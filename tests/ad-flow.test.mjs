import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const hash = value => createHash("sha256").update(value).digest("hex");

// Real SQLite + the built production Worker: tests both MCP and app routes.
// Fixtures exist only in this in-memory test database, never in the user's Site.
class D1 {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); }
  prepare(sql) {
    const sqlite = this.sqlite; let args = [];
    const query = {
      bind(...values) { args = values; return query; },
      async first(column) { const r = sqlite.prepare(sql).get(...args); return r ? (column ? r[column] : { ...r }) : null; },
      async all() { return { results: sqlite.prepare(sql).all(...args).map(r => ({ ...r })), success: true, meta: {} }; },
      async run() { return { results: [], success: true, meta: { ...sqlite.prepare(sql).run(...args) } }; },
    }; return query;
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try { const r = []; for (const s of statements) r.push(await s.run()); this.sqlite.exec("COMMIT"); return r; }
    catch (e) { this.sqlite.exec("ROLLBACK"); throw e; }
  }
}

test("AD: migrations, MCP, explicit consent, same-day records, source validation, unified history and exports", async () => {
  const db = new D1();
  const migrations = (await readdir(new URL("../drizzle/", import.meta.url))).filter(f => f.endsWith(".sql")).sort();
  for (const file of migrations) db.sqlite.exec(await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString(); const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run("test-user", "sidclay@example.com", "Teste AD", `${date}T00:00:00Z`, now, now);
  const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url));
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const env = { DB: db, SENDERO_SENHA: "senha-de-teste", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const login = await worker.fetch(new Request("https://sendero.example/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  async function request(path, body) {
    return worker.fetch(new Request(`https://sendero.example${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json", Accept: "application/json, text/event-stream", cookie } : { Accept: "text/html", cookie }, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  }
  let sequence = 0;
  async function rpc(method, params = {}) { const r = await request("/mcp", { jsonrpc: "2.0", id: ++sequence, method, params }); assert.equal(r.status, 200); return await r.json(); }
  async function tool(name, args = {}) { const r = await rpc("tools/call", { name, arguments: args }); assert.ok(!r.error, JSON.stringify(r)); return r.result; }
  const initialize = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "AD integration test", version: "1" } });
  assert.match(initialize.result.instructions, /registrar_reflexao_ad/);
  const tools = await rpc("tools/list");
  for (const name of ["propor_reflexao_ad", "registrar_reflexao_ad", "trechos_indexados", "recuperar_trecho_indexado", "status_obras_aprovadas", "listar_reflexoes_ad", "historico_integrado"]) assert.ok(tools.result.tools.some(t => t.name === name));
  assert.ok(!tools.result.tools.some(t => /aprovar_passagem|listar_passagens_aprovadas/.test(t.name)));
  assert.match(initialize.result.instructions, /Nunca crie frases/);
  // Existing data is present before AD writes.
  await tool("contexto_atual");
  db.sqlite.prepare('INSERT INTO "Category" (id,userId,name,color,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run("test-category", "test-user", "Teste", "#66704f", now, now);
  db.sqlite.prepare('INSERT INTO "ReflectionTemplate" (id,userId,topic,description,categoryId,cycleDays,period,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run("test-template", "test-user", "Reflexão preservada", "Orientação", "test-category", "[1,2]", "MORNING", now, now);
  db.sqlite.prepare('INSERT INTO "ReflectionEntry" (id,userId,templateId,date,cycleDay,contentText,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)').run("test-cycle", "test-user", "test-template", `${date}T00:00:00Z`, 1, "Texto do ciclo preservado.", now, now);
  db.sqlite.prepare('INSERT INTO "DiaryEntry" (id,userId,date,fixedAnswer,rotatingAnswers,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("test-diary", "test-user", `${date}T00:00:00Z`, "Diário preservado.", "{}", now, now);
  const beforeDiary = db.sqlite.prepare('SELECT * FROM "DiaryEntry"').all(); const beforeCycle = db.sqlite.prepare('SELECT * FROM "ReflectionEntry"').all();
  const status = await tool("status_obras_aprovadas");
  assert.equal(status.structuredContent.works.length, 7);
  assert.ok(status.structuredContent.works.every(w => w.status === "INDEXED"));
  assert.equal(status.structuredContent.works.reduce((n,w) => n+w.passageCount,0), 828);
  for (const [workId, count] of [["n-sri-ram-sacrificio",9],["psicologia-2014",123]]) {
    const w = status.structuredContent.works.find(w => w.id === workId); assert.equal(w.passageCount,count);
    const passages = await tool("trechos_indexados", { workId, limit: 1 });
    assert.equal(passages.structuredContent.passages[0].workId,workId);
    const p = passages.structuredContent.passages[0]; assert.equal(p.excerpt,p.text.slice(p.quoteStart,p.quoteEnd));
  }
  assert.equal(status.structuredContent.works.find(w => w.id === "psicologia-2014").author,"Autoria não identificada no arquivo");
  assert.match(status.structuredContent.works.find(w => w.author === "Epicteto").edition, /não identificada/);
  assert.match(status.structuredContent.works.find(w => w.author === "Aristóteles").edition, /não identificados/);
  const counts = db.sqlite.prepare('SELECT COUNT(*) n FROM "IndexedPassage"').get().n;
  await tool("status_obras_aprovadas"); assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM "IndexedPassage"').get().n, counts);
  const noBase = await tool("consultar_fontes_filosoficas", { query: "xyzzzzqwertyy" });
  assert.ok(!noBase.isError, JSON.stringify(noBase)); assert.equal(noBase.structuredContent.sources.length, 0); assert.equal(noBase.structuredContent.sufficientBase, false); assert.match(noBase.structuredContent.note, /Não há/);
  const base = await tool("consultar_fontes_filosoficas", { query: "atenção", limit: 2 });
  assert.ok(!base.isError, JSON.stringify(base)); assert.equal(base.structuredContent.sufficientBase, true);
  const source = base.structuredContent.sources[0]; const passageId = source.id;
  assert.equal(source.excerpt, source.text.slice(source.quoteStart, source.quoteEnd));
  assert.equal(source.textHash, hash(source.text)); assert.ok(source.sourceHash && source.location && source.edition);
  assert.equal(source.text, db.sqlite.prepare('SELECT text FROM "IndexedPassage" WHERE id=?').get(passageId).text);
  const retrieved = await tool("recuperar_trecho_indexado", { passageId, start: source.quoteStart, end: source.quoteEnd });
  assert.equal(retrieved.structuredContent.passage.excerpt, source.excerpt);
  assert.equal((await tool("recuperar_trecho_indexado", { passageId, start: 0, end: 901 })).isError, true);
  assert.equal((await tool("recuperar_trecho_indexado", { passageId, start: 1 })).isError, true);
  const browse = await tool("trechos_indexados", { workId: source.workId, limit: 2, offset: 1 });
  assert.equal(browse.structuredContent.passages.length, 2); assert.ok(browse.structuredContent.passages.every(p => p.workId === source.workId));
  const manual = await request("/api/ad", { action: "approvePassage", excerpt: "Inventada", confirmation: "aprovo" }); assert.equal(manual.status, 400);
  const obsolete = await request("/api/ad?action=candidates"); assert.equal(obsolete.status, 400);
  const input = { date, theme: "Teste de atenção", summary: "Síntese técnica para testar o ciclo AD.", context: "Fixture de teste, sem conteúdo pessoal.", openQuestion: "Como revisar a proposta?", practice: "Conferir a síntese antes de confirmar.", citations: [{ passageId, start: source.quoteStart, end: source.quoteEnd }] };
  const unknown = await tool("propor_reflexao_ad", { ...input, citations: [{ passageId: "nao-indexada", start: 0, end: 10 }] }); assert.equal(unknown.isError, true);
  const forged = await request("/api/ad", { action: "propose", ...input, references: [{excerpt:"Frase inventada"}] }); assert.equal(forged.status, 200);
  assert.equal((await forged.json()).references[0].excerpt, source.excerpt);
  const proposed = await tool("propor_reflexao_ad", input); const proposalId = proposed.structuredContent.id;
  assert.equal(proposed.structuredContent.references[0].excerpt, source.excerpt);
  assert.equal(proposed.structuredContent.references[0].sourceHash, source.sourceHash);
  assert.equal(proposed.structuredContent.saved, false); assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM "ADReflection"').get().n, 0);
  const refused = await tool("registrar_reflexao_ad", { proposalId, confirmation: "não registre" }); assert.equal(refused.isError, true);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM "ADReflection"').get().n, 0);
  const saved = await tool("registrar_reflexao_ad", { proposalId, confirmation: "registre" }); assert.equal(saved.structuredContent.saved, true);
  const recordId = saved.structuredContent.record.id;
  assert.equal(saved.structuredContent.record.summary, input.summary); assert.equal(saved.structuredContent.record.origin, "AD / conversa");
  const retried = await tool("registrar_reflexao_ad", { proposalId, confirmation: "confirmo" }); assert.equal(retried.structuredContent.record.id, recordId); assert.equal(retried.structuredContent.alreadyRegistered, true);
  const second = await tool("propor_reflexao_ad", { ...input, theme: "Segunda reflexão no mesmo dia", citations: [], passageIds: [] });
  assert.match(second.structuredContent.sourceStatus, /Não há base suficiente/);
  await tool("registrar_reflexao_ad", { proposalId: second.structuredContent.id, confirmation: "confirmo" });
  const list = await tool("listar_reflexoes_ad", { from: date, to: date }); assert.equal(list.structuredContent.total, 2);
  const otherUser = db.sqlite.prepare('SELECT COUNT(*) n FROM "ADReflection" WHERE userId != ?').get("test-user"); assert.equal(otherUser.n, 0);
  const history = await tool("historico_integrado", { from: date, to: date }); assert.equal(history.structuredContent.total, 4);
  const filtered = await tool("historico_integrado", { kind: "AD", theme: "Segunda" }); assert.equal(filtered.structuredContent.total, 1);
  const paged = await tool("historico_integrado", { limit: 1, offset: 1 }); assert.equal(paged.structuredContent.records.length, 1);
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM "DiaryEntry"').all(), beforeDiary);
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM "ReflectionEntry"').all(), beforeCycle);
  // The persisted record is returned by the Site's API and server-rendered Refletir screen.
  const api = await request("/api/ad?kind=AD"); assert.equal(api.status, 200); assert.equal((await api.json()).total, 2);
  const html = await request("/refletir"); assert.equal(html.status, 200); const text = await html.text();
  assert.match(text, /Trechos indexados das obras aprovadas/); assert.doesNotMatch(text, /Aprovar passagem|Cadastrar passagem|Passagens aprovadas/); assert.match(text, /Histórico integrado/); assert.ok(text.includes(recordId)); assert.match(text, /Síntese técnica/); assert.match(text, /Reflexões do ciclo/); assert.doesNotMatch(text, /codex-preview/);
  const focused = await request(saved.structuredContent.url); assert.equal(focused.status, 200); const focusedText = await focused.text(); assert.ok(focusedText.includes(recordId));
  const reports = await request("/relatorios"); assert.equal(reports.status, 200); assert.match(await reports.text(), /Reflexões AD/);
  const csv = await request(`/api/reports/export?from=${date}&to=${date}&sections=reflections,diary,passages`); assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /utf-8/);
  const csvText = new TextDecoder("utf-8").decode(await csv.arrayBuffer()); assert.ok(csvText.includes(recordId)); assert.match(csvText, /Diário preservado/); assert.match(csvText, /Texto do ciclo preservado/); assert.match(csvText, /sintese_aprovada/); assert.match(csvText, /Trechos indexados das obras aprovadas/); assert.ok(csvText.includes(source.textHash)); assert.match(csvText, /Ā|ā/);
  // The browser uses the same proposal/confirm service, never a direct write.
  const uiProposal = await request("/api/ad", { action: "propose", ...input, theme: "Teste via interface" }); const uiData = await uiProposal.json(); assert.equal(uiProposal.status, 200);
  const uiNoConsent = await request("/api/ad", { action: "confirm", proposalId: uiData.id }); assert.equal(uiNoConsent.status, 400);
  const uiConfirm = await request("/api/ad", { action: "confirm", proposalId: uiData.id, confirmation: "confirmo" }); assert.equal(uiConfirm.status, 200); assert.equal((await uiConfirm.json()).saved, true);
  const invalidDate = await request("/api/ad", { action: "propose", ...input, date: "2026-02-31" }); assert.equal(invalidDate.status, 400);
  db.sqlite.close();
});
