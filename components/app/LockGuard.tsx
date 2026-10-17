"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";

// Mirrors LOCK_AFTER_MS in worker/auth.ts; the server is the one that enforces it.
const LOCK_AFTER_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const PRESENCE_PATH = "/api/presenca";

type LockState = "open" | "checking" | "locked";

/**
 * Covers the screen when the app comes back after the lock window, so private
 * text is never shown before the PIN. Unlocking happens in place, keeping any
 * text being written underneath. While the app is on screen a light heartbeat
 * keeps the server-side activity window fresh.
 */
export function LockGuard({ onReturn }: { onReturn: (awayMs: number) => void }) {
  const [state, setState] = useState<LockState>("open");
  const hiddenAt = useRef<number | null>(null);
  const onReturnRef = useRef(onReturn);
  useEffect(() => { onReturnRef.current = onReturn; }, [onReturn]);

  useEffect(() => {
    async function checkPresence() {
      try {
        const response = await fetch(PRESENCE_PATH, { cache: "no-store" });
        if (response.ok) { setState("open"); return; }
        const body = await response.json().catch(() => null) as { locked?: boolean } | null;
        if (body?.locked) setState("locked");
        else window.location.assign("/entrar");
      } catch {
        // Offline: keep the current state; the server checks again on the next request.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const awayMs = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (awayMs > LOCK_AFTER_MS) {
        setState("checking");
        void checkPresence();
      }
      onReturnRef.current(awayMs);
    }

    function onPageShow(event: PageTransitionEvent) {
      // Restored from the browser's back/forward cache: the server has not seen this page.
      if (event.persisted) { setState("checking"); void checkPresence(); }
    }

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkPresence();
    }, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  if (state === "open") return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-paper px-4" role="dialog" aria-modal="true" aria-label="Sendero bloqueado">
      {state === "checking" ? <LockKeyhole className="h-8 w-8 text-olive" aria-label="Verificando acesso" /> : <PinForm onUnlocked={() => setState("open")} />}
    </div>
  );
}

function PinForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/desbloquear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const body = await response.json().catch(() => null) as { ok?: boolean; loggedOut?: boolean; error?: string } | null;
      if (body?.ok) { onUnlocked(); return; }
      if (body?.loggedOut) { window.location.assign("/entrar"); return; }
      setError(body?.error ?? "Não foi possível desbloquear agora.");
      setPin("");
    } catch {
      setError("Sem conexão. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[360px] rounded-xl border border-line bg-white p-6 shadow-soft">
      <LockKeyhole className="h-6 w-6 text-olive" aria-hidden="true" />
      <h1 className="mt-3 text-xl font-semibold text-ink">Sendero bloqueado</h1>
      <p className="mt-1 text-sm text-moss">Digite seu PIN para continuar.</p>
      <label htmlFor="sendero-pin" className="mt-5 block text-sm font-semibold text-ink">PIN</label>
      <input id="sendero-pin" type="password" inputMode="numeric" autoComplete="off" autoFocus required value={pin} onChange={(event) => setPin(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-3 text-base" />
      <button type="submit" disabled={sending || !pin} className="mt-4 w-full rounded-lg bg-olive py-3 text-base font-semibold text-white disabled:opacity-60">{sending ? "Verificando…" : "Desbloquear"}</button>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-clay">{error}</p> : null}
      <a href="/sair" className="mt-4 block text-center text-sm text-moss underline">Entrar com a senha</a>
    </form>
  );
}
