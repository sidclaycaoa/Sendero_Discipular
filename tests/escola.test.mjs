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

const weekOf = (dateKey) => { const date = new Date(`${dateKey}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - date.getUTCDay()); return date.toISOString().slice(0, 10); };

test("the week's Bastião stands on its own, with up to three ideas to live shown in Hábitos, Início and Diário", async () => {
  const { db, call, today } = await setup();
  assert.equal((await act(call, "criarBastiao", { number: 47, name: "Sobre a vontade", fromClass: true })).status, 400, "no class yet to come from");
  const bastiao = await (await act(call, "criarBastiao", { number: 47, name: "Sobre a vontade" })).json();
  assert.equal(db.sqlite.prepare('SELECT weekStart FROM "Bastiao" WHERE id = ?').get(bastiao.id).weekStart, weekOf(today));
  await act(call, "editarBastiao", { id: bastiao.id, read: true });
  await act(call, "editarBastiao", { id: bastiao.id, notes: "A vontade se educa." });
  assert.ok(db.sqlite.prepare('SELECT readAt FROM "Bastiao" WHERE id = ?').get(bastiao.id).readAt, "notes keep the read mark");

  const ideas = [];
  for (const idea of ["Agir antes de sentir vontade", "Terminar o que começo", "Silêncio ao acordar", "Uma quarta ideia"]) ideas.push((await (await act(call, "criarIdeia", { id: bastiao.id, text: idea })).json()).id);
  for (const id of ideas.slice(0, 3)) assert.equal((await act(call, "editarIdeia", { id, live: true })).status, 200);
  const fourth = await act(call, "editarIdeia", { id: ideas[3], live: true });
  assert.equal(fourth.status, 400, "no more than three ideas to live per week");
  assert.match((await fourth.json()).error, /no máximo 3 ideias para viver por semana/);

  await act(call, "marcarIdeia", { id: ideas[0], done: true });
  await act(call, "marcarIdeia", { id: ideas[0], done: true }); // twice is still one day
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "IdeaLog"').get().n, 1);

  const escola = await text(await call("/escola"));
  assert.match(escola, /Bastião da semana/);
  assert.match(escola, /Bastião nº 47 Sobre a vontade/);
  assert.match(escola, /Para viver nesta semana/);
  assert.match(await text(await call("/habitos")), /Para viver · Bastião .*Silêncio ao acordar/);
  assert.match(await text(await call("/inicio")), /1 de 3 ideias do Bastião vividas hoje/);
  const diary = await text(await call("/diario"));
  assert.match(diary, /Quinta reflexão · Para viver nesta semana/);
  assert.match(diary, /Sobre o Bastião da semana — como vivi as ideias escolhidas hoje\?/);
  await call("/api/diary", { date: today, answers: ["a", "b", "c", "d", "Vivi a primeira ideia no trabalho."] });
  const saved = JSON.parse(db.sqlite.prepare('SELECT rotatingAnswers FROM "DiaryEntry"').get().rotatingAnswers);
  assert.equal(saved.answers[4], "Vivi a primeira ideia no trabalho.");
});

test("the monthly class keeps practices and gathers the Bastiões of its period; one can be marked as from the class", async () => {
  const { db, call, today } = await setup();
  const aula = await (await act(call, "criarAula", { date: today, title: "A vontade" })).json();
  const weekly = await (await act(call, "criarBastiao", { number: 47, name: "Sobre a vontade" })).json();
  const fromClass = await (await act(call, "criarBastiao", { number: 12, name: "Do dever", fromClass: true })).json();
  assert.equal(db.sqlite.prepare('SELECT classId FROM "Bastiao" WHERE id = ?').get(fromClass.id).classId, aula.id);
  await act(call, "editarBastiao", { id: weekly.id, fromClass: true });
  await act(call, "editarBastiao", { id: weekly.id, fromClass: false });
  assert.equal(db.sqlite.prepare('SELECT classId FROM "Bastiao" WHERE id = ?').get(weekly.id).classId, null);
  const idea = await (await act(call, "criarIdeia", { id: weekly.id, text: "Agir antes de sentir vontade" })).json();
  await act(call, "editarIdeia", { id: idea.id, live: true });
  await act(call, "marcarIdeia", { id: idea.id, done: true });

  assert.equal((await act(call, "criarVivencia", { id: aula.id, habitId: "hab_diario" })).status, 200);
  const novo = await (await act(call, "criarVivencia", { id: aula.id, title: "Observar a impaciência", group: "PSYCHOLOGY" })).json();
  assert.ok(novo.habitId);
  await act(call, "editarVivencia", { id: db.sqlite.prepare('SELECT id FROM "ClassPractice" WHERE habitId = ?').get(novo.habitId).id, points: "Percebi pressa ao falar." });

  const page = await text(await call("/escola"));
  assert.match(page, /Aula em curso/);
  assert.match(page, /Bastiões do período/);
  assert.match(page, /Bastião Nº 12 · Do dever · da aula/);
  assert.match(page, /Vivi: Agir antes de sentir vontade \(1 dia\)/);
  assert.match(page, /Vivência: Observar a impaciência/);
  assert.match(page, /Percebi pressa ao falar\./);
  assert.match(await text(await call("/habitos")), /Observar a impaciência/);
});

test("an idea can go to Memorização or to the master; older weeks go to the archive; deleting a class keeps its Bastiões", async () => {
  const { db, call, today } = await setup();
  const aula = await (await act(call, "criarAula", { date: today })).json();
  const bastiao = await (await act(call, "criarBastiao", { number: 12, name: "Do dever", fromClass: true })).json();
  const idea = await (await act(call, "criarIdeia", { id: bastiao.id, text: "O dever liberta. A preguiça prende." })).json();
  const memo = await (await act(call, "enviarIdeia", { id: idea.id, to: "MEMORIZAR" })).json();
  assert.deepEqual({ ...db.sqlite.prepare('SELECT title, contentText FROM "MemorizationItem" WHERE id = ?').get(memo.id) }, { title: "Bastião Nº 12 · Do dever", contentText: "O dever liberta.\nA preguiça prende." });
  await act(call, "enviarIdeia", { id: idea.id, to: "MESTRE", question: "Como viver isso no trabalho?" });
  assert.equal(db.sqlite.prepare('SELECT question FROM "MasterQuestion"').get().question, "Como viver isso no trabalho?");

  const lastWeek = new Date(Date.parse(`${today}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const old = await (await act(call, "criarBastiao", { number: 46, name: "Da paciência", weekStart: lastWeek })).json();
  const escola = await text(await call("/escola"));
  assert.match(escola, /Bastiões anteriores .*Nº 46 · Da paciência/);
  assert.match(await text(await call(`/escola/bastiao/${old.id}`)), /Da paciência/);

  assert.equal((await act(call, "excluirAula", { id: aula.id })).status, 200);
  assert.equal(db.sqlite.prepare('SELECT classId FROM "Bastiao" WHERE id = ?').get(bastiao.id).classId, null);
  assert.equal((await act(call, "inventada", {})).status, 400);
});
