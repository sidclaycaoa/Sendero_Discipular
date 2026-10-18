import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Hábitos: runs that forgive one miss, water goal from weight, weekly minutes.
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?habitos=${Date.now()}-${Math.random()}`, import.meta.url));
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
const shift = (dateKey, days) => new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function log(db, habitId, date, values) {
  db.sqlite.prepare('INSERT INTO "HabitLog" (id, userId, habitId, date, count, minutes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(`log-${habitId}-${date}`, "u1", habitId, date, values.count ?? 0, values.minutes ?? null, new Date().toISOString());
}

test("a run survives one missed day, ends after two, and today never counts as missed", async () => {
  const { db, call, today } = await setup();
  db.sqlite.prepare('UPDATE "HabitTemplate" SET createdAt = ?').run(`${shift(today, -30)}T00:00:00.000Z`);
  // Ordenar: 4 days, two misses (run ends), 3 days, one forgiven miss, 4 days up to yesterday → run of 7.
  for (const back of [14, 13, 12, 11, 8, 7, 6, 4, 3, 2, 1]) log(db, "hab_ordenar", shift(today, -back), { count: 1 });
  // Varrer: 5 days long ago, then two misses right before today → no run, record 5.
  for (const back of [10, 9, 8, 7, 6]) log(db, "hab_varrer", shift(today, -back), { count: 1 });
  const html = await (await call("/habitos")).text();
  const ordenar = html.slice(html.indexOf("Ordenar o ambiente"));
  assert.match(ordenar.slice(0, 3000), /sequência de 7 dias/);
  const varrer = html.slice(html.indexOf("Varrer por dentro"));
  assert.doesNotMatch(varrer.slice(0, 1500), /sequência de/);
});

test("the water goal follows the weight, or a fixed goal, and invalid values fall back", async () => {
  const { call } = await setup();
  assert.match(await text(await call("/habitos")), /de 2,5 L/);
  assert.equal((await call.patch("/api/habits/water", { weightKg: 108, mlPerKg: 35 })).status, 200);
  assert.match(await text(await call("/habitos")), /de 3,8 L/); // 108 × 35 = 3 780 → 3,8 L
  await call.patch("/api/habits/water", { weightKg: 108, mlPerKg: 35, fixedGoalMl: 4200 });
  assert.match(await text(await call("/habitos")), /de 4,2 L/);
  await call.patch("/api/habits/water", { weightKg: 5000, fixedGoalMl: 10 });
  assert.match(await text(await call("/habitos")), /de 2,5 L/);
});

test("time-based habits count the week, while each day keeps its own minutes", async () => {
  const { db, call, today } = await setup();
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (weekday > 0) log(db, "time_reading", shift(today, -1), { minutes: 40 });
  await call("/api/habits/progress", { habitId: "time_reading", dateKey: today, count: 0, minutes: 30 });
  const page = await text(await call("/habitos"));
  assert.match(page, new RegExp(`${weekday > 0 ? 70 : 30} de 240 min na semana`));
  assert.equal(db.sqlite.prepare('SELECT minutes FROM "HabitLog" WHERE habitId = ? AND date = ?').get("time_reading", today).minutes, 30);
});
