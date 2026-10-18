import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

// Agenda: day timeline, late tasks, week, simple shopping, quick add and phone notices.
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?agenda=${Date.now()}-${Math.random()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: "senha" }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const call = (path, body) => worker.fetch(new Request(`https://s${path}`, body
    ? { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }
    : { headers: { accept: "text/html", cookie } }), env, ctx);
  call.patch = (path, body) => worker.fetch(new Request(`https://s${path}`, { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }), env, ctx);
  await (await call("/habitos")).text(); // seeds the default practices
  return { db, call, today, worker, env, ctx };
}

const text = async (response) => (await response.text()).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const shift = (dateKey, days) => new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const saoPauloNow = () => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

test("quick add understands day and hour in Portuguese", () => {
  const source = new URL("../lib/quick-add.ts", import.meta.url).pathname;
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", `
    import { parseQuickAdd } from ${JSON.stringify(source)};
    const t = "2026-10-18";
    console.log(JSON.stringify(["ligar pro contador amanhã 15h", "dentista sexta às 9", "reunião dia 25 15:30", "imposto 03/11", "aniversário 05/01", "levar carro depois de amanhã 8h30", "Ler BST 205"].map((s) => parseQuickAdd(s, t))));
  `]).toString();
  assert.deepEqual(JSON.parse(out), [
    { title: "Ligar pro contador", date: "2026-10-19", time: "15:00" },
    { title: "Dentista", date: "2026-10-23", time: "09:00" },
    { title: "Reunião", date: "2026-10-25", time: "15:30" },
    { title: "Imposto", date: "2026-11-03", time: null },
    { title: "Aniversário", date: "2027-01-05", time: null },
    { title: "Levar carro", date: "2026-10-20", time: "08:30" },
    { title: "Ler BST 205", date: null, time: null },
  ]);
});

test("the day shows tasks without hour, a timeline with events, tasks with hour and habits, and late tasks", async () => {
  const { db, call, today } = await setup();
  await call("/api/tasks", { title: "Pagar conta de luz", dueDate: today, priority: 3 });
  await call("/api/tasks", { title: "Ligar para o contador", dueDate: today, dueTime: "15:00" });
  await call("/api/tasks", { kind: "event", title: "Consulta dentista", startsAt: `${today}T09:30`, endsAt: `${today}T10:30`, location: "Rua Augusta" });
  await call("/api/tasks", { title: "Renovar CNH", dueDate: shift(today, -4) });
  await call("/api/tasks", { title: "Planejar a semana", dueDate: shift(today, -14), recurrence: { frequency: "weekly" } });
  await call.patch("/api/habits/template/hab_varrer", { title: "Varrer por dentro", cadence: "DAILY", targetCount: 1, scheduledTime: "07:00" });

  const page = await text(await call("/tarefas"));
  assert.match(page, /Tarefas do dia · 2 .*Pagar conta de luz .*Planejar a semana repete/);
  assert.match(page, /07:00 · Varrer por dentro/);
  assert.match(page, /Consulta dentista 09:30 ?–10:30 Rua Augusta/);
  assert.match(page, /Ligar para o contador 15:00/);
  assert.match(page, /Atrasadas · 2 .*Planejar a semana desde .* repete .*Renovar CNH/, "a late repeating task shows once");

  assert.equal((await call("/api/agenda", { action: "remarcarAtrasadas" })).status, 200);
  assert.equal(db.sqlite.prepare('SELECT dueDate FROM "TaskOccurrence" WHERE title = ?').get("Renovar CNH").dueDate, today);
  const planned = db.sqlite.prepare('SELECT dueDate, status FROM "TaskOccurrence" WHERE title = ? AND dueDate <= ? ORDER BY dueDate').all("Planejar a semana", today);
  assert.deepEqual(planned.map((row) => row.status), ["CANCELED", "CANCELED", "PLANNED"], "today's occurrence stays, no duplicate");
  assert.doesNotMatch(await text(await call("/tarefas")), /Atrasadas/);

  // Another day, its week, and moving a task to tomorrow.
  const id = db.sqlite.prepare('SELECT id FROM "TaskOccurrence" WHERE title = ?').get("Pagar conta de luz").id;
  await call.patch(`/api/tasks/${id}`, { dueDate: shift(today, 1) });
  assert.match(await text(await call(`/tarefas?data=${shift(today, 1)}`)), /Pagar conta de luz/);
  const week = await text(await call(`/tarefas?ver=semana&data=${today}`));
  assert.match(week, /Consulta dentista/);
  assert.match(week, /hoje/);
});

test("tasks from a reflection keep a plain date; shopping is a simple list", async () => {
  const { db, call } = await setup();
  const now = new Date().toISOString();
  const category = db.sqlite.prepare('SELECT id FROM "Category" LIMIT 1').get().id;
  db.sqlite.prepare('INSERT INTO "ReflectionTemplate" (id,userId,topic,subtopic,description,categoryId,cycleDays,period,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)').run("tpl", "u1", "Ordem", "Como?", "Ordenar", category, "[1]", "MORNING", now, now);
  await call("/api/reflections/task", { templateId: "tpl" });
  assert.match(db.sqlite.prepare('SELECT dueDate FROM "TaskOccurrence" WHERE originType = ?').get("REFLECTION").dueDate, /^\d{4}-\d{2}-\d{2}$/);

  for (const title of ["Veda-rosca", "Lâmpada"]) await call("/api/shopping", { title });
  const lamp = db.sqlite.prepare('SELECT id FROM "ShoppingItem" WHERE title = ?').get("Lâmpada").id;
  await call.patch(`/api/shopping/${lamp}`, { checked: true });
  assert.match(await text(await call("/tarefas?ver=compras")), /Veda-rosca .*Comprados · 1 .*Lâmpada/);
  await call("/api/agenda", { action: "limparComprados" });
  assert.deepEqual(db.sqlite.prepare('SELECT title FROM "ShoppingItem"').all().map((row) => row.title), ["Veda-rosca"]);
});

test("tasks with an hour remind at that hour and events 15 minutes before, once", async () => {
  const { db, call, today, worker, env } = await setup();
  db.sqlite.prepare('INSERT INTO "PushSubscription" (id,userId,endpoint,p256dh,auth,origin,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run("p", "u1", "https://push.example/x", "BOr0Jx3c5_dummy", "c2VjcmV0", "https://s", new Date().toISOString());
  await (await call("/configuracoes")).text();
  db.sqlite.prepare('UPDATE "Reminder" SET enabled = 0 WHERE kind <> \'AGENDA\'').run();
  const [hour, minute] = saoPauloNow().split(":").map(Number);
  const now = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const in15 = `${String(Math.floor((hour * 60 + minute + 15) / 60) % 24).padStart(2, "0")}:${String((minute + 15) % 60).padStart(2, "0")}`;
  await call("/api/tasks", { title: "Ligar para o contador", dueDate: today, dueTime: now });
  if (hour * 60 + minute + 15 < 24 * 60) await call("/api/tasks", { kind: "event", title: "Reunião", startsAt: `${today}T${in15}` });

  const sent = [];
  const realFetch = globalThis.fetch;
  // The fake subscription has invalid keys, so encryption fails before fetch; count the claimed notices instead.
  globalThis.fetch = async () => new Response(null, { status: 201 });
  try {
    const pending = [];
    await worker.scheduled({}, env, { waitUntil: (promise) => pending.push(promise), passThroughOnException() {} });
    await Promise.all(pending);
  } finally { globalThis.fetch = realFetch; }
  sent.push(...db.sqlite.prepare('SELECT key FROM "AgendaNotice"').all().map((row) => row.key.split(":")[0]));
  assert.deepEqual(sent.sort(), hour * 60 + minute + 15 < 24 * 60 ? ["EVENT", "TASK"] : ["TASK"]);
});

/** Runs the cron as if it were a given São Paulo time today. */
async function cronAt(worker, env, today, time) {
  const RealDate = globalThis.Date;
  const fixed = new RealDate(`${today}T${time}:00-03:00`).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  };
  try {
    const pending = [];
    await worker.scheduled({}, env, { waitUntil: (promise) => pending.push(promise), passThroughOnException() {} });
    await Promise.all(pending);
  } finally { globalThis.Date = RealDate; }
}

test("class readings are reminded near the deadline and the eve of a class at 20:00", async () => {
  const { db, call, today, worker, env } = await setup();
  db.sqlite.prepare('INSERT INTO "PushSubscription" (id,userId,endpoint,p256dh,auth,origin,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run("p", "u1", "https://push.example/x", "BOr0Jx3c5_dummy", "c2VjcmV0", "https://s", new Date().toISOString());
  await (await call("/configuracoes")).text();
  db.sqlite.prepare('UPDATE "Reminder" SET enabled = 0 WHERE kind <> \'AGENDA\'').run();
  const reading = await (await call("/api/leitura", { kind: "AULA", title: "Texto da aula 12", dueDate: shift(today, 1) })).json();
  const done = await (await call("/api/leitura", { kind: "AULA", title: "Já lido", dueDate: shift(today, 1), status: "LIDO" })).json();
  const aula = await (await call("/api/escola", { action: "criarAula", date: shift(today, 1), title: "A vontade" })).json();
  const keys = () => db.sqlite.prepare('SELECT key FROM "AgendaNotice"').all().map((row) => row.key);

  await cronAt(worker, env, today, "08:30");
  assert.deepEqual(keys(), [], "too early");
  await cronAt(worker, env, today, "09:05");
  assert.deepEqual(keys(), [`LEITURA:${reading.id}:${today}`]);
  assert.ok(!keys().some((key) => key.includes(done.id)), "a read one is not reminded");
  await cronAt(worker, env, today, "09:20");
  assert.equal(keys().length, 1, "once a day");
  await cronAt(worker, env, today, "20:05");
  assert.deepEqual(keys().sort(), [`AULA:${aula.id}`, `LEITURA:${reading.id}:${today}`].sort());
});
