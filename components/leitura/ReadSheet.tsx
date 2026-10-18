"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import type { ReadingItem } from "@/lib/db/leitura";

// The running timer lives in the phone, so it survives the screen locking or the app closing.
const TIMER_KEY = "sendero-leitura-cronometro";
type Timer = { itemId: string; title: string; startedAt: number };

export function readTimer(): Timer | null {
  try { return JSON.parse(window.localStorage.getItem(TIMER_KEY) ?? "null") as Timer | null; } catch { return null; }
}
function writeTimer(timer: Timer | null) {
  try {
    if (timer) window.localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); else window.localStorage.removeItem(TIMER_KEY);
    window.dispatchEvent(new Event("sendero-timer"));
  } catch { /* private mode: the timer just won't survive a reload */ }
}
function subscribeTimer(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("sendero-timer", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("sendero-timer", callback); };
}
/** The running timer, as a string so React can compare snapshots. */
export const useRunningTimer = () => {
  const raw = useSyncExternalStore(subscribeTimer, () => { try { return window.localStorage.getItem(TIMER_KEY) ?? ""; } catch { return ""; } }, () => "");
  return raw ? JSON.parse(raw) as Timer : null;
};

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const rest = `${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${rest}` : rest;
};

/**
 * "Ler agora" runs a timer and then asks where the reading stopped;
 * "Registrar" asks the same without the timer.
 */
export function ReadSheet({ item, timed, onClose }: { item: ReadingItem; timed: boolean; onClose: () => void }) {
  const router = useRouter();
  const running = useRunningTimer();
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [minutes, setMinutes] = useState("");
  const [page, setPage] = useState(String(item.currentPage || ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!timed) return;
    // The screen only opens one timer at a time; a timer for this item keeps its start.
    if (readTimer()?.itemId !== item.id) writeTimer({ itemId: item.id, title: item.title, startedAt: Date.now() });
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [timed, item.id, item.title]);

  const startedAt = running?.itemId === item.id ? running.startedAt : null;
  const elapsed = startedAt ? (stoppedAt ?? now) - startedAt : 0;

  function stop() {
    const end = Date.now();
    setStoppedAt(end);
    setMinutes(String(Math.max(1, Math.round((end - (startedAt ?? end)) / 60_000))));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/leitura/sessao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, minutes: Number(minutes) || 0, toPage: page === "" ? null : Number(page) }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error);
      if (timed) writeTimer(null);
      router.refresh();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Não foi possível registrar.");
    } finally {
      setSaving(false);
    }
  }

  const max = item.totalPages ?? 100;
  return (
    <Sheet title={item.title} onClose={onClose}>
      {timed && stoppedAt === null ? (
        <div className="py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-olive">Lendo</p>
          <p className="mt-2 text-6xl font-semibold tabular-nums text-ink">{clock(elapsed)}</p>
          <p className="mt-2 text-sm text-ink/55">Pode bloquear o celular: o tempo continua contando.</p>
          <button type="button" onClick={stop} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-paper"><Square className="h-4 w-4" aria-hidden="true" /> Parar</button>
          <button type="button" onClick={() => { writeTimer(null); onClose(); }} className="mt-3 block w-full text-sm font-semibold text-ink/50">Descartar este tempo</button>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {timed ? <p className="text-sm text-ink/65">Você leu por {clock(elapsed)}.</p> : null}
          <label className="block"><span className="text-sm font-semibold text-ink">{item.totalPages ? "Parei na página" : "Quanto já li (%)"}</span>
            <div className="mt-1.5 flex items-center gap-3">
              <input inputMode="numeric" value={page} onChange={(event) => setPage(event.target.value.replace(/\D/g, ""))} className="min-h-11 w-24 rounded-lg border border-line bg-paper px-3 text-base tabular-nums" />
              <span className="text-sm text-ink/55">{item.totalPages ? `de ${item.totalPages}` : "%"}</span>
            </div>
            <input type="range" min={0} max={max} value={Number(page) || 0} onChange={(event) => setPage(event.target.value)} className="mt-3 w-full accent-[#6b4f3a]" aria-label="Ajustar onde parei" />
          </label>
          <label className="block"><span className="text-sm font-semibold text-ink">Minutos de leitura</span>
            <input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1.5 min-h-11 w-24 rounded-lg border border-line bg-paper px-3 text-base tabular-nums" />
            <span className="mt-1 block text-xs text-ink/55">Somam na meta semanal de Leitura em Hábitos.</span>
          </label>
          {error ? <p role="alert" className="text-sm font-semibold text-red-800">{error}</p> : null}
          <button type="button" onClick={save} disabled={saving} className="min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-50">{saving ? "Registrando…" : "Registrar leitura"}</button>
        </div>
      )}
    </Sheet>
  );
}
