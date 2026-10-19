"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, CheckCircle2, Copy, Lightbulb, RotateCcw } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import type { AppFeedback } from "@/lib/db/pendencias";

export function FeedbackList({ items }: { items: AppFeedback[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = items.filter((item) => item.status === "OPEN");
  const done = items.filter((item) => item.status === "DONE");

  async function setDone(item: AppFeedback, value: boolean) {
    setBusy(item.id);
    setError(null);
    try {
      const response = await fetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, done: value }) });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Não foi possível atualizar agora.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Abertas · {open.length}</h2>
        {open.length ? <CopyAll items={open} /> : null}
      </div>
      <div className="mt-3 space-y-3">
        {open.length ? open.map((item) => (
          <Card key={item.id}>
            <ItemHeader item={item} />
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{item.description}</p>
            <button type="button" disabled={busy === item.id} onClick={() => setDone(item, true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Marcar como resolvida
            </button>
          </Card>
        )) : <p className="text-sm text-ink/60">Nenhuma pendência aberta.</p>}
      </div>
      {done.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-lg font-semibold text-ink">Resolvidas · {done.length}</summary>
          <div className="mt-3 space-y-3">
            {done.map((item) => (
              <Card key={item.id} className="opacity-80">
                <ItemHeader item={item} />
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/80">{item.description}</p>
                <button type="button" disabled={busy === item.id} onClick={() => setDone(item, false)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink disabled:opacity-50">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reabrir
                </button>
              </Card>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

/** The open items as one text, ready to paste in a conversation. */
function feedbackText(items: AppFeedback[]) {
  const header = `Pendências do Sendero · ${items.length} aberta${items.length === 1 ? "" : "s"} · ${formatDate(new Date().toISOString())}`;
  const lines = items.map((item, index) => `${index + 1}. [${item.kind === "BUG" ? "Bug" : "Melhoria"}] ${formatDate(item.createdAt)}${item.page ? ` · tela ${item.page}` : ""}\n${item.description.trim()}`);
  return [header, ...lines].join("\n\n");
}

function CopyAll({ items }: { items: AppFeedback[] }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const text = feedbackText(items);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      // Some app views refuse the clipboard: show the text selected, to copy by hand.
      setState("manual");
    }
  }
  return (
    <>
      <button type="button" onClick={copy} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-moss">
        <Copy className="h-4 w-4" aria-hidden="true" /> {state === "copied" ? "Copiado ✓" : "Copiar todas"}
      </button>
      {state === "manual" ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
          <p className="text-sm font-semibold text-ink">O iPhone não deixou copiar sozinho. O texto já está selecionado: toque em Copiar.</p>
          <textarea readOnly autoFocus value={text} onFocus={(event) => event.currentTarget.select()} rows={6} className="mt-2 w-full rounded-lg border border-line bg-paper p-2 text-sm" aria-label="Pendências abertas" />
          <button type="button" onClick={() => setState("idle")} className="mt-2 min-h-10 rounded-lg border border-line px-3 text-sm font-semibold">Fechar</button>
        </div>
      ) : null}
    </>
  );
}

function ItemHeader({ item }: { item: AppFeedback }) {
  const isBug = item.kind === "BUG";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${isBug ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
        {isBug ? <Bug className="h-3.5 w-3.5" aria-hidden="true" /> : <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />}{isBug ? "Bug" : "Melhoria"}
      </span>
      <span className="text-xs text-ink/55">{formatDate(item.createdAt)}{item.page ? ` · ${item.page}` : ""}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}
