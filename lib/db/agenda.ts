import { getSaoPauloDateKey } from "@/lib/date";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { addDays, weekStart } from "@/lib/habit-streak";

/**
 * Agenda: a day (tasks without hour, a timeline with events, tasks with an
 * hour and — discreetly — habits with an hour), a week, and simple shopping.
 * Events store local São Paulo time as "YYYY-MM-DDTHH:MM".
 */

export type AgendaTask = { id: string; title: string; description: string; date: string; time: string | null; priority: 1 | 2 | 3; done: boolean; recurring: boolean; origin: "MANUAL" | "REFLECTION" | "DIARY" };
export type AgendaEvent = { id: string; title: string; date: string; time: string; endTime: string; location: string; description: string };
export type AgendaHabit = { id: string; title: string; time: string };
export type AgendaDay = { date: string; tasks: AgendaTask[]; events: AgendaEvent[] };

type TaskRow = { id: string; title: string; description: string | null; dueDate: string; dueTime: string | null; priority: number; completedAt: string | null; seriesId: string | null; originType: string };
type EventRow = { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; description: string | null };

const toTask = (row: TaskRow): AgendaTask => ({
  id: row.id, title: row.title, description: row.description ?? "", date: row.dueDate.slice(0, 10), time: row.dueTime,
  priority: (Math.min(3, Math.max(1, Number(row.priority) || 2)) as 1 | 2 | 3), done: Boolean(row.completedAt), recurring: Boolean(row.seriesId),
  origin: row.originType === "REFLECTION" ? "REFLECTION" : row.originType === "DIARY" ? "DIARY" : "MANUAL",
});
const toEvent = (row: EventRow): AgendaEvent => ({
  id: row.id, title: row.title, date: row.startsAt.slice(0, 10), time: row.startsAt.slice(11, 16), endTime: row.endsAt?.slice(11, 16) ?? "",
  location: row.location ?? "", description: row.description ?? "",
});
const byTime = <T extends { time: string | null; title: string }>(a: T, b: T) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.title.localeCompare(b.title);
const TASK_COLUMNS = 'id, title, description, dueDate, dueTime, priority, completedAt, seriesId, originType';

/** Tasks and events for a span of days (inclusive), plus the habits that have an hour. */
async function loadSpan(userId: string, from: string, to: string) {
  const db = getSenderoDb();
  const [tasks, events, habits] = await Promise.all([
    db.prepare(`SELECT ${TASK_COLUMNS} FROM "TaskOccurrence" WHERE userId = ? AND status != 'CANCELED' AND dueDate >= ? AND dueDate <= ?`).bind(userId, from, to).all<TaskRow>(),
    db.prepare('SELECT id, title, startsAt, endsAt, location, description FROM "Event" WHERE userId = ? AND substr(startsAt, 1, 10) >= ? AND substr(startsAt, 1, 10) <= ? ORDER BY startsAt').bind(userId, from, to).all<EventRow>(),
    db.prepare('SELECT id, title, scheduledTime AS time FROM "HabitTemplate" WHERE userId = ? AND isActive = 1 AND cadence = \'DAILY\' AND scheduledTime IS NOT NULL ORDER BY scheduledTime').bind(userId).all<AgendaHabit>(),
  ]);
  return { tasks: tasks.results.map(toTask), events: events.results.map(toEvent), habits: habits.results };
}

/** One day, the dots of its week, and — when it is today — what is late. */
export async function getAgendaDay(userId: string, date: string, today = getSaoPauloDateKey()) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const start = weekStart(date);
  const [span, late] = await Promise.all([
    loadSpan(userId, start, addDays(start, 6)),
    date === today
      ? db.prepare(`SELECT ${TASK_COLUMNS} FROM "TaskOccurrence" WHERE userId = ? AND status != 'CANCELED' AND completedAt IS NULL AND dueDate < ? ORDER BY dueDate`).bind(userId, today).all<TaskRow>()
      : Promise.resolve({ results: [] as TaskRow[] }),
  ]);
  // A late repeating task only shows its latest occurrence.
  const lateBySeries = new Map<string, AgendaTask>();
  const lateTasks: AgendaTask[] = [];
  for (const row of late.results) {
    const task = toTask(row);
    if (row.seriesId) lateBySeries.set(row.seriesId, task); else lateTasks.push(task);
  }
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index);
    return { date: day, count: span.tasks.filter((task) => task.date === day && !task.done).length + span.events.filter((event) => event.date === day).length };
  });
  return {
    date, today, week,
    late: [...lateTasks, ...lateBySeries.values()].sort((a, b) => a.date.localeCompare(b.date)),
    tasks: span.tasks.filter((task) => task.date === date).sort(byTime),
    events: span.events.filter((event) => event.date === date),
    habits: span.habits,
  };
}

/** The seven days of a week (Sunday first). */
export async function getAgendaWeek(userId: string, date: string) {
  await ensureSenderoSeeded();
  const start = weekStart(date);
  const span = await loadSpan(userId, start, addDays(start, 6));
  const days: AgendaDay[] = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index);
    return { date: day, tasks: span.tasks.filter((task) => task.date === day).sort(byTime), events: span.events.filter((event) => event.date === day) };
  });
  return { start, days };
}

