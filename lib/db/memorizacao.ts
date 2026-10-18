import { getSaoPauloDateKey } from "@/lib/date";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { splitLines } from "@/lib/memorize-text";

/**
 * Memorização: a text is split into lines (one line = one short passage) and
 * learned in order. `known` counts the lines already learned; the line being
 * worked on is the next one.
 */

export type MemorizationText = {
  id: string; title: string; source: string; lines: string[]; known: number;
  updatedAt: string; lastPracticeDate: string | null; practiceDays: number;
};

type ItemRow = { id: string; title: string; source: string | null; contentText: string; currentLine: number; totalLines: number; updatedAt: string };

const MAX_TEXT = 20_000;

function toText(row: ItemRow, stats?: { lastDate: string | null; days: number }): MemorizationText {
  const lines = splitLines(row.contentText);
  return {
    id: row.id, title: row.title, source: row.source ?? "", lines,
    known: Math.max(0, Math.min(lines.length, Number(row.currentLine) || 0)),
    updatedAt: row.updatedAt, lastPracticeDate: stats?.lastDate ?? null, practiceDays: stats?.days ?? 0,
  };
}

function cleanInput(input: { title?: unknown; source?: unknown; text?: unknown }) {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
  const source = typeof input.source === "string" ? input.source.trim().slice(0, 300) : "";
  const text = typeof input.text === "string" ? input.text.slice(0, MAX_TEXT) : "";
  if (!title) throw new Error("Dê um título ao texto.");
  const lines = splitLines(text);
  if (!lines.length) throw new Error("Cole o texto, com uma linha por trecho.");
  return { title, source: source || null, text: lines.join("\n"), total: lines.length };
}

export async function listMemorizationTexts(userId: string) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const [items, stats] = await Promise.all([
    db.prepare('SELECT id, title, source, contentText, currentLine, totalLines, updatedAt FROM "MemorizationItem" WHERE userId = ? AND archivedAt IS NULL ORDER BY updatedAt DESC').bind(userId).all<ItemRow>(),
    db.prepare(`
      SELECT l.itemId, MAX(l.date) AS lastDate, COUNT(DISTINCT l.date) AS days FROM "MemorizationProgressLog" l
      JOIN "MemorizationItem" i ON i.id = l.itemId WHERE i.userId = ? GROUP BY l.itemId
    `).bind(userId).all<{ itemId: string; lastDate: string | null; days: number }>(),
  ]);
  const byItem = new Map(stats.results.map((row) => [row.itemId, { lastDate: row.lastDate, days: Number(row.days) }]));
  return items.results.map((row) => toText(row, byItem.get(row.id)));
}

export async function getMemorizationText(userId: string, id: string) {
  await ensureSenderoSeeded();
  const row = await getSenderoDb().prepare('SELECT id, title, source, contentText, currentLine, totalLines, updatedAt FROM "MemorizationItem" WHERE id = ? AND userId = ? AND archivedAt IS NULL')
    .bind(id, userId).first<ItemRow>();
  return row ? toText(row) : null;
}

export async function createMemorizationText(userId: string, input: { title?: unknown; source?: unknown; text?: unknown }) {
  await ensureSenderoSeeded();
  const clean = cleanInput(input);
  const id = `memo_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await getSenderoDb().prepare('INSERT INTO "MemorizationItem" (id, userId, title, source, contentText, currentLine, totalLines, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)')
    .bind(id, userId, clean.title, clean.source, clean.text, clean.total, now, now).run();
  return { id };
}

/** Editing keeps the progress, capped at the new number of lines. */
export async function updateMemorizationText(userId: string, id: string, input: { title?: unknown; source?: unknown; text?: unknown }) {
  await ensureSenderoSeeded();
  const clean = cleanInput(input);
  await getSenderoDb().prepare('UPDATE "MemorizationItem" SET title = ?, source = ?, contentText = ?, totalLines = ?, currentLine = MIN(currentLine, ?), updatedAt = ? WHERE id = ? AND userId = ?')
    .bind(clean.title, clean.source, clean.text, clean.total, clean.total, new Date().toISOString(), id, userId).run();
}

export async function archiveMemorizationText(userId: string, id: string) {
  await ensureSenderoSeeded();
  const now = new Date().toISOString();
  await getSenderoDb().prepare('UPDATE "MemorizationItem" SET archivedAt = ?, updatedAt = ? WHERE id = ? AND userId = ?').bind(now, now, id, userId).run();
}

export type MemorizationEvent = "ACERTOU" | "ERROU" | "AVANCOU" | "VOLTOU";

/**
 * Records a step of today's practice. Advancing or going back moves the
 * learned-lines mark; right/wrong answers only feed the history.
 */
export async function recordMemorization(userId: string, id: string, event: unknown, line: unknown) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const item = await getMemorizationText(userId, id);
  if (!item) throw new Error("Texto não encontrado.");
  const kind: MemorizationEvent = event === "ACERTOU" || event === "ERROU" || event === "AVANCOU" || event === "VOLTOU" ? event : "ACERTOU";
  const known = kind === "AVANCOU" ? Math.min(item.lines.length, item.known + 1) : kind === "VOLTOU" ? Math.max(0, item.known - 1) : item.known;
  const now = new Date().toISOString();
  const lineNumber = Math.max(1, Math.min(item.lines.length, Number(line) || item.known + 1));
  await db.batch([
    db.prepare('INSERT INTO "MemorizationProgressLog" (id, itemId, date, line, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(`memolog_${crypto.randomUUID()}`, id, getSaoPauloDateKey(), lineNumber, kind, now),
    db.prepare('UPDATE "MemorizationItem" SET currentLine = ?, updatedAt = ? WHERE id = ? AND userId = ?').bind(known, now, id, userId),
  ]);
  return { known };
}

/** The Memorização habit, so finishing a practice can mark it done today. */
export async function getMemorizationHabit(userId: string) {
  await ensureSenderoSeeded();
  return getSenderoDb().prepare('SELECT id FROM "HabitTemplate" WHERE userId = ? AND isActive = 1 AND practiceTool = \'MEMORIZAR\' ORDER BY createdAt LIMIT 1')
    .bind(userId).first<{ id: string }>();
}
