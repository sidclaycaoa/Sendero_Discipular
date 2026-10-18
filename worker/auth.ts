/**
 * Single-user access gate for the whole Worker.
 *
 * - Password (`SENDERO_SENHA` secret): a successful login sets an HttpOnly
 *   cookie holding `<expiresAt>.<hmac>`, signed with a key derived from the
 *   password, so changing the secret signs everyone out. Without the secret the
 *   gate stays closed.
 * - PIN lock (`SENDERO_PIN` secret, optional): like a banking app, the session
 *   stays long but the app locks after a few minutes without activity. An
 *   "active" cookie carries the last time the app was seen; it is refreshed on
 *   every request and by the page's heartbeat while it is on screen. Once it is
 *   older than the lock window, only the PIN reopens it; too many wrong PINs end
 *   the session and the full password is required again.
 */

const SESSION_COOKIE = "sendero_sessao";
const ACTIVE_COOKIE = "sendero_ativo";
const ATTEMPTS_COOKIE = "sendero_tentativas";
const SESSION_DAYS = 90;
export const LOCK_AFTER_MS = 5 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 5;
const PUBLIC_PATHS = new Set(["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png", "/favicon.svg", "/favicon.ico", "/sw.js"]);
export const PRESENCE_PATH = "/api/presenca";
const UNLOCK_PATH = "/desbloquear";

export type AuthEnv = { SENDERO_SENHA?: string; SENDERO_PIN?: string };

/** Either answer the request here, or let it through (optionally refreshing the activity cookie). */
export type AuthResult = { response: Response } | { setCookie: string | null };

export async function handleAuth(request: Request, env: AuthEnv, now = Date.now()): Promise<AuthResult> {
  const url = new URL(request.url);
  const password = env.SENDERO_SENHA ?? "";
  const pin = env.SENDERO_PIN ?? "";

  if (url.pathname === "/entrar") {
    if (!password) return { response: gatePage(loginForm("O login ainda não foi configurado no Cloudflare."), 503) };
    if (request.method === "POST") return { response: await login(request, url, password, pin, now) };
    return { response: gatePage(loginForm()) };
  }
  if (url.pathname === "/sair") return { response: redirect("/entrar", ...clearAllCookies()) };
  if (PUBLIC_PATHS.has(url.pathname)) return { setCookie: null };

  if (!password || !(await hasValidSession(request, password, now))) {
    if (wantsPage(request)) return { response: redirect(withNext("/entrar", url)) };
    return { response: json({ error: "Não autorizado" }, 401) };
  }
  if (!pin) {
    if (url.pathname === PRESENCE_PATH) return { response: new Response(null, { status: 204, headers: { "cache-control": "no-store" } }) };
    return { setCookie: null };
  }

  if (url.pathname === UNLOCK_PATH) {
    if (request.method === "POST") return { response: await unlock(request, url, password, pin, now) };
    if (await isActive(request, password, pin, now)) return { response: redirect(safeNext(url.searchParams.get("volta"))) };
    return { response: gatePage(pinForm()) };
  }
  if (!(await isActive(request, password, pin, now))) {
    if (wantsPage(request)) return { response: redirect(withNext(UNLOCK_PATH, url)) };
    return { response: json({ locked: true }, 401) };
  }

  const refreshed = await createActiveCookie(password, pin, now);
  if (url.pathname === PRESENCE_PATH) return { response: new Response(null, { status: 204, headers: { "set-cookie": refreshed, "cache-control": "no-store" } }) };
  return { setCookie: refreshed };
}

/** Adds the refreshed activity cookie to a response produced by the app. */
export function withCookie(response: Response, cookie: string | null) {
  if (!cookie) return response;
  const copy = new Response(response.body, response);
  copy.headers.append("set-cookie", cookie);
  return copy;
}

