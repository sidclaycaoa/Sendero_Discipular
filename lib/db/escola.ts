import { getSaoPauloDateKey } from "@/lib/date";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { createMemorizationText } from "@/lib/db/memorizacao";
import { createMasterQuestion } from "@/lib/db/pendencias";
import { createHabitTemplate } from "@/lib/db/sendero";
import { bastiaoLabel, MAX_LIVE_IDEAS } from "@/lib/escola-shared";
import { addDays, streaks, weekStart } from "@/lib/habit-streak";

/**
 * Escola: the Bastião is weekly (the masters' text of the week, read on its
 * site); a monthly class may assign one, and asks for practices to live until
 * the next class. Key ideas of the week's Bastiões (up to three) are lived
 * every day; practices point to habits and keep the points to bring back.
 */

export type Idea = { id: string; text: string; live: boolean; doneToday: boolean; last7: Array<0 | 1>; daysLived: number };
export type Bastiao = { id: string; weekStart: string; fromClass: boolean; number: number | null; name: string; read: boolean; notes: string; reflection: string; ideas: Idea[] };
export type ClassPractice = { id: string; habitId: string | null; title: string; points: string; doneToday: boolean | null; last7: Array<0 | 1> | null };
export type SchoolClass = { id: string; date: string; title: string; notes: string; closing: string; bastioes: Bastiao[]; practices: ClassPractice[]; until: string | null };
export type LiveIdea = { id: string; text: string; bastiao: string; doneToday: boolean; last7: Array<0 | 1> };
export type BastiaoSummary = { id: string; weekStart: string; number: number | null; name: string; read: boolean; fromClass: boolean; ideas: number };

const MAX_TEXT = 20_000;
const text = (value: unknown, max = MAX_TEXT) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const lastDays = (today: string) => Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

type ClassRow = { id: string; date: string; title: string | null; notes: string | null; closing: string | null };
type BastiaoRow = { id: string; weekStart: string | null; classId: string | null; number: number | null; name: string; readAt: string | null; notes: string | null; reflection: string | null; createdAt: string };
type IdeaRow = { id: string; bastiaoId: string; text: string; live: number };

async function own(table: string, id: string, userId: string) {
  const row = await getSenderoDb().prepare(`SELECT id FROM "${table}" WHERE id = ? AND userId = ?`).bind(id, userId).first();
  if (!row) throw new Error("Item não encontrado.");
}

/** The class in course: the latest one up to today. */
async function currentClassId(userId: string, today: string) {
  const row = await getSenderoDb().prepare('SELECT id FROM "SchoolClass" WHERE userId = ? AND date <= ? ORDER BY date DESC, createdAt DESC LIMIT 1').bind(userId, today).first<{ id: string }>();
  return row?.id ?? null;
}

/** Bastiões matching a condition, with their ideas and the last 7 days each idea was lived. */
async function loadBastioes(userId: string, where: string, params: string[], today: string): Promise<Bastiao[]> {
  const db = getSenderoDb();
  const rows = (await db.prepare(`SELECT id, weekStart, classId, number, name, readAt, notes, reflection, createdAt FROM "Bastiao" WHERE userId = ? AND (${where}) ORDER BY weekStart, COALESCE(number, 999999), createdAt`)
    .bind(userId, ...params).all<BastiaoRow>()).results;
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const marks = ids.map(() => "?").join(",");
  const days = lastDays(today);
  const [ideas, logs] = await Promise.all([
    db.prepare(`SELECT id, bastiaoId, text, live FROM "BastiaoIdea" WHERE bastiaoId IN (${marks}) ORDER BY position, createdAt`).bind(...ids).all<IdeaRow>(),
    db.prepare(`SELECT l.ideaId, l.date FROM "IdeaLog" l JOIN "BastiaoIdea" i ON i.id = l.ideaId WHERE i.bastiaoId IN (${marks})`).bind(...ids).all<{ ideaId: string; date: string }>(),
  ]);
  const logged = new Set(logs.results.map((log) => `${log.ideaId}:${log.date}`));
  const lived = new Map<string, number>();
  logs.results.forEach((log) => lived.set(log.ideaId, (lived.get(log.ideaId) ?? 0) + 1));
  return rows.map((row) => ({
    id: row.id, weekStart: row.weekStart ?? weekStart(row.createdAt.slice(0, 10)), fromClass: Boolean(row.classId),
    number: row.number, name: row.name, read: Boolean(row.readAt), notes: row.notes ?? "", reflection: row.reflection ?? "",
    ideas: ideas.results.filter((idea) => idea.bastiaoId === row.id).map((idea) => ({
      id: idea.id, text: idea.text, live: Boolean(idea.live), doneToday: logged.has(`${idea.id}:${today}`),
      last7: days.map((day) => (logged.has(`${idea.id}:${day}`) ? 1 : 0)), daysLived: lived.get(idea.id) ?? 0,
    })),
  }));
}

