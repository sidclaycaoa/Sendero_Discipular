import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { DEFAULT_NOTEBOOKS, MARK_START, NOTEBOOK_COLORS, preview } from "@/lib/caderno-shared";

/**
 * Caderno: notebooks → sections → pages (one level of subpages). Pages save
 * often; a version of the previous text is kept every few minutes, archived
 * items are only hidden, and a page is deleted for good only from the archive.
 * One FTS5 index serves the search over pages and, when asked, reflections and
 * the diary.
 */

export type Notebook = { id: string; name: string; color: string; kind: "NORMAL" | "ENTRADA" | "FRASES"; position: number; archivedAt: string | null; updatedAt: string };
export type NoteSection = { id: string; notebookId: string; name: string; position: number; archivedAt: string | null };
export type NotePageSummary = { id: string; notebookId: string; sectionId: string | null; parentId: string | null; title: string; preview: string; position: number; updatedAt: string };
export type NotePage = NotePageSummary & { content: string | null; plainText: string; archivedAt: string | null; createdAt: string };
export type NotebookCard = Notebook & { sections: number; pages: number };
export type SearchHit = { kind: "PAGINA" | "REFLEXAO" | "DIARIO"; id: string; title: string; snippet: string; href: string | null; place: string; color: string | null };

const MAX_TITLE = 300;
const MAX_CONTENT = 900_000;
const VERSION_EVERY_MS = 10 * 60 * 1000;
const VERSIONS_KEPT = 50;
const UNTITLED = "Sem título";

const text = (value: unknown, max = MAX_TITLE) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();
const requireId = (value: unknown, what: string) => {
  if (typeof value !== "string" || !value) throw new Error(`${what} não informado.`);
  return value;
};

