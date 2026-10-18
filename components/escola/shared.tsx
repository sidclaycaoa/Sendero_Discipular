"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { LiveIdea } from "@/lib/db/escola";

/** Sends one Escola action; refreshes the screen when it worked. */
export function useEscola() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function act<T = Record<string, unknown>>(action: string, body: Record<string, unknown>, refresh = true): Promise<T | null> {
    setError(null);
    const response = await fetch("/api/escola", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) }).catch(() => null);
    const data = await response?.json().catch(() => null) as (T & { error?: string }) | null;
    if (!response?.ok) { setError(data?.error ?? "Não foi possível salvar. Confira a conexão."); return null; }
    if (refresh) router.refresh();
    return data;
  }
  return { act, error, setError };
}

/**
 * Text that saves itself a moment after you stop typing or dictating,
 * and when you leave the field.
 */
export function AutoText({ value, onSave, placeholder, rows = 3, label }: { value: string; onSave: (value: string) => Promise<unknown>; placeholder: string; rows?: number; label?: string }) {
  const [text, setText] = useState(value);
  const [state, setState] = useState<"saved" | "typing" | "saving" | "error">("saved");
  const saved = useRef(value);
  const timer = useRef<number | undefined>(undefined);

  async function flush(next: string) {
    window.clearTimeout(timer.current);
    if (next === saved.current) { setState("saved"); return; }
    setState("saving");
    const ok = await onSave(next);
    if (ok === null) { setState("error"); return; }
    saved.current = next;
    setState("saved");
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <label className="block">
      {label ? <span className="flex items-baseline justify-between text-xs font-semibold text-ink/60">{label}<Status state={state} /></span> : null}
      <textarea
        value={text} rows={rows} placeholder={placeholder}
        onChange={(event) => { const next = event.target.value; setText(next); setState("typing"); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void flush(next), 1500); }}
        onBlur={() => void flush(text)}
        className="mt-1 w-full rounded-lg border border-line bg-paper p-3 text-sm leading-6 outline-none focus:border-moss"
      />
      {!label ? <Status state={state} /> : null}
    </label>
  );
}

function Status({ state }: { state: "saved" | "typing" | "saving" | "error" }) {
  const label = { saved: "", typing: "", saving: "salvando…", error: "não salvou, toque fora para tentar de novo" }[state];
  return label ? <span className={`text-[11px] font-normal ${state === "error" ? "text-red-700" : "text-ink/45"}`}>{label}</span> : null;
}

/** Ideas chosen to live this week, with today's check and the last 7 days. */
export function LiveIdeasList({ ideas, compact }: { ideas: LiveIdea[]; compact?: boolean }) {
  const { act } = useEscola();
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <ul className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      {ideas.map((idea) => {
        const today = done[idea.id] ?? idea.doneToday;
        return (
          <li key={idea.id} className="flex items-center gap-3 border-t border-line/70 px-3 py-2.5 first:border-t-0">
            <button type="button" aria-label={`${today ? "Desmarcar" : "Vivi hoje"}: ${idea.text}`} onClick={async () => { setDone((state) => ({ ...state, [idea.id]: !today })); if (!(await act("marcarIdeia", { id: idea.id, done: !today }))) setDone((state) => ({ ...state, [idea.id]: today })); }}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${today ? "border-clay bg-clay text-white" : "border-[#cfc8b9] bg-white text-transparent"}`}><Check className="h-4 w-4" /></button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm leading-5 ${today ? "text-ink/50" : "text-ink"} ${compact ? "line-clamp-2" : ""}`}>{idea.text}</p>
              <p className="mt-1 flex items-center gap-2 text-[11px] text-ink/45">
                <span className="inline-flex gap-[3px]">{idea.last7.map((value, index) => <i key={index} className={`h-[5px] w-[5px] rounded-full ${index === 6 ? (today ? "bg-clay" : "border border-clay/50") : value ? "bg-clay" : "bg-[#e3dccd]"}`} />)}</span>
                <span className="truncate">{idea.bastiao}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
