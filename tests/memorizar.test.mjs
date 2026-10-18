import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Memorização: texts learned line by line.
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?memorizar=${Date.now()}-${Math.random()}`, import.meta.url));
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

test("a pasted text becomes lines learned one at a time, and the practice marks the habit", async () => {
  const { db, call, today } = await setup();
  const created = await (await call("/api/memorizar", { title: "Fases", source: "Apostila ED", text: "Primeira linha do texto.\n\n  Segunda linha, com vírgula.\nTerceira linha." })).json();
  assert.ok(created.id);
  const row = db.sqlite.prepare('SELECT totalLines, currentLine, contentText FROM "MemorizationItem" WHERE id = ?').get(created.id);
  assert.deepEqual({ ...row }, { totalLines: 3, currentLine: 0, contentText: "Primeira linha do texto.\nSegunda linha, com vírgula.\nTerceira linha." });

  assert.match(await text(await call("/memorizar")), /Fases .*Apostila ED .*0 de 3 linhas de cor/);
  assert.match(await text(await call(`/memorizar/${created.id}`)), /Trabalhando a linha 1 de 3/);

  // Right answers only feed the history; advancing moves the mark, and it never passes the end.
  await call("/api/memorizar/progresso", { id: created.id, event: "ACERTOU", line: 1 });
  assert.equal(db.sqlite.prepare('SELECT currentLine FROM "MemorizationItem" WHERE id = ?').get(created.id).currentLine, 0);
  for (let i = 0; i < 5; i++) await call("/api/memorizar/progresso", { id: created.id, event: "AVANCOU" });
  assert.equal(db.sqlite.prepare('SELECT currentLine FROM "MemorizationItem" WHERE id = ?').get(created.id).currentLine, 3);
  assert.equal((await (await call("/api/memorizar/progresso", { id: created.id, event: "VOLTOU" })).json()).known, 2);
  const logs = db.sqlite.prepare('SELECT date, note FROM "MemorizationProgressLog" WHERE itemId = ?').all(created.id);
  assert.equal(logs.length, 7);
  assert.ok(logs.every((log) => log.date === today));

  // Editing keeps progress, capped at the new size.
  await call.patch("/api/memorizar", { id: created.id, title: "Fases", source: "", text: "Só uma linha." });
  assert.deepEqual({ ...db.sqlite.prepare('SELECT totalLines, currentLine, source FROM "MemorizationItem" WHERE id = ?').get(created.id) }, { totalLines: 1, currentLine: 1, source: null });

  // Hábitos sends the Memorização practice to the module; finishing marks it done today.
  const habits = await (await call("/habitos")).text();
  assert.ok(habits.includes('href="/memorizar"'));
  assert.equal((await call("/api/memorizar/concluir", {})).status, 200);
  assert.equal(db.sqlite.prepare('SELECT count FROM "HabitLog" WHERE habitId = ? AND date = ?').get("ed_memorizacao", today).count, 1);

  // A text without title or lines is refused.
  assert.equal((await call("/api/memorizar", { title: "", text: "x" })).status, 400);
  assert.equal((await call("/api/memorizar", { title: "Vazio", text: " \n " })).status, 400);
});

test("migration 0010 opens the module from the existing Memorização habit", async () => {
  const { db } = await setup();
  db.sqlite.prepare('UPDATE "HabitTemplate" SET practiceTool = NULL').run();
  const sql = (await readFile(new URL("../migrations/0010_memorization.sql", import.meta.url), "utf8")).replace(/ALTER TABLE[^;]*;/g, "").replace(/CREATE INDEX[^;]*;/g, "");
  db.sqlite.exec(sql);
  assert.equal(db.sqlite.prepare('SELECT practiceTool FROM "HabitTemplate" WHERE id = ?').get("ed_memorizacao").practiceTool, "MEMORIZAR");
});
