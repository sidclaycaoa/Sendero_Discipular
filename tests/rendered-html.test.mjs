import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("omits development preview metadata in production", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const env = {
    SENDERO_SENHA: "senha-de-teste",
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const login = await worker.fetch(
    new Request("https://localhost/entrar", { method: "POST", body: new URLSearchParams({ senha: "senha-de-teste" }) }),
    env,
    ctx,
  );
  const cookie = login.headers.get("set-cookie").split(";")[0];

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", cookie },
    }),
    {
      SENDERO_SENHA: env.SENDERO_SENHA,
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.doesNotMatch(await response.text(), developmentPreviewMeta);
});
