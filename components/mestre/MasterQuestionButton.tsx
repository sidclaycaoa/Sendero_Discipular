"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export type MasterQuestionContext = {
  sourceType: "REFLEXAO" | "DIARIO";
  sourceId?: string;
  sourceDate?: string;
  contextTitle: string;
  contextDetail?: string;
};

/**
 * Saves a question for the master together with what was being reflected on and
 * what had been written at that moment, so the context is not lost by the time
 * of the conversation.
 */
export function MasterQuestionButton({ context, getText }: { context: MasterQuestionContext; getText: () => string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function start() {
    setSnapshot(getText());
    setMessage(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/mestre", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, contextText: snapshot, question }) });
      const result = await response.json().catch(() => null) as { saved?: boolean; error?: string } | null;
      if (!response.ok || !result?.saved) throw new Error(result?.error ?? "Não foi possível guardar agora.");
      setQuestion("");
      setOpen(false);
      setMessage({ ok: true, text: "Dúvida guardada para levar ao mestre." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Não foi possível guardar agora." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={start} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-900">
        <HelpCircle className="h-4 w-4" aria-hidden="true" /> Guardar dúvida para o mestre
      </button>
      {message ? <p role="status" className={`mt-2 text-sm font-semibold ${message.ok ? "text-emerald-800" : "text-red-800"}`}>{message.text}</p> : null}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-ink/55 p-3 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Guardar dúvida para o mestre">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-800">{context.sourceType === "REFLEXAO" ? "Reflexão" : "Diário"}{context.sourceDate ? ` · ${formatDate(context.sourceDate)}` : ""}</p>
            <p className="mt-1 text-base font-semibold text-ink">{context.contextTitle}</p>
            {context.contextDetail ? <p className="mt-1 text-sm text-ink/65">{context.contextDetail}</p> : null}
            {snapshot.trim() ? <blockquote className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm leading-6 text-ink/80">{snapshot}</blockquote> : <p className="mt-3 text-sm text-ink/55">Ainda não há texto escrito; a dúvida guarda o tema.</p>}
            <label htmlFor="master-question" className="mt-4 block text-sm font-semibold text-ink">Sua dúvida</label>
            <textarea id="master-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} autoFocus placeholder="O que você quer perguntar ao mestre?" className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-violet-500" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-xl border border-line text-sm font-semibold text-ink">Cancelar</button>
              <button type="button" onClick={save} disabled={saving || !question.trim()} className="min-h-12 rounded-xl bg-violet-800 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar dúvida"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}
