import { getSenderoDb } from "@/lib/db/d1";

/**
 * Data for the "Percurso" part of Início: real progress indicators built only
 * from stored records (no invented numbers). Every query runs in parallel so the
 * page pays a single round of D1 latency.
 */

export type PracticeGroupCode = "ED" | "PSYCHOLOGY" | "HABIT";

export type PercursoData = {
  today: { groups: Array<{ code: PracticeGroupCode; done: number; total: number; ratio: number }> };
  strength: Array<{ code: PracticeGroupCode; value: number | null; delta: number | null }>;
  heatmap: { weeks: Array<Array<{ date: string; level: number; future: boolean }>>; monthLabels: Array<{ column: number; label: string }>; presentDays30: number };
  constancy: { quickReturns: number; longPauses: number };
  compare: { day: number; currentMonth: string; previousMonth: string; rows: Array<{ label: string; now: number; before: number; unit?: "ml" }> };
  monthly: Array<{ month: string; label: string; count: number; partial: boolean }>;
  coherence: { reflectionTasks: number; reflectionTasksDone: number; adThisMonth: number };
  milestones: Array<{ label: string; current: number; target: number }>;
  memory: { date: string; topic: string; excerpt: string } | null;
};

type HabitRow = { id: string; title: string; cadence: string; targetCount: number; groupCode: string | null };
type LogRow = { habitId: string; date: string; count: number };

const HEATMAP_WEEKS = 26;
const STRENGTH_HISTORY_DAYS = 150;
// Loop Habit Tracker's daily multiplier: a day counts for half after ~13 days.
const STRENGTH_DECAY = Math.pow(0.5, 1 / 13);
const DIARY_HABIT_TITLE = "escrever o diário";