/** This week's Bastiões and run of weeks, the archive, and the class in course. */
export async function getSchoolOverview(userId: string, today = getSaoPauloDateKey()) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const thisWeek = weekStart(today);
  const [classes, habits, week, archive, weeksRead] = await Promise.all([
    db.prepare('SELECT id, date, title FROM "SchoolClass" WHERE userId = ? ORDER BY date DESC, createdAt DESC').bind(userId).all<{ id: string; date: string; title: string | null }>(),
    db.prepare('SELECT id, title FROM "HabitTemplate" WHERE userId = ? AND isActive = 1 ORDER BY title').bind(userId).all<{ id: string; title: string }>(),
    loadBastioes(userId, "weekStart = ?", [thisWeek], today),
    db.prepare(`SELECT b.id, b.weekStart, b.number, b.name, b.readAt, b.classId, (SELECT COUNT(*) FROM "BastiaoIdea" i WHERE i.bastiaoId = b.id) AS ideas
      FROM "Bastiao" b WHERE b.userId = ? AND b.weekStart < ? ORDER BY b.weekStart DESC, COALESCE(b.number, 999999)`).bind(userId, thisWeek)
      .all<{ id: string; weekStart: string; number: number | null; name: string; readAt: string | null; classId: string | null; ideas: number }>(),
    db.prepare('SELECT weekStart, MAX(CASE WHEN readAt IS NOT NULL THEN 1 ELSE 0 END) AS read FROM "Bastiao" WHERE userId = ? GROUP BY weekStart ORDER BY weekStart').bind(userId).all<{ weekStart: string; read: number }>(),
  ]);
  // Weeks with a Bastião read in a row; one missed week is forgiven.
  const readWeeks = new Set(weeksRead.results.filter((row) => row.read).map((row) => row.weekStart));
  const run: boolean[] = [];
  for (let day = weeksRead.results[0]?.weekStart ?? thisWeek; day <= thisWeek; day = addDays(day, 7)) run.push(readWeeks.has(day));
  const current = classes.results.find((item) => item.date <= today) ?? classes.results.at(-1) ?? null;
  return {
    today,
    weekStart: thisWeek,
    week,
    weekStreak: streaks(run).current,
    archive: archive.results.map((row): BastiaoSummary => ({ id: row.id, weekStart: row.weekStart, number: row.number, name: row.name, read: Boolean(row.readAt), fromClass: Boolean(row.classId), ideas: Number(row.ideas) })),
    current: current ? await getSchoolClass(userId, current.id, today) : null,
    classes: classes.results.map((item) => ({ id: item.id, date: item.date, title: item.title ?? "" })),
    habits: habits.results,
  };
}

export async function getBastiao(userId: string, id: string, today = getSaoPauloDateKey()) {
  await ensureSenderoSeeded();
  return (await loadBastioes(userId, "id = ?", [id], today))[0] ?? null;
}

