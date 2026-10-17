/**
 * Single-user password gate for the whole Worker.
 *
 * The password lives in the `SENDERO_SENHA` secret. A successful login sets an
 * HttpOnly cookie holding `<expiresAt>.<hmac>`, signed with a key derived from
 * the password, so changing the secret signs everyone out. Without the secret
 * the gate stays closed.
 */

const COOKIE_NAME = "sendero_sessao";
const SESSION_DAYS = 90;
const PUBLIC_PATHS = new Set(["/manifest.webmanifest", "/icon.svg", "/favicon.svg", "/favicon.ico"]);

export type AuthEnv = { SENDERO_SENHA?: string };

/** Returns a response when the request must be answered by the gate, or null to let it through. */
export async function handleAuth(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const password = env.SENDERO_SENHA ?? "";

  if (url.pathname === "/entrar") {
    if (!password) return loginPage("O login ainda não foi configurado no Cloudflare.", 503);
    if (request.method === "POST") return login(request, url, password);
    return loginPage();
  }
  if (url.pathname === "/sair") return logout();
  if (PUBLIC_PATHS.has(url.pathname)) return null;
  if (password && (await hasValidSession(request, password))) return null;

  const wantsPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsPage) {
    const next = url.pathname + url.search;
    return redirect(`/entrar${next === "/" ? "" : `?volta=${encodeURIComponent(next)}`}`);
  }
  return new Response("Não autorizado", { status: 401 });
}

export async function createSessionCookie(password: string, now = Date.now()) {
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const value = `${expiresAt}.${await sign(String(expiresAt), password)}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export async function hasValidSession(request: Request, password: string, now = Date.now()) {
  const token = readCookie(request.headers.get("cookie") ?? "", COOKIE_NAME);
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Number(expiresAt) < now) return false;
  return timingSafeEqual(signature, await sign(expiresAt, password));
}

async function login(request: Request, url: URL, password: string) {
  const form = await request.formData().catch(() => null);
  const attempt = String(form?.get("senha") ?? "");
  const ok = timingSafeEqual(await sha256(attempt), await sha256(password));
  if (!ok) {
    // Slows down guessing without needing extra storage.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return loginPage("Senha incorreta.", 401);
  }
  return redirect(safeNext(url.searchParams.get("volta")), await createSessionCookie(password));
}

function logout() {
  return redirect("/entrar", `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function redirect(location: string, cookie?: string) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function readCookie(header: string, name: string) {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function sign(value: string, password: string) {
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`sendero-sessao:${password}`));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(mac);
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

function loginPage(message = "", status = 200) {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sendero · Entrar</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f4ed; color: #1f2528;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  form { width: min(100% - 32px, 360px); background: #fff; border: 1px solid #ded7ca; border-radius: 12px; padding: 24px;
    box-shadow: 0 12px 30px rgba(31, 37, 40, 0.08); }
  h1 { margin: 0 0 4px; font-size: 22px; }
  p { margin: 0 0 20px; color: #46533b; font-size: 14px; }
  label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  input { box-sizing: border-box; width: 100%; font-size: 16px; padding: 12px; border: 1px solid #ded7ca; border-radius: 8px; }
  button { width: 100%; margin-top: 16px; padding: 12px; font-size: 16px; font-weight: 600; color: #fff; background: #66704f;
    border: 0; border-radius: 8px; }
  .erro { margin: 12px 0 0; color: #b85d3b; font-weight: 600; }
</style>
</head>
<body>
<form method="post">
  <h1>Sendero</h1>
  <p>Espaço pessoal. Entre com sua senha.</p>
  <label for="senha">Senha</label>
  <input id="senha" name="senha" type="password" autocomplete="current-password" required autofocus>
  <button type="submit">Entrar</button>
  ${message ? `<p class="erro" role="alert">${message}</p>` : ""}
</form>
</body>
</html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
