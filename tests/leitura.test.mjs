import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Leitura: books and class readings, reading time and marked passages.
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
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try { for (const s of statements) this.sqlite.prepare(s._sql).run(...s._args()); this.sqlite.exec("COMMIT"); }
    catch (e) { this.sqlite.exec("ROLLBACK"); throw e; }
    return statements.map(() => ({ results: [], success: true, meta: {} }));
  }
}

async function setup() {
  const db = new D1();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) db.sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run("u1", "sidclay@example.com", "Teste", `${today}T00:00:00Z`, now, now);
  const { default: worker } = await import(new URL(`../dist/server/index.js?leitura=${Date.now()}-${Math.random()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: "senha" }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const call = (path, body) => worker.fetch(new Request(`https://s${path}`, body
    ? { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }
    : { headers: { accept: "text/html", cookie } }), env, ctx);
  call.patch = (path, body) => worker.fetch(new Request(`https://s${path}`, { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }), env, ctx);
  await (await call("/habitos")).text(); // seeds the default practices
  return { db, call, today };
}

const text = async (response) => (await response.text()).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("reading sessions move the page, finish the book and count towards the weekly reading habit", async () => {
  const { db, call, today } = await setup();
  const { id } = await (await call("/api/leitura", { kind: "LIVRO", title: "A Tranquilidade da Alma", author: "Sêneca", totalPages: 300, status: "LENDO" })).json();
  assert.ok(id);
  assert.equal((await call("/api/leitura/sessao", { id, minutes: 30, toPage: 40 })).status, 200);
  assert.equal((await call("/api/leitura/sessao", { id, minutes: 15, toPage: 52 })).status, 200);
  const item = db.sqlite.prepare('SELECT currentPage, status FROM "ReadingItem" WHERE id = ?').get(id);
  assert.deepEqual({ ...item }, { currentPage: 52, status: "LENDO" });
  assert.equal(db.sqlite.prepare('SELECT minutes FROM "HabitLog" WHERE habitId = ? AND date = ?').get("time_reading", today).minutes, 45);

  const page = await text(await call("/leitura"));
  assert.match(page, /A Tranquilidade da Alma .*p\. 52 de 300/);
  assert.match(page, /45 de 240 min nesta semana/);
  assert.match(page, /52 páginas na semana/);

  // Reaching the last page marks it read; a page past the end is capped.
  await call("/api/leitura/sessao", { id, minutes: 0, toPage: 999 });
  const done = db.sqlite.prepare('SELECT currentPage, status, finishedAt FROM "ReadingItem" WHERE id = ?').get(id);
  assert.equal(done.currentPage, 300);
  assert.equal(done.status, "LIDO");
  assert.ok(done.finishedAt);
  assert.equal((await call("/api/leitura/sessao", { id })).status, 400, "nothing to record");
});

test("texts without pages advance in percent, and class readings show their deadline", async () => {
  const { db, call, today } = await setup();
  const due = new Date(Date.parse(`${today}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
  const { id } = await (await call("/api/leitura", { kind: "AULA", title: "Texto da aula 12", dueDate: due })).json();
  assert.match(await text(await call("/leitura")), /Leitura de aula · para daqui a 2 dias/);
  await call("/api/leitura/sessao", { id, minutes: 10, toPage: 60 });
  assert.match(await text(await call(`/leitura/${id}`)), /60% lido/);
  assert.match(await text(await call("/leitura")), /0 páginas na semana/, "percent is not pages");
  await call("/api/leitura/sessao", { id, toPage: 100 });
  assert.equal(db.sqlite.prepare('SELECT status FROM "ReadingItem" WHERE id = ?').get(id).status, "LIDO");
});

test("a marked passage can become a Memorização text, one sentence per line", async () => {
  const { db, call } = await setup();
  const { id } = await (await call("/api/leitura", { title: "Manual", author: "Epicteto", totalPages: 80 })).json();
  const quote = await (await call("/api/leitura/trecho", { id, text: "Algumas coisas dependem de nós. Outras não dependem.", page: "1", note: "base" })).json();
  assert.ok(quote.id);
  assert.match(await text(await call(`/leitura/${id}`)), /Algumas coisas dependem de nós/);
  const memo = await (await call("/api/leitura/trecho", { id: quote.id, memorizar: true })).json();
  const row = db.sqlite.prepare('SELECT title, source, contentText, totalLines FROM "MemorizationItem" WHERE id = ?').get(memo.id);
  assert.deepEqual({ ...row }, { title: "Manual · p. 1", source: "Epicteto, Manual", contentText: "Algumas coisas dependem de nós.\nOutras não dependem.", totalLines: 2 });
});

test("migration 0014 sends the weekly reading habit to the module", async () => {
  const { db, call } = await setup();
  db.sqlite.prepare('UPDATE "HabitTemplate" SET practiceTool = NULL WHERE id = ?').run("time_reading");
  const sql = (await readFile(new URL("../migrations/0014_reading.sql", import.meta.url), "utf8")).split("\n").filter((line) => line.startsWith("UPDATE")).join("\n");
  db.sqlite.exec(sql);
  assert.equal(db.sqlite.prepare('SELECT practiceTool FROM "HabitTemplate" WHERE id = ?').get("time_reading").practiceTool, "LEITURA");
  assert.ok((await (await call("/habitos")).text()).includes('href="/leitura"'));
});
