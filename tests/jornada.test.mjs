import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Real SQLite + the built Worker: one labor of a myth per month, opened by itself, in a fixed order.
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

test("the Jornada opens a labor each month, keeps the user's texts and follows the order of the myths", async () => {
  const db = new D1();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) db.sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const month = today.slice(0, 7);
  const shift = (key, delta) => { const d = new Date(`${key}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 7); };
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,birthDate,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("u1", "sidclay@example.com", "Teste", "1994-01-21T00:00:00.000Z", `${today}T00:00:00Z`, now, now);

  // The myths are seeded in order, each with its own number of labors.
  const myths = db.sqlite.prepare('SELECT m.hero, COUNT(l.id) AS n FROM "JourneyMyth" m JOIN "JourneyLabor" l ON l.mythId = m.id GROUP BY m.id ORDER BY m.position').all().map((row) => `${row.hero} ${row.n}`);
  assert.deepEqual(myths, ["Hércules 12", "Ulisses 12", "Teseu 7", "Rama 7", "Psiquê 4", "Perseu 6", "Arjuna 7", "Gilgamesh 7", "Jasão 7", "Parsifal 7"]);

  const { default: worker } = await import(new URL(`../dist/server/index.js?jornada=${Date.now()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha-de-teste", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const get = async (path) => { const r = await worker.fetch(new Request(`https://s${path}`, { headers: { accept: "text/html", cookie } }), env, ctx); return { status: r.status, text: (await r.text()).replace(/<!-- -->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") }; };
  const send = async (method, body) => worker.fetch(new Request("https://s/api/jornada", { method, headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }), env, ctx);
  const cycles = () => db.sqlite.prepare('SELECT month, laborId, startDate, outcome FROM "JourneyCycle" ORDER BY month').all().map((row) => ({ ...row }));

  // First visit: the first labor starts today, at the call.
  let page = await get("/jornada");
  assert.equal(page.status, 200);
  assert.deepEqual(cycles(), [{ month, laborId: "hercules-01", startDate: today, outcome: null }]);
  assert.match(page.text, /Hércules · I de XII O Leão de Nemeia/);
  assert.match(page.text, /O chamado\. O trabalho começou/);
  assert.match(page.text, /Os mitos que virão.*Ulisses A Odisseia · 12 meses.*Parsifal A busca do Graal · 7 meses/);
  assert.match(page.text, /Pedras do caminho/);

  // The user's own words stay with the month.
  const cycleId = db.sqlite.prepare('SELECT id FROM "JourneyCycle"').get().id;
  assert.equal((await send("PATCH", { id: cycleId, field: "monster", text: "  A pressa de responder.  " })).status, 200);
  assert.equal((await send("PATCH", { id: cycleId, field: "karma", text: "x" })).status, 400);
  page = await get("/jornada");
  assert.match(page.text, /“A pressa de responder\.”/);

  // A new month opens the next labor on its first day; the month left open asks for its return.
  db.sqlite.prepare('UPDATE "JourneyCycle" SET month = ?, startDate = ?').run(shift(month, -1), `${shift(month, -1)}-20`);
  page = await get("/jornada");
  assert.deepEqual(cycles().map((row) => row.laborId), ["hercules-01", "hercules-02"]);
  assert.equal(cycles()[1].startDate, `${month}-01`);
  assert.match(page.text, /Retorno pendente: O Leão de Nemeia/);

  // "O monstro ainda vive": the month that just opened, still blank, lives the same labor again.
  assert.equal((await send("POST", { id: cycleId, outcome: "REPETIR" })).status, 200);
  assert.deepEqual(cycles().map((row) => row.laborId), ["hercules-01", "hercules-01"]);
  // Changing the answer to "cumprido" brings the next labor back.
  await send("POST", { id: cycleId, outcome: "CUMPRIDO" });
  assert.deepEqual(cycles().map((row) => row.laborId), ["hercules-01", "hercules-02"]);
  page = await get("/jornada");
  assert.ok(!page.text.includes("Retorno pendente"));
  assert.match(page.text, /Hércules · II de XII A Hidra de Lerna/);

  // After the twelfth labor of Hércules comes the first island of Ulisses.
  db.sqlite.prepare('DELETE FROM "JourneyCycle" WHERE month = ?').run(month);
  db.sqlite.prepare('UPDATE "JourneyCycle" SET laborId = ?').run("hercules-12");
  page = await get("/jornada");
  assert.equal(cycles().at(-1).laborId, "ulisses-01");
  assert.match(page.text, /Ulisses · I de XII Os Cícones/);

  // Início: the card of the month and a stone reached today (the first day at the water goal).
  db.sqlite.prepare('UPDATE "User" SET waterGoalMl = 1000').run();
  db.sqlite.prepare('INSERT INTO "WaterLog" (id,userId,date,amountMl,createdAt) VALUES (?,?,?,?,?)').run("w1", "u1", today, 1000, now);
  const inicio = await get("/inicio");
  assert.match(inicio.text, /Jornada · Ulisses I .* Os Cícones/);
  assert.match(inicio.text, /Hoje, na jornada: o primeiro dia com 1 L de água\./);
});
