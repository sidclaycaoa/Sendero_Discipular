import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Real SQLite + the built Worker: Início shows the day and the labor of the month; the Percurso lives in the Jornada.
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

test("Início shows today's rings and the Jornada card; the Jornada keeps the real Percurso indicators", async () => {
  const db = new D1();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) db.sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const daysAgo = (n) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,birthDate,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("u1", "sidclay@example.com", "Teste", "1994-01-21T00:00:00.000Z", `${today}T00:00:00Z`, now, now);

  const { default: worker } = await import(new URL(`../dist/server/index.js?inicio=${Date.now()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha-de-teste", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const get = async (path) => { const r = await worker.fetch(new Request(`https://s${path}`, { headers: { accept: "text/html", cookie } }), env, ctx); return { status: r.status, text: (await r.text()).replace(/<!-- -->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") }; };

  await get("/habitos"); // seeds the default practices
  const practice = db.sqlite.prepare('SELECT id FROM "HabitTemplate" WHERE title = ?').get("Eu Sou Discípulo");
  // Practiced today and yesterday, missed the day before, practiced again: one quick return.
  for (const n of [0, 1, 3]) db.sqlite.prepare('INSERT INTO "HabitLog" (id,userId,habitId,date,count,createdAt) VALUES (?,?,?,?,?,?)').run(`l${n}`, "u1", practice.id, daysAgo(n), 3, now);
  db.sqlite.prepare('INSERT INTO "DiaryEntry" (id,userId,date,fixedAnswer,rotatingAnswers,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("d0", "u1", today, "x", "[]", now, now);

  const page = await get("/inicio");
  assert.equal(page.status, 200);
  // Diary saved today counts as the "Escrever o Diário" practice: 2 of the 3 daily ED practices done.
  assert.ok(page.text.includes("O dia até agora"));
  assert.match(page.text, /2\/3 Práticas ED/);
  // The Percurso moved to the Jornada; Início keeps one card with the labor of the month.
  assert.ok(!page.text.includes("Mapa de presença"));
  assert.match(page.text, /Jornada · Hércules I · o chamado O Leão de Nemeia/);
  assert.match(page.text, /Hoje, na jornada: começa o Leão de Nemeia · o primeiro Diário\./);

  const jornada = await get("/jornada");
  assert.equal(jornada.status, 200);
  for (const section of ["Mapa de presença", "Retomadas no dia seguinte", "Força das práticas", "Reflexões por mês", "Exportar dados por período"]) assert.ok(jornada.text.includes(section), section);
  assert.match(jornada.text, /1 Retomadas no dia seguinte/);
  assert.match(jornada.text, /3 de 30 dias presentes/);
});
