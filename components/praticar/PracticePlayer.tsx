"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Music2, Play, Square } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import type { PracticeTool } from "@/lib/practice";

type PracticeHabit = { id: string; title: string; description: string; cadence: "DAILY" | "WEEKLY" | "TIME_BASED"; targetCount: number; todayCount: number; note: string; dateKey: string };
type Phase = "ready" | "running" | "done";

/**
 * Guided practice: keeps the screen awake, runs the tool (interval bells, Tratak
 * circle in full screen, or the exercise's music) and ends with an optional note
 * that also marks the practice as done for today.
 */
export function PracticePlayer({ habit, tool }: { habit: PracticeHabit; tool: PracticeTool }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const bellsRung = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const duration = tool.kind === "music" ? null : tool.durationSec;

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setElapsed(seconds);
      if (tool.kind === "intervals") {
        const due = Math.min(Math.floor(seconds / tool.everySec), Math.floor(tool.durationSec / tool.everySec));
        while (bellsRung.current < due) { bellsRung.current += 1; ring(); }
      }
      if (duration !== null && seconds >= duration) finish(true);
    }, 200);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Full screen (and landscape) once the circle is on screen, still within the tap that started it.
  useEffect(() => {
    if (phase !== "running" || tool.kind !== "tratak" || !stage.current) return;
    void stage.current.requestFullscreen?.()
      .then(() => (screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> }).lock?.("landscape"))
      .catch(() => undefined);
  }, [phase, tool.kind]);

  useEffect(() => () => { void release(); }, []);

  function ring(final = false) {
    const context = audio.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = final ? 523 : 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (final ? 1.6 : 0.8));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (final ? 1.7 : 0.9));
    navigator.vibrate?.(final ? [300, 150, 300] : 200);
  }

  async function start() {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio.current ??= AudioCtor ? new AudioCtor() : null;
    await audio.current?.resume().catch(() => undefined);
    try {
      wakeLock.current = await (navigator as unknown as { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch { wakeLock.current = null; }
    bellsRung.current = 0;
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("running");
  }

  async function release() {
    await wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    (screen.orientation as unknown as { unlock?: () => void }).unlock?.();
  }

  function finish(completed: boolean) {
    // The interval tool already rang its last bell; Tratak gets a softer closing tone.
    if (completed && tool.kind === "tratak") ring(true);
    void release();
    setPhase("done");
  }

  return (
    <>
      <Link prefetch={false} href="/habitos" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Hábitos</Link>

      {tool.kind === "tratak" ? (
        <div ref={stage} className={phase === "running" ? "fixed inset-0 z-[90] bg-white" : "hidden"} onClick={() => phase === "running" && finish(false)}>
          <svg viewBox="0 0 1600 760" preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Círculo do Tratak">
            <rect width="1600" height="760" fill="#ffffff" />
            <circle cx="800" cy="380" r="310" fill="none" stroke="#000000" strokeWidth="18" />
            <circle cx="800" cy="378" r="22" fill="#000000" />
          </svg>
          <span className="absolute bottom-3 right-4 text-sm tabular-nums text-black/25">{clock(Math.max(0, tool.durationSec - elapsed))}</span>
        </div>
      ) : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-olive">Prática guiada</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{habit.title}</h1>
        {habit.description ? <p className="mt-1 text-sm leading-6 text-ink/70">{habit.description}</p> : null}
        <p className="mt-3 rounded-lg bg-paper p-3 text-sm leading-6 text-ink/75">{tool.hint}</p>

        {phase !== "done" ? (
          <div className="mt-5 text-center">
            <p className="text-5xl font-semibold tabular-nums text-ink" aria-live="off">{duration !== null ? clock(Math.max(0, duration - elapsed)) : clock(elapsed)}</p>
            {tool.kind === "intervals" ? <p className="mt-2 text-sm text-ink/60">Som {Math.min(bellsRung.current, tool.durationSec / tool.everySec)} de {tool.durationSec / tool.everySec} · a cada {tool.everySec} s</p> : null}
            {duration !== null ? <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-olive" style={{ width: `${Math.min(100, elapsed / duration * 100)}%` }} /></div> : null}
          </div>
        ) : null}

        {tool.kind === "music" && phase === "running" ? (
          <div className="mt-5">
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${tool.youtubeId}?autoplay=1&playsinline=1&rel=0`} title={tool.label} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
            <a href={tool.spotifyUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-moss"><Music2 className="h-4 w-4" aria-hidden="true" /> Abrir no Spotify</a>
          </div>
        ) : null}

        {phase === "ready" ? (
          <button type="button" onClick={start} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-paper">
            <Play className="h-5 w-5" aria-hidden="true" /> {tool.kind === "tratak" ? "Começar (deite o celular)" : "Começar"}
          </button>
        ) : null}
        {phase === "running" && tool.kind !== "tratak" ? (
          <button type="button" onClick={() => finish(false)} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-ink">
            <Square className="h-4 w-4" aria-hidden="true" /> {tool.kind === "music" ? "Concluir prática" : "Encerrar antes"}
          </button>
        ) : null}
        {phase === "done" ? <FinishForm habit={habit} minutes={Math.max(1, Math.round(elapsed / 60))} /> : null}
      </Card>
    </>
  );
}

function FinishForm({ habit, minutes }: { habit: PracticeHabit; minutes: number }) {
  const [note, setNote] = useState(habit.note);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    // A practice session counts one more time today (minutes for time-based habits).
    const count = habit.cadence === "DAILY" ? Math.min(habit.targetCount, habit.todayCount + 1) : habit.todayCount + 1;
    try {
      const response = await fetch("/api/habits/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ habitId: habit.id, dateKey: habit.dateKey, count: habit.cadence === "TIME_BASED" ? 0 : count, minutes: habit.cadence === "TIME_BASED" ? minutes : 0, note }) });
      if (!response.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Não foi possível registrar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) return (
    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
      <p className="text-base font-semibold text-emerald-900">Prática registrada.</p>
      <Link prefetch={false} href="/habitos" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white">Voltar aos hábitos</Link>
    </div>
  );
  return (
    <div className="mt-5">
      <p className="text-base font-semibold text-ink">Prática concluída.</p>
      <label htmlFor="practice-note" className="mt-3 block text-sm font-semibold text-ink">Como foi? (opcional)</label>
      <textarea id="practice-note" value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="O que você sentiu, percebeu ou estranhou…" className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-moss" />
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={save} disabled={saving} className="mt-3 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-50">{saving ? "Registrando…" : "Registrar prática"}</button>
    </div>
  );
}

function clock(totalSeconds: number) {
  const seconds = Math.ceil(totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
