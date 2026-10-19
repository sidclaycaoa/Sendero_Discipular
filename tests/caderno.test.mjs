import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Real SQLite (with FTS5) + the built Worker: notebooks, sections, pages, versions, archive and search.
class D1 {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); }
  prepare(sql) {
    const sqlite = this.sqlite; let args = [];
    const query = {
      bind(...values) { args = values; return query; },
      async first(column) { const r = sqlite.prepare(sql).get(...args); return r ? (column ? r[column] : { ...r }) : null; },
      async all() { return { results: sqlite.prepare(sql).all(...args).map(r => ({ ...r })), success: true, meta: {} }; },
      async run() { return { results: [], success: true, meta: { ...sqlite.prepare(sql).run(...args) } }; },
      _sql: sql, _args: () => args,
    }; return query;
  }
  async batch(statements) { for (const s of statements) this.sqlite.prepare(s._sql).run(...s._args()); return statements.map(() => ({ results: [], success: true, meta: {} })); }
}

test("the Caderno keeps notebooks, sections and pages, never loses a text and finds it again", async () => {
  const db = new D1();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) db.sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,birthDate,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("u1", "sidclay@example.com", "Teste", "1994-01-21T00:00:00.000Z", `${today}T00:00:00Z`, now, now);

  const { default: worker } = await import(new URL(`../dist/server/index.js?caderno=${Date.now()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha-de-teste", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const get = async (path) => { const r = await worker.fetch(new Request(`https://s${path}`, { headers: { accept: "text/html", cookie } }), env, ctx); return { status: r.status, text: (await r.text()).replace(/<!-- -->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") }; };
  const act = async (body) => { const r = await worker.fetch(new Request("https://s/api/caderno", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }), env, ctx); return { status: r.status, ...(await r.json()) }; };
  const count = (sql, ...args) => db.sqlite.prepare(sql).get(...args).n;

  // The first visit creates the suggested notebooks; the bottom menu now has the Caderno in place of the Diário.
  let page = await get("/caderno");
  assert.equal(page.status, 200);
  assert.match(page.text, /Escola do Discipulado .*Leituras .*Aulas .*Vida e trabalho .*Frases e passagens 0 frases .*Caixa de entrada/);
  assert.match(page.text, /Início Refletir Hábitos Agenda Caderno/);
  assert.ok(!/Agenda Diário/.test(page.text));
  assert.equal(count('SELECT COUNT(*) AS n FROM "Notebook"'), 6);
  await get("/caderno");
  assert.equal(count('SELECT COUNT(*) AS n FROM "Notebook"'), 6, "visiting again does not duplicate");

  // Notebook → section → page → subpage.
  const notebook = await act({ action: "createNotebook", name: "Estudos", color: "#2f5d62" });
  assert.equal(notebook.status, 200);
  assert.equal((await act({ action: "createNotebook", name: "  " })).status, 400);
  const section = await act({ action: "createSection", notebookId: notebook.id, name: "Bastiões" });
  const created = await act({ action: "createPage", notebookId: notebook.id, sectionId: section.id });
  const doc = (text) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  await act({ action: "savePage", id: created.id, title: "Bastião 12 · O tempo", content: doc("Os deveres do discípulo pedem constância."), text: "Os deveres do discípulo pedem constância." });
  const sub = await act({ action: "createPage", parentId: created.id });
  const subSub = await act({ action: "createPage", parentId: sub.id });
  assert.equal(db.sqlite.prepare('SELECT parentId FROM "NotePage" WHERE id = ?').get(subSub.id).parentId, created.id, "subpages have one level");

  page = await get(`/caderno/${notebook.id}`);
  assert.match(page.text, /Estudos/);
  assert.match(page.text, /Bastiões 3 pág\. Bastião 12 · O tempo .*Os deveres do discípulo/);
  assert.match((await get(`/caderno/pagina/${created.id}`)).text, /Estudos › Bastiões .*Bastião 12 · O tempo/);

  // Versions: the text being replaced is kept (at most one every few minutes), and restoring keeps the current one too.
  await act({ action: "savePage", id: created.id, title: "Bastião 12 · O tempo", content: doc("Segunda escrita."), text: "Segunda escrita." });
  await act({ action: "savePage", id: created.id, title: "Bastião 12 · O tempo", content: doc("Terceira escrita."), text: "Terceira escrita." });
  assert.equal(count('SELECT COUNT(*) AS n FROM "NotePageVersion" WHERE pageId = ?', created.id), 1);
  const { versions } = await act({ action: "listVersions", id: created.id });
  assert.match(versions[0].preview, /Os deveres do discípulo/);
  await act({ action: "restoreVersion", id: versions[0].id });
  assert.equal(db.sqlite.prepare('SELECT plainText FROM "NotePage" WHERE id = ?').get(created.id).plainText, "Os deveres do discípulo pedem constância.");
  assert.equal(count('SELECT COUNT(*) AS n FROM "NotePageVersion" WHERE pageId = ?', created.id), 2);

  // Search ignores accents and finds the start of words ("dever" → "deveres", "discipulo" → "discípulo").
  page = await get(`/caderno/busca?q=${encodeURIComponent("dever discipulo")}`);
  assert.match(page.text, /Páginas do Caderno 1 Bastião 12 · O tempo Os deveres do discípulo pedem constância\. Estudos › Bastiões/);

  // Reflections and the diary come in only when asked.
  db.sqlite.prepare('INSERT INTO "DiaryEntry" (id,userId,date,fixedAnswer,rotatingAnswers,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("d1", "u1", today, "Cumpri o dever mesmo cansado.", JSON.stringify({ answers: ["Gratidão pelo dia."] }), now, now);
  db.sqlite.prepare('INSERT INTO "DiaryEntry" (id,userId,date,fixedAnswer,rotatingAnswers,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("d0", "u1", "2026-01-02", "Texto antigo", "não é json", now, now);
  assert.ok(!(await get("/caderno/busca?q=dever")).text.includes("Diário de"));
  page = await get("/caderno/busca?q=dever&tudo=1");
  assert.match(page.text, /Diário 1 Diário de .*Cumpri o dever mesmo cansado/);
  assert.match((await get("/caderno/busca?q=antigo&tudo=1")).text, /Texto antigo/);

  // Quick note: lands in the Caixa de entrada, titled by its first line.
  const note = await act({ action: "createPage", inbox: true, text: "Respondi antes de ouvir.\nLevar para sexta." });
  const row = db.sqlite.prepare('SELECT p.title, n.name FROM "NotePage" p JOIN "Notebook" n ON n.id = p.notebookId WHERE p.id = ?').get(note.id);
  assert.deepEqual({ ...row }, { title: "Respondi antes de ouvir.", name: "Caixa de entrada" });

  // Move: the page takes its subpages along.
  const inbox = db.sqlite.prepare('SELECT id FROM "Notebook" WHERE kind = \'ENTRADA\'').get().id;
  await act({ action: "movePage", id: created.id, notebookId: inbox, sectionId: null });
  assert.equal(count('SELECT COUNT(*) AS n FROM "NotePage" WHERE notebookId = ? AND (id = ? OR parentId = ?)', inbox, created.id, created.id), 3);
  assert.equal((await act({ action: "movePage", id: created.id, notebookId: inbox, sectionId: section.id })).status, 400, "a section of another notebook is refused");

  // Archive hides the page and its subpages (also from search); nothing is deleted until confirmed from the archive.
  assert.equal((await act({ action: "deletePage", id: created.id, confirm: true })).status, 400, "only archived pages can be deleted");
  await act({ action: "archivePage", id: created.id, archived: true });
  assert.equal(count('SELECT COUNT(*) AS n FROM "NotePage" WHERE archivedAt IS NOT NULL'), 3);
  assert.ok(!(await get("/caderno/busca?q=dever")).text.includes("Bastião 12"));
  assert.equal((await get(`/caderno/pagina/${created.id}`)).status, 404);
  assert.match((await get("/caderno/arquivo")).text, /Páginas Bastião 12 · O tempo Caixa de entrada · arquivada/);
  await act({ action: "archivePage", id: created.id, archived: false });
  assert.equal(count('SELECT COUNT(*) AS n FROM "NotePage" WHERE archivedAt IS NOT NULL'), 0, "restoring brings the subpages back");
  await act({ action: "archivePage", id: created.id, archived: true });
  assert.equal((await act({ action: "deletePage", id: created.id })).status, 400, "deleting asks for confirmation");
  assert.equal((await act({ action: "deletePage", id: created.id, confirm: true })).status, 200);
  assert.equal(count('SELECT COUNT(*) AS n FROM "NotePage" WHERE id IN (?, ?, ?)', created.id, sub.id, subSub.id), 0);
  assert.equal(count('SELECT COUNT(*) AS n FROM "NotePageVersion" WHERE pageId = ?', created.id), 0);
  assert.equal(count('SELECT COUNT(*) AS n FROM "SearchIndex" WHERE refId = ?', created.id), 0);

  // Notebooks and sections are archived, never deleted, and come back from the archive.
  await act({ action: "updateSection", id: section.id, archived: true });
  await act({ action: "updateNotebook", id: notebook.id, archived: true });
  page = await get("/caderno");
  assert.ok(!page.text.includes("Estudos"));
  assert.match(page.text, /Arquivo \(2\)/);
  await act({ action: "updateNotebook", id: notebook.id, archived: false });
  assert.match((await get("/caderno")).text, /Estudos/);

  // Order: arrows move a notebook among the others.
  const first = db.sqlite.prepare('SELECT id FROM "Notebook" WHERE archivedAt IS NULL ORDER BY position LIMIT 1').get().id;
  await act({ action: "reorder", kind: "notebook", id: first, direction: "down" });
  assert.notEqual(db.sqlite.prepare('SELECT id FROM "Notebook" WHERE archivedAt IS NULL ORDER BY position LIMIT 1').get().id, first);

  // The Diário opens with "play" from its practice in Hábitos.
  await get("/habitos");
  assert.equal(db.sqlite.prepare('SELECT practiceTool FROM "HabitTemplate" WHERE title = ?').get("Escrever o Diário").practiceTool, "DIARIO");
});
