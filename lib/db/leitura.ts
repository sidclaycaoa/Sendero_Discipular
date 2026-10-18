import { getSaoPauloDateKey } from "@/lib/date";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { createMemorizationText } from "@/lib/db/memorizacao";
import { saveHabitProgress } from "@/lib/db/sendero";
import { bastiaoLabel } from "@/lib/escola-shared";
import { addDays, streaks, weekStart } from "@/lib/habit-streak";
import { READING_KINDS, READING_STATUS, type ReadingKind, type ReadingStatus } from "@/lib/leitura-shared";

export type { ReadingKind, ReadingStatus };

/**
 * Leitura: books, course handouts, loose texts and readings asked in class.
 * Progress is a page out of the total, or a percentage when there are no pages.
 * Reading time also counts towards the weekly reading habit.
 */

export type ReadingItem = {
  id: string; kind: ReadingKind; title: string; author: string; totalPages: number | null; currentPage: number;
  status: ReadingStatus; dueDate: string | null; note: string; startedAt: string | null; finishedAt: string | null; updatedAt: string;
  /** 0–100. */
  progress: number;
  /** Pages (or percentage points) per day over the last 14 days, and the days left at that pace. */
  pacePerDay: number | null; daysLeft: number | null;
};
export type ReadingSession = { id: string; itemId: string; date: string; minutes: number; fromPage: number | null; toPage: number | null };
export type ReadingQuote = { id: string; itemId: string; itemTitle: string; text: string; page: string; note: string; createdAt: string };


type ItemRow = { id: string; kind: string; title: string; author: string | null; totalPages: number | null; currentPage: number; status: string; dueDate: string | null; note: string | null; startedAt: string | null; finishedAt: string | null; updatedAt: string };
type SessionRow = { id: string; itemId: string; date: string; minutes: number; fromPage: number | null; toPage: number | null };

const MAX_TEXT = 20_000;
const text = (value: unknown, max = 300) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const isKind = (value: unknown): value is ReadingKind => typeof value === "string" && value in READING_KINDS;
const isStatus = (value: unknown): value is ReadingStatus => typeof value === "string" && value in READING_STATUS;
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function toItem(row: ItemRow, sessions: SessionRow[], today: string): ReadingItem {
  const total = row.totalPages && row.totalPages > 0 ? row.totalPages : null;
  const current = Math.max(0, Math.min(total ?? 100, Number(row.currentPage) || 0));
  const since = addDays(today, -13);
  const advanced = sessions.filter((session) => session.itemId === row.id && session.date >= since)
    .reduce((sum, session) => sum + Math.max(0, (session.toPage ?? 0) - (session.fromPage ?? session.toPage ?? 0)), 0);
  const pace = advanced > 0 ? advanced / 14 : null;
  const left = (total ?? 100) - current;
  return {
    id: row.id, kind: isKind(row.kind) ? row.kind : "LIVRO", title: row.title, author: row.author ?? "", totalPages: total, currentPage: current,
    status: isStatus(row.status) ? row.status : "LENDO", dueDate: row.dueDate, note: row.note ?? "", startedAt: row.startedAt, finishedAt: row.finishedAt, updatedAt: row.updatedAt,
    progress: Math.round((current / (total ?? 100)) * 100),
    pacePerDay: pace ? Math.round(pace * 10) / 10 : null,
    daysLeft: pace && left > 0 && row.status !== "LIDO" ? Math.ceil(left / pace) : null,
  };
}

function cleanItem(input: Record<string, unknown>) {
  const title = text(input.title, 200);
  if (!title) throw new Error("Dê um título à leitura.");
  const pages = Number(input.totalPages);
  return {
    kind: isKind(input.kind) ? input.kind : "LIVRO",
    title,
    author: text(input.author, 200) || null,
    totalPages: Number.isFinite(pages) && pages >= 1 && pages <= 20_000 ? Math.round(pages) : null,
    status: isStatus(input.status) ? input.status : "LENDO",
    dueDate: isDate(input.dueDate) ? input.dueDate : null,
    note: text(input.note, 2_000) || null,
  };
}

