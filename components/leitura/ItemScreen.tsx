"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { Cover, dueLabel, ItemForm, progressLabel } from "@/components/leitura/parts";
import { QuoteCard } from "@/components/leitura/LeituraScreen";
import { ReadSheet, useRunningTimer } from "@/components/leitura/ReadSheet";
import { READING_KINDS, READING_STATUS, type getReadingItem } from "@/lib/db/leitura";

type Detail = NonNullable<Awaited<ReturnType<typeof getReadingItem>>>;

export function ItemScreen({ detail, today }: { detail: Detail; today: string }) {
  const router = useRouter();
  const { item } = detail;
  const running = useRunningTimer();
  const [editing, setEditing] = useState(false);
  const [reading, setReading] = useState<boolean | null>(null);
  const [quote, setQuote] = useState("");
  const [page, setPage] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const due = item.kind === "AULA" && item.status !== "LIDO" ? dueLabel(item.dueDate, today) : null;
  const otherTimer = running && running.itemId !== item.id ? running : null;

  async function call(url: string, method: string, body: unknown) {
    setError(null);
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!response?.ok) { setError((await response?.json().catch(() => null) as { error?: string } | null)?.error ?? "Não foi possível salvar."); return false; }
    router.refresh();
    return true;
  }

  async function addQuote() {
    setSaving(true);
    if (await call("/api/leitura/trecho", "POST", { id: item.id, text: quote, page, note })) { setQuote(""); setPage(""); setNote(""); }
    setSaving(false);
  }

  return (
    <>
      <Link prefetch={false} href="/leitura" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Leitura</Link>

      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <div className="flex gap-4">
          <Cover item={item} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-olive">{READING_KINDS[item.kind]} · {READING_STATUS[item.status]}</p>
            <h1 className="mt-1 text-xl font-semibold leading-snug text-ink">{item.title}</h1>
            {item.author ? <p className="mt-0.5 text-sm text-ink/60">{item.author}</p> : null}
            {due ? <p className={`mt-1 text-xs font-semibold ${due.late ? "text-clay" : "text-ink/55"}`}>Ler {due.text}</p> : null}
            <div className="mt-3 flex items-baseline justify-between text-xs"><span className="font-semibold text-ink">{progressLabel(item)}</span><span className="font-bold text-[#6b4f3a]">{item.progress}%</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#ece6da]"><div className="h-full rounded-full bg-[#6b4f3a]" style={{ width: `${item.progress}%` }} /></div>
            <p className="mt-1.5 text-[11px] text-ink/50">{detail.minutesTotal} min lidos{item.daysLeft ? ` · termina em ~${item.daysLeft} ${item.daysLeft === 1 ? "dia" : "dias"}` : ""}</p>
          </div>
        </div>
        {item.note ? <p className="mt-3 rounded-lg bg-paper p-3 text-sm leading-6 text-ink/75">{item.note}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={Boolean(otherTimer)} onClick={() => setReading(true)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-40"><Timer className="h-4 w-4" aria-hidden="true" /> Ler agora</button>
          <button type="button" onClick={() => setReading(false)} className="min-h-11 rounded-xl border border-line text-sm font-semibold text-ink">Parei em…</button>
        </div>
        {otherTimer ? <p className="mt-2 text-xs text-ink/55">Há um cronômetro ligado em “{otherTimer.title}”. Pare aquele antes de começar este.</p> : null}
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-ink"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar</button>
          <button type="button" onClick={async () => { if (window.confirm(`Tirar “${item.title}” da Leitura?`) && await call("/api/leitura", "DELETE", { id: item.id })) router.push("/leitura"); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-rose-700"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir</button>
        </div>
      </section>

      <h2 className="mt-5 px-1 text-xs font-bold uppercase tracking-wider text-moss">Trechos marcados</h2>
      <section className="mt-1.5 rounded-2xl border border-line bg-white p-3 shadow-soft">
        <textarea value={quote} onChange={(event) => setQuote(event.target.value)} rows={3} placeholder="Copie ou dite o trecho que quer guardar…" className="w-full rounded-lg border border-line bg-paper p-3 text-sm leading-6 outline-none focus:border-moss" />
        <div className="mt-2 grid grid-cols-[6rem_1fr] gap-2">
          <input value={page} onChange={(event) => setPage(event.target.value)} placeholder="Página" className="min-h-10 rounded-lg border border-line bg-paper px-3 text-sm" />
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Seu comentário (opcional)" className="min-h-10 min-w-0 rounded-lg border border-line bg-paper px-3 text-sm" />
        </div>
        <button type="button" onClick={addQuote} disabled={saving || !quote.trim()} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden="true" /> Guardar trecho</button>
      </section>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <div className="mt-2 space-y-2">{detail.quotes.map((item) => <QuoteCard key={item.id} quote={item} onDelete={() => { if (window.confirm("Excluir este trecho?")) void call("/api/leitura/trecho", "DELETE", { id: item.id }); }} />)}</div>

      {detail.sessions.length ? (
        <>
          <h2 className="mt-5 px-1 text-xs font-bold uppercase tracking-wider text-moss">Histórico</h2>
          <ul className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {detail.sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between border-t border-line/70 px-3 py-2.5 text-sm first:border-t-0">
                <span className="text-ink/70">{session.date.slice(8, 10)}/{session.date.slice(5, 7)}</span>
                <span className="text-ink">{session.minutes ? `${session.minutes} min` : ""}{session.minutes && session.toPage !== null ? " · " : ""}{session.toPage !== null ? (item.totalPages ? `até p. ${session.toPage}` : `${session.toPage}%`) : ""}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {editing ? <ItemForm item={item} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} /> : null}
      {reading !== null ? <ReadSheet item={item} timed={reading} onClose={() => setReading(null)} /> : null}
    </>
  );
}