export async function getPercursoData(userId: string, todayKey: string): Promise<PercursoData> {
  const db = getSenderoDb();
  const heatmapStart = addDays(startOfWeek(todayKey), -(HEATMAP_WEEKS - 1) * 7);
  const historyStart = minKey(addDays(todayKey, -STRENGTH_HISTORY_DAYS), heatmapStart);
  const monthlyStart = `${shiftMonth(todayKey.slice(0, 7), -6)}-01`;
  const previousMonth = shiftMonth(todayKey.slice(0, 7), -1);
  const day = Number(todayKey.slice(8, 10));
  const previousEnd = `${previousMonth}-${String(Math.min(day, daysInMonth(previousMonth))).padStart(2, "0")}`;
  const currentStart = `${todayKey.slice(0, 7)}-01`;

  const [habits, logs, reflectionDays, diaryDays, waterDays, monthly, totals, compareRows, tasks, memory] = await Promise.all([
    db.prepare(`
      SELECT ht.id, ht.title, ht.cadence, ht.targetCount, pg.code AS groupCode
      FROM "HabitTemplate" ht
      LEFT JOIN "HabitPracticeGroup" hpg ON hpg.habitId = ht.id
      LEFT JOIN "PracticeGroup" pg ON pg.id = hpg.groupId
      WHERE ht.userId = ? AND ht.isActive = 1
    `).bind(userId).all<HabitRow>(),
    db.prepare('SELECT habitId, substr(date, 1, 10) AS date, count FROM "HabitLog" WHERE userId = ? AND date >= ?').bind(userId, historyStart).all<LogRow>(),
    db.prepare('SELECT substr(date, 1, 10) AS date, COUNT(*) AS n FROM "ReflectionEntry" WHERE userId = ? AND date >= ? GROUP BY 1').bind(userId, historyStart).all<{ date: string; n: number }>(),
    db.prepare('SELECT substr(date, 1, 10) AS date FROM "DiaryEntry" WHERE userId = ? AND date >= ?').bind(userId, historyStart).all<{ date: string }>(),
    db.prepare('SELECT substr(date, 1, 10) AS date FROM "WaterLog" WHERE userId = ? AND date >= ? GROUP BY 1').bind(userId, heatmapStart).all<{ date: string }>(),
    db.prepare('SELECT substr(date, 1, 7) AS month, COUNT(*) AS n FROM "ReflectionEntry" WHERE userId = ? AND date >= ? GROUP BY 1').bind(userId, monthlyStart).all<{ month: string; n: number }>(),
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM "ReflectionEntry" WHERE userId = ?1) AS reflections,
        (SELECT COUNT(*) FROM "DiaryEntry" WHERE userId = ?1) AS diaries,
        (SELECT COUNT(*) FROM "ADReflection" WHERE userId = ?1 AND substr(date, 1, 7) = ?2) AS adThisMonth
    `).bind(userId, todayKey.slice(0, 7)).first<{ reflections: number; diaries: number; adThisMonth: number }>(),
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM "ReflectionEntry" WHERE userId = ?1 AND date >= ?2 AND substr(date, 1, 10) <= ?3) AS reflectionsNow,
        (SELECT COUNT(*) FROM "ReflectionEntry" WHERE userId = ?1 AND date >= ?4 AND substr(date, 1, 10) <= ?5) AS reflectionsBefore,
        (SELECT COUNT(*) FROM "DiaryEntry" WHERE userId = ?1 AND date >= ?2 AND substr(date, 1, 10) <= ?3) AS diariesNow,
        (SELECT COUNT(*) FROM "DiaryEntry" WHERE userId = ?1 AND date >= ?4 AND substr(date, 1, 10) <= ?5) AS diariesBefore,
        (SELECT COUNT(*) FROM "HabitLog" WHERE userId = ?1 AND date >= ?2 AND substr(date, 1, 10) <= ?3) AS practicesNow,
        (SELECT COUNT(*) FROM "HabitLog" WHERE userId = ?1 AND date >= ?4 AND substr(date, 1, 10) <= ?5) AS practicesBefore,
        (SELECT COALESCE(SUM(amountMl), 0) FROM "WaterLog" WHERE userId = ?1 AND date >= ?2 AND substr(date, 1, 10) <= ?3) AS waterNow,
        (SELECT COALESCE(SUM(amountMl), 0) FROM "WaterLog" WHERE userId = ?1 AND date >= ?4 AND substr(date, 1, 10) <= ?5) AS waterBefore
    `).bind(userId, currentStart, todayKey, `${previousMonth}-01`, previousEnd).first<Record<string, number>>(),
    db.prepare('SELECT COUNT(*) AS total, COUNT(completedAt) AS done FROM "TaskOccurrence" WHERE userId = ? AND originType = \'REFLECTION\'').bind(userId).first<{ total: number; done: number }>(),
    db.prepare(`
      SELECT substr(re.date, 1, 10) AS date, rt.topic, re.contentText
      FROM "ReflectionEntry" re JOIN "ReflectionTemplate" rt ON rt.id = re.templateId
      WHERE re.userId = ? AND substr(re.date, 1, 10) BETWEEN ? AND ? AND length(trim(re.contentText)) >= 60
      ORDER BY abs(julianday(substr(re.date, 1, 10)) - julianday(?)) ASC, length(re.contentText) DESC
      LIMIT 1
    `).bind(userId, addDays(todayKey, -100), addDays(todayKey, -80), addDays(todayKey, -90)).first<{ date: string; topic: string; contentText: string }>(),
  ]);

  const habitRows = habits.results;
  const logRows = withDiaryAsHabit(habitRows, logs.results, diaryDays.results.map((row) => row.date));
  const activity = new Map<string, number>();
  const bump = (date: string, amount: number) => activity.set(date, (activity.get(date) ?? 0) + amount);
  reflectionDays.results.forEach((row) => bump(row.date, Number(row.n)));
  diaryDays.results.forEach((row) => bump(row.date, 1));
  logs.results.forEach((row) => { if (Number(row.count) > 0) bump(row.date, 1); });
  waterDays.results.forEach((row) => bump(row.date, 1));

  const compare = compareRows ?? {};
  return {
    today: { groups: GROUPS.map((code) => todayProgress(code, habitRows, logRows, todayKey)) },
    strength: GROUPS.map((code) => {
      const now = groupStrength(code, habitRows, logRows, historyStart, todayKey);
      const before = groupStrength(code, habitRows, logRows, historyStart, addDays(todayKey, -30));
      return { code, value: now, delta: now === null || before === null ? null : now - before };
    }),
    heatmap: buildHeatmap(activity, heatmapStart, todayKey),
    constancy: constancy(edPresence(habitRows, logRows), todayKey),
    compare: {
      day, currentMonth: todayKey.slice(0, 7), previousMonth,
      rows: [
        { label: "Reflexões", now: Number(compare.reflectionsNow ?? 0), before: Number(compare.reflectionsBefore ?? 0) },
        { label: "Diários", now: Number(compare.diariesNow ?? 0), before: Number(compare.diariesBefore ?? 0) },
        { label: "Práticas registradas", now: Number(compare.practicesNow ?? 0), before: Number(compare.practicesBefore ?? 0) },
        { label: "Água", now: Number(compare.waterNow ?? 0), before: Number(compare.waterBefore ?? 0), unit: "ml" },
      ],
    },
    monthly: Array.from({ length: 7 }, (_, index) => {
      const month = shiftMonth(todayKey.slice(0, 7), index - 6);
      return { month, label: monthLabel(month), count: Number(monthly.results.find((row) => row.month === month)?.n ?? 0), partial: index === 6 };
    }),
    coherence: { reflectionTasks: Number(tasks?.total ?? 0), reflectionTasksDone: Number(tasks?.done ?? 0), adThisMonth: Number(totals?.adThisMonth ?? 0) },
    milestones: [
      nextMilestone("reflexões", Number(totals?.reflections ?? 0), 50),
      nextMilestone("diários", Number(totals?.diaries ?? 0), 25),
    ],
    memory: memory ? { date: memory.date, topic: memory.topic, excerpt: excerpt(memory.contentText) } : null,
  };
}

