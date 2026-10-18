import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Guided practice tools on habits.
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?praticar=${Date.now()}-${Math.random()}`, import.meta.url));
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

test("a habit with a practice tool gets a 'Praticar' screen; one without does not", async () => {
  const { db, call } = await setup();
  const tratak = db.sqlite.prepare('SELECT id FROM "HabitTemplate" WHERE title = ?').get("Templo Interior");
  const plain = db.sqlite.prepare('SELECT id FROM "HabitTemplate" WHERE title = ?').get("Ordenar o ambiente");
  // Choosing the tool in the habit form.
  const saved = await call.patch(`/api/habits/template/${tratak.id}`, { title: "Templo Interior", cadence: "WEEKLY", targetCount: 2, practiceGroup: "ED", practiceTool: "TEMPLO" });
  assert.equal(saved.status, 200);
  assert.equal(db.sqlite.prepare('SELECT practiceTool FROM "HabitTemplate" WHERE id = ?').get(tratak.id).practiceTool, "TEMPLO");
  const habits = await (await call("/habitos")).text();
  assert.ok(habits.includes(`/praticar/${tratak.id}`));
  assert.ok(!habits.includes(`/praticar/${plain.id}`));
  const html = await (await call(`/praticar/${tratak.id}`)).text();
  assert.match(html, /<audio[^>]*src="\/audio\/templo-interior.mp3"[^>]*loop/);
  const page = await text(new Response(html));
  assert.match(page, /Prática guiada Templo Interior/);
  assert.match(page, /A música toca aqui no app/);
  assert.equal((await call(`/praticar/${plain.id}`)).status, 404);
  // An unknown tool value is ignored.
  await call.patch(`/api/habits/template/${tratak.id}`, { title: "Templo Interior", cadence: "WEEKLY", targetCount: 2, practiceGroup: "ED", practiceTool: "QUALQUER" });
  assert.equal(db.sqlite.prepare('SELECT practiceTool FROM "HabitTemplate" WHERE id = ?').get(tratak.id).practiceTool, null);
});

test("migration 0008 attaches tools to the exercises that already exist", async () => {
  const { db } = await setup();
  db.sqlite.prepare('UPDATE "HabitTemplate" SET practiceTool = NULL').run();
  const now = new Date().toISOString();
  const category = db.sqlite.prepare('SELECT id FROM "Category" LIMIT 1').get().id;
  for (const [id, title] of [["h1", "Tratak"], ["h2", "Câmara de Purificação"], ["h3", "Exercício das formas geométricas"]]) {
    db.sqlite.prepare('INSERT INTO "HabitTemplate" (id,userId,title,categoryId,cadence,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(id, "u1", title, category, "DAILY", now, now);
  }
  const sql = (await readFile(new URL("../migrations/0008_practice_tools.sql", import.meta.url), "utf8")).replace(/ALTER TABLE[^;]*;/, "");
  db.sqlite.exec(sql);
  const tools = Object.fromEntries(db.sqlite.prepare('SELECT title, practiceTool FROM "HabitTemplate" WHERE practiceTool IS NOT NULL').all().map((row) => [row.title, row.practiceTool]));
  assert.deepEqual(tools, { "Templo Interior": "TEMPLO", "Tratak": "TRATAK", "Câmara de Purificação": "CAMARA", "Exercício das formas geométricas": "INTERVALOS" });
});

test("Asana Yoga shows one pose a day, in order, restarting every 6 days", async () => {
  const { db, call, today } = await setup();
  const now = new Date().toISOString();
  const category = db.sqlite.prepare('SELECT id FROM "Category" LIMIT 1').get().id;
  db.sqlite.prepare('INSERT INTO "HabitTemplate" (id,userId,title,categoryId,cadence,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("asana", "u1", "AsanaYoga", category, "DAILY", now, now);
  db.sqlite.exec(await readFile(new URL("../migrations/0009_asana_tool.sql", import.meta.url), "utf8"));
  assert.equal(db.sqlite.prepare('SELECT practiceTool FROM "HabitTemplate" WHERE id = ?').get("asana").practiceTool, "ASANA");

  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse("2026-10-18T12:00:00Z")) / 86_400_000);
  const position = ((days % 6) + 6) % 6 + 1;
  const html = await (await call("/praticar/asana")).text();
  assert.match(html, new RegExp(`src="/asana/asana-${position}-[a-z]+\\.png"`));
  assert.match(await text(await call("/praticar/asana")), new RegExp(`posição ${position} de 6`));
});
