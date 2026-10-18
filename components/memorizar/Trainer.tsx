"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, Pencil, RotateCcw, SkipForward, X } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import { TextForm } from "@/components/memorizar/TextForm";
import type { MemorizationText } from "@/lib/db/memorizacao";
import { initials, wordLengths } from "@/lib/memorize-text";
import { holdScreen } from "@/lib/screen-awake";

type Mode = "ler" | "iniciais" | "decor";
const MODES: Array<{ key: Mode; label: string }> = [{ key: "ler", label: "Ler" }, { key: "iniciais", label: "Iniciais" }, { key: "decor", label: "De cor" }];
// Right answers in a row, by heart, before suggesting the next line.
const READY_AFTER = 3;

/**
 * Practice of one text: the new line goes from reading, to first letters, to
 * by heart; three right answers by heart suggest moving to the next line.
 * The lines already learned stay above it as plain text, to read the new one in
 * context; "Do início" hides them too, to recite everything from the start.
 */
export function Trainer({ text, hasHabit }: { text: MemorizationText; hasHabit: boolean }) {
  const router = useRouter();
  const [known, setKnown] = useState(text.known);
  const [mode, setMode] = useState<Mode>("ler");
  const [fromStart, setFromStart] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [editing, setEditing] = useState(false);
  const [finish, setFinish] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // The screen stays on while practising; it is asked on the first tap (the phone only allows it then).
  const letScreenSleep = useRef<(() => void) | null>(null);
  const keepAwake = () => { letScreenSleep.current ??= holdScreen(); };
  useEffect(() => () => letScreenSleep.current?.(), []);

  const total = text.lines.length;
  const complete = known >= total;
  const current = Math.min(known, total - 1);
  const shown = text.lines.slice(0, complete ? total : current + 1);
  // A long text keeps the line being worked on in sight when it changes.
  const newLine = useRef<HTMLLIElement>(null);
  useEffect(() => { newLine.current?.scrollIntoView({ block: "nearest" }); }, [current]);

  async function record(event: "ACERTOU" | "ERROU" | "AVANCOU" | "VOLTOU") {
    setError(null);
    try {
      const response = await fetch("/api/memorizar/progresso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: text.id, event, line: current + 1 }) });
      if (!response.ok) throw new Error();
      return (await response.json() as { known: number }).known;
    } catch {
      setError("Não foi possível registrar agora. Confira a conexão.");
      return null;
    }
  }

  function changeMode(next: Mode) { setMode(next); setRevealed(false); }

  async function answer(right: boolean) {
    if (mode !== "ler") void record(right ? "ACERTOU" : "ERROU");
    setRevealed(false);
    if (right) {
      setStreak((value) => (mode === "decor" ? value + 1 : 0));
      if (mode !== "decor") changeMode(mode === "ler" ? "iniciais" : "decor");
    } else {
      setStreak(0);
      if (mode === "decor") changeMode("iniciais");
    }
  }

  async function move(event: "AVANCOU" | "VOLTOU") {
    const saved = await record(event);
    if (saved === null) return;
    setKnown(saved);
    setStreak(0);
    setFromStart(false);
    changeMode("ler");
    router.refresh();
  }

  async function finishToday() {
    setFinish("saving");
    const response = await fetch("/api/memorizar/concluir", { method: "POST" }).catch(() => null);
    setFinish(response?.ok ? "done" : "error");
  }

  if (editing) return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-ink">Editar texto</p>
      <TextForm initial={{ id: text.id, title: text.title, source: text.source, text: text.lines.join("\n") }} onDone={() => setEditing(false)} />
      <button type="button" onClick={async () => { if (!confirm("Tirar este texto da lista?")) return; await fetch("/api/memorizar", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: text.id }) }); router.push("/memorizar"); router.refresh(); }} className="mt-4 text-sm font-semibold text-red-800">Tirar da lista</button>
    </Card>
  );

  const hidden = mode === "decor" && !revealed;
  return (
    <div onPointerDownCapture={keepAwake}>
      <div className="mb-4 flex items-center justify-between">
        <Link prefetch={false} href="/memorizar" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Textos</Link>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink/60"><Pencil className="h-4 w-4" aria-hidden="true" /> Editar</button>
      </div>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-olive">Memorização</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{text.title}</h1>
        {text.source ? <p className="mt-1 text-sm text-ink/60">{text.source}</p> : null}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-moss transition-all" style={{ width: `${(known / total) * 100}%` }} /></div>
          <span className="text-xs font-semibold tabular-nums text-ink/70">{known}/{total}</span>
        </div>
        <p className="mt-1.5 text-xs text-ink/55">{complete ? "Texto inteiro de cor. Siga recitando do início para fixar." : `Trabalhando a linha ${current + 1} de ${total}.`}</p>
      </Card>

      <Card className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Ajuda" className="inline-flex rounded-full bg-paper p-1">
            {MODES.map((item) => (
              <button key={item.key} type="button" role="tab" aria-selected={mode === item.key} onClick={() => changeMode(item.key)} className={`min-h-9 rounded-full px-3.5 text-xs font-semibold ${mode === item.key ? "bg-ink text-paper" : "text-ink/65"}`}>{item.label}</button>
            ))}
          </div>
          {!complete && known > 0 ? (
            <button type="button" onClick={() => { setFromStart(!fromStart); setRevealed(false); }} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${fromStart ? "border-moss bg-moss/10 text-moss" : "border-line text-ink/65"}`}>{fromStart ? "Do início ✓" : "Do início"}</button>
          ) : null}
        </div>

        {!complete && !fromStart && known > 0 ? <p className="mt-4 text-xs font-semibold text-ink/55">Já de cor: leia junto antes da linha nova.</p> : null}
        <ol className={`${!complete && !fromStart && known > 0 ? "mt-2 space-y-1.5" : "mt-4 space-y-3"}`} aria-live="polite">
          {shown.map((line, index) => {
            const number = index + 1;
            const isNew = !complete && number === current + 1;
            const practised = complete || fromStart || isNew;
            return (
              <li key={number} ref={isNew ? newLine : undefined} className={`flex gap-3 rounded-lg ${isNew ? "bg-paper p-3 ring-1 ring-moss/30" : "px-3 py-1"}`}>
                <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-ink/40">{number}</span>
                <p className={`min-w-0 flex-1 ${isNew ? "text-lg leading-8 font-medium text-ink" : practised ? "text-lg leading-8 text-ink/80" : "text-base leading-7 text-ink/55"}`}>
                  {!practised ? line : hidden ? <Blanks line={line} /> : mode === "iniciais" ? <span className="tracking-wide">{initials(line)}</span> : line}
                </p>
              </li>
            );
          })}
        </ol>

        {hidden ? (
          <button type="button" onClick={() => setRevealed(true)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-ink"><Eye className="h-4 w-4" aria-hidden="true" /> Recitei. Conferir</button>
        ) : mode === "ler" ? (
          <button type="button" onClick={() => answer(true)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-paper">Li com atenção. Passar às iniciais</button>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => answer(false)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-ink"><X className="h-4 w-4" aria-hidden="true" /> Errei</button>
            <button type="button" onClick={() => answer(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-moss text-sm font-semibold text-white"><Check className="h-4 w-4" aria-hidden="true" /> Acertei</button>
          </div>
        )}

        {!complete && streak >= READY_AFTER ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-sm font-semibold text-emerald-900">{streak} acertos de cor seguidos. Esta linha já é sua.</p>
            <button type="button" onClick={() => move("AVANCOU")} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white"><SkipForward className="h-4 w-4" aria-hidden="true" /> {current + 1 < total ? `Ir para a linha ${current + 2}` : "Concluir o texto"}</button>
          </div>
        ) : streak > 0 && mode === "decor" ? (
          <p className="mt-3 text-center text-xs text-ink/55">{streak} de {READY_AFTER} acertos de cor para avançar.</p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3">
          {known > 0 ? <button type="button" onClick={() => move("VOLTOU")} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-ink/55"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Voltar uma linha</button> : <span />}
          {!complete ? <button type="button" onClick={() => move("AVANCOU")} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-moss">Já sei esta linha <SkipForward className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
        </div>
        {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      </Card>

      {hasHabit ? (
        finish === "done" ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-900">Memorização marcada como feita hoje.</p>
        ) : (
          <button type="button" onClick={finishToday} disabled={finish === "saving"} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-line bg-white text-sm font-semibold text-ink disabled:opacity-50">{finish === "saving" ? "Registrando…" : finish === "error" ? "Tentar de novo: concluir o treino de hoje" : "Concluir o treino de hoje"}</button>
        )
      ) : null}
    </div>
  );
}

/** The hidden line as blanks the size of each word. */
function Blanks({ line }: { line: string }) {
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-2 py-1" aria-label="Linha escondida">
      {wordLengths(line).map((length, index) => <span key={index} className="inline-block h-3 rounded-full bg-line" style={{ width: `${Math.min(10, Math.max(1, length)) * 0.55}em` }} />)}
    </span>
  );
}
