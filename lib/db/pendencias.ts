import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";

/** App feedback (bugs and improvements) and questions to take to the master. */

export type FeedbackKind = "BUG" | "MELHORIA";
export type AppFeedback = {
  id: string; kind: FeedbackKind; description: string; page: string | null;
  status: "OPEN" | "DONE"; resolution: string | null; createdAt: string; resolvedAt: string | null;
};

export type MasterQuestionSource = "REFLEXAO" | "DIARIO" | "LIVRE";
export type MasterQuestion = {
  id: string; sourceType: MasterQuestionSource; sourceId: string | null; sourceDate: string | null;
  contextTitle: string | null; contextDetail: string | null; contextText: string | null;
  question: string; status: "OPEN" | "ANSWERED"; answer: string | null; createdAt: string; resolvedAt: string | null;
};

const MAX_TEXT = 20_000;
const clean = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "");
const optional = (value: unknown) => clean(value) || null;

export async function createFeedback(userId: string, input: { kind: unknown; description: unknown; page: unknown }) {
  await ensureSenderoSeeded();
  const kind: FeedbackKind = input.kind === "BUG" ? "BUG" : "MELHORIA";
  const description = clean(input.description);
  if (!description) throw new Error("Descreva o bug ou a melhoria.");
  const id = `feedback_${crypto.randomUUID()}`;
  await getSenderoDb().prepare('INSERT INTO "AppFeedback" (id, userId, kind, description, page, status, createdAt) VALUES (?, ?, ?, ?, ?, \'OPEN\', ?)')
    .bind(id, userId, kind, description, optional(input.page), new Date().toISOString()).run();
  return { id };
}

export async function listFeedback(userId: string) {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare('SELECT * FROM "AppFeedback" WHERE userId = ? ORDER BY CASE status WHEN \'OPEN\' THEN 0 ELSE 1 END, createdAt DESC LIMIT 300')
    .bind(userId).all<AppFeedback>();
  return result.results;
}

export async function setFeedbackStatus(userId: string, id: string, done: boolean, resolution?: unknown) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('UPDATE "AppFeedback" SET status = ?, resolution = ?, resolvedAt = ? WHERE id = ? AND userId = ?')
    .bind(done ? "DONE" : "OPEN", done ? optional(resolution) : null, done ? new Date().toISOString() : null, id, userId).run();
}

export async function createMasterQuestion(userId: string, input: Record<string, unknown>) {
  await ensureSenderoSeeded();
  const question = clean(input.question);
  if (!question) throw new Error("Escreva a dúvida que você quer levar.");
  const sourceType: MasterQuestionSource = input.sourceType === "REFLEXAO" || input.sourceType === "DIARIO" ? input.sourceType : "LIVRE";
  const sourceDate = typeof input.sourceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate) ? input.sourceDate : null;
  const id = `mestre_${crypto.randomUUID()}`;
  await getSenderoDb().prepare(`
    INSERT INTO "MasterQuestion" (id, userId, sourceType, sourceId, sourceDate, contextTitle, contextDetail, contextText, question, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
  `).bind(id, userId, sourceType, optional(input.sourceId), sourceDate, optional(input.contextTitle), optional(input.contextDetail), optional(input.contextText), question, new Date().toISOString()).run();
  return { id };
}

export async function listMasterQuestions(userId: string) {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare('SELECT * FROM "MasterQuestion" WHERE userId = ? ORDER BY CASE status WHEN \'OPEN\' THEN 0 ELSE 1 END, createdAt DESC LIMIT 300')
    .bind(userId).all<MasterQuestion>();
  return result.results;
}

export async function countOpenMasterQuestions(userId: string) {
  await ensureSenderoSeeded();
  const row = await getSenderoDb().prepare('SELECT COUNT(*) AS n FROM "MasterQuestion" WHERE userId = ? AND status = \'OPEN\'').bind(userId).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** Closing a question may record what the master said; reopening clears it. */
export async function setMasterQuestionStatus(userId: string, id: string, answered: boolean, answer?: unknown) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('UPDATE "MasterQuestion" SET status = ?, answer = ?, resolvedAt = ? WHERE id = ? AND userId = ?')
    .bind(answered ? "ANSWERED" : "OPEN", answered ? optional(answer) : null, answered ? new Date().toISOString() : null, id, userId).run();
}
