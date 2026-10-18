import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Escola: classes, Bastiões with key ideas to live, practices and what to bring back.
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?escola=${Date.now()}-${Math.random()}`, import.meta.url));
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
const act = (call, action, body) => call("/api/escola", { action, ...body });

test("a class holds its Bastiões, up to three ideas to live, and practices linked to habits", async () => {
  const { db, call, today } = await setup();
  const aula = await (await act(call, "criarAula", { date: today, title: "A vontade" })).json();
  const bastiao = await (await act(call, "criarBastiao", { classId: aula.id, number: 47, name: "Sobre a vontade" })).json();
  assert.ok(bastiao.id);
  await act(call, "editarBastiao", { id: bastiao.id, read: true });
  await act(call, "editarBastiao", { id: bastiao.id, notes: "A vontade se educa." });
  assert.ok(db.sqlite.prepare('SELECT readAt FROM "Bastiao" WHERE id = ?').get(bastiao.id).readAt, "notes keep the read mark");

  const ideas = [];
  for (const idea of ["Agir antes de sentir vontade", "Terminar o que começo", "Silêncio ao acordar", "Uma quarta ideia"]) ideas.push((await (await act(call, "criarIdeia", { id: bastiao.id, text: idea })).json()).id);
  for (const id of ideas.slice(0, 3)) assert.equal((await act(call, "editarIdeia", { id, live: true })).status, 200);
  const fourth = await act(call, "editarIdeia", { id: ideas[3], live: true });
  assert.equal(fourth.status, 400, "no more than three ideas to live per class");
  assert.match((await fourth.json()).error, /no máximo 3/);

  await act(call, "marcarIdeia", { id: ideas[0], done: true });
  await act(call, "marcarIdeia", { id: ideas[0], done: true }); // twice is still one day
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "IdeaLog"').get().n, 1);

  // A habit already done every day, and a new exercise that also appears in Hábitos.
  assert.equal((await act(call, "criarVivencia", { id: aula.id, habitId: "hab_diario" })).status, 200);
  const novo = await (await act(call, "criarVivencia", { id: aula.id, title: "Observar a impaciência", group: "PSYCHOLOGY" })).json();
  assert.ok(novo.habitId);
  await act(call, "editarVivencia", { id: db.sqlite.prepare('SELECT id FROM "ClassPractice" WHERE habitId = ?').get(novo.habitId).id, points: "Percebi pressa ao falar." });

  const page = await text(await call("/escola"));
  assert.match(page, /Aula em curso/);
  assert.match(page, /Bastião nº 47 Sobre a vontade/);
  assert.match(page, /Para viver até a próxima aula/);
  assert.match(page, /Vivi: Agir antes de sentir vontade \(1\/7 dias\)/);
  assert.match(page, /Vivência: Observar a impaciência/);
  assert.match(page, /Percebi pressa ao falar\./);

  const habits = await text(await call("/habitos"));
  assert.match(habits, /Para viver · Bastião/);
  assert.match(habits, /Silêncio ao acordar/);
  assert.match(habits, /Observar a impaciência/);
  assert.match(await text(await call("/inicio")), /1 de 3 ideias do Bastião vividas hoje/);
});

test("an idea can go to Memorização or to the master; deleting a class keeps its Bastiões", async () => {
  const { db, call, today } = await setup();
  const aula = await (await act(call, "criarAula", { date: today })).json();
  const bastiao = await (await act(call, "criarBastiao", { classId: aula.id, number: 12, name: "Do dever" })).json();
  const idea = await (await act(call, "criarIdeia", { id: bastiao.id, text: "O dever liberta. A preguiça prende." })).json();
  const memo = await (await act(call, "enviarIdeia", { id: idea.id, to: "MEMORIZAR" })).json();
  assert.deepEqual({ ...db.sqlite.prepare('SELECT title, contentText FROM "MemorizationItem" WHERE id = ?').get(memo.id) }, { title: "Bastião Nº 12 · Do dever", contentText: "O dever liberta.\nA preguiça prende." });
  await act(call, "enviarIdeia", { id: idea.id, to: "MESTRE", question: "Como viver isso no trabalho?" });
  assert.equal(db.sqlite.prepare('SELECT question FROM "MasterQuestion"').get().question, "Como viver isso no trabalho?");

  assert.equal((await act(call, "excluirAula", { id: aula.id })).status, 200);
  assert.equal(db.sqlite.prepare('SELECT classId FROM "Bastiao" WHERE id = ?').get(bastiao.id).classId, null);
  assert.equal((await act(call, "inventada", {})).status, 400);
  assert.equal((await act(call, "criarBastiao", { classId: "nao-existe", name: "x" })).status, 400);
});