export async function createSessionCookie(password: string, now = Date.now()) {
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const value = `${expiresAt}.${await sign(String(expiresAt), `sendero-sessao:${password}`)}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export async function hasValidSession(request: Request, password: string, now = Date.now()) {
  const [expiresAt, signature] = (readCookie(request, SESSION_COOKIE) ?? "").split(".");
  if (!expiresAt || !signature || Number(expiresAt) < now) return false;
  return timingSafeEqual(signature, await sign(expiresAt, `sendero-sessao:${password}`));
}

async function createActiveCookie(password: string, pin: string, now: number) {
  const value = `${now}.${await sign(String(now), activeKey(password, pin))}`;
  return `${ACTIVE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

async function isActive(request: Request, password: string, pin: string, now: number) {
  const [lastSeen, signature] = (readCookie(request, ACTIVE_COOKIE) ?? "").split(".");
  if (!lastSeen || !signature || now - Number(lastSeen) > LOCK_AFTER_MS || Number(lastSeen) > now + 60_000) return false;
  return timingSafeEqual(signature, await sign(lastSeen, activeKey(password, pin)));
}

function activeKey(password: string, pin: string) {
  return `sendero-ativo:${password}:${pin}`;
}

async function login(request: Request, url: URL, password: string, pin: string, now: number) {
  const form = await request.formData().catch(() => null);
  const attempt = String(form?.get("senha") ?? "");
  if (!(await sameSecret(attempt, password))) {
    // Slows down guessing without needing extra storage.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return gatePage(loginForm("Senha incorreta."), 401);
  }
  const cookies = [await createSessionCookie(password, now), expired(ATTEMPTS_COOKIE)];
  if (pin) cookies.push(await createActiveCookie(password, pin, now));
  return redirect(safeNext(url.searchParams.get("volta")), ...cookies);
}

async function unlock(request: Request, url: URL, password: string, pin: string, now: number) {
  const asJson = (request.headers.get("content-type") ?? "").includes("application/json");
  const body = asJson ? await request.json().catch(() => null) as { pin?: unknown } | null : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());
  const attempt = String(body?.pin ?? "");

  if (await sameSecret(attempt, pin)) {
    const cookies = [await createActiveCookie(password, pin, now), expired(ATTEMPTS_COOKIE)];
    if (asJson) return json({ ok: true }, 200, cookies);
    return redirect(safeNext(url.searchParams.get("volta")), ...cookies);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  const failures = (await readAttempts(request, password)) + 1;
  if (failures >= MAX_PIN_ATTEMPTS) {
    const message = "Muitas tentativas de PIN. Entre com a senha.";
    if (asJson) return json({ ok: false, loggedOut: true, error: message }, 401, clearAllCookies());
    return gatePage(loginForm(message), 401, clearAllCookies());
  }
  const counter = `${ATTEMPTS_COOKIE}=${failures}.${await sign(String(failures), `sendero-tentativas:${password}`)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  const message = `PIN incorreto. ${MAX_PIN_ATTEMPTS - failures} tentativa${MAX_PIN_ATTEMPTS - failures === 1 ? "" : "s"} antes de pedir a senha.`;
  if (asJson) return json({ ok: false, error: message }, 401, [counter]);
  return gatePage(pinForm(message), 401, [counter]);
}

async function readAttempts(request: Request, password: string) {
  const [count, signature] = (readCookie(request, ATTEMPTS_COOKIE) ?? "").split(".");
  if (!count || !signature || !timingSafeEqual(signature, await sign(count, `sendero-tentativas:${password}`))) return 0;
  return Number(count) || 0;
}

function clearAllCookies() {
  return [expired(SESSION_COOKIE), expired(ACTIVE_COOKIE), expired(ATTEMPTS_COOKIE)];
}

function expired(name: string) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function wantsPage(request: Request) {
  return request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
}

function withNext(path: string, url: URL) {
  const next = url.pathname + url.search;
  return next === "/" ? path : `${path}?volta=${encodeURIComponent(next)}`;
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function redirect(location: string, ...cookies: string[]) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  cookies.forEach((cookie) => headers.append("set-cookie", cookie));
  return new Response(null, { status: 303, headers });
}

function json(body: unknown, status: number, cookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  cookies.forEach((cookie) => headers.append("set-cookie", cookie));
  return new Response(JSON.stringify(body), { status, headers });
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function sign(value: string, keyMaterial: string) {
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(mac);
}

async function sameSecret(attempt: string, secret: string) {
  return timingSafeEqual(await sha256(attempt), await sha256(secret));
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function loginForm(message = "") {
  return `<form method="post">
  <h1>Sendero</h1>
  <p>Espaço pessoal. Entre com sua senha.</p>
  <label for="senha">Senha</label>
  <input id="senha" name="senha" type="password" autocomplete="current-password" required autofocus>
  <button type="submit">Entrar</button>
  ${message ? `<p class="erro" role="alert">${message}</p>` : ""}
</form>`;
}

/**
 * The PIN has its own keypad: the phone's keyboard sometimes refuses to open
 * in apps installed on the iPhone home screen, which locked the user out.
 * A physical keyboard still works (digits, backspace, enter).
 */
function pinForm(message = "") {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "apagar", "0", "ok"];
  return `<form method="post" id="pin-form">
  <h1>Sendero bloqueado</h1>
  <p>Digite seu PIN para continuar.</p>
  <label for="pin">PIN</label>
  <input id="pin" name="pin" type="password" inputmode="none" readonly autocomplete="off" required>
  <div class="pad" role="group" aria-label="Teclado do PIN">
    ${keys.map((key) => key === "apagar" ? `<button type="button" data-key="apagar" aria-label="Apagar">⌫</button>`
      : key === "ok" ? `<button type="submit" class="ok" aria-label="Desbloquear">OK</button>`
      : `<button type="button" data-key="${key}">${key}</button>`).join("")}
  </div>
  ${message ? `<p class="erro" role="alert">${message}</p>` : ""}
  <p class="alt"><a href="/sair">Entrar com a senha</a></p>
</form>
<script>
  (function () {
    var form = document.getElementById("pin-form"), input = document.getElementById("pin");
    function press(key) {
      if (key === "apagar") input.value = input.value.slice(0, -1);
      else if (/^[0-9]$/.test(key) && input.value.length < 12) input.value += key;
    }
    form.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-key]");
      if (button) press(button.getAttribute("data-key"));
    });
    document.addEventListener("keydown", function (event) {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("apagar");
      else if (event.key === "Enter" && input.value) form.requestSubmit();
    });
  })();
