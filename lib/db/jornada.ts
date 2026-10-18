import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { addDays, withDiaryAsHabit } from "@/lib/db/percurso";
import { waterGoal } from "@/lib/habit-streak";
import { daysInMonth, stageOf, type CycleField } from "@/lib/jornada-shared";

/**
 * Jornada: one labor of a myth per month, through the seven stages of the
 * hero's journey. A month's cycle opens by itself on the first visit; the next
 * labor follows the fixed order of the myths, unless the last one was marked
 * to be lived again. Stones of the path are counted from the real records.
 */

export type JourneyLabor = { id: string; mythId: string; position: number; title: string; story: string; symbol: string; question: string };
export type JourneyMyth = { id: string; position: number; hero: string; title: string; tradition: string | null; summary: string; labors: JourneyLabor[] };
export type JourneyCycle = {
  id: string; laborId: string; month: string; startDate: string;
  monster: string | null; master: string | null; abyss: string | null; elixir: string | null;
  outcome: "CUMPRIDO" | "REPETIR" | null; closedAt: string | null;
};
export type Fall = { from: string; to: string; back: string | null };
export type Stone = { value: string; label: string; next?: boolean; tone?: "water" };
export type PathStation = { labor: JourneyLabor; state: "done" | "now" | "lived" | "ahead"; times: number; elixir: string | null; closedMonth: string | null };

type JourneyCommon = { labor: JourneyLabor; myth: JourneyMyth; path: PathStation[]; myths: JourneyMyth[]; stones: Stone[] };
/** Before the start day the Jornada is a prologue: the first labor and the myths can be read, nothing is lived yet. */
export type JourneyData = JourneyCommon & ({ prelude: string } | {
  prelude: null;
  cycle: JourneyCycle;
  stage: ReturnType<typeof stageOf>;
  weapons: Array<{ id: string; title: string; days: boolean[] }>;
  falls: Fall[];
  witness: { days: number; practiceDays: number; diaries: number; reflections: number };
  pendingReturns: Array<{ cycle: JourneyCycle; labor: JourneyLabor }>;
});

type CycleRow = JourneyCycle & { userId: string };
type HabitRow = { id: string; title: string; cadence: string; targetCount: number; groupCode: string | null };

const CYCLE_FIELDS: CycleField[] = ["monster", "master", "abyss", "elixir"];
const MAX_TEXT = 20_000;

async function loadMyths(): Promise<JourneyMyth[]> {
  const db = getSenderoDb();
  const [myths, labors] = await Promise.all([
    db.prepare('SELECT id, position, hero, title, tradition, summary FROM "JourneyMyth" ORDER BY position').all<Omit<JourneyMyth, "labors">>(),
    db.prepare('SELECT id, mythId, position, title, story, symbol, question FROM "JourneyLabor" ORDER BY position').all<JourneyLabor>(),
  ]);
  return myths.results.map((myth) => ({ ...myth, labors: labors.results.filter((labor) => labor.mythId === myth.id) }));
}

/** The labor after `laborId` in the fixed order; after the last myth, the journey starts over. */
function nextLabor(myths: JourneyMyth[], laborId: string | null) {
  const order = myths.flatMap((myth) => myth.labors);
  if (!laborId) return order[0];
  const index = order.findIndex((labor) => labor.id === laborId);
  return order[(index + 1) % order.length];
}

const isEmpty = (cycle: JourneyCycle) => !cycle.outcome && CYCLE_FIELDS.every((field) => !cycle[field]);

/** The day the journey begins (NULL: on the first visit). */
async function journeyStart(userId: string) {
  const row = await getSenderoDb().prepare('SELECT journeyStart FROM "User" WHERE id = ?').bind(userId).first<{ journeyStart: string | null }>();
  return row?.journeyStart ?? null;
}

