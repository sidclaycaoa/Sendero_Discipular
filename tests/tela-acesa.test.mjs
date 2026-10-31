import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";

// Tela acesa ao ditar: a request refused for lack of a tap (Safari) must not hold back the next one.
test("a refused wake lock request does not block the next one, the video plays sound without looping, and the answer is kept for Configurações", () => {
  const source = new URL("../lib/screen-awake.ts", import.meta.url).pathname;
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", `
    const store = new Map();
    const pending = [];
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {}, body: { appendChild() {} },
      createElement: () => (video = { paused: true, setAttribute() {}, removeAttribute() {}, addEventListener() {}, style: {}, play: () => Promise.resolve(), pause() {}, load() {}, remove() {} }) };
    let video;
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
    console.log(JSON.stringify({ muted: Boolean(video.muted), loop: Boolean(video.loop), src: video.src.slice(0, 14), playing: JSON.parse(store.get("sendero_tela_acesa")).video, asked, after: pending.length, refused: [refused.held, refused.refused], held: held.held, released, saved: JSON.parse(store.get("sendero_tela_acesa")).held }));
  `]).toString();
  assert.deepEqual(JSON.parse(out), { muted: false, loop: false, src: "data:video/mp4", playing: true, asked: 2, after: 2, refused: [false, "Permission was denied"], held: true, released: 1, saved: true });
});

test("the keep-awake video carries a sound track (Safari ignores a video without sound)", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../lib/screen-awake.ts", import.meta.url), "utf8");
  const file = Buffer.from(/base64,([A-Za-z0-9+/=]+)/.exec(source)[1], "base64");
  assert.ok(file.includes("soun") && file.includes("mp4a"), "faixa de áudio AAC");
  assert.ok(file.includes("vide") && file.includes("avc1"), "faixa de vídeo H.264");
});