/** A class with its practices, and the Bastiões of its period (weekly ones and those it assigned). */
export async function getSchoolClass(userId: string, id: string, today = getSaoPauloDateKey()): Promise<SchoolClass | null> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const row = await db.prepare('SELECT id, date, title, notes, closing FROM "SchoolClass" WHERE id = ? AND userId = ?').bind(id, userId).first<ClassRow>();
  if (!row) return null;
  const days = lastDays(today);
  const next = await db.prepare('SELECT date FROM "SchoolClass" WHERE userId = ? AND date > ? ORDER BY date LIMIT 1').bind(userId, row.date).first<{ date: string }>();
  const [bastioes, practices] = await Promise.all([
    loadBastioes(userId, "classId = ? OR (weekStart >= ? AND weekStart < ?)", [id, weekStart(row.date), next ? weekStart(next.date) : "9999-12-31"], today),
    db.prepare('SELECT id, habitId, title, points FROM "ClassPractice" WHERE classId = ? AND userId = ? ORDER BY createdAt').bind(id, userId).all<{ id: string; habitId: string | null; title: string; points: string | null }>(),
  ]);
  const habitIds = practices.results.map((practice) => practice.habitId).filter((value): value is string => Boolean(value));
  const habitInfo = new Map<string, { target: number; logs: Map<string, number> }>();
  if (habitIds.length) {
    const marks = habitIds.map(() => "?").join(",");
    const [targets, logs] = await Promise.all([
      db.prepare(`SELECT id, targetCount, title FROM "HabitTemplate" WHERE id IN (${marks})`).bind(...habitIds).all<{ id: string; targetCount: number; title: string }>(),
      db.prepare(`SELECT habitId, date, count, minutes FROM "HabitLog" WHERE userId = ? AND habitId IN (${marks}) AND date >= ?`).bind(userId, ...habitIds, days[0]).all<{ habitId: string; date: string; count: number; minutes: number | null }>(),
    ]);
    for (const habit of targets.results) habitInfo.set(habit.id, { target: Math.max(1, Number(habit.targetCount) || 1), logs: new Map() });
    for (const log of logs.results) {
      const info = habitInfo.get(log.habitId);
      if (info) info.logs.set(log.date.slice(0, 10), (info.logs.get(log.date.slice(0, 10)) ?? 0) + Number(log.count || log.minutes || 0));
    }
  }
  return {
    id: row.id, date: row.date, title: row.title ?? "", notes: row.notes ?? "", closing: row.closing ?? "", until: next?.date ?? null,
    bastioes,
    practices: practices.results.map((practice) => {
      const info = practice.habitId ? habitInfo.get(practice.habitId) : null;
      return {
        id: practice.id, habitId: practice.habitId, title: practice.title, points: practice.points ?? "",
        doneToday: info ? (info.logs.get(today) ?? 0) >= info.target : null,
        last7: info ? days.map((day) => ((info.logs.get(day) ?? 0) >= info.target ? 1 : 0)) : null,
      };
    }),
  };
}

/** Ideas chosen to live this week; shown in Escola, Hábitos, Início and Diário. */
export async function getLiveIdeas(userId: string, today = getSaoPauloDateKey()): Promise<{ ideas: LiveIdea[] }> {
  await ensureSenderoSeeded();
  const week = await loadBastioes(userId, "weekStart = ?", [weekStart(today)], today);
  return { ideas: week.flatMap((bastiao) => bastiao.ideas.filter((idea) => idea.live).map((idea) => ({ id: idea.id, text: idea.text, bastiao: bastiaoLabel(bastiao), doneToday: idea.doneToday, last7: idea.last7 }))) };
}

