import { ensureReferenceLibrary, ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { indexedPassage, listIndexedPassages } from "@/lib/book-index";
import { createMemorizationText } from "@/lib/db/memorizacao";

/**
 * Frases e passagens. A literal quotation always carries its source; one from
 * the AD's books must be an exact stretch of the indexed passage (checked here,
 * never typed from memory). The user's synthesis is kept apart and labelled so.
 */

export type PassageKind = "LITERAL" | "SINTESE";
export type SavedPassage = {
  id: string; kind: PassageKind; text: string; author: string | null; work: string | null; edition: string | null;
  location: string | null; sourceType: "LIVRO_AD" | "MANUAL" | "PAGINA"; sourceRef: string | null; note: string | null;
  archivedAt: string | null; createdAt: string; updatedAt: string;
};
export type BookHit = { id: string; author: string; work: string; location: string; text: string; excerpt: string };

const MAX_TEXT = 4000;
const clean = (value: unknown, max = 300) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const cleanText = (value: unknown) => (typeof value === "string" ? value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT) : "");
const optional = (value: unknown, max = 300) => clean(value, max) || null;

export async function listPassages(userId: string) {
  await ensureSenderoSeeded();
  const rows = await getSenderoDb().prepare('SELECT * FROM "Passage" WHERE userId = ? AND archivedAt IS NULL ORDER BY createdAt DESC').bind(userId).all<SavedPassage>();
  const authors = new Map<string, number>();
  for (const row of rows.results) if (row.kind === "LITERAL" && row.author) authors.set(row.author, (authors.get(row.author) ?? 0) + 1);
  return { passages: rows.results, authors: [...authors.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })) };
}

/** Passages of the seven approved books, found by words (accents ignored). */
export async function searchBooks(query: string): Promise<BookHit[]> {
  if (!query.trim()) return [];
  const db = getSenderoDb();
  await ensureReferenceLibrary();
  const hits = await listIndexedPassages(db, query, 20);
  return hits.map((hit) => ({ id: hit.id, author: hit.author, work: hit.work, location: hit.location, text: hit.text, excerpt: hit.excerpt }));
}

function index(passage: { id: string; kind: PassageKind; text: string; author: string | null; work: string | null; note: string | null }, userId: string) {
  const db = getSenderoDb();
  const title = passage.kind === "LITERAL" ? [passage.author, passage.work].filter(Boolean).join(" · ") : "Minha síntese";
  return [
    db.prepare('DELETE FROM "SearchIndex" WHERE kind = \'FRASE\' AND refId = ?').bind(passage.id),
    db.prepare('INSERT INTO "SearchIndex" (kind, refId, userId, title, body) VALUES (\'FRASE\', ?, ?, ?, ?)').bind(passage.id, userId, title, [passage.text, passage.note].filter(Boolean).join("\n")),
  ];
}

async function owned(userId: string, id: unknown) {
  if (typeof id !== "string" || !id) throw new Error("Frase não informada.");
  const row = await getSenderoDb().prepare('SELECT * FROM "Passage" WHERE id = ? AND userId = ?').bind(id, userId).first<SavedPassage>();
  if (!row) throw new Error("Frase não encontrada.");
  return row;
}

