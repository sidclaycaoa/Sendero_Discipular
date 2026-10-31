import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";

// Tela acesa ao ditar: a request refused for lack of a tap (Safari) must not hold back the next one.
test("a refused wake lock request does not block the next one, and the answer is kept for Configurações", () => {
  const source = new URL("../lib/screen-awake.ts", import.meta.url).pathname;
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", `
    const store = new Map();
    const pending = [];
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {}, body: { appendChild() {} },
      createElement: () => ({ setAttribute() {}, removeAttribute() {}, addEventListener() {}, style: {}, play: () => Promise.resolve(), pause() {}, load() {}, remove() {} }) };
    Object.defineProperty(globalThis, "navigator", { value: { wakeLock: { request: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } } });
    const { holdScreen, readScreenAwakeStatus } = await import(${JSON.stringify(source)});
    const hold = holdScreen();          // pointerdown: no tap yet for Safari
    hold.renew();                       // touchend, while the first is still unanswered
    const asked = pending.length;
    let released = 0;
    const sentinel = () => ({ release: async () => { released++; }, addEventListener() {} });
    pending[0].reject(new Error("Permission was denied"));
    await new Promise((r) => setTimeout(r, 0));
    const refused = readScreenAwakeStatus();
    pending[1].resolve(sentinel());
    await new Promise((r) => setTimeout(r, 0));
    const held = readScreenAwakeStatus();
    hold.renew();                       // already held: no new request
    hold();
    await new Promise((r) => setTimeout(r, 0));
    console.log(JSON.stringify({ asked, after: pending.length, refused: [refused.held, refused.refused], held: held.held, released, saved: JSON.parse(store.get("sendero_tela_acesa")).held }));
  `]).toString();
  assert.deepEqual(JSON.parse(out), { asked: 2, after: 2, refused: [false, "Permission was denied"], held: true, released: 1, saved: true });
});