export async function getReadingOverview(userId: string, today = getSaoPauloDateKey()) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const since = addDays(today, -90);
  const [items, sessions, quotes, bastioes] = await Promise.all([
    db.prepare('SELECT * FROM "ReadingItem" WHERE userId = ? AND archivedAt IS NULL ORDER BY updatedAt DESC').bind(userId).all<ItemRow>(),
    db.prepare('SELECT id, itemId, date, minutes, fromPage, toPage FROM "ReadingSession" WHERE userId = ? AND date >= ? ORDER BY date').bind(userId, since).all<SessionRow>(),
    db.prepare(`SELECT q.id, q.itemId, i.title AS itemTitle, q.text, q.page, q.note, q.createdAt FROM "ReadingQuote" q JOIN "ReadingItem" i ON i.id = q.itemId
      WHERE q.userId = ? AND i.archivedAt IS NULL ORDER BY q.createdAt DESC LIMIT 3`).bind(userId).all<ReadingQuote>(),
    // This week's Bastiões (they live in Escola).
    db.prepare('SELECT number, name, readAt FROM "Bastiao" WHERE userId = ? AND weekStart = ? ORDER BY COALESCE(number, 999999)')
      .bind(userId, weekStart(today)).all<{ number: number | null; name: string; readAt: string | null }>(),
  ]);
  const all = items.results.map((row) => toItem(row, sessions.results, today));
  // Percent progress (texts without pages) is not pages read.
  const paged = new Set(items.results.filter((row) => row.totalPages && row.totalPages > 0).map((row) => row.id));
  const pagesOf = (session: SessionRow) => (paged.has(session.itemId) ? Math.max(0, (session.toPage ?? 0) - (session.fromPage ?? session.toPage ?? 0)) : 0);

  // This week's numbers and the days spent reading.
  const thisWeek = weekStart(today);
  const weekSessions = sessions.results.filter((session) => session.date >= thisWeek);
  const readingDays = new Set(sessions.results.map((session) => session.date));
  const days: boolean[] = [];
  for (let day = addDays(today, -89); day <= today; day = addDays(day, 1)) days.push(readingDays.has(day));
  const last7 = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index - 6);
    const daySessions = sessions.results.filter((session) => session.date === day);
    return { date: day, minutes: daySessions.reduce((sum, session) => sum + Number(session.minutes), 0), pages: daySessions.reduce((sum, session) => sum + pagesOf(session), 0) };
  });

  return {
    today,
    items: all,
    quotes: quotes.results,
    stats: {
      minutesWeek: weekSessions.reduce((sum, session) => sum + Number(session.minutes), 0),
      pagesWeek: weekSessions.reduce((sum, session) => sum + pagesOf(session), 0),
      dayStreak: streaks(days).current,
      finishedThisYear: all.filter((item) => item.status === "LIDO" && item.finishedAt?.slice(0, 4) === today.slice(0, 4)).length,
      last7,
    },
    bastioes: bastioes.results.map((bastiao) => ({ label: bastiaoLabel(bastiao), read: Boolean(bastiao.readAt) })),
  };
}

export async function getReadingItem(userId: string, id: string, today = getSaoPauloDateKey()) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const [row, sessions, quotes] = await Promise.all([
    db.prepare('SELECT * FROM "ReadingItem" WHERE id = ? AND userId = ? AND archivedAt IS NULL').bind(id, userId).first<ItemRow>(),
    db.prepare('SELECT id, itemId, date, minutes, fromPage, toPage FROM "ReadingSession" WHERE itemId = ? AND userId = ? ORDER BY date DESC, createdAt DESC LIMIT 60').bind(id, userId).all<SessionRow>(),
    db.prepare('SELECT q.id, q.itemId, \'\' AS itemTitle, q.text, q.page, q.note, q.createdAt FROM "ReadingQuote" q WHERE q.itemId = ? AND q.userId = ? ORDER BY q.createdAt DESC').bind(id, userId).all<ReadingQuote>(),
  ]);
  if (!row) return null;
  return {
    item: toItem(row, sessions.results, today),
    sessions: sessions.results as ReadingSession[],
    quotes: quotes.results.map((quote) => ({ ...quote, page: quote.page ?? "", note: quote.note ?? "", itemTitle: row.title })),
    minutesTotal: sessions.results.reduce((sum, session) => sum + Number(session.minutes), 0),
  };
}

export async function createReadingItem(userId: string, input: Record<string, unknown>) {
  await ensureSenderoSeeded();
  const clean = cleanItem(input);
  const id = `leitura_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await getSenderoDb().prepare(`
    INSERT INTO "ReadingItem" (id, userId, kind, title, author, totalPages, currentPage, status, dueDate, note, startedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, clean.kind, clean.title, clean.author, clean.totalPages, clean.status, clean.dueDate, clean.note, clean.status === "LENDO" ? now : null, now, now).run();
  return { id };
}

/** Edits the item; a new total keeps the page reached, and finishing marks the date. */
export async function updateReadingItem(userId: string, id: string, input: Record<string, unknown>) {
  await ensureSenderoSeeded();
  const clean = cleanItem(input);
  const now = new Date().toISOString();
  await getSenderoDb().prepare(`
    UPDATE "ReadingItem" SET kind = ?, title = ?, author = ?, totalPages = ?, status = ?, dueDate = ?, note = ?,
      currentPage = CASE WHEN ? = 'LIDO' THEN COALESCE(?, 100) ELSE MIN(currentPage, COALESCE(?, 100)) END,
      startedAt = COALESCE(startedAt, CASE WHEN ? = 'LENDO' THEN ? END),
      finishedAt = CASE WHEN ? = 'LIDO' THEN COALESCE(finishedAt, ?) ELSE NULL END,
      updatedAt = ?
    WHERE id = ? AND userId = ?
  `).bind(clean.kind, clean.title, clean.author, clean.totalPages, clean.status, clean.dueDate, clean.note,
    clean.status, clean.totalPages, clean.totalPages, clean.status, now, clean.status, now, now, id, userId).run();
}