const GROUPS: PracticeGroupCode[] = ["ED", "PSYCHOLOGY", "HABIT"];

function groupOf(habit: HabitRow): PracticeGroupCode {
  return habit.groupCode === "ED" || habit.groupCode === "PSYCHOLOGY" ? habit.groupCode : "HABIT";
}

function dailyHabits(code: PracticeGroupCode, habits: HabitRow[]) {
  return habits.filter((habit) => groupOf(habit) === code && habit.cadence === "DAILY");
}

/** A saved diary entry counts as the "Escrever o Diário" practice, so it never needs a second tap. */
export function withDiaryAsHabit(habits: HabitRow[], logs: LogRow[], diaryDates: string[]): LogRow[] {
  const diaryHabit = habits.find((habit) => habit.title.trim().toLocaleLowerCase("pt-BR") === DIARY_HABIT_TITLE);
  if (!diaryHabit) return logs;
  const logged = new Set(logs.filter((log) => log.habitId === diaryHabit.id && Number(log.count) > 0).map((log) => log.date));
  return [...logs, ...diaryDates.filter((date) => !logged.has(date)).map((date) => ({ habitId: diaryHabit.id, date, count: 1 }))];
}

function completionByDay(habits: HabitRow[], logs: LogRow[]) {
  const targets = new Map(habits.map((habit) => [habit.id, Math.max(1, Number(habit.targetCount) || 1)]));
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (!targets.has(log.habitId)) continue;
    const key = `${log.habitId}|${log.date}`;
    counts.set(key, (counts.get(key) ?? 0) + Number(log.count || 0));
  }
  return (date: string) => {
    if (!habits.length) return 0;
    let sum = 0;
    for (const habit of habits) sum += Math.min(1, (counts.get(`${habit.id}|${date}`) ?? 0) / targets.get(habit.id)!);
    return sum / habits.length;
  };
}

