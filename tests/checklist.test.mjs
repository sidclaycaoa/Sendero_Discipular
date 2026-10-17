import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Regression tests for the failures listed in docs/dossie-sendero.md (§7 and §9.5).
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?checklist=${Date.now()}-${Math.random()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: "senha" }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const call = (path, body) => worker.fetch(new Request(`https://s${path}`, body
    ? { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }
    : { headers: { accept: "text/html", cookie } }), env, ctx);
  await (await call("/habitos")).text(); // seeds the default practices
  return { db, call, today };
}

test("quick taps on a 3x practice never add up to more than what was tapped", async () => {
  const { db, call, today } = await setup();
  const habit = db.sqlite.prepare('SELECT id FROM "HabitTemplate" WHERE title = ?').get("Eu Sou Discípulo");
  const responses = await Promise.all([1, 2].map((count) => call("/api/habits/progress", { habitId: habit.id, dateKey: today, count })));
  responses.forEach((response) => assert.equal(response.status, 200));
  const rows = db.sqlite.prepare('SELECT count FROM "HabitLog" WHERE habitId = ? AND date = ?').all(habit.id, today);
  assert.equal(rows.length, 1, "one row per practice and day");
  assert.ok([1, 2].includes(rows[0].count));
  // Unmarking clears the day.
  await call("/api/habits/progress", { habitId: habit.id, dateKey: today, count: 0 });
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "HabitLog" WHERE habitId = ?').get(habit.id).n, 0);
});

test("marking one practice never changes another", async () => {
  const { db, call, today } = await setup();
  const [first, second] = db.sqlite.prepare('SELECT id FROM "HabitTemplate" WHERE cadence = ? ORDER BY id LIMIT 2').all("DAILY");
  await call("/api/habits/progress", { habitId: first.id, dateKey: today, count: 1 });
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "HabitLog" WHERE habitId = ?').get(second.id).n, 0);
});

test("a diary answer with paragraphs survives saving and editing", async () => {
  const { db, call, today } = await setup();
  const answers = ["Primeiro parágrafo.\n\nSegundo parágrafo da mesma resposta.", "Resposta dois.", "Resposta três.", "Sobre a tônica."];
  const saved = await call("/api/diary", { date: today, answers });
  assert.equal(saved.status, 200);
  const page = await (await call("/diario")).text();
  assert.ok(page.includes("Segundo parágrafo da mesma resposta."));
  // Editing keeps a single entry for the day.
  await call("/api/diary", { date: today, answers: [...answers.slice(0, 3), "Tônica revisada."] });
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "DiaryEntry"').get().n, 1);
  const stored = JSON.parse(db.sqlite.prepare('SELECT rotatingAnswers FROM "DiaryEntry"').get().rotatingAnswers);
  assert.deepEqual(stored.answers, [...answers.slice(0, 3), "Tônica revisada."]);
});

test("saving the diary marks the 'Escrever o Diário' practice exactly once", async () => {
  const { db, call, today } = await setup();
  const habit = db.sqlite.prepare('SELECT id FROM "HabitTemplate" WHERE title = ?').get("Escrever o Diário");
  await call("/api/diary", { date: today, answers: ["a", "b", "c", "d"] });
  await call("/api/diary", { date: today, answers: ["a", "b", "c", "d (editado)"] });
  const rows = db.sqlite.prepare('SELECT count FROM "HabitLog" WHERE habitId = ? AND date = ?').all(habit.id, today);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 1);
});