export async function archiveReadingItem(userId: string, id: string) {
  await ensureSenderoSeeded();
  const now = new Date().toISOString();
  await getSenderoDb().prepare('UPDATE "ReadingItem" SET archivedAt = ?, updatedAt = ? WHERE id = ? AND userId = ?').bind(now, now, id, userId).run();
}

/**
 * Records a reading moment: minutes (from the timer or typed) and where it stopped.
 * The minutes also go to today's entry of the weekly reading habit.
 */
export async function addReadingSession(userId: string, itemId: string, input: { minutes?: unknown; toPage?: unknown }) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const row = await db.prepare('SELECT * FROM "ReadingItem" WHERE id = ? AND userId = ? AND archivedAt IS NULL').bind(itemId, userId).first<ItemRow>();
  if (!row) throw new Error("Leitura não encontrada.");
  const max = row.totalPages && row.totalPages > 0 ? row.totalPages : 100;
  const minutes = Math.max(0, Math.min(24 * 60, Math.round(Number(input.minutes) || 0)));
  const typed = Number(input.toPage);
  const toPage = input.toPage === null || input.toPage === undefined || input.toPage === "" || !Number.isFinite(typed) ? null : Math.max(0, Math.min(max, Math.round(typed)));
  if (!minutes && toPage === null) throw new Error("Informe os minutos ou onde você parou.");
  const today = getSaoPauloDateKey();
  const now = new Date().toISOString();
  const finished = toPage !== null && toPage >= max;
  await db.batch([
    db.prepare('INSERT INTO "ReadingSession" (id, userId, itemId, date, minutes, fromPage, toPage, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(`sessao_${crypto.randomUUID()}`, userId, itemId, today, minutes, toPage === null ? null : row.currentPage, toPage, now),
    db.prepare(`UPDATE "ReadingItem" SET currentPage = COALESCE(?, currentPage), status = CASE WHEN ? THEN 'LIDO' WHEN status IN ('QUERO', 'PAUSADO') THEN 'LENDO' ELSE status END,
      startedAt = COALESCE(startedAt, ?), finishedAt = CASE WHEN ? THEN COALESCE(finishedAt, ?) ELSE finishedAt END, updatedAt = ? WHERE id = ?`)
      .bind(toPage, finished ? 1 : 0, now, finished ? 1 : 0, now, now, itemId),
  ]);
  if (minutes) {
    const habit = await db.prepare('SELECT id FROM "HabitTemplate" WHERE userId = ? AND isActive = 1 AND practiceTool = \'LEITURA\' ORDER BY createdAt LIMIT 1').bind(userId).first<{ id: string }>();
    if (habit) {
      const log = await db.prepare('SELECT minutes FROM "HabitLog" WHERE userId = ? AND habitId = ? AND date = ?').bind(userId, habit.id, today).first<{ minutes: number | null }>();
      await saveHabitProgress({ userId, habitId: habit.id, dateKey: today, count: 0, minutes: Number(log?.minutes ?? 0) + minutes });
    }
  }
  return { finished };
}

export async function addReadingQuote(userId: string, itemId: string, input: { text?: unknown; page?: unknown; note?: unknown }) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const quote = text(input.text, MAX_TEXT);
  if (!quote) throw new Error("Escreva o trecho.");
  const owner = await db.prepare('SELECT id FROM "ReadingItem" WHERE id = ? AND userId = ?').bind(itemId, userId).first();
  if (!owner) throw new Error("Leitura não encontrada.");
  const id = `trecho_${crypto.randomUUID()}`;
  await db.prepare('INSERT INTO "ReadingQuote" (id, userId, itemId, text, page, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, itemId, quote, text(input.page, 40) || null, text(input.note, 2_000) || null, new Date().toISOString()).run();
  return { id };
}

export async function deleteReadingQuote(userId: string, id: string) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('DELETE FROM "ReadingQuote" WHERE id = ? AND userId = ?').bind(id, userId).run();
}

/** Turns a marked passage into a Memorização text, one sentence per line. */
export async function quoteToMemorization(userId: string, id: string) {
  await ensureSenderoSeeded();
  const quote = await getSenderoDb().prepare('SELECT q.text, q.page, i.title, i.author FROM "ReadingQuote" q JOIN "ReadingItem" i ON i.id = q.itemId WHERE q.id = ? AND q.userId = ?')
    .bind(id, userId).first<{ text: string; page: string | null; title: string; author: string | null }>();
  if (!quote) throw new Error("Trecho não encontrado.");
  const lines = quote.text.includes("\n") ? quote.text : quote.text.replace(/([.!?;:])\s+/g, "$1\n");
  return createMemorizationText(userId, {
    title: `${quote.title}${quote.page ? ` · p. ${quote.page}` : ""}`,
    source: [quote.author, quote.title].filter(Boolean).join(", "),
    text: lines,
  });
}