/** This month's cycle, opened on the first visit of the month; none before the start day. */
async function ensureCycle(userId: string, todayKey: string, myths: JourneyMyth[], start: string | null) {
  if (start && todayKey < start) return null;
  const db = getSenderoDb();
  const month = todayKey.slice(0, 7);
  const find = () => db.prepare('SELECT * FROM "JourneyCycle" WHERE userId = ? AND month = ?').bind(userId, month).first<CycleRow>();
  const existing = await find();
  if (existing) return existing;
  const last = await db.prepare('SELECT * FROM "JourneyCycle" WHERE userId = ? AND month < ? ORDER BY month DESC LIMIT 1').bind(userId, month).first<CycleRow>();
  const labor = last?.outcome === "REPETIR" ? myths.flatMap((myth) => myth.labors).find((item) => item.id === last.laborId) : nextLabor(myths, last?.laborId ?? null);
  if (!labor) throw new Error("Os mitos da Jornada ainda não foram cadastrados.");
  const now = new Date().toISOString();
  // Cycles take the whole month; only a first cycle with no start day set begins on the day it opens.
  const startDate = last ? `${month}-01` : start && start.slice(0, 7) === month ? start : todayKey;
  await db.prepare('INSERT OR IGNORE INTO "JourneyCycle" (id, userId, laborId, month, startDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(`cycle_${crypto.randomUUID()}`, userId, labor.id, month, startDate, now, now).run();
  return (await find())!;
}

export async function getJourney(userId: string, todayKey: string): Promise<JourneyData> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const [myths, start] = await Promise.all([loadMyths(), journeyStart(userId)]);
  const cycle = await ensureCycle(userId, todayKey, myths, start);
  if (!cycle) {
    const [myth] = myths;
    const ahead = (labor: JourneyLabor): PathStation => ({ labor, state: "ahead", times: 0, elixir: null, closedMonth: null });
    return { prelude: start!, labor: myth.labors[0], myth, path: myth.labors.map(ahead), myths, stones: await getStones(userId, todayKey) };
  }
  const labors = myths.flatMap((myth) => myth.labors);
  const labor = labors.find((item) => item.id === cycle.laborId)!;
  const myth = myths.find((item) => item.id === labor.mythId)!;
  const monthEnd = `${cycle.month}-${String(daysInMonth(cycle.month)).padStart(2, "0")}`;
  const windowEnd = todayKey < monthEnd ? todayKey : monthEnd;
  const weekStart = addDays(todayKey, -6);
  const from = cycle.startDate < weekStart ? cycle.startDate : weekStart;

  const [cycles, habits, logs, diaryDays, reflections, stones] = await Promise.all([
    db.prepare('SELECT * FROM "JourneyCycle" WHERE userId = ? ORDER BY month').bind(userId).all<CycleRow>(),
    db.prepare(`
      SELECT ht.id, ht.title, ht.cadence, ht.targetCount, pg.code AS groupCode
      FROM "HabitTemplate" ht
      JOIN "HabitPracticeGroup" hpg ON hpg.habitId = ht.id
      JOIN "PracticeGroup" pg ON pg.id = hpg.groupId
      WHERE ht.userId = ? AND ht.isActive = 1 AND pg.code = 'ED'
      ORDER BY ht.createdAt, ht.title
    `).bind(userId).all<HabitRow>(),
    db.prepare('SELECT habitId, substr(date, 1, 10) AS date, count FROM "HabitLog" WHERE userId = ? AND date >= ?').bind(userId, from).all<{ habitId: string; date: string; count: number }>(),
    db.prepare('SELECT DISTINCT substr(date, 1, 10) AS date FROM "DiaryEntry" WHERE userId = ? AND date >= ?').bind(userId, from).all<{ date: string }>(),
    db.prepare('SELECT COUNT(*) AS n FROM "ReflectionEntry" WHERE userId = ? AND date >= ? AND substr(date, 1, 10) <= ?').bind(userId, cycle.startDate, windowEnd).first<{ n: number }>(),
    getStones(userId, todayKey),
  ]);

  const edIds = new Set(habits.results.map((habit) => habit.id));
  const diaryDates = diaryDays.results.map((row) => row.date);
  const allLogs = withDiaryAsHabit(habits.results, logs.results.filter((log) => edIds.has(log.habitId)), diaryDates);
  const presence = new Set([...allLogs.filter((log) => Number(log.count) > 0).map((log) => log.date), ...diaryDates]);
  const counts = new Map<string, number>();
  for (const log of allLogs) counts.set(`${log.habitId}|${log.date}`, (counts.get(`${log.habitId}|${log.date}`) ?? 0) + Number(log.count || 0));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(todayKey, index - 6));

  const inWindow = (date: string) => date >= cycle.startDate && date <= windowEnd;
  const doneIds = new Set(cycles.results.filter((item) => item.outcome === "CUMPRIDO").map((item) => item.laborId));
  return {
    prelude: null,
    cycle: pick(cycle),
    labor,
    myth,
    stage: stageOf(cycle.startDate, todayKey),
    weapons: habits.results.filter((habit) => habit.cadence === "DAILY").map((habit) => ({
      id: habit.id, title: habit.title,
      days: weekDays.map((date) => (counts.get(`${habit.id}|${date}`) ?? 0) >= Math.max(1, Number(habit.targetCount) || 1)),
    })),
    falls: findFalls(presence, cycle.startDate, todayKey < monthEnd ? addDays(todayKey, -1) : monthEnd),
    witness: {
      days: Math.max(0, dayDiff(cycle.startDate, windowEnd) + 1),
      practiceDays: [...presence].filter(inWindow).length,
      diaries: diaryDates.filter(inWindow).length,
      reflections: Number(reflections?.n ?? 0),
    },
    path: myth.labors.map((item) => {
      const lived = cycles.results.filter((row) => row.laborId === item.id);
      const withElixir = [...lived].reverse().find((row) => row.elixir);
      const state = item.id === labor.id && !cycle.outcome ? "now" : doneIds.has(item.id) ? "done" : lived.length ? "lived" : "ahead";
      return { labor: item, state, times: lived.length, elixir: withElixir?.elixir ?? null, closedMonth: [...lived].reverse().find((row) => row.closedAt)?.month ?? null };
    }),
    pendingReturns: cycles.results.filter((row) => row.month < cycle.month && !row.outcome).map((row) => ({ cycle: pick(row), labor: labors.find((item) => item.id === row.laborId)! })),
    myths,
    stones,
  };
}