export async function runPassageAction(userId: string, body: Record<string, unknown>): Promise<Record<string, unknown> | void> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const now = new Date().toISOString();
  switch (body.action) {
    case "searchBooks":
      return { hits: await searchBooks(clean(body.query, 200)) };
    case "fromBook": {
      // The stretch must be found word for word in the indexed passage.
      await ensureReferenceLibrary();
      if (typeof body.passageId !== "string") throw new Error("Escolha uma passagem dos livros.");
      const whole = await indexedPassage(db, body.passageId, undefined).catch(() => null);
      if (!whole) throw new Error("Passagem não encontrada nos livros do AD.");
      const selection = typeof body.selection === "string" ? body.selection.trim() : "";
      let span: { start: number; end: number } | undefined;
      if (selection) {
        const start = whole.text.indexOf(selection);
        if (start < 0) throw new Error("O trecho escolhido não está igual ao do livro. Selecione de novo, sem mudar o texto.");
        span = { start, end: start + selection.length };
      }
      const quote = await indexedPassage(db, body.passageId, span);
      const passage = {
        id: `frase_${crypto.randomUUID()}`, kind: "LITERAL" as const, text: quote.excerpt.trim(), author: quote.author, work: quote.work,
        edition: quote.edition || null, location: quote.location || (quote.page ? `p. ${quote.page}` : null), note: optional(body.note, MAX_TEXT),
      };
      await db.batch([
        db.prepare('INSERT INTO "Passage" (id, userId, kind, text, author, work, edition, location, sourceType, sourceRef, note, createdAt, updatedAt) VALUES (?, ?, \'LITERAL\', ?, ?, ?, ?, ?, \'LIVRO_AD\', ?, ?, ?, ?)')
          .bind(passage.id, userId, passage.text, passage.author, passage.work, passage.edition, passage.location, quote.id, passage.note, now, now),
        ...index(passage, userId),
      ]);
      return { id: passage.id };
    }
    case "create":
    case "update": {
      const existing = body.action === "update" ? await owned(userId, body.id) : null;
      if (existing?.sourceType === "LIVRO_AD") {
        // A quotation from the books keeps its text and source; only the comment changes.
        const note = optional(body.note, MAX_TEXT);
        await db.batch([
          db.prepare('UPDATE "Passage" SET note = ?, updatedAt = ? WHERE id = ?').bind(note, now, existing.id),
          ...index({ ...existing, note }, userId),
        ]);
        return { id: existing.id };
      }
      const kind: PassageKind = (existing?.kind ?? body.kind) === "SINTESE" ? "SINTESE" : "LITERAL";
      const text = cleanText(body.text);
      if (!text) throw new Error("Escreva a frase.");
      const author = optional(body.author);
      const work = optional(body.work);
      if (kind === "LITERAL" && (!author || !work)) throw new Error("Uma citação literal precisa de autor e obra. Se é sua, guarde como síntese.");
      const passage = { id: existing?.id ?? `frase_${crypto.randomUUID()}`, kind, text, author: kind === "LITERAL" ? author : null, work: kind === "LITERAL" ? work : null, note: optional(body.note, MAX_TEXT) };
      const edition = kind === "LITERAL" ? optional(body.edition) : null;
      const location = optional(body.location);
      const statement = existing
        ? db.prepare('UPDATE "Passage" SET text = ?, author = ?, work = ?, edition = ?, location = ?, note = ?, updatedAt = ? WHERE id = ?').bind(text, passage.author, passage.work, edition, location, passage.note, now, existing.id)
        : db.prepare('INSERT INTO "Passage" (id, userId, kind, text, author, work, edition, location, sourceType, sourceRef, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(passage.id, userId, kind, text, passage.author, passage.work, edition, location, body.pageId ? "PAGINA" : "MANUAL", typeof body.pageId === "string" ? body.pageId : null, passage.note, now, now);
      await db.batch([statement, ...index(passage, userId)]);
      return { id: passage.id };
    }
    case "archive": {
      const passage = await owned(userId, body.id);
      await db.prepare('UPDATE "Passage" SET archivedAt = ?, updatedAt = ? WHERE id = ?').bind(body.archived === false ? null : now, now, passage.id).run();
      return;
    }
    case "delete": {
      const passage = await owned(userId, body.id);
      if (!passage.archivedAt) throw new Error("Só é possível apagar de vez uma frase que está no arquivo.");
      if (body.confirm !== true) throw new Error("Confirme para apagar de vez.");
      await db.batch([
        db.prepare('DELETE FROM "SearchIndex" WHERE kind = \'FRASE\' AND refId = ?').bind(passage.id),
        db.prepare('DELETE FROM "Passage" WHERE id = ?').bind(passage.id),
      ]);
      return;
    }
    case "memorize": {
      const passage = await owned(userId, body.id);
      const firstWords = passage.text.split(/\s+/).slice(0, 5).join(" ");
      const title = `${passage.kind === "LITERAL" ? passage.author : "Minha síntese"} · ${firstWords}…`;
      const source = passage.kind === "LITERAL" ? [passage.work, passage.location].filter(Boolean).join(", ") : "Minha síntese";
      // One sentence (or clause after ; or :) per line, as the Memorização works line by line.
      const created = await createMemorizationText(userId, { title, source, text: passage.text.replace(/([.!?;:])\s+/g, "$1\n") });
      return { memorizationId: created.id };
    }
    default:
      throw new Error("Ação de frases não reconhecida.");
  }
}

export async function archivedPassages(userId: string) {
  await ensureSenderoSeeded();
  const rows = await getSenderoDb().prepare('SELECT * FROM "Passage" WHERE userId = ? AND archivedAt IS NOT NULL ORDER BY archivedAt DESC').bind(userId).all<SavedPassage>();
  return rows.results;
}