/** The first visit creates the suggested notebooks; after that the user adds, renames and archives freely. */
async function ensureNotebooks(userId: string) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const existing = await db.prepare('SELECT COUNT(*) AS n FROM "Notebook" WHERE userId = ?').bind(userId).first<{ n: number }>();
  if (Number(existing?.n ?? 0) > 0) return;
  const now = nowIso();
  await db.batch(DEFAULT_NOTEBOOKS.map((notebook, index) => db.prepare('INSERT INTO "Notebook" (id, userId, name, color, kind, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id("nb"), userId, notebook.name, notebook.color, notebook.kind, index, now, now)));
}

export async function getCadernoHome(userId: string) {
  await ensureNotebooks(userId);
  const db = getSenderoDb();
  const [notebooks, recent, archived] = await Promise.all([
    db.prepare(`
      SELECT n.id, n.name, n.color, n.kind, n.position, n.archivedAt, n.updatedAt,
        (SELECT COUNT(*) FROM "NoteSection" s WHERE s.notebookId = n.id AND s.archivedAt IS NULL) AS sections,
        (SELECT COUNT(*) FROM "NotePage" p WHERE p.notebookId = n.id AND p.archivedAt IS NULL) AS pages
      FROM "Notebook" n WHERE n.userId = ? AND n.archivedAt IS NULL ORDER BY n.position, n.createdAt
    `).bind(userId).all<NotebookCard>(),
    db.prepare(`
      SELECT p.id, p.title, p.plainText, p.updatedAt, n.name AS notebook, n.color, s.name AS section
      FROM "NotePage" p JOIN "Notebook" n ON n.id = p.notebookId LEFT JOIN "NoteSection" s ON s.id = p.sectionId
      WHERE p.userId = ? AND p.archivedAt IS NULL AND n.archivedAt IS NULL AND (s.id IS NULL OR s.archivedAt IS NULL)
      ORDER BY p.updatedAt DESC LIMIT 4
    `).bind(userId).all<{ id: string; title: string; plainText: string; updatedAt: string; notebook: string; color: string; section: string | null }>(),
    db.prepare(`
      SELECT (SELECT COUNT(*) FROM "NotePage" WHERE userId = ?1 AND archivedAt IS NOT NULL)
           + (SELECT COUNT(*) FROM "NoteSection" WHERE userId = ?1 AND archivedAt IS NOT NULL)
           + (SELECT COUNT(*) FROM "Notebook" WHERE userId = ?1 AND archivedAt IS NOT NULL) AS n
    `).bind(userId).first<{ n: number }>(),
  ]);
  return {
    notebooks: notebooks.results.map((row) => ({ ...row, sections: Number(row.sections), pages: Number(row.pages) })),
    recent: recent.results.map((row) => ({ id: row.id, title: row.title || UNTITLED, place: [row.notebook, row.section].filter(Boolean).join(" › "), color: row.color, updatedAt: row.updatedAt })),
    archived: Number(archived?.n ?? 0),
  };
}

export async function getNotebook(userId: string, notebookId: string) {
  await ensureNotebooks(userId);
  const db = getSenderoDb();
  const notebook = await db.prepare('SELECT id, name, color, kind, position, archivedAt, updatedAt FROM "Notebook" WHERE id = ? AND userId = ?').bind(notebookId, userId).first<Notebook>();
  if (!notebook) return null;
  const [sections, pages] = await Promise.all([
    db.prepare('SELECT id, notebookId, name, position, archivedAt FROM "NoteSection" WHERE notebookId = ? AND archivedAt IS NULL ORDER BY position, createdAt').bind(notebookId).all<NoteSection>(),
    db.prepare('SELECT id, notebookId, sectionId, parentId, title, plainText, position, updatedAt FROM "NotePage" WHERE notebookId = ? AND archivedAt IS NULL ORDER BY position, createdAt').bind(notebookId).all<NotePageSummary & { plainText: string }>(),
  ]);
  return { notebook, sections: sections.results, pages: pages.results.map(summary) };
}

function summary(row: NotePageSummary & { plainText: string }): NotePageSummary {
  return { id: row.id, notebookId: row.notebookId, sectionId: row.sectionId, parentId: row.parentId, title: row.title || UNTITLED, preview: preview(row.plainText), position: row.position, updatedAt: row.updatedAt };
}

export async function getPage(userId: string, pageId: string) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const page = await db.prepare('SELECT id, notebookId, sectionId, parentId, title, content, plainText, position, archivedAt, createdAt, updatedAt FROM "NotePage" WHERE id = ? AND userId = ?').bind(pageId, userId).first<NotePage & { plainText: string }>();
  if (!page) return null;
  const [notebooks, sections, parent, children, versions] = await Promise.all([
    db.prepare('SELECT id, name, color, kind, position, archivedAt, updatedAt FROM "Notebook" WHERE userId = ? AND archivedAt IS NULL ORDER BY position, createdAt').bind(userId).all<Notebook>(),
    db.prepare('SELECT s.id, s.notebookId, s.name, s.position, s.archivedAt FROM "NoteSection" s JOIN "Notebook" n ON n.id = s.notebookId WHERE s.userId = ? AND s.archivedAt IS NULL AND n.archivedAt IS NULL ORDER BY s.position, s.createdAt').bind(userId).all<NoteSection>(),
    page.parentId ? db.prepare('SELECT id, title FROM "NotePage" WHERE id = ? AND userId = ?').bind(page.parentId, userId).first<{ id: string; title: string }>() : Promise.resolve(null),
    db.prepare('SELECT id, notebookId, sectionId, parentId, title, plainText, position, updatedAt FROM "NotePage" WHERE parentId = ? AND archivedAt IS NULL ORDER BY position, createdAt').bind(pageId).all<NotePageSummary & { plainText: string }>(),
    db.prepare('SELECT COUNT(*) AS n FROM "NotePageVersion" WHERE pageId = ?').bind(pageId).first<{ n: number }>(),
  ]);
  const notebook = notebooks.results.find((item) => item.id === page.notebookId) ?? await db.prepare('SELECT id, name, color, kind, position, archivedAt, updatedAt FROM "Notebook" WHERE id = ?').bind(page.notebookId).first<Notebook>();
  return {
    page: { ...page, title: page.title },
    notebook: notebook!,
    section: sections.results.find((item) => item.id === page.sectionId) ?? null,
    parent: parent ? { id: parent.id, title: parent.title || UNTITLED } : null,
    children: children.results.map(summary),
    versions: Number(versions?.n ?? 0),
    notebooks: notebooks.results,
    sections: sections.results,
  };
}

export async function listVersions(userId: string, pageId: string) {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare('SELECT id, title, plainText, createdAt FROM "NotePageVersion" WHERE pageId = ? AND userId = ? ORDER BY createdAt DESC')
    .bind(pageId, userId).all<{ id: string; title: string; plainText: string; createdAt: string }>();
  return result.results.map((row) => ({ id: row.id, title: row.title || UNTITLED, preview: preview(row.plainText, 160), createdAt: row.createdAt }));
}

export async function getArchive(userId: string) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const [notebooks, sections, pages] = await Promise.all([
    db.prepare('SELECT id, name, color, archivedAt FROM "Notebook" WHERE userId = ? AND archivedAt IS NOT NULL ORDER BY archivedAt DESC').bind(userId).all<{ id: string; name: string; color: string; archivedAt: string }>(),
    db.prepare('SELECT s.id, s.name, s.archivedAt, n.name AS notebook, n.color FROM "NoteSection" s JOIN "Notebook" n ON n.id = s.notebookId WHERE s.userId = ? AND s.archivedAt IS NOT NULL ORDER BY s.archivedAt DESC').bind(userId).all<{ id: string; name: string; archivedAt: string; notebook: string; color: string }>(),
    db.prepare(`
      SELECT p.id, p.title, p.plainText, p.archivedAt, n.name AS notebook, n.color
      FROM "NotePage" p JOIN "Notebook" n ON n.id = p.notebookId
      WHERE p.userId = ? AND p.archivedAt IS NOT NULL AND (p.parentId IS NULL OR p.parentId NOT IN (SELECT id FROM "NotePage" WHERE archivedAt = p.archivedAt))
      ORDER BY p.archivedAt DESC
    `).bind(userId).all<{ id: string; title: string; plainText: string; archivedAt: string; notebook: string; color: string }>(),
  ]);
  return {
    notebooks: notebooks.results,
    sections: sections.results,
    pages: pages.results.map((row) => ({ id: row.id, title: row.title || UNTITLED, preview: preview(row.plainText), archivedAt: row.archivedAt, notebook: row.notebook, color: row.color })),
  };
}

