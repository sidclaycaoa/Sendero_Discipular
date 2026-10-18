import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import { createECDH, createDecipheriv, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";

// Phone reminders: Web Push sent by the Worker's cron.
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
  const { default: worker } = await import(new URL(`../dist/server/index.js?lembretes=${Date.now()}-${Math.random()}`, import.meta.url));
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

const b64url = (buffer) => Buffer.from(buffer).toString("base64url");

/** A phone's side: its keys, and decrypting what the push service would deliver (RFC 8291). */
function fakePhone() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  const subscription = { endpoint: `https://push.example/${randomBytes(6).toString("hex")}`, keys: { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(auth) } };
  function decrypt(body) {
    const salt = body.subarray(0, 16);
    const idLength = body[20];
    const senderKey = body.subarray(21, 21 + idLength);
    const cipher = body.subarray(21 + idLength);
    const shared = ecdh.computeSecret(senderKey);
    const ikm = Buffer.from(hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), ecdh.getPublicKey(), senderKey]), 32));
    const key = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
    const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
    const decipher = createDecipheriv("aes-128-gcm", key, nonce);
    decipher.setAuthTag(cipher.subarray(cipher.length - 16));
    const plain = Buffer.concat([decipher.update(cipher.subarray(0, cipher.length - 16)), decipher.final()]);
    assert.equal(plain[plain.length - 1], 2, "last-record delimiter");
    return JSON.parse(plain.subarray(0, -1).toString("utf8"));
  }
  return { subscription, decrypt };
}

function checkVapid(header, publicKey, endpoint) {
  const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(key, publicKey);
  const [head, claims, signature] = token.split(".");
  const raw = Buffer.from(publicKey, "base64url");
  const jwk = { kty: "EC", crv: "P-256", x: b64url(raw.subarray(1, 33)), y: b64url(raw.subarray(33, 65)) };
  assert.ok(verify("sha256", Buffer.from(`${head}.${claims}`), { key: createPublicKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")));
  const payload = JSON.parse(Buffer.from(claims, "base64url").toString());
  assert.equal(payload.aud, new URL(endpoint).origin);
  assert.equal(payload.sub, "https://s");
}

function saoPauloNow() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
}

async function runCron(worker, env) {
  const pending = [];
  await worker.scheduled({}, env, { waitUntil: (promise) => pending.push(promise), passThroughOnException() {} });
  await Promise.all(pending);
}

test("due reminders reach the phone encrypted and signed, only when something is pending, once a day", async () => {
  const { db, call, worker, env } = await setup();
  const phone = fakePhone();
  const { publicKey } = await (await call("/api/lembretes/inscricao")).json();
  assert.equal(Buffer.from(publicKey, "base64url").length, 65);
  assert.equal((await call("/api/lembretes/inscricao", phone.subscription)).status, 200);
  await (await call("/configuracoes")).text(); // creates the default reminders
  db.sqlite.prepare('UPDATE "Reminder" SET time = ?').run(saoPauloNow());

  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return new Response(null, { status: 201 }); };
  try {
    await runCron(worker, env);
    // No reflection is due in this database, so only practices and the blank diary are reminded.
    const messages = sent.map(({ url, init }) => {
      assert.equal(url, phone.subscription.endpoint);
      assert.equal(init.headers["Content-Encoding"], "aes128gcm");
      checkVapid(init.headers.Authorization, publicKey, url);
      return phone.decrypt(Buffer.from(init.body));
    });
    assert.deepEqual(messages.map((message) => message.url).sort(), ["/diario", "/habitos"]);
    assert.ok(messages.every((message) => message.title === "Sendero"));
    assert.match(messages.find((message) => message.url === "/diario").body, /Diário de hoje ainda está em branco/);

    sent.length = 0;
    await runCron(worker, env);
    assert.equal(sent.length, 0, "a reminder goes out once a day");

    // The test button, and a phone that left (410) is forgotten.
    globalThis.fetch = async () => new Response(null, { status: 410 });
    assert.equal((await (await call("/api/lembretes", {})).json()).sent, 0);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "PushSubscription"').get().n, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("switched-off or long-past reminders stay quiet; bad times are refused", async () => {
  const { db, call, worker, env } = await setup();
  await call("/api/lembretes/inscricao", fakePhone().subscription);
  await (await call("/configuracoes")).text();
  const [diary, practices] = ["DIARIO", "PRATICAS"].map((kind) => db.sqlite.prepare('SELECT id FROM "Reminder" WHERE kind = ?').get(kind).id);
  db.sqlite.prepare('UPDATE "Reminder" SET time = ?').run(saoPauloNow());
  assert.equal((await call.patch("/api/lembretes", { id: diary, enabled: false })).status, 200);
  assert.equal((await call.patch("/api/lembretes", { id: practices, time: "25:00" })).status, 400);
  // Two hours ago is too late to still be useful.
  const [hour, minute] = saoPauloNow().split(":").map(Number);
  const past = `${String((hour + 22) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  assert.equal((await call.patch("/api/lembretes", { id: practices, time: past })).status, 200);

  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { sent.push(String(url)); return new Response(null, { status: 201 }); };
  try { await runCron(worker, env); } finally { globalThis.fetch = realFetch; }
  assert.equal(sent.length, 0);
});

test("the service worker is reachable without a session and shows only what the push carries", async () => {
  const { worker } = await setup();
  const env = { DB: null, SENDERO_SENHA: "senha", ASSETS: { fetch: async () => new Response("sw", { status: 200 }) } };
  const response = await worker.fetch(new Request("https://s/sw.js"), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.ok(!/addEventListener\("fetch"/.test(source), "no page caching");
});