test("the recovery queue shows the current month and can include the previous one", async () => {
  const { db, call, today } = await setup();
  const now = new Date().toISOString();
  const category = db.sqlite.prepare('SELECT id FROM "Category" LIMIT 1').get().id;
  // One theme scheduled on every block, never answered.
  db.sqlite.prepare('INSERT INTO "ReflectionTemplate" (id,userId,topic,description,categoryId,cycleDays,period,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
    .run("tpl", "u1", "Tema de teste", "d", category, JSON.stringify(Array.from({ length: 30 }, (_, i) => i + 1)), "MORNING", now, now);
  const text = async (path) => (await (await call(path)).text()).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const monthOnly = await text("/refletir");
  const withPrevious = await text("/refletir?fila=anterior");
  const currentCount = Number(/Pendências anteriores .*? (\d+) /.exec(monthOnly)[1]);
  const combinedCount = Number(/Pendências anteriores .*? (\d+) /.exec(withPrevious)[1]);
  assert.equal(combinedCount - currentCount, 15, "all 15 blocks of the previous month join the queue");
  assert.match(monthOnly, /\+ \p{L}+ · 15/u);

  const home = await text("/inicio");
  assert.match(home, /Atendimento às reflexões/);
  assert.match(home, /meta 90 ?%/);
  assert.match(home, /Faltam 8 reflex/);
  void today;
});

test("migration 0006 turns ISO dates into plain keys without losing or duplicating rows", async () => {
  const { db } = await setup();
  const now = new Date().toISOString();
  const category = db.sqlite.prepare('SELECT id FROM "Category" LIMIT 1').get().id;
  db.sqlite.prepare('INSERT INTO "ReflectionTemplate" (id,userId,topic,description,categoryId,cycleDays,period,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run("tpl", "u1", "T", "d", category, "[1,2]", "MORNING", now, now);
  // Rows as the GPT version stored them.
  db.sqlite.prepare('INSERT INTO "ReflectionEntry" (id,userId,templateId,date,cycleDay,contentText,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)').run("r1", "u1", "tpl", "2026-09-01T00:00:00.000Z", 1, "texto", now, now);
  db.sqlite.prepare('INSERT INTO "DiaryEntry" (id,userId,date,fixedAnswer,rotatingAnswers,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("d1", "u1", "2026-09-01T00:00:00.000Z", "a", "{}", now, now);
  db.sqlite.prepare('INSERT INTO "TaskOccurrence" (id,userId,title,dueDate,categoryId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("k1", "u1", "t", "2026-09-02T00:00:00.000Z", category, now, now);
  db.sqlite.exec(await readFile(new URL("../migrations/0006_dates_and_integrity.sql", import.meta.url), "utf8"));
  assert.equal(db.sqlite.prepare('SELECT date FROM "ReflectionEntry" WHERE id = ?').get("r1").date, "2026-09-01");
  assert.equal(db.sqlite.prepare('SELECT date FROM "DiaryEntry" WHERE id = ?').get("d1").date, "2026-09-01");
  assert.equal(db.sqlite.prepare('SELECT dueDate FROM "TaskOccurrence" WHERE id = ?').get("k1").dueDate, "2026-09-02");
  assert.equal(db.sqlite.prepare('SELECT contentText FROM "ReflectionEntry" WHERE id = ?').get("r1").contentText, "texto");
});

test("editing a not-yet-migrated day updates that row instead of creating a second one", async () => {
  const { db, call } = await setup();
  const now = new Date().toISOString();
  const category = db.sqlite.prepare('SELECT id FROM "Category" LIMIT 1').get().id;
  db.sqlite.prepare('INSERT INTO "ReflectionTemplate" (id,userId,topic,description,categoryId,cycleDays,period,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run("tpl", "u1", "T", "d", category, "[1,2]", "MORNING", now, now);
  db.sqlite.prepare('INSERT INTO "ReflectionEntry" (id,userId,templateId,date,cycleDay,contentText,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)').run("r1", "u1", "tpl", "2026-09-01T00:00:00.000Z", 1, "antes", now, now);
  db.sqlite.prepare('INSERT INTO "DiaryEntry" (id,userId,date,fixedAnswer,rotatingAnswers,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("d1", "u1", "2026-09-01T00:00:00.000Z", "a", "{}", now, now);
  await call("/api/reflections/entry", { templateId: "tpl", date: "2026-09-01", contentText: "depois" });
  await call("/api/diary", { date: "2026-09-01", answers: ["x", "y", "z", "w"] });
  const reflections = db.sqlite.prepare('SELECT id, date, contentText FROM "ReflectionEntry" WHERE templateId = ?').all("tpl");
  assert.deepEqual(reflections.map((r) => ({ ...r })), [{ id: "r1", date: "2026-09-01", contentText: "depois" }]);
  const diaries = db.sqlite.prepare('SELECT id, date FROM "DiaryEntry"').all();
  assert.deepEqual(diaries.map((r) => ({ ...r })), [{ id: "d1", date: "2026-09-01" }]);
});