function pick(row: CycleRow): JourneyCycle {
  return { id: row.id, laborId: row.laborId, month: row.month, startDate: row.startDate, monster: row.monster, master: row.master, abyss: row.abyss, elixir: row.elixir, outcome: row.outcome, closedAt: row.closedAt };
}

/** Two days or more without any ED practice inside the cycle, and the day the practice came back. */
export function findFalls(presence: Set<string>, startKey: string, endKey: string): Fall[] {
  const falls: Fall[] = [];
  let gapStart: string | null = null;
  for (let date = startKey; date <= endKey; date = addDays(date, 1)) {
    if (presence.has(date)) {
      if (gapStart && dayDiff(gapStart, date) >= 2) falls.push({ from: gapStart, to: addDays(date, -1), back: date });
      gapStart = null;
    } else {
      gapStart ??= date;
    }
  }
  if (gapStart && dayDiff(gapStart, endKey) + 1 >= 2) falls.push({ from: gapStart, to: endKey, back: null });
  return falls;
}

function dayDiff(fromKey: string, toKey: string) {
  return Math.round((Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / 86_400_000);
}

export async function saveCycleText(userId: string, input: Record<string, unknown>) {
  await ensureSenderoSeeded();
  const field = input.field as CycleField;
  if (typeof input.id !== "string" || !CYCLE_FIELDS.includes(field)) throw new Error("Campo da Jornada não reconhecido.");
  const text = typeof input.text === "string" ? input.text.trim().slice(0, MAX_TEXT) : "";
  const result = await getSenderoDb().prepare(`UPDATE "JourneyCycle" SET ${field} = ?, updatedAt = ? WHERE id = ? AND userId = ?`)
    .bind(text || null, new Date().toISOString(), input.id, userId).run();
  if (!result.meta.changes) throw new Error("Trabalho não encontrado.");
}

/** Closes a cycle. If the following month already opened and nothing was written there yet, its labor follows this choice. */
export async function closeCycle(userId: string, input: Record<string, unknown>) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const outcome = input.outcome === "REPETIR" ? "REPETIR" : input.outcome === "CUMPRIDO" ? "CUMPRIDO" : null;
  if (typeof input.id !== "string" || !outcome) throw new Error("Escolha como fechar o trabalho.");
  const cycle = await db.prepare('SELECT * FROM "JourneyCycle" WHERE id = ? AND userId = ?').bind(input.id, userId).first<CycleRow>();
  if (!cycle) throw new Error("Trabalho não encontrado.");
  const now = new Date().toISOString();
  await db.prepare('UPDATE "JourneyCycle" SET outcome = ?, closedAt = ?, updatedAt = ? WHERE id = ?').bind(outcome, now, now, cycle.id).run();
  const following = await db.prepare('SELECT * FROM "JourneyCycle" WHERE userId = ? AND month > ? ORDER BY month LIMIT 1').bind(userId, cycle.month).first<CycleRow>();
  if (following && isEmpty(following)) {
    const laborId = outcome === "REPETIR" ? cycle.laborId : nextLabor(await loadMyths(), cycle.laborId).id;
    if (laborId !== following.laborId) await db.prepare('UPDATE "JourneyCycle" SET laborId = ?, updatedAt = ? WHERE id = ?').bind(laborId, now, following.id).run();
  }
}

