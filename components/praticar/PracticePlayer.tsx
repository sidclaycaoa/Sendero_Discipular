"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Music2, Play, Square } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import { asanaOfDay, type PlayableTool } from "@/lib/practice";
import { holdScreen } from "@/lib/screen-awake";

type PracticeHabit = { id: string; title: string; description: string; cadence: "DAILY" | "WEEKLY" | "TIME_BASED"; targetCount: number; todayCount: number; note: string; dateKey: string };
type Phase = "ready" | "running" | "done";

const noSubscribe = () => () => undefined;
/** iPhone browsers refuse full screen to web pages; only the installed app hides the bar. */
function browserHidesBar() {
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return !installed && !document.fullscreenEnabled;
}

/**
 * Guided practice: keeps the screen awake, runs the tool (interval bells, Tratak
 * circle in full screen, or the exercise's music) and ends with an optional note
 * that also marks the practice as done for today.
 */
export function PracticePlayer({ habit, tool }: { habit: PracticeHabit; tool: PlayableTool }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const bellsRung = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const letScreenSleep = useRef<(() => void) | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement>(null);
  const duration = tool.kind === "music" ? null : tool.durationSec;
  const fullScreen = tool.kind === "tratak" || tool.kind === "asana";
  const needsInstall = useSyncExternalStore(noSubscribe, browserHidesBar, () => false) && fullScreen;
  const asana = tool.kind === "asana" ? asanaOfDay(tool, habit.dateKey) : null;

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setElapsed(seconds);
      if (tool.kind === "intervals") {
        // The last mark is announced by the closing tones instead of a single bell.
        const due = Math.min(Math.floor(seconds / tool.everySec), Math.floor(tool.durationSec / tool.everySec) - 1);
        while (bellsRung.current < due) { bellsRung.current += 1; ring(); }
      }
      if (duration !== null && seconds >= duration) finish(true);
    }, 200);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => { void release(); }, []);

  // Coming back to the app (after a call, a notification…): wake the sound up again.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void audio.current?.resume().catch(() => undefined); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  function tone(frequency: number, at: number, length: number) {
    const context = audio.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.5, context.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + at + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + at);
    oscillator.stop(context.currentTime + at + length + 0.05);
  }

  /** One bell for each interval; three rising tones and a vibration when the time is up. */
  function ring(final = false) {
    if (final) {
      tone(660, 0, 0.6); tone(784, 0.7, 0.6); tone(988, 1.4, 1.2);
      navigator.vibrate?.([400, 200, 400, 200, 600]);
    } else {
      tone(660, 0, 0.8);
      navigator.vibrate?.(200);
    }
  }

  async function start() {
    // Things that need the tap itself come first, before anything is awaited:
    // the screen must not sleep, or the timer stops and the bell never rings.
    letScreenSleep.current?.();
    letScreenSleep.current = holdScreen();
    if (fullScreen) {
      void document.documentElement.requestFullscreen?.({ navigationUI: "hide" })
        .then(() => (screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> }).lock?.(tool.kind === "tratak" ? "landscape" : "portrait"))
        .catch(() => undefined);
    }
    if (tool.kind === "music" && player.current) {
      player.current.currentTime = 0;
      void player.current.play().catch(() => undefined);
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: tool.trackName, artist: habit.title, album: "Sendero" });
    }
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio.current ??= AudioCtor ? new AudioCtor() : null;
    await audio.current?.resume().catch(() => undefined);
    bellsRung.current = 0;
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("running");
  }

  async function release() {
    player.current?.pause();
    letScreenSleep.current?.();
    letScreenSleep.current = null;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    (screen.orientation as unknown as { unlock?: () => void }).unlock?.();
  }

  function finish(completed: boolean) {
    if (completed) ring(true);
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

      {asana ? (
        <div className={phase === "running" ? "fixed inset-0 z-[90] bg-[#fbf9f4]" : "hidden"} onClick={() => phase === "running" && finish(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asana.pose.src} alt={asana.pose.name} className="h-full w-full object-contain" />
          <span className="absolute bottom-3 right-4 text-base font-semibold tabular-nums text-ink/40">{clock(Math.max(0, (duration ?? 0) - elapsed))}</span>
        </div>
      ) : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-olive">Prática guiada</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{habit.title}</h1>
        {habit.description ? <p className="mt-1 text-sm leading-6 text-ink/70">{habit.description}</p> : null}
        <p className="mt-3 rounded-lg bg-paper p-3 text-sm leading-6 text-ink/75">{tool.hint}</p>
        {asana && phase === "ready" ? (
          <figure className="mt-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asana.pose.src} alt={asana.pose.name} className="mx-auto h-72 w-auto rounded-xl border border-line" />
            <figcaption className="mt-2 text-sm font-semibold text-ink">Hoje: posição {asana.index + 1} de 6 · {asana.pose.name}</figcaption>
          </figure>
        ) : null}
        {needsInstall && phase === "ready" ? (
          <p className="mt-3 rounded-lg border border-clay/30 bg-clay/5 p-3 text-sm leading-6 text-ink/80">
            Neste navegador a barra de cima não some. Para a imagem em tela cheia, abra o Sendero pelo ícone na tela de início: no Safari, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>.
          </p>
        ) : null}

        {phase !== "done" ? (
          <div className="mt-5 text-center">
            <p className="text-5xl font-semibold tabular-nums text-ink" aria-live="off">{duration !== null ? clock(Math.max(0, duration - elapsed)) : clock(elapsed)}</p>
            {tool.kind === "intervals" ? <p className="mt-2 text-sm text-ink/60">Troca {Math.min(Math.floor(elapsed / tool.everySec) + 1, tool.durationSec / tool.everySec)} de {tool.durationSec / tool.everySec} · som a cada {tool.everySec} s</p> : null}
            {duration !== null ? <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-olive" style={{ width: `${Math.min(100, elapsed / duration * 100)}%` }} /></div> : null}
          </div>
        ) : null}

        {tool.kind === "music" ? (
          <div className={phase === "running" ? "mt-5" : "hidden"}>
            <p className="text-sm font-semibold text-ink">{tool.trackName}</p>
            <audio ref={player} src={tool.audioSrc} loop preload="auto" controls className="mt-2 w-full" />
            <p className="mt-1 text-xs text-ink/55">Repete sozinha até você concluir.</p>
            <a href={tool.spotifyUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-moss"><Music2 className="h-4 w-4" aria-hidden="true" /> Abrir no Spotify</a>
          </div>
        ) : null}

        {phase === "ready" ? (
          <button type="button" onClick={start} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-paper">
            <Play className="h-5 w-5" aria-hidden="true" /> {tool.kind === "tratak" ? "Começar (deite o celular)" : "Começar"}
          </button>
        ) : null}
        {phase === "running" && !fullScreen ? (
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
