import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createHmac } from "node:crypto";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `pin-${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const ctx = { waitUntil() {}, passThroughOnException() {} };
const assets = { fetch: async () => new Response("asset", { status: 200 }) };
const env = { SENDERO_SENHA: "senha-correta", SENDERO_PIN: "246810", ASSETS: assets };

const call = (path, init = {}, overrides = {}) => worker.fetch(new Request(`https://sendero.test${path}`, init), { ...env, ...overrides }, ctx);
const cookieValue = (response, name) => response.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith(`${name}=`));

async function login() {
  const response = await call("/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) });
  return { session: cookieValue(response, "sendero_sessao"), active: cookieValue(response, "sendero_ativo") };
}

// Same signing scheme as worker/auth.ts, to forge an activity cookie from the past.
function activeCookieAt(timestamp) {
  const key = createHash("sha256").update(`sendero-ativo:${env.SENDERO_SENHA}:${env.SENDERO_PIN}`).digest();
  return `sendero_ativo=${timestamp}.${createHmac("sha256", key).update(String(timestamp)).digest("hex")}`;
}

const pinRequest = (pin, cookie) => call("/desbloquear", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ pin }) });

test("logging in with the password also opens the PIN window", async () => {
  const { session, active } = await login();
  assert.ok(session && active);
  const response = await call("/manifest.webmanifest");
  assert.equal(response.status, 200);
  const page = await call("/icon-qualquer.png", { headers: { cookie: `${session}; ${active}` } });
  assert.equal(page.status, 200);
  assert.ok(cookieValue(page, "sendero_ativo"), "every allowed request refreshes the activity window");
});

test("after five minutes away the app asks for the PIN, on pages and on data", async () => {
  const { session } = await login();
  const stale = activeCookieAt(Date.now() - 6 * 60 * 1000);
  const page = await call("/diario", { headers: { accept: "text/html", cookie: `${session}; ${stale}` } });
  assert.equal(page.status, 303);
  assert.equal(page.headers.get("location"), "/desbloquear?volta=%2Fdiario");
  const api = await call("/api/tasks", { headers: { cookie: `${session}; ${stale}` } });
  assert.equal(api.status, 401);
  assert.deepEqual(await api.json(), { locked: true });
  const presence = await call("/api/presenca", { headers: { cookie: `${session}; ${stale}` } });
  assert.equal(presence.status, 401);
});

test("the heartbeat keeps a recent window open", async () => {
  const { session } = await login();
  const recent = activeCookieAt(Date.now() - 60 * 1000);
  const presence = await call("/api/presenca", { headers: { cookie: `${session}; ${recent}` } });
  assert.equal(presence.status, 204);
  assert.ok(cookieValue(presence, "sendero_ativo"));
});

test("the right PIN unlocks in place; a wrong one counts down", async () => {
  const { session } = await login();
  const wrong = await pinRequest("000000", session);
  assert.equal(wrong.status, 401);
  assert.match((await wrong.json()).error, /4 tentativas/);
  const attempts = cookieValue(wrong, "sendero_tentativas");
  const right = await pinRequest(env.SENDERO_PIN, `${session}; ${attempts}`);
  assert.equal(right.status, 200);
  assert.deepEqual(await right.json(), { ok: true });
  assert.ok(cookieValue(right, "sendero_ativo"));
});

test("five wrong PINs end the session and require the password", async () => {
  const { session } = await login();
  let cookie = session;
  let last;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    last = await pinRequest("111111", cookie);
    const counter = cookieValue(last, "sendero_tentativas");
    if (counter) cookie = `${session}; ${counter}`;
  }
  const body = await last.json();
  assert.equal(body.loggedOut, true);
  assert.equal(cookieValue(last, "sendero_sessao"), "sendero_sessao=");
});

test("without a PIN configured the lock stays off", async () => {
  const response = await call("/entrar", { method: "POST", body: new URLSearchParams({ senha: env.SENDERO_SENHA }) }, { SENDERO_PIN: undefined });
  const session = cookieValue(response, "sendero_sessao");
  assert.equal(cookieValue(response, "sendero_ativo"), undefined);
  const presence = await call("/api/presenca", { headers: { cookie: session } }, { SENDERO_PIN: undefined });
  assert.equal(presence.status, 204);
});

test("the unlock screen still requires a session", async () => {
  const response = await call("/desbloquear", { headers: { accept: "text/html" } });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/entrar?volta=%2Fdesbloquear");
});

test("the PIN screen brings its own keypad, so it never depends on the phone keyboard", async () => {
  const { session } = await login();
  const page = await (await call("/desbloquear", { headers: { accept: "text/html", cookie: session } })).text();
  assert.match(page, /<input id="pin" name="pin" type="password" inputmode="none" readonly/);
  for (const key of ["0", "1", "5", "9"]) assert.ok(page.includes(`data-key="${key}"`), key);
  assert.ok(page.includes('data-key="apagar"'));
  assert.ok(!page.includes("autofocus"));
});
