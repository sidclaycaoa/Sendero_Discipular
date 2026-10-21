import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// "Uma passagem para hoje": whole passages from the books (exact text), the user's class notes and phrases.
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

test("Inspiração draws whole passages with their source and never repeats the one just shown", async () => {
  const db = new D1();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) db.sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,birthDate,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("u1", "sidclay@example.com", "Teste", "1994-01-21T00:00:00.000Z", `${today}T00:00:00Z`, now, now);
  const { default: worker } = await import(new URL(`../dist/server/index.js?inspiracao=${Date.now()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha-de-teste", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const post = async (path, body) => { const r = await worker.fetch(new Request(`https://s${path}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }), env, ctx); return { status: r.status, ...(await r.json()) }; };
  const page = await worker.fetch(new Request("https://s/inspiracao", { headers: { accept: "text/html", cookie } }), env, ctx);
  assert.equal(page.status, 200);

  const first = await post("/api/inspiracao", { source: "livros" });
  assert.equal(first.inspiration.kind, "LIVRO");
  assert.ok(first.inspiration.text.length >= 250, "a whole passage, not a sliver");
  assert.ok(first.inspiration.heading.includes("·"));
  const stored = db.sqlite.prepare('SELECT text FROM "IndexedPassage" WHERE id = ?').get(first.inspiration.bookPassageId);
  assert.equal(stored.text.trim(), first.inspiration.text, "the book's own text");
  const second = await post("/api/inspiracao", { source: "livros", exclude: [first.inspiration.key] });
  assert.notEqual(second.inspiration.key, first.inspiration.key);

  const themed = await post("/api/inspiracao", { source: "livros", theme: "tranquilidade" });
  assert.ok(!themed.inspiration || themed.inspiration.kind === "LIVRO");
  assert.equal((await post("/api/inspiracao", { source: "livros", theme: "zzzxxqq" })).inspiration, null);

  // Class notes: chunks of what was written, with the class named.
  assert.equal((await post("/api/inspiracao", { source: "aulas" })).inspiration, null);
  db.sqlite.prepare('INSERT INTO "SchoolClass" (id,userId,date,title,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("aula_1", "u1", "2026-10-14", "O Dever", "A virtude não é um estado, é um esforço diário de atenção sobre si mesmo.\n\nO mestre disse que o dever cumprido em silêncio forma o caráter mais do que mil discursos sobre ele.", now, now);
  const lesson = await post("/api/inspiracao", { source: "aulas" });
  assert.equal(lesson.inspiration.kind, "AULA");
  assert.equal(lesson.inspiration.href, "/escola/aula_1");
  assert.match(lesson.inspiration.detail, /O Dever/);
  assert.match(lesson.inspiration.text, /virtude/);
});
