import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Real SQLite + the built Worker: phrases are either literal (with source, checked against the
// AD's books when they come from them) or the user's own synthesis, never confused.
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

test("Frases e passagens keep quotations faithful to their source and apart from the user's synthesis", async () => {
  const db = new D1();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) db.sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,birthDate,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("u1", "sidclay@example.com", "Teste", "1994-01-21T00:00:00.000Z", `${today}T00:00:00Z`, now, now);

  const { default: worker } = await import(new URL(`../dist/server/index.js?frases=${Date.now()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha-de-teste", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const get = async (path) => { const r = await worker.fetch(new Request(`https://s${path}`, { headers: { accept: "text/html", cookie } }), env, ctx); return { status: r.status, text: (await r.text()).replace(/<!-- -->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") }; };
  const post = async (path, body) => { const r = await worker.fetch(new Request(`https://s${path}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }), env, ctx); return { status: r.status, ...(await r.json()) }; };
  const frase = (body) => post("/api/frases", body);

  // Notebooks made before the Frases existed gain the special notebook, once, at the end.
  await get("/caderno");
  db.sqlite.prepare('DELETE FROM "Notebook" WHERE kind = \'FRASES\'').run();
  await get("/caderno");
  await get("/caderno");
  const special = db.sqlite.prepare('SELECT id, position, (SELECT MAX(position) FROM "Notebook") AS last FROM "Notebook" WHERE kind = \'FRASES\'').all();
  assert.equal(special.length, 1);
  assert.equal(special[0].position, special[0].last);
  assert.equal((await post("/api/caderno", { action: "createPage", notebookId: special[0].id })).status, 400, "the phrases notebook holds phrases, not pages");
  const notebookPage = await worker.fetch(new Request(`https://s/caderno/${special[0].id}`, { headers: { accept: "text/html", cookie }, redirect: "manual" }), env, ctx);
  assert.match(notebookPage.headers.get("location") ?? "", /\/caderno\/frases$/);

  // From the AD's books: search, then keep an exact stretch. A changed stretch is refused.
  const { hits } = await frase({ action: "searchBooks", query: "amanhecer tarefa própria de homem" });
  const hit = hits.find((item) => item.text.includes("desperto para cumprir uma tarefa própria de homem"));
  assert.ok(hit, "finds Marco Aurélio, Livro V");
  assert.equal(hit.author, "Marco Aurélio");
  assert.equal((await frase({ action: "fromBook", passageId: hit.id, selection: "desperto para cumprir uma tarefa de homem" })).status, 400);
  const kept = await frase({ action: "fromBook", passageId: hit.id, selection: "desperto para cumprir uma tarefa própria de homem", note: "Para as manhãs difíceis." });
  assert.equal(kept.status, 200);
  const literal = db.sqlite.prepare('SELECT * FROM "Passage" WHERE id = ?').get(kept.id);
  assert.deepEqual({ kind: literal.kind, text: literal.text, author: literal.author, work: literal.work, sourceType: literal.sourceType, sourceRef: literal.sourceRef }, { kind: "LITERAL", text: "desperto para cumprir uma tarefa própria de homem", author: "Marco Aurélio", work: "Meditações", sourceType: "LIVRO_AD", sourceRef: hit.id });
  assert.match(literal.edition, /Kiron/);
  // A quotation from the books keeps its text: editing only changes the note.
  await frase({ action: "update", id: kept.id, text: "outro texto", note: "Nota nova." });
  assert.deepEqual({ ...db.sqlite.prepare('SELECT text, note FROM "Passage" WHERE id = ?').get(kept.id) }, { text: "desperto para cumprir uma tarefa própria de homem", note: "Nota nova." });

  // Typed by the user: a literal needs author and work; a synthesis never shows as an author's quotation.
  assert.equal((await frase({ action: "create", kind: "LITERAL", text: "Uma frase sem fonte." })).status, 400);
  const typed = await frase({ action: "create", kind: "LITERAL", text: "Primeiro, diga a si mesmo o que você deveria ser; depois, faça o que tem de fazer.", author: "Epicteto", work: "A Arte de Viver", location: "p. 10" });
  const mine = await frase({ action: "create", kind: "SINTESE", text: "O tempo é o lugar onde a vontade se mostra.", author: "Alguém" });
  assert.equal(db.sqlite.prepare('SELECT author FROM "Passage" WHERE id = ?').get(mine.id).author, null);

  let page = await get("/caderno/frases");
  assert.match(page.text, /Frases e passagens 3 frases · 2 autores/);
  assert.match(page.text, /Minha síntese O tempo é o lugar onde a vontade se mostra\. Escrita por você/);
  assert.match(page.text, /Citação literal “desperto para cumprir uma tarefa própria de homem” Marco Aurélio · Meditações · .*conferida no livro do AD Minha nota: Nota nova\./);
  assert.match(page.text, /Epicteto · A Arte de Viver · p\. 10 · digitada por você/);
  assert.match((await get("/caderno")).text, /Frases e passagens 3 frases/);

  // Phrases are found by the Caderno's search.
  page = await get("/caderno/busca?q=vontade");
  assert.match(page.text, /Frases 1 Minha síntese O tempo é o lugar onde a vontade se mostra/);
  assert.match((await get("/caderno/busca?q=deveria")).text, /Frases 1 Epicteto/);

  // Memorizar: one sentence or clause per line.
  const memo = await frase({ action: "memorize", id: typed.id });
  const item = db.sqlite.prepare('SELECT title, source, contentText, totalLines FROM "MemorizationItem" WHERE id = ?').get(memo.memorizationId);
  assert.deepEqual({ ...item }, { title: "Epicteto · Primeiro, diga a si mesmo…", source: "A Arte de Viver, p. 10", contentText: "Primeiro, diga a si mesmo o que você deveria ser;\ndepois, faça o que tem de fazer.", totalLines: 2 });

  // Archive hides (also from search); deleting asks for the archive and a confirmation.
  assert.equal((await frase({ action: "delete", id: mine.id, confirm: true })).status, 400);
  await frase({ action: "archive", id: mine.id });
  assert.ok(!(await get("/caderno/busca?q=vontade")).text.includes("Minha síntese"));
  assert.match((await get("/caderno/arquivo")).text, /Frases O tempo é o lugar onde a vontade se mostra\. Minha síntese · arquivada/);
  await frase({ action: "archive", id: mine.id, archived: false });
  assert.match((await get("/caderno/busca?q=vontade")).text, /Minha síntese/);
  await frase({ action: "archive", id: mine.id });
  assert.equal((await frase({ action: "delete", id: mine.id })).status, 400);
  assert.equal((await frase({ action: "delete", id: mine.id, confirm: true })).status, 200);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "SearchIndex" WHERE refId = ?').get(mine.id).n, 0);
});