export async function createClass(userId: string, input: { date?: unknown; title?: unknown }) {
  await ensureSenderoSeeded();
  const id = newId("aula");
  const now = new Date().toISOString();
  await getSenderoDb().prepare('INSERT INTO "SchoolClass" (id, userId, date, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, isDate(input.date) ? input.date : getSaoPauloDateKey(), text(input.title, 200) || null, now, now).run();
  return { id };
}

const CLASS_FIELDS = { title: 200, notes: MAX_TEXT, closing: MAX_TEXT } as const;
export async function updateClass(userId: string, id: string, input: Record<string, unknown>) {
  await ensureSenderoSeeded();
  await own("SchoolClass", id, userId);
  const db = getSenderoDb();
  const now = new Date().toISOString();
  const updates = [];
  for (const [field, max] of Object.entries(CLASS_FIELDS)) {
    if (field in input) updates.push(db.prepare(`UPDATE "SchoolClass" SET ${field} = ?, updatedAt = ? WHERE id = ?`).bind(text(input[field], max) || null, now, id));
  }
  if (isDate(input.date)) updates.push(db.prepare('UPDATE "SchoolClass" SET date = ?, updatedAt = ? WHERE id = ?').bind(input.date, now, id));
  if (updates.length) await db.batch(updates);
}

/** Removes the class and its practices; its Bastiões stay in the archive. */
export async function deleteClass(userId: string, id: string) {
  await ensureSenderoSeeded();
  await own("SchoolClass", id, userId);
  const db = getSenderoDb();
  await db.batch([
    db.prepare('UPDATE "Bastiao" SET classId = NULL WHERE classId = ? AND userId = ?').bind(id, userId),
    db.prepare('DELETE FROM "ClassPractice" WHERE classId = ? AND userId = ?').bind(id, userId),
    db.prepare('DELETE FROM "SchoolClass" WHERE id = ? AND userId = ?').bind(id, userId),
  ]);
}

/** The week's Bastião (this week unless another week is given); "veio da aula" links it to the class in course. */
export async function createBastiao(userId: string, input: { weekStart?: unknown; number?: unknown; name?: unknown; fromClass?: unknown }) {
  await ensureSenderoSeeded();
  const name = text(input.name, 200);
  if (!name) throw new Error("Informe o nome do Bastião.");
  const today = getSaoPauloDateKey();
  const classId = input.fromClass ? await currentClassId(userId, today) : null;
  if (input.fromClass && !classId) throw new Error("Registre a aula antes de ligar o Bastião a ela.");
  const number = Number(input.number);
  const id = newId("bastiao");
  const now = new Date().toISOString();
  await getSenderoDb().prepare('INSERT INTO "Bastiao" (id, userId, weekStart, classId, number, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, weekStart(isDate(input.weekStart) ? input.weekStart : today), classId, Number.isInteger(number) && number > 0 ? number : null, name, now, now).run();
  return { id };
}

export async function updateBastiao(userId: string, id: string, input: Record<string, unknown>) {
  await ensureSenderoSeeded();
  await own("Bastiao", id, userId);
  const db = getSenderoDb();
  const now = new Date().toISOString();
  const updates = [];
  if ("name" in input) { const name = text(input.name, 200); if (!name) throw new Error("Informe o nome do Bastião."); updates.push(db.prepare('UPDATE "Bastiao" SET name = ? WHERE id = ?').bind(name, id)); }
  if ("number" in input) { const number = Number(input.number); updates.push(db.prepare('UPDATE "Bastiao" SET number = ? WHERE id = ?').bind(Number.isInteger(number) && number > 0 ? number : null, id)); }
  if ("read" in input) updates.push(db.prepare('UPDATE "Bastiao" SET readAt = ? WHERE id = ?').bind(input.read ? now : null, id));
  if ("fromClass" in input) {
    const classId = input.fromClass ? await currentClassId(userId, getSaoPauloDateKey()) : null;
    if (input.fromClass && !classId) throw new Error("Registre a aula antes de ligar o Bastião a ela.");
    updates.push(db.prepare('UPDATE "Bastiao" SET classId = ? WHERE id = ?').bind(classId, id));
  }
  if ("notes" in input) updates.push(db.prepare('UPDATE "Bastiao" SET notes = ? WHERE id = ?').bind(text(input.notes) || null, id));
  if ("reflection" in input) updates.push(db.prepare('UPDATE "Bastiao" SET reflection = ? WHERE id = ?').bind(text(input.reflection) || null, id));
  updates.push(db.prepare('UPDATE "Bastiao" SET updatedAt = ? WHERE id = ?').bind(now, id));
  await db.batch(updates);
}

export async function deleteBastiao(userId: string, id: string) {
  await ensureSenderoSeeded();
  await own("Bastiao", id, userId);
  const db = getSenderoDb();
  await db.batch([
    db.prepare('DELETE FROM "IdeaLog" WHERE ideaId IN (SELECT id FROM "BastiaoIdea" WHERE bastiaoId = ?)').bind(id),
    db.prepare('DELETE FROM "BastiaoIdea" WHERE bastiaoId = ?').bind(id),
    db.prepare('DELETE FROM "Bastiao" WHERE id = ? AND userId = ?').bind(id, userId),
  ]);
}

export async function addIdea(userId: string, bastiaoId: string, input: { text?: unknown }) {
  await ensureSenderoSeeded();
  await own("Bastiao", bastiaoId, userId);
  const value = text(input.text, 1_000);
  if (!value) throw new Error("Escreva a ideia.");
  const db = getSenderoDb();
  const last = await db.prepare('SELECT COALESCE(MAX(position), 0) AS position FROM "BastiaoIdea" WHERE bastiaoId = ?').bind(bastiaoId).first<{ position: number }>();
  const id = newId("ideia");
  await db.prepare('INSERT INTO "BastiaoIdea" (id, userId, bastiaoId, text, live, position, createdAt) VALUES (?, ?, ?, ?, 0, ?, ?)')
    .bind(id, userId, bastiaoId, value, Number(last?.position ?? 0) + 1, new Date().toISOString()).run();
  return { id };
}

/** Edits an idea; choosing it to live is limited to three per week. */
export async function updateIdea(userId: string, id: string, input: { text?: unknown; live?: unknown }) {
  await ensureSenderoSeeded();
  await own("BastiaoIdea", id, userId);
  const db = getSenderoDb();
  if ("text" in input) {
    const value = text(input.text, 1_000);
    if (!value) throw new Error("Escreva a ideia.");
    await db.prepare('UPDATE "BastiaoIdea" SET text = ? WHERE id = ?').bind(value, id).run();
  }
  if ("live" in input) {
    if (input.live) {
      const count = await db.prepare(`
        SELECT COUNT(*) AS n FROM "BastiaoIdea" i JOIN "Bastiao" b ON b.id = i.bastiaoId
        WHERE i.live = 1 AND i.id <> ? AND b.userId = ? AND b.weekStart = (SELECT b2.weekStart FROM "BastiaoIdea" i2 JOIN "Bastiao" b2 ON b2.id = i2.bastiaoId WHERE i2.id = ?)
      `).bind(id, userId, id).first<{ n: number }>();
      if (Number(count?.n ?? 0) >= MAX_LIVE_IDEAS) throw new Error(`Escolha no máximo ${MAX_LIVE_IDEAS} ideias para viver por semana.`);
    }
    await db.prepare('UPDATE "BastiaoIdea" SET live = ? WHERE id = ?').bind(input.live ? 1 : 0, id).run();
  }
}

export async function deleteIdea(userId: string, id: string) {
  await ensureSenderoSeeded();
  await own("BastiaoIdea", id, userId);
  const db = getSenderoDb();
  await db.batch([db.prepare('DELETE FROM "IdeaLog" WHERE ideaId = ?').bind(id), db.prepare('DELETE FROM "BastiaoIdea" WHERE id = ?').bind(id)]);
}

/** Marks or unmarks an idea as lived on a day. */
export async function markIdea(userId: string, id: string, input: { done?: unknown; date?: unknown }) {
  await ensureSenderoSeeded();
  await own("BastiaoIdea", id, userId);
  const date = isDate(input.date) ? input.date : getSaoPauloDateKey();
  const db = getSenderoDb();
  if (input.done) await db.prepare('INSERT OR IGNORE INTO "IdeaLog" (id, userId, ideaId, date) VALUES (?, ?, ?, ?)').bind(newId("vivi"), userId, id, date).run();
  else await db.prepare('DELETE FROM "IdeaLog" WHERE ideaId = ? AND date = ? AND userId = ?').bind(id, date, userId).run();
}

/** An idea goes to Memorização (one sentence per line) or becomes a question for the master. */
export async function sendIdea(userId: string, id: string, to: unknown, question?: unknown) {
  await ensureSenderoSeeded();
  const idea = await getSenderoDb().prepare('SELECT i.text, b.number, b.name FROM "BastiaoIdea" i JOIN "Bastiao" b ON b.id = i.bastiaoId WHERE i.id = ? AND i.userId = ?')
    .bind(id, userId).first<{ text: string; number: number | null; name: string }>();
  if (!idea) throw new Error("Ideia não encontrada.");
  const label = `Bastião ${bastiaoLabel(idea)}`;
  if (to === "MEMORIZAR") return createMemorizationText(userId, { title: label, source: label, text: idea.text.replace(/([.!?;:])\s+/g, "$1\n") });
  if (to === "MESTRE") return createMasterQuestion(userId, { sourceType: "LIVRE", contextTitle: label, contextText: idea.text, question: text(question) || idea.text });
  throw new Error("Destino inválido.");
}

/**
 * A practice asked in class: an existing habit, or a new exercise that is
 * created in Hábitos at the same time.
 */
export async function addPractice(userId: string, classId: string, input: { habitId?: unknown; title?: unknown; group?: unknown; cadence?: unknown }) {
  await ensureSenderoSeeded();
  await own("SchoolClass", classId, userId);
  const db = getSenderoDb();
  let habitId: string | null = null;
  let title = text(input.title, 200);
  if (typeof input.habitId === "string" && input.habitId) {
    const habit = await db.prepare('SELECT id, title FROM "HabitTemplate" WHERE id = ? AND userId = ?').bind(input.habitId, userId).first<{ id: string; title: string }>();
    if (!habit) throw new Error("Hábito não encontrado.");
    habitId = habit.id;
    title = habit.title;
  } else {
    if (!title) throw new Error("Dê um nome ao exercício.");
    const group = input.group === "ED" || input.group === "HABIT" ? input.group : "PSYCHOLOGY";
    habitId = (await createHabitTemplate({ userId, title, cadence: input.cadence === "WEEKLY" ? "WEEKLY" : "DAILY", targetCount: 1, practiceGroup: group, description: "Vivência pedida em aula." })).id;
  }
  const id = newId("vivencia");
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO "ClassPractice" (id, userId, classId, habitId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, classId, habitId, title, now, now).run();
  return { id, habitId };
}

export async function updatePractice(userId: string, id: string, input: { points?: unknown }) {
  await ensureSenderoSeeded();
  await own("ClassPractice", id, userId);
  await getSenderoDb().prepare('UPDATE "ClassPractice" SET points = ?, updatedAt = ? WHERE id = ?').bind(text(input.points) || null, new Date().toISOString(), id).run();
}

/** Takes the practice off the class; the habit stays in Hábitos. */
export async function deletePractice(userId: string, id: string) {
  await ensureSenderoSeeded();
  await own("ClassPractice", id, userId);
  await getSenderoDb().prepare('DELETE FROM "ClassPractice" WHERE id = ?').bind(id).run();
}