export function todayProgress(code: PracticeGroupCode, habits: HabitRow[], logs: LogRow[], todayKey: string) {
  const group = dailyHabits(code, habits);
  const targets = new Map(group.map((habit) => [habit.id, Math.max(1, Number(habit.targetCount) || 1)]));
  const counts = new Map<string, number>();
  logs.filter((log) => log.date === todayKey && targets.has(log.habitId)).forEach((log) => counts.set(log.habitId, (counts.get(log.habitId) ?? 0) + Number(log.count || 0)));
  const done = group.filter((habit) => (counts.get(habit.id) ?? 0) >= targets.get(habit.id)!).length;
  return { code, done, total: group.length, ratio: completionByDay(group, logs)(todayKey) };
}

/** Habit strength 0–100 (exponential smoothing of daily completion), or null when the group has no daily practice. */
export function groupStrength(code: PracticeGroupCode, habits: HabitRow[], logs: LogRow[], fromKey: string, toKey: string): number | null {
  const group = dailyHabits(code, habits);
  if (!group.length) return null;
  const completion = completionByDay(group, logs);
  let score = 0;
  for (let date = fromKey; date <= toKey; date = addDays(date, 1)) score = score * STRENGTH_DECAY + (1 - STRENGTH_DECAY) * completion(date);
  return Math.round(score * 100);
}

function edPresence(habits: HabitRow[], logs: LogRow[]) {
  const ed = new Set(habits.filter((habit) => groupOf(habit) === "ED").map((habit) => habit.id));
  return new Set(logs.filter((log) => ed.has(log.habitId) && Number(log.count) > 0).map((log) => log.date));
}

/**
 * "Never miss twice": in the last 30 days, how often practice came back right
 * after a single missed day, and how many gaps lasted two days or more.
 */
export function constancy(presence: Set<string>, todayKey: string) {
  let quickReturns = 0;
  let longPauses = 0;
  let gap = 0;
  let seenPresence = false;
  for (let date = addDays(todayKey, -29); date <= todayKey; date = addDays(date, 1)) {
    if (presence.has(date)) {
      if (seenPresence && gap === 1) quickReturns += 1;
      if (seenPresence && gap >= 2) longPauses += 1;
      gap = 0;
      seenPresence = true;
    } else if (date !== todayKey) {
      gap += 1;
    }
  }
  if (seenPresence && gap >= 2) longPauses += 1;
  return { quickReturns, longPauses };
}

export function buildHeatmap(activity: Map<string, number>, startKey: string, todayKey: string) {
  const weeks: PercursoData["heatmap"]["weeks"] = [];
  const monthLabels: PercursoData["heatmap"]["monthLabels"] = [];
  let lastMonth = "";
  for (let week = 0; week < HEATMAP_WEEKS; week += 1) {
    const days = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addDays(startKey, week * 7 + weekday);
      const n = activity.get(date) ?? 0;
      days.push({ date, level: n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 8 ? 3 : 4, future: date > todayKey });
    }
    const month = days[0].date.slice(0, 7);
    if (month !== lastMonth) {
      monthLabels.push({ column: week, label: monthLabel(month) });
      lastMonth = month;
    }
    weeks.push(days);
  }
  let presentDays30 = 0;
  for (let date = addDays(todayKey, -29); date <= todayKey; date = addDays(date, 1)) if ((activity.get(date) ?? 0) > 0) presentDays30 += 1;
  return { weeks, monthLabels, presentDays30 };
}

function nextMilestone(label: string, current: number, step: number) {
  const target = (Math.floor(current / step) + 1) * step;
  return { label: `${target} ${label}`, current, target };
}

function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 240) return clean;
  const cut = clean.lastIndexOf(" ", 240);
  return `${clean.slice(0, cut > 160 ? cut : 240)}…`;
}

// Date helpers on YYYY-MM-DD keys (calendar math in UTC, keys already in São Paulo time).
export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey: string) {
  const weekday = (new Date(`${dateKey}T12:00:00.000Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(dateKey, -weekday);
}

function minKey(a: string, b: string) {
  return a < b ? a : b;
}

function shiftMonth(monthKey: string, delta: number) {
  const date = new Date(`${monthKey}-15T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${monthKey}-15T12:00:00.000Z`)).replace(".", "");
}
