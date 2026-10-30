import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

// Aparência: the dark look covers every fixed color of the screens, and the choice is applied before drawing.
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

async function sources(dir) {
  const files = [];
  for (const entry of await readdir(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) files.push(...await sources(`${path}/`));
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const PALETTE = "red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|slate|gray|zinc|neutral|stone";
const COLOR_CLASS = new RegExp(`(?<![\\w-])(?:bg|text|border|ring|from|via|to|divide|accent|fill|stroke|shadow|outline|decoration)-(?:(?:${PALETTE})-\\d{2,3}|white|\\[[^\\]\\s"'\`]*#[0-9a-fA-F]{3,8}[^\\]\\s"'\`]*\\])(?:\\/\\d+)?(?![\\w-])`, "g");
const escape = (name) => name.replace(/[[\]#/.:(),]/g, (char) => `\\${char}`);

test("every fixed color used by a screen has its dark version, or is listed as kept", async () => {
  const css = await readFile(new URL("../app/theme-dark.css", import.meta.url), "utf8");
  const kept = new Set(css.slice(0, css.indexOf("*/")).split(/\s+/));
  const used = new Set();
  for (const file of [...await sources("../app/"), ...await sources("../components/")]) {
    for (const match of (await readFile(new URL(file, import.meta.url), "utf8")).matchAll(COLOR_CLASS)) used.add(match[0]);
  }
  // White letters and light tints over the dark blocks stay as they are.
  const tints = /^(?:(?:bg|border)-white\/(?:5|8|10|15)|text-white\/\d+)$/;
  const missing = [...used].filter((name) => !tints.test(name) && !kept.has(name) && !css.includes(`.${escape(name)} `) && !css.includes(`.${escape(name)},`) && !css.includes(`.${escape(name)}:`));
  assert.ok(used.size > 50, "the scan finds the color classes");
  assert.deepEqual(missing, [], "add these to app/theme-dark.css (or to its list of colors kept on purpose)");
});

test("the choice is read from the phone's cookie, light by default", () => {
  const source = new URL("../lib/theme.ts", import.meta.url).pathname;
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", `
    import { readThemeChoice } from ${JSON.stringify(source)};
    console.log(JSON.stringify(["", "sendero_tema=escuro", "a=1; sendero_tema=auto; b=2", "sendero_tema=roxo"].map(readThemeChoice)));
  `]).toString();
  assert.deepEqual(JSON.parse(out), ["claro", "escuro", "auto", "claro"]);
});

test("pages apply the look in the head, Configurações offers it, and the login page follows it", async () => {
  const db = new D1();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) db.sqlite.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const now = new Date().toISOString();
  db.sqlite.prepare('INSERT INTO "User" (id,email,name,cycleAnchorDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run("u1", "s@example.com", "Teste", now, now, now);
  const { default: worker } = await import(new URL(`../dist/server/index.js?tema=${Date.now()}`, import.meta.url));
  const env = { DB: db, SENDERO_SENHA: "senha", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const gate = await (await worker.fetch(new Request("https://s/entrar"), env, ctx)).text();
  assert.match(gate, /<head>[\s\S]*sendero_tema[\s\S]*<\/head>/);
  assert.match(gate, /\[data-theme="dark"\] body/);
  const login = await worker.fetch(new Request("https://s/entrar", { method: "POST", body: new URLSearchParams({ senha: "senha" }) }), env, ctx);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const html = await (await worker.fetch(new Request("https://s/configuracoes", { headers: { accept: "text/html", cookie } }), env, ctx)).text();
  const head = html.slice(0, html.indexOf("</head>"));
  assert.match(head, /senderoTema/, "the look is set before the page is drawn");
  assert.match(html, /Aparência/);
  assert.match(html, /Claro[\s\S]*Escuro[\s\S]*Automático/);
});