/** Builds an FTS5 query: every word must appear, as the start of a word, ignoring accents ("dever" finds "deveres"). */
export function searchQuery(input: string) {
  const words = (input.normalize("NFC").toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
  return words.map((word) => `"${word}"*`).join(" ");
}

export async function search(userId: string, input: string, everywhere: boolean): Promise<SearchHit[]> {
  await ensureNotebooks(userId);
  const query = searchQuery(input);
  if (!query) return [];
  const db = getSenderoDb();
  if (everywhere) await refreshWritings(userId);
  const rows = await db.prepare(`
    SELECT kind, refId, title, snippet("SearchIndex", 4, char(2), char(3), '…', 14) AS body, snippet("SearchIndex", 3, char(2), char(3), '…', 14) AS heading
    FROM "SearchIndex" WHERE "SearchIndex" MATCH ? AND userId = ? ${everywhere ? "" : "AND kind = 'PAGINA'"}
    ORDER BY rank LIMIT 80
  `).bind(query, userId).all<{ kind: SearchHit["kind"]; refId: string; title: string; body: string; heading: string }>();
  const pageIds = rows.results.filter((row) => row.kind === "PAGINA").map((row) => row.refId);
  const reflectionIds = rows.results.filter((row) => row.kind === "REFLEXAO").map((row) => row.refId);
  const diaryIds = rows.results.filter((row) => row.kind === "DIARIO").map((row) => row.refId);
  const marks = (count: number) => Array.from({ length: count }, () => "?").join(",") || "''";
  const [pages, reflections, diaries] = await Promise.all([
    pageIds.length ? db.prepare(`
      SELECT p.id, n.name AS notebook, n.color, s.name AS section FROM "NotePage" p JOIN "Notebook" n ON n.id = p.notebookId LEFT JOIN "NoteSection" s ON s.id = p.sectionId
      WHERE p.id IN (${marks(pageIds.length)}) AND p.archivedAt IS NULL AND n.archivedAt IS NULL AND (s.id IS NULL OR s.archivedAt IS NULL)
    `).bind(...pageIds).all<{ id: string; notebook: string; color: string; section: string | null }>() : Promise.resolve({ results: [] }),
    reflectionIds.length ? db.prepare(`SELECT id, templateId, substr(date, 1, 10) AS date FROM "ReflectionEntry" WHERE id IN (${marks(reflectionIds.length)})`).bind(...reflectionIds).all<{ id: string; templateId: string; date: string }>() : Promise.resolve({ results: [] }),
    diaryIds.length ? db.prepare(`SELECT id, substr(date, 1, 10) AS date FROM "DiaryEntry" WHERE id IN (${marks(diaryIds.length)})`).bind(...diaryIds).all<{ id: string; date: string }>() : Promise.resolve({ results: [] }),
  ]);
  const hits: SearchHit[] = [];
  for (const row of rows.results) {
    const snippet = row.body.includes(MARK_START) || !row.heading.includes(MARK_START) ? row.body : preview(row.body.replace(/[\u0002\u0003]/g, ""), 160);
    if (row.kind === "PAGINA") {
      const page = (pages.results as Array<{ id: string; notebook: string; color: string; section: string | null }>).find((item) => item.id === row.refId);
      if (page) hits.push({ kind: "PAGINA", id: row.refId, title: row.title || UNTITLED, snippet, href: `/caderno/pagina/${row.refId}`, place: [page.notebook, page.section].filter(Boolean).join(" › "), color: page.color });
    } else if (row.kind === "REFLEXAO") {
      const entry = (reflections.results as Array<{ id: string; templateId: string; date: string }>).find((item) => item.id === row.refId);
      if (entry) hits.push({ kind: "REFLEXAO", id: row.refId, title: row.title, snippet, href: `/refletir/${entry.templateId}?date=${entry.date}`, place: `Reflexão · ${shortDate(entry.date)}`, color: null });
    } else {
      const entry = (diaries.results as Array<{ id: string; date: string }>).find((item) => item.id === row.refId);
      if (entry) hits.push({ kind: "DIARIO", id: row.refId, title: `Diário de ${shortDate(entry.date)}`, snippet, href: null, place: "Diário", color: null });
    }
  }
  return hits;
}

/** Puts reflections and the diary in the search index again when they changed since the last search. */
async function refreshWritings(userId: string) {
  const db = getSenderoDb();
  const [reflections, diaries, known] = await Promise.all([
    db.prepare('SELECT COUNT(*) || \'|\' || COALESCE(MAX(updatedAt), \'\') AS signature FROM "ReflectionEntry" WHERE userId = ?').bind(userId).first<{ signature: string }>(),
    db.prepare('SELECT COUNT(*) || \'|\' || COALESCE(MAX(updatedAt), \'\') AS signature FROM "DiaryEntry" WHERE userId = ?').bind(userId).first<{ signature: string }>(),
    db.prepare('SELECT kind, signature FROM "SearchSource" WHERE userId = ?').bind(userId).all<{ kind: string; signature: string }>(),
  ]);
  const stale = (kind: string, signature = "") => known.results.find((row) => row.kind === kind)?.signature !== signature;
  const statements = [];
  if (stale("REFLEXAO", reflections?.signature)) {
    statements.push(
      db.prepare('DELETE FROM "SearchIndex" WHERE kind = \'REFLEXAO\' AND userId = ?').bind(userId),
      db.prepare(`
        INSERT INTO "SearchIndex" (kind, refId, userId, title, body)
        SELECT 'REFLEXAO', re.id, re.userId, COALESCE(rt.topic, 'Reflexão'), re.contentText
        FROM "ReflectionEntry" re LEFT JOIN "ReflectionTemplate" rt ON rt.id = re.templateId WHERE re.userId = ?
      `).bind(userId),
      db.prepare('INSERT OR REPLACE INTO "SearchSource" (userId, kind, signature) VALUES (?, \'REFLEXAO\', ?)').bind(userId, reflections?.signature ?? ""),
    );
  }
  if (stale("DIARIO", diaries?.signature)) {
    const rows = await db.prepare('SELECT id, fixedAnswer, rotatingAnswers FROM "DiaryEntry" WHERE userId = ?').bind(userId).all<{ id: string; fixedAnswer: string; rotatingAnswers: string }>();
    statements.push(db.prepare('DELETE FROM "SearchIndex" WHERE kind = \'DIARIO\' AND userId = ?').bind(userId));
    for (const row of rows.results) statements.push(db.prepare('INSERT INTO "SearchIndex" (kind, refId, userId, title, body) VALUES (\'DIARIO\', ?, ?, \'\', ?)').bind(row.id, userId, diaryText(row.fixedAnswer, row.rotatingAnswers)));
    statements.push(db.prepare('INSERT OR REPLACE INTO "SearchSource" (userId, kind, signature) VALUES (?, \'DIARIO\', ?)').bind(userId, diaries?.signature ?? ""));
  }
  if (statements.length) await db.batch(statements);
}

/** The diary's answers as plain text, whatever shape the stored JSON has (older entries are not always JSON). */
export function diaryText(fixedAnswer: string, rotatingAnswers: string) {
  const parts = [fixedAnswer];
  try {
    const collect = (value: unknown): void => {
      if (typeof value === "string") parts.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(JSON.parse(rotatingAnswers));
  } catch {
    parts.push(rotatingAnswers);
  }
  return parts.filter(Boolean).join("\n");
}

async function nextPosition(table: "Notebook" | "NoteSection" | "NotePage", column: "userId" | "notebookId", value: string) {
  const row = await getSenderoDb().prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS n FROM "${table}" WHERE ${column} = ?`).bind(value).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

async function ownedNotebook(userId: string, notebookId: unknown) {
  const row = await getSenderoDb().prepare('SELECT id, kind FROM "Notebook" WHERE id = ? AND userId = ?').bind(requireId(notebookId, "Caderno"), userId).first<{ id: string; kind: string }>();
  if (!row) throw new Error("Caderno não encontrado.");
  return row;
}

async function ownedSection(userId: string, sectionId: unknown, notebookId: string) {
  if (sectionId === null || sectionId === undefined || sectionId === "") return null;
  const row = await getSenderoDb().prepare('SELECT id FROM "NoteSection" WHERE id = ? AND userId = ? AND notebookId = ?').bind(requireId(sectionId, "Seção"), userId, notebookId).first<{ id: string }>();
  if (!row) throw new Error("Seção não encontrada neste caderno.");
  return row.id;
}

/** Every change made from the Caderno screens. */
export async function runCadernoAction(userId: string, body: Record<string, unknown>): Promise<Record<string, unknown> | void> {
  await ensureNotebooks(userId);
  const db = getSenderoDb();
  const now = nowIso();
  switch (body.action) {
    case "createNotebook": {
      const name = text(body.name);
      if (!name) throw new Error("Dê um nome ao caderno.");
      const color = NOTEBOOK_COLORS.includes(String(body.color)) ? String(body.color) : NOTEBOOK_COLORS[0];
      const notebookId = id("nb");
      await db.prepare('INSERT INTO "Notebook" (id, userId, name, color, kind, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, \'NORMAL\', ?, ?, ?)')
        .bind(notebookId, userId, name, color, await nextPosition("Notebook", "userId", userId), now, now).run();
      return { id: notebookId };
    }
    case "updateNotebook": {
      const notebook = await ownedNotebook(userId, body.id);
      const name = body.name === undefined ? null : text(body.name);
      if (name === "") throw new Error("Dê um nome ao caderno.");
      const color = typeof body.color === "string" && NOTEBOOK_COLORS.includes(body.color) ? body.color : null;
      const archived = typeof body.archived === "boolean" ? body.archived : null;
      await db.prepare('UPDATE "Notebook" SET name = COALESCE(?1, name), color = COALESCE(?2, color), archivedAt = CASE WHEN ?3 = 1 THEN ?4 ELSE archivedAt END, updatedAt = ?5 WHERE id = ?6')
        .bind(name, color, archived === null ? 0 : 1, archived ? now : null, now, notebook.id).run();
      return;
    }
    case "createSection": {
      const notebook = await ownedNotebook(userId, body.notebookId);
      const name = text(body.name);
      if (!name) throw new Error("Dê um nome à seção.");
      const sectionId = id("sec");
      await db.prepare('INSERT INTO "NoteSection" (id, userId, notebookId, name, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(sectionId, userId, notebook.id, name, await nextPosition("NoteSection", "notebookId", notebook.id), now, now).run();
      return { id: sectionId };
    }
    case "updateSection": {
      const section = await db.prepare('SELECT id FROM "NoteSection" WHERE id = ? AND userId = ?').bind(requireId(body.id, "Seção"), userId).first<{ id: string }>();
      if (!section) throw new Error("Seção não encontrada.");
      const name = body.name === undefined ? null : text(body.name);
      if (name === "") throw new Error("Dê um nome à seção.");
      const archived = typeof body.archived === "boolean" ? body.archived : null;
      await db.prepare('UPDATE "NoteSection" SET name = COALESCE(?1, name), archivedAt = CASE WHEN ?2 = 1 THEN ?3 ELSE archivedAt END, updatedAt = ?4 WHERE id = ?5')
        .bind(name, archived === null ? 0 : 1, archived ? now : null, now, section.id).run();
      return;
    }
    case "createPage": {
      let notebookId: string;
      let sectionId: string | null = null;
      let parentId: string | null = null;
      if (body.parentId) {
        const parent = await db.prepare('SELECT id, notebookId, sectionId, parentId FROM "NotePage" WHERE id = ? AND userId = ?').bind(requireId(body.parentId, "Página"), userId).first<{ id: string; notebookId: string; sectionId: string | null; parentId: string | null }>();
        if (!parent) throw new Error("Página não encontrada.");
        // Subpages have one level, as in OneNote: a subpage of a subpage goes under the same parent.
        parentId = parent.parentId ?? parent.id;
        notebookId = parent.notebookId;
        sectionId = parent.sectionId;
      } else if (body.inbox) {
        const inbox = await db.prepare('SELECT id FROM "Notebook" WHERE userId = ? AND kind = \'ENTRADA\' AND archivedAt IS NULL ORDER BY position LIMIT 1').bind(userId).first<{ id: string }>();
        notebookId = inbox?.id ?? (await ownedNotebook(userId, body.notebookId)).id;
      } else {
        notebookId = (await ownedNotebook(userId, body.notebookId)).id;
        sectionId = await ownedSection(userId, body.sectionId, notebookId);
      }
      const plain = text(body.text, MAX_CONTENT);
      const title = text(body.title) || (plain ? preview(plain.split("\n")[0], 60) : "");
      const content = plain ? JSON.stringify({ type: "doc", content: plain.split(/\n+/).map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })) }) : null;
      const pageId = id("pg");
      await db.batch([
        db.prepare('INSERT INTO "NotePage" (id, userId, notebookId, sectionId, parentId, title, content, plainText, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(pageId, userId, notebookId, sectionId, parentId, title, content, plain, await nextPosition("NotePage", "notebookId", notebookId), now, now),
        db.prepare('INSERT INTO "SearchIndex" (kind, refId, userId, title, body) VALUES (\'PAGINA\', ?, ?, ?, ?)').bind(pageId, userId, title, plain),
      ]);
      return { id: pageId };
    }
    case "savePage":
      return savePage(userId, body);
    case "movePage": {
      const page = await db.prepare('SELECT id FROM "NotePage" WHERE id = ? AND userId = ?').bind(requireId(body.id, "Página"), userId).first<{ id: string }>();
      if (!page) throw new Error("Página não encontrada.");
      const notebook = await ownedNotebook(userId, body.notebookId);
      const sectionId = await ownedSection(userId, body.sectionId, notebook.id);
      const position = await nextPosition("NotePage", "notebookId", notebook.id);
      // A page moves with its subpages; moved on its own, a subpage becomes a page.
      await db.batch([
        db.prepare('UPDATE "NotePage" SET notebookId = ?, sectionId = ?, parentId = NULL, position = ?, updatedAt = ? WHERE id = ?').bind(notebook.id, sectionId, position, now, page.id),
        db.prepare('UPDATE "NotePage" SET notebookId = ?, sectionId = ?, updatedAt = ? WHERE parentId = ?').bind(notebook.id, sectionId, now, page.id),
      ]);
      return;
    }
    case "reorder":
      return reorder(userId, body);
    case "archivePage": {
      const page = await db.prepare('SELECT id, archivedAt FROM "NotePage" WHERE id = ? AND userId = ?').bind(requireId(body.id, "Página"), userId).first<{ id: string; archivedAt: string | null }>();
      if (!page) throw new Error("Página não encontrada.");
      if (body.archived === false) {
        // Restoring brings back the subpages archived together with it.
        await db.prepare('UPDATE "NotePage" SET archivedAt = NULL, updatedAt = ?2 WHERE id = ?1 OR (parentId = ?1 AND archivedAt = ?3)')
          .bind(page.id, now, page.archivedAt).run();
      } else {
        await db.prepare('UPDATE "NotePage" SET archivedAt = ?2, updatedAt = ?2 WHERE (id = ?1 OR parentId = ?1) AND archivedAt IS NULL').bind(page.id, now).run();
      }
      return;
    }
    case "deletePage": {
      const page = await db.prepare('SELECT id, archivedAt FROM "NotePage" WHERE id = ? AND userId = ?').bind(requireId(body.id, "Página"), userId).first<{ id: string; archivedAt: string | null }>();
      if (!page) throw new Error("Página não encontrada.");
      if (!page.archivedAt) throw new Error("Só é possível apagar de vez uma página que está no arquivo.");
      if (body.confirm !== true) throw new Error("Confirme para apagar de vez.");
      const ids = [page.id, ...(await db.prepare('SELECT id FROM "NotePage" WHERE parentId = ? AND archivedAt = ?').bind(page.id, page.archivedAt).all<{ id: string }>()).results.map((row) => row.id)];
      await db.batch(ids.flatMap((pageId) => [
        db.prepare('DELETE FROM "NotePageVersion" WHERE pageId = ?').bind(pageId),
        db.prepare('DELETE FROM "SearchIndex" WHERE kind = \'PAGINA\' AND refId = ?').bind(pageId),
        db.prepare('DELETE FROM "NotePage" WHERE id = ?').bind(pageId),
      ]));
      // Subpages left behind (archived at another moment) become pages of their own.
      await db.prepare('UPDATE "NotePage" SET parentId = NULL WHERE parentId = ?').bind(page.id).run();
      return;
    }
    case "listVersions":
      return { versions: await listVersions(userId, requireId(body.id, "Página")) };
    case "restoreVersion": {
      const version = await db.prepare('SELECT v.pageId, v.title, v.content, v.plainText FROM "NotePageVersion" v WHERE v.id = ? AND v.userId = ?').bind(requireId(body.id, "Versão"), userId).first<{ pageId: string; title: string; content: string | null; plainText: string }>();
      if (!version) throw new Error("Versão não encontrada.");
      // The text being replaced is kept as a version too, so restoring can be undone.
      return savePage(userId, { id: version.pageId, title: version.title, content: version.content, text: version.plainText, forceVersion: true });
    }
    default:
      throw new Error("Ação do Caderno não reconhecida.");
  }
}

async function savePage(userId: string, body: Record<string, unknown>) {
  const db = getSenderoDb();
  const page = await db.prepare('SELECT id, title, content, plainText, updatedAt FROM "NotePage" WHERE id = ? AND userId = ?').bind(requireId(body.id, "Página"), userId).first<{ id: string; title: string; content: string | null; plainText: string; updatedAt: string }>();
  if (!page) throw new Error("Página não encontrada.");
  const title = text(body.title);
  const content = typeof body.content === "string" ? body.content : body.content == null ? null : JSON.stringify(body.content);
  if (content && content.length > MAX_CONTENT) throw new Error("A página ficou grande demais. Divida o texto em duas páginas.");
  const plain = typeof body.text === "string" ? body.text.slice(0, MAX_CONTENT) : "";
  const changed = page.title !== title || (page.content ?? null) !== content;
  if (!changed) return { updatedAt: page.updatedAt };
  const now = nowIso();
  const last = await db.prepare('SELECT MAX(createdAt) AS at FROM "NotePageVersion" WHERE pageId = ?').bind(page.id).first<{ at: string | null }>();
  const keepVersion = (page.content || page.title) && (body.forceVersion === true || !last?.at || Date.parse(now) - Date.parse(last.at) >= VERSION_EVERY_MS);
  await db.batch([
    ...(keepVersion ? [
      db.prepare('INSERT INTO "NotePageVersion" (id, userId, pageId, title, content, plainText, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id("ver"), userId, page.id, page.title, page.content, page.plainText, now),
      db.prepare('DELETE FROM "NotePageVersion" WHERE pageId = ?1 AND id NOT IN (SELECT id FROM "NotePageVersion" WHERE pageId = ?1 ORDER BY createdAt DESC LIMIT ?2)').bind(page.id, VERSIONS_KEPT),
    ] : []),
    db.prepare('UPDATE "NotePage" SET title = ?, content = ?, plainText = ?, updatedAt = ? WHERE id = ?').bind(title, content, plain, now, page.id),
    db.prepare('DELETE FROM "SearchIndex" WHERE kind = \'PAGINA\' AND refId = ?').bind(page.id),
    db.prepare('INSERT INTO "SearchIndex" (kind, refId, userId, title, body) VALUES (\'PAGINA\', ?, ?, ?, ?)').bind(page.id, userId, title, plain),
  ]);
  return { updatedAt: now };
}

/** Moves a notebook, section or page one place up or down among its siblings. */
async function reorder(userId: string, body: Record<string, unknown>) {
  const db = getSenderoDb();
  const direction = body.direction === "up" ? -1 : 1;
  const itemId = requireId(body.id, "Item");
  type Row = { id: string; position: number };
  let siblings: Row[];
  let table: "Notebook" | "NoteSection" | "NotePage";
  if (body.kind === "notebook") {
    table = "Notebook";
    siblings = (await db.prepare('SELECT id, position FROM "Notebook" WHERE userId = ? AND archivedAt IS NULL ORDER BY position, createdAt').bind(userId).all<Row>()).results;
  } else if (body.kind === "section") {
    table = "NoteSection";
    const section = await db.prepare('SELECT notebookId FROM "NoteSection" WHERE id = ? AND userId = ?').bind(itemId, userId).first<{ notebookId: string }>();
    if (!section) throw new Error("Seção não encontrada.");
    siblings = (await db.prepare('SELECT id, position FROM "NoteSection" WHERE notebookId = ? AND archivedAt IS NULL ORDER BY position, createdAt').bind(section.notebookId).all<Row>()).results;
  } else {
    table = "NotePage";
    const page = await db.prepare('SELECT notebookId, sectionId, parentId FROM "NotePage" WHERE id = ? AND userId = ?').bind(itemId, userId).first<{ notebookId: string; sectionId: string | null; parentId: string | null }>();
    if (!page) throw new Error("Página não encontrada.");
    siblings = (await db.prepare('SELECT id, position FROM "NotePage" WHERE notebookId = ? AND sectionId IS ? AND parentId IS ? AND archivedAt IS NULL ORDER BY position, createdAt').bind(page.notebookId, page.sectionId, page.parentId).all<Row>()).results;
  }
  const index = siblings.findIndex((row) => row.id === itemId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= siblings.length) return;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  await db.batch(siblings.map((row, position) => db.prepare(`UPDATE "${table}" SET position = ? WHERE id = ?`).bind(position, row.id)));
}

function shortDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`)).replace(".", "").replace(/ de /g, " ");
}
