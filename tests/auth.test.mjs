import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `auth-${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const ctx = { waitUntil() {}, passThroughOnException() {} };
const assets = { fetch: async () => new Response("asset", { status: 200 }) };
const env = { SENDERO_SENHA: "senha-correta", ASSETS: assets };

const call = (path, init = {}, overrides = {}) =>
  worker.fetch(new Request(`https://sendero.test${path}`, init), { ...env, ...overrides }, ctx);

async function sessionCookie() {
  const response = await call("/entrar", { method: "POST", body: new URLSearchParams({ senha: "senha-correta" }) });
  return response.headers.get("set-cookie").split(";")[0];
}

test("pages redirect to the login screen without a session", async () => {
  const response = await call("/diario", { headers: { accept: "text/html" } });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/entrar?volta=%2Fdiario");
});

test("APIs, MCP and book files are closed without a session", async () => {
  for (const path of ["/api/tasks", "/mcp", "/ad-sources/seneca-tranquilidade.pdf"]) {
    const response = await call(path);
    assert.equal(response.status, 401, path);
  }
});

test("the app manifest and icon stay public for installing on the phone", async () => {
  assert.equal((await call("/manifest.webmanifest")).status, 200);
  assert.equal((await call("/icon.svg")).status, 200);
});

test("a wrong password does not open a session", async () => {
  const response = await call("/entrar", { method: "POST", body: new URLSearchParams({ senha: "errada" }) });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("the right password opens a session and returns to the requested page", async () => {
  const response = await call("/entrar?volta=%2Fdiario", { method: "POST", body: new URLSearchParams({ senha: "senha-correta" }) });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/diario");
  assert.match(response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);

  const asset = await call("/ad-sources/seneca-tranquilidade.pdf", { headers: { cookie: await sessionCookie() } });
  assert.equal(asset.status, 200);
});

test("redirects after login never leave the site", async () => {
  const response = await call("/entrar?volta=%2F%2Fevil.example", { method: "POST", body: new URLSearchParams({ senha: "senha-correta" }) });
  assert.equal(response.headers.get("location"), "/");
});

test("changing the password signs old sessions out", async () => {
  const cookie = await sessionCookie();
  const response = await call("/api/tasks", { headers: { cookie } }, { SENDERO_SENHA: "nova-senha" });
  assert.equal(response.status, 401);
});

test("a forged session cookie is rejected", async () => {
  const response = await call("/api/tasks", { headers: { cookie: `sendero_sessao=${Date.now() + 1e9}.${"0".repeat(64)}` } });
  assert.equal(response.status, 401);
});

test("without the secret configured, everything stays closed", async () => {
  const response = await call("/", { headers: { accept: "text/html" } }, { SENDERO_SENHA: undefined });
  assert.equal(response.status, 303);
  const login = await call("/entrar", {}, { SENDERO_SENHA: undefined });
  assert.equal(login.status, 503);
});