/** For Início: the labor of the month and the stones reached today. */
export async function getJourneyCard(userId: string, todayKey: string) {
  await ensureSenderoSeeded();
  const [myths, start] = await Promise.all([loadMyths(), journeyStart(userId)]);
  const cycle = await ensureCycle(userId, todayKey, myths, start);
  const marks = await todayMarks(userId, todayKey);
  if (!cycle) return { prelude: start!, hero: myths[0].hero, mythTitle: myths[0].title, labor: myths[0].labors[0].title, position: 1, total: myths[0].labors.length, monster: null, stage: null, marks };
  const labor = myths.flatMap((myth) => myth.labors).find((item) => item.id === cycle.laborId)!;
  const myth = myths.find((item) => item.id === labor.mythId)!;
  if (cycle.startDate === todayKey) marks.unshift(`começa ${labor.title.replace(/^(O|A|Os|As) /, (article) => article.toLocaleLowerCase("pt-BR"))}`);
  return { prelude: null, hero: myth.hero, mythTitle: myth.title, labor: labor.title, position: labor.position, total: myth.labors.length, monster: cycle.monster, stage: stageOf(cycle.startDate, todayKey), marks };
}

const reflectionStone = (n: number) => n === 1 || n % 100 === 0;
const diaryStone = (n: number) => n === 1 || n === 10 || n === 25 || n % 50 === 0;

