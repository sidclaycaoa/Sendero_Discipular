import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Feedback (bugs and improvements), questions for the master and diary actions.
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?pendencias=${Date.now()}-${Math.random()}`, import.meta.url));
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

test("a reported bug stays pending until it is marked resolved", async () => {
  const { db, call } = await setup();
  const saved = await call("/api/feedback", { kind: "BUG", description: "Botão de ação do diário não responde", page: "/diario" });
  assert.equal(saved.status, 200);
  const { id } = await saved.json();
  assert.match(await text(await call("/pendencias")), /Abertas · 1 .*Botão de ação do diário não responde/);
  assert.equal((await call.patch("/api/feedback", { id, done: true })).status, 200);
  assert.equal(db.sqlite.prepare('SELECT status FROM "AppFeedback" WHERE id = ?').get(id).status, "DONE");
  assert.match(await text(await call("/pendencias")), /Abertas · 0/);
});

test("a question for the master keeps its context and can be closed with the answer", async () => {
  const { db, call, today } = await setup();
  const saved = await call("/api/mestre", { sourceType: "REFLEXAO", sourceId: "tpl", sourceDate: today, contextTitle: "Disciplina interior", contextDetail: "Como isso apareceu hoje?", contextText: "Percebi que adio o essencial.", question: "Como diferenciar cansaço de fuga?" });
  assert.equal(saved.status, 200);
  const { id } = await saved.json();
  const home = await text(await call("/inicio"));
  assert.match(home, /Para falar com meu mestre 1 dúvida guardada/);
  const page = await text(await call("/mestre"));
  assert.match(page, /Disciplina interior .*Como diferenciar cansaço de fuga\?/);
  assert.match(page, /Percebi que adio o essencial\./);
  assert.equal((await call.patch("/api/mestre", { id, answered: true, answer: "Observe o corpo antes de decidir." })).status, 200);
  const row = db.sqlite.prepare('SELECT status, answer FROM "MasterQuestion" WHERE id = ?').get(id);
  assert.deepEqual({ ...row }, { status: "ANSWERED", answer: "Observe o corpo antes de decidir." });
});

test("the diary's 'new action' creates a task that shows up in Tarefas", async () => {
  const { db, call, today } = await setup();
  const created = await call("/api/tasks", { kind: "task", title: "Conversar com calma em casa", dueDate: today, origin: "DIARY" });
  assert.equal(created.status, 200);
  assert.equal(db.sqlite.prepare('SELECT originType FROM "TaskOccurrence" WHERE title = ?').get("Conversar com calma em casa").originType, "DIARY");
  assert.match(await text(await call("/diario")), /Ações nascidas do diário .*Conversar com calma em casa/);
});

