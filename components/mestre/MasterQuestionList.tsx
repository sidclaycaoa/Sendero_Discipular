"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import type { MasterQuestion } from "@/lib/db/pendencias";

export function MasterQuestionList({ items }: { items: MasterQuestion[] }) {
  const open = items.filter((item) => item.status === "OPEN");
  const answered = items.filter((item) => item.status === "ANSWERED");
  return (
    <>
      <h2 className="mt-6 text-lg font-semibold text-ink">Para conversar · {open.length}</h2>
      <div className="mt-3 space-y-3">
        {open.length ? open.map((item) => <QuestionCard key={item.id} item={item} />) : <p className="text-sm text-ink/60">Nenhuma dúvida aberta. Use “Guardar dúvida para o mestre” numa reflexão ou no Diário.</p>}
      </div>
      {answered.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-lg font-semibold text-ink">Já conversadas · {answered.length}</summary>
          <div className="mt-3 space-y-3">{answered.map((item) => <QuestionCard key={item.id} item={item} />)}</div>
        </details>
      ) : null}
    </>
  );
}

function QuestionCard({ item }: { item: MasterQuestion }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpen = item.status === "OPEN";

  async function update(answered: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/mestre", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, answered, answer }) });
      if (!response.ok) throw new Error();
      setClosing(false);
      router.refresh();
    } catch {
      setError("Não foi possível salvar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={isOpen ? "border border-violet-200" : "opacity-85"}>
      <p className="text-xs font-bold uppercase tracking-wide text-violet-800">
        {item.sourceType === "REFLEXAO" ? "Reflexão" : item.sourceType === "DIARIO" ? "Diário" : "Dúvida"}{item.sourceDate ? ` · ${formatDate(item.sourceDate)}` : ""}
      </p>
      {item.contextTitle ? <p className="mt-1 text-sm font-semibold text-ink">{item.contextTitle}</p> : null}
      {item.contextDetail ? <p className="mt-0.5 text-xs text-ink/60">{item.contextDetail}</p> : null}
      <p className="mt-3 rounded-lg bg-violet-50 p-3 text-base font-semibold leading-6 text-violet-950">{item.question}</p>
      {item.contextText ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-moss">Ver o que eu tinha escrito</summary>
          <blockquote className="mt-2 whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm leading-6 text-ink/80">{item.contextText}</blockquote>
        </details>
      ) : null}
      {item.answer ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">O que o mestre disse</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-emerald-950">{item.answer}</p></div> : null}
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
      {isOpen ? (
        closing ? (
          <div className="mt-3">
            <label htmlFor={`answer-${item.id}`} className="text-sm font-semibold text-ink">O que ele respondeu? (opcional)</label>
            <textarea id={`answer-${item.id}`} value={answer} onChange={(event) => setAnswer(event.target.value)} rows={4} className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-emerald-600" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setClosing(false)} className="min-h-11 rounded-lg border border-line text-sm font-semibold text-ink">Cancelar</button>
              <button type="button" onClick={() => update(true)} disabled={busy} className="min-h-11 rounded-lg bg-emerald-800 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Salvando…" : "Fechar dúvida"}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setClosing(true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-paper">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Já conversei · fechar
          </button>
        )
      ) : (
        <button type="button" onClick={() => update(false)} disabled={busy} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink disabled:opacity-50">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reabrir
        </button>
      )}
    </Card>
  );
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}