</script>`;
}

function gatePage(form: string, status = 200, cookies: string[] = []) {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sendero</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f4ed; color: #1f2528;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  form { box-sizing: border-box; width: min(100% - 32px, 360px); background: #fff; border: 1px solid #ded7ca; border-radius: 12px; padding: 24px;
    box-shadow: 0 12px 30px rgba(31, 37, 40, 0.08); }
  h1 { margin: 0 0 4px; font-size: 22px; }
  p { margin: 0 0 20px; color: #46533b; font-size: 14px; }
  label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  input { box-sizing: border-box; width: 100%; font-size: 16px; padding: 12px; border: 1px solid #ded7ca; border-radius: 8px; }
  button { width: 100%; margin-top: 16px; padding: 12px; font-size: 16px; font-weight: 600; color: #fff; background: #66704f;
    border: 0; border-radius: 8px; }
  .erro { margin: 12px 0 0; color: #b85d3b; font-weight: 600; }
  input[readonly] { text-align: center; letter-spacing: 6px; font-size: 22px; background: #f7f4ed; }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
  .pad button { margin: 0; min-height: 56px; font-size: 22px; font-weight: 600; color: #1f2528; background: #f7f4ed; border: 1px solid #ded7ca; border-radius: 12px; }
  .pad button:active { background: #ded7ca; }
  .pad .ok { color: #fff; background: #66704f; border-color: #66704f; font-size: 18px; }
  .alt { margin: 16px 0 0; text-align: center; }
  .alt a { color: #46533b; }
</style>
</head>
<body>
${form}
</body>
</html>`;
  const headers = new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  cookies.forEach((cookie) => headers.append("set-cookie", cookie));
  return new Response(html, { status, headers });
}
