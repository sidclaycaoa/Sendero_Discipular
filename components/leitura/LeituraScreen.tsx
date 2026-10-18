"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, Check, ChevronRight, Plus, Timer } from "lucide-react";
import { Cover, dueLabel, ItemForm, progressLabel } from "@/components/leitura/parts";
import { ReadSheet, useRunningTimer } from "@/components/leitura/ReadSheet";
import type { getReadingOverview, ReadingItem, ReadingQuote } from "@/lib/db/leitura";

type Overview = Awaited<ReturnType<typeof getReadingOverview>>;
type Shelf = "QUERO" | "PAUSADO" | "LIDO";

export function LeituraScreen({ data, weeklyGoal }: { data: Overview; weeklyGoal: number | null }) {
  const router = useRouter();
  const running = useRunningTimer();
  const [adding, setAdding] = useState(false);
  const [reading, setReading] = useState<{ item: ReadingItem; timed: boolean } | null>(null);
  const [shelf, setShelf] = useState<Shelf>("QUERO");

  const active = data.items.filter((item) => item.status === "LENDO" || (item.kind === "AULA" && item.status !== "LIDO"))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const shelves: Record<Shelf, ReadingItem[]> = {
    QUERO: data.items.filter((item) => item.status === "QUERO" && item.kind !== "AULA"),
    PAUSADO: data.items.filter((item) => item.status === "PAUSADO" && item.kind !== "AULA"),
    LIDO: data.items.filter((item) => item.status === "LIDO"),
  };
  const runningItem = running ? data.items.find((item) => item.id === running.itemId) : null;
  // Only one timer at a time: while one runs, "Ler agora" goes back to it.
  const startReading = (item: ReadingItem) => setReading({ item: runningItem ?? item, timed: true });
  const maxPages = Math.max(1, ...data.stats.last7.map((day) => day.pages));

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight text-ink">Leitura</h1><p className="mt-0.5 text-sm text-ink/55">{data.stats.minutesWeek} {weeklyGoal ? `de ${weeklyGoal} ` : ""}min nesta semana</p></div>
        <button type="button" aria-label="Nova leitura" onClick={() => setAdding(true)} className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-paper"><Plus className="h-5 w-5" /></button>
      </div>

      {runningItem ? (
        <button type="button" onClick={() => setReading({ item: runningItem, timed: true })} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-ink p-3 text-left text-paper">
          <Timer className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Cronômetro ligado</span><span className="block truncate text-xs text-paper/70">{runningItem.title}</span></span>
          <span className="text-xs font-semibold text-amber-200">Abrir</span>
        </button>
      ) : null}

      <Link prefetch={false} href="/escola" className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-soft">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-clay">Bastiões da aula</span>
          {data.bastioes.length ? data.bastioes.map((bastiao) => <span key={bastiao.label} className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">{bastiao.read ? <Check className="h-3.5 w-3.5 text-moss" aria-label="lido" /> : <span className="h-1.5 w-1.5 rounded-full bg-clay" aria-label="a ler" />}{bastiao.label}</span>)
            : <span className="mt-0.5 block text-sm text-ink/60">Registre a aula e o Bastião na Escola</span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink/35" aria-hidden="true" />
      </Link>

      <h2 className="mt-5 px-1 text-xs font-bold uppercase tracking-wider text-moss">Lendo agora</h2>
      {active.length ? (
        <div className="mt-1.5 space-y-2.5">
          {active.map((item) => {
            const due = item.kind === "AULA" && item.status !== "LIDO" ? dueLabel(item.dueDate, data.today) : null;
            return (
              <article key={item.id} className="rounded-2xl border border-line bg-white p-3 shadow-soft">
                <Link prefetch={false} href={`/leitura/${item.id}`} className="flex gap-3">
                  <Cover item={item} />
                  <div className="min-w-0 flex-1">
                    {item.kind === "AULA" ? <p className={`text-[11px] font-bold uppercase tracking-wide ${due?.late ? "text-clay" : "text-olive"}`}>Leitura de aula{due ? ` · ${due.text}` : ""}</p> : null}
                    <p className="text-base font-semibold leading-snug text-ink">{item.title}</p>
                    {item.author ? <p className="mt-0.5 truncate text-xs text-ink/55">{item.author}</p> : null}
                    <div className="mt-2.5 flex items-baseline justify-between text-xs"><span className="font-semibold text-ink">{progressLabel(item)}</span><span className="font-bold text-[#6b4f3a]">{item.progress}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#ece6da]"><div className="h-full rounded-full bg-[#6b4f3a]" style={{ width: `${item.progress}%` }} /></div>
                    {item.daysLeft ? <p className="mt-1.5 text-[11px] text-ink/50">No seu ritmo, termina em ~{item.daysLeft} {item.daysLeft === 1 ? "dia" : "dias"}</p> : null}
                  </div>
                </Link>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => startReading(item)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-ink text-sm font-semibold text-paper"><Timer className="h-4 w-4" aria-hidden="true" /> Ler agora</button>
                  <button type="button" onClick={() => setReading({ item, timed: false })} className="min-h-10 rounded-xl border border-line text-sm font-semibold text-ink">Parei em…</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-1.5 w-full rounded-2xl border border-dashed border-line p-4 text-sm text-ink/60">Nada em leitura. Toque para cadastrar um livro, apostila ou texto de aula.</button>
      )}

      <section className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat value={data.stats.minutesWeek} label="min na semana" />
        <Stat value={data.stats.pagesWeek} label="páginas na semana" />
        <Stat value={data.stats.dayStreak} label={data.stats.dayStreak === 1 ? "dia lendo" : "dias lendo"} />
      </section>
      <section className="mt-2.5 rounded-2xl border border-line bg-white p-3 shadow-soft">
        <div className="flex items-baseline justify-between"><p className="text-sm font-semibold text-ink">Páginas por dia</p><span className="text-[11px] text-ink/45">últimos 7 dias</span></div>
        <div className="mt-2 flex h-14 items-end gap-1.5">
          {data.stats.last7.map((day, index) => <div key={day.date} className={`flex-1 rounded-t ${index === 6 ? "bg-[#6b4f3a]" : "bg-[#d8cbb6]"}`} style={{ height: `${Math.max(day.pages || day.minutes ? 6 : 0, (day.pages / maxPages) * 100)}%` }} title={`${day.pages} páginas, ${day.minutes} min`} />)}
        </div>
        <div className="mt-1 flex gap-1.5">{data.stats.last7.map((day) => <span key={day.date} className="flex-1 text-center text-[10px] text-ink/45">{"DSTQQSS"[new Date(`${day.date}T12:00:00Z`).getUTCDay()]}</span>)}</div>
      </section>

      {data.quotes.length ? (
        <>
          <h2 className="mt-5 px-1 text-xs font-bold uppercase tracking-wider text-moss">Trechos marcados</h2>
          <div className="mt-1.5 space-y-2">{data.quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} showItem />)}</div>
        </>
      ) : null}

      <div className="mt-5 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-moss">Estante</h2>
        <span className="text-[11px] text-ink/45">{data.stats.finishedThisYear} {data.stats.finishedThisYear === 1 ? "lido" : "lidos"} em {data.today.slice(0, 4)}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {([["QUERO", "Quero ler"], ["PAUSADO", "Pausados"], ["LIDO", "Lidos"]] as Array<[Shelf, string]>).map(([key, label]) => <button key={key} type="button" onClick={() => setShelf(key)} className={`min-h-9 rounded-full border text-xs font-semibold ${shelf === key ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/70"}`}>{label} {shelves[key].length}</button>)}
      </div>
      {shelves[shelf].length ? (
        <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-2">
          {shelves[shelf].map((item) => <Link prefetch={false} key={item.id} href={`/leitura/${item.id}`} aria-label={item.title}><Cover item={item} size="sm" /></Link>)}
        </div>
      ) : <p className="mt-2.5 px-1 text-sm text-ink/50">Nada aqui ainda.</p>}

      {adding ? <ItemForm onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); if (id) router.push(`/leitura/${id}`); }} /> : null}
      {reading ? <ReadSheet key={`${reading.item.id}-${reading.timed}`} item={reading.item} timed={reading.timed} onClose={() => setReading(null)} /> : null}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border border-line bg-white p-2.5 shadow-soft"><p className="text-xl font-semibold text-ink">{value}</p><p className="text-[11px] leading-4 text-ink/55">{label}</p></div>;
}

export function QuoteCard({ quote, showItem, onDelete }: { quote: ReadingQuote; showItem?: boolean; onDelete?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  async function memorize() {
    setState("saving");
    const response = await fetch("/api/leitura/trecho", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: quote.id, memorizar: true }) }).catch(() => null);
    const body = response?.ok ? await response.json() as { id?: string } : null;
    setState(body?.id ? "done" : "idle");
    if (body?.id) router.push(`/memorizar/${body.id}`);
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-soft">
      <p className="whitespace-pre-line border-l-[3px] border-clay py-0.5 pl-3 text-sm italic leading-6 text-ink/85">“{quote.text}”</p>
      {quote.note ? <p className="mt-2 text-xs leading-5 text-ink/65">{quote.note}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-ink/50">
        {showItem ? <span className="font-semibold text-ink/70">{quote.itemTitle}</span> : null}
        {quote.page ? <span>p. {quote.page}</span> : null}
        <span>{quote.createdAt.slice(8, 10)}/{quote.createdAt.slice(5, 7)}</span>
        <button type="button" onClick={memorize} disabled={state !== "idle"} className="ml-auto inline-flex items-center gap-1 font-semibold text-moss disabled:opacity-50"><BookMarked className="h-3.5 w-3.5" aria-hidden="true" />{state === "saving" ? "Criando…" : "Memorizar"}</button>
        {onDelete ? <button type="button" onClick={onDelete} className="font-semibold text-rose-700">Excluir</button> : null}
      </div>
    </div>
  );
}