export async function getShopping(userId: string) {
  await ensureSenderoSeeded();
  const rows = await getSenderoDb().prepare('SELECT id, title, isChecked FROM "ShoppingItem" WHERE userId = ? ORDER BY isChecked, createdAt').bind(userId).all<{ id: string; title: string; isChecked: number }>();
  return rows.results.map((row) => ({ id: row.id, title: row.title, checked: Boolean(row.isChecked) }));
}

/**
 * Brings open late tasks to a day (usually today). Late occurrences of a
 * repeating task are closed as not done instead: the next one is already on
 * its own day, and moving it would duplicate it.
 */
export async function rescheduleLate(userId: string, to: string) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const now = new Date().toISOString();
  const [moved, closed] = await db.batch([
    db.prepare('UPDATE "TaskOccurrence" SET dueDate = ?, updatedAt = ? WHERE userId = ? AND status != \'CANCELED\' AND completedAt IS NULL AND dueDate < ? AND seriesId IS NULL').bind(to, now, userId, to),
    db.prepare('UPDATE "TaskOccurrence" SET status = \'CANCELED\', updatedAt = ? WHERE userId = ? AND status != \'CANCELED\' AND completedAt IS NULL AND dueDate < ? AND seriesId IS NOT NULL').bind(now, userId, to),
  ]);
  return { moved: Number(moved.meta?.changes ?? 0), closed: Number(closed.meta?.changes ?? 0) };
}

export async function clearCheckedShopping(userId: string) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('DELETE FROM "ShoppingItem" WHERE userId = ? AND isChecked = 1').bind(userId).run();
}

/**
 * Phone notices for the cron: tasks with an hour at that hour, events 15
 * minutes before, class readings due today or tomorrow (09:00) and the eve
 * of a Escola class (20:00). Each goes out once; `minutes` is now in São Paulo.
 */
export async function dueAgendaNotices(userId: string, today: string, minutes: number, lateLimit: number) {
  const db = getSenderoDb();
  const tomorrow = addDays(today, 1);
  const [tasks, events, sent, readings, classes] = await Promise.all([
    db.prepare('SELECT id, title, dueTime FROM "TaskOccurrence" WHERE userId = ? AND dueDate = ? AND dueTime IS NOT NULL AND completedAt IS NULL AND status != \'CANCELED\'').bind(userId, today).all<{ id: string; title: string; dueTime: string }>(),
    db.prepare('SELECT id, title, startsAt, location FROM "Event" WHERE userId = ? AND substr(startsAt, 1, 10) = ? AND length(startsAt) >= 16').bind(userId, today).all<{ id: string; title: string; startsAt: string; location: string | null }>(),
    db.prepare('SELECT key FROM "AgendaNotice" WHERE userId = ?').bind(userId).all<{ key: string }>(),
    // Class readings due today or tomorrow, still not read.
    db.prepare('SELECT id, title, dueDate FROM "ReadingItem" WHERE userId = ? AND kind = \'AULA\' AND status != \'LIDO\' AND archivedAt IS NULL AND dueDate IN (?, ?)').bind(userId, today, tomorrow).all<{ id: string; title: string; dueDate: string }>(),
    // A Escola class tomorrow.
    db.prepare('SELECT id, title FROM "SchoolClass" WHERE userId = ? AND date = ?').bind(userId, tomorrow).all<{ id: string; title: string | null }>(),
  ]);
  const already = new Set(sent.results.map((row) => row.key));
  const due = (time: string, before: number) => {
    const at = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) - before;
    return minutes >= at && minutes - at <= lateLimit;
  };
  return [
    // Class readings at 09:00, on the eve and on the day.
    ...readings.results.filter((reading) => due("09:00", 0) && !already.has(`LEITURA:${reading.id}:${today}`))
      .map((reading) => ({ key: `LEITURA:${reading.id}:${today}`, url: `/leitura/${reading.id}`, body: `Leitura de aula para ${reading.dueDate === today ? "hoje" : "amanhã"}: ${reading.title}` })),
    // The eve of a class, at 20:00.
    ...classes.results.filter((item) => due("20:00", 0) && !already.has(`AULA:${item.id}`))
      .map((item) => ({ key: `AULA:${item.id}`, url: "/escola", body: `Amanhã tem aula${item.title ? ` (${item.title})` : ""}. Veja o que levar.` })),
    ...tasks.results.filter((task) => due(task.dueTime, 0) && !already.has(`TASK:${task.id}`))
      .map((task) => ({ key: `TASK:${task.id}`, url: "/tarefas", body: `${task.dueTime} · ${task.title}` })),
    ...events.results.filter((event) => due(event.startsAt.slice(11, 16), 15) && !already.has(`EVENT:${event.id}`))
      .map((event) => ({ key: `EVENT:${event.id}`, url: "/tarefas", body: `Às ${event.startsAt.slice(11, 16)} · ${event.title}${event.location ? ` · ${event.location}` : ""}` })),
  ];
}

/** Marks a notice as sent; false when another run already took it. */
export async function claimAgendaNotice(userId: string, key: string) {
  const result = await getSenderoDb().prepare('INSERT OR IGNORE INTO "AgendaNotice" (key, userId, sentAt) VALUES (?, ?, ?)').bind(key, userId, new Date().toISOString()).run();
  return Number(result.meta?.changes ?? 1) > 0;
}