async function counts(userId: string, todayKey: string) {
  const db = getSenderoDb();
  const [totals, reflectionDays, diaryDays, waterDays, user] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM "ReflectionEntry" WHERE userId = ?1) AS reflections,
        (SELECT COUNT(*) FROM "ReflectionEntry" WHERE userId = ?1 AND substr(date, 1, 10) = ?2) AS reflectionsToday,
        (SELECT COUNT(DISTINCT templateId) FROM "ReflectionEntry" WHERE userId = ?1) AS themes,
        (SELECT COALESCE(SUM(reflectionTimeSeconds), 0) FROM "ReflectionEntry" WHERE userId = ?1) AS seconds,
        (SELECT COUNT(*) FROM "DiaryEntry" WHERE userId = ?1) AS diaries,
        (SELECT COUNT(*) FROM "DiaryEntry" WHERE userId = ?1 AND substr(date, 1, 10) = ?2) AS diariesToday
    `).bind(userId, todayKey).first<Record<string, number>>(),
    db.prepare('SELECT DISTINCT substr(date, 1, 10) AS date FROM "ReflectionEntry" WHERE userId = ? ORDER BY 1').bind(userId).all<{ date: string }>(),
    db.prepare('SELECT DISTINCT substr(date, 1, 10) AS date FROM "DiaryEntry" WHERE userId = ? ORDER BY 1').bind(userId).all<{ date: string }>(),
    db.prepare('SELECT substr(date, 1, 10) AS date, SUM(amountMl) AS ml FROM "WaterLog" WHERE userId = ? GROUP BY 1 ORDER BY 1').bind(userId).all<{ date: string; ml: number }>(),
    db.prepare('SELECT weightKg, waterMlPerKg, waterGoalMl FROM "User" WHERE id = ?').bind(userId).first<{ weightKg: number | null; waterMlPerKg: number | null; waterGoalMl: number | null }>(),
  ]);
  const goal = waterGoal(user ?? {});
  return {
    reflections: Number(totals?.reflections ?? 0), reflectionsToday: Number(totals?.reflectionsToday ?? 0),
    themes: Number(totals?.themes ?? 0), seconds: Number(totals?.seconds ?? 0),
    diaries: Number(totals?.diaries ?? 0), diariesToday: Number(totals?.diariesToday ?? 0),
    reflectionDates: reflectionDays.results.map((row) => row.date), diaryDates: diaryDays.results.map((row) => row.date),
    water: waterDays.results.map((row) => ({ date: row.date, ml: Number(row.ml) })), goal,
  };
}

/** Stones reached with today's records: a round number of reflections or diaries, or the first day at the water goal. */
async function todayMarks(userId: string, todayKey: string) {
  const data = await counts(userId, todayKey);
  const marks: string[] = [];
  for (let n = data.reflections - data.reflectionsToday + 1; n <= data.reflections; n += 1) if (reflectionStone(n)) marks.push(`a ${n.toLocaleString("pt-BR")}ª reflexão`);
  for (let n = data.diaries - data.diariesToday + 1; n <= data.diaries; n += 1) if (diaryStone(n)) marks.push(n === 1 ? "o primeiro Diário" : `o ${n}º Diário`);
  if (data.water.find((day) => day.ml >= data.goal)?.date === todayKey) marks.push(`o primeiro dia com ${liters(data.goal)} de água`);
  return marks;
}

export async function getStones(userId: string, todayKey: string): Promise<Stone[]> {
  const data = await counts(userId, todayKey);
  const stones: Stone[] = [];
  if (data.reflections) stones.push({ value: data.reflections.toLocaleString("pt-BR"), label: `reflexões desde ${shortDate(data.reflectionDates[0])}` });
  if (data.themes) stones.push({ value: String(data.themes), label: "temas diferentes refletidos" });
  const reflectionRun = longestRun(data.reflectionDates);
  if (reflectionRun.length >= 2) stones.push({ value: `${reflectionRun.length} dias`, label: `seguidos refletindo, de ${shortDate(reflectionRun.from)} a ${shortDate(reflectionRun.to)}` });
  if (data.diaries) stones.push({ value: String(data.diaries), label: `Diários desde ${shortDate(data.diaryDates[0])}` });
  const diaryRun = longestRun(data.diaryDates);
  if (diaryRun.length >= 2) stones.push({ value: `${diaryRun.length} dias`, label: `seguidos com Diário, de ${shortDate(diaryRun.from)} a ${shortDate(diaryRun.to)}` });
  if (data.seconds >= 3600) stones.push({ value: `${Math.floor(data.seconds / 3600)} h`, label: "de reflexão cronometrada" });
  const bestWater = data.water.reduce<{ date: string; ml: number } | null>((best, day) => (!best || day.ml > best.ml ? day : best), null);
  const atGoal = data.water.filter((day) => day.ml >= data.goal).length;
  if (atGoal) stones.push({ value: String(atGoal), label: `dia${atGoal === 1 ? "" : "s"} com ${liters(data.goal)} de água`, tone: "water" });
  else if (bestWater) stones.push({ value: liters(bestWater.ml), label: `o dia com mais água, em ${shortDate(bestWater.date)}`, tone: "water" });

  const nextReflection = data.reflections < 1 ? 1 : (Math.floor(data.reflections / 100) + 1) * 100;
  stones.push({ value: `${nextReflection.toLocaleString("pt-BR")}ª reflexão`, label: `faltam ${nextReflection - data.reflections}`, next: true });
  let nextDiary = data.diaries + 1;
  while (!diaryStone(nextDiary)) nextDiary += 1;
  stones.push({ value: `${nextDiary}º Diário`, label: `faltam ${nextDiary - data.diaries}`, next: true });
  if (!atGoal) stones.push({ value: `Primeiro dia com ${liters(data.goal)}`, label: "a sua meta de água", next: true, tone: "water" });
  return stones;
}

export function longestRun(dates: string[]) {
  let best = { length: 0, from: "", to: "" };
  let start = "";
  let length = 0;
  let previous = "";
  for (const date of dates) {
    if (previous && addDays(previous, 1) === date) length += 1;
    else { start = date; length = 1; }
    if (length > best.length) best = { length, from: start, to: date };
    previous = date;
  }
  return best;
}

function liters(ml: number) {
  return `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
}

function shortDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`)).replace(".", "").replace(" de ", " ");
}

export type JourneyCardData = Awaited<ReturnType<typeof getJourneyCard>>;
