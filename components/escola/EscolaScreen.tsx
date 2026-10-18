"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Flame, Plus, Search } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { BastiaoCard, NewBastiao } from "@/components/escola/BastiaoCard";
import { ClassView } from "@/components/escola/ClassView";
import { LiveIdeasList, useEscola } from "@/components/escola/shared";
import type { getSchoolOverview } from "@/lib/db/escola";
import { bastiaoLabel } from "@/lib/escola-shared";
import { flameTier } from "@/lib/habit-streak";

type Overview = Awaited<ReturnType<typeof getSchoolOverview>>;
const shortDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
const weekLabel = (weekStart: string) => {
  const end = new Date(Date.parse(`${weekStart}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  return `${shortDate(weekStart)} a ${shortDate(end)}`;
};

export function EscolaScreen({ data }: { data: Overview }) {
  const [adding, setAdding] = useState<"bastiao" | "aula" | null>(null);
  const [query, setQuery] = useState("");
  const live = data.week.flatMap((bastiao) => bastiao.ideas.filter((idea) => idea.live).map((idea) => ({ id: idea.id, text: idea.text, bastiao: bastiaoLabel(bastiao), doneToday: idea.doneToday, last7: idea.last7 })));
  const tier = flameTier(data.weekStreak, false);
  const others = data.classes.filter((item) => item.id !== data.current?.id);
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const archive = search ? data.archive.filter((item) => `${item.number ?? ""} ${item.name}`.toLocaleLowerCase("pt-BR").includes(search)) : data.archive;

  return (
    <>
      <div><h1 className="text-2xl font-semibold tracking-tight text-ink">Escola</h1><p className="mt-0.5 text-sm text-ink/55">Bastião da semana e aula do mês</p></div>

      {/* Weekly Bastião */}
      <div className="mt-4 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-clay">Bastião da semana · {weekLabel(data.weekStart)}</h2>
        {data.weekStreak ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink/70" aria-label={`${data.weekStreak} semanas seguidas`}><Flame className="h-4 w-4" fill={tier.fill} stroke={tier.stroke} strokeWidth={1.6} aria-hidden="true" />{data.weekStreak}</span> : null}
      </div>
      {live.length ? <div className="mt-1.5"><p className="mb-1 px-1 text-[11px] font-semibold text-ink/55">Para viver nesta semana · vivi hoje?</p><LiveIdeasList ideas={live} /></div> : null}
      {data.week.length ? (
        <div className="mt-2.5 space-y-3">
          {data.week.map((bastiao) => <BastiaoCard key={bastiao.id} bastiao={bastiao} liveCount={live.length} />)}
          <button type="button" onClick={() => setAdding("bastiao")} className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-moss"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Outro Bastião nesta semana</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding("bastiao")} className="mt-1.5 w-full rounded-2xl border border-dashed border-line bg-white p-4 text-left">
          <p className="text-sm font-semibold text-ink">Registrar o Bastião desta semana</p>
          <p className="mt-1 text-xs leading-5 text-ink/55">Número e nome; depois as ideias-força, o que viver e as anotações.</p>
        </button>
      )}

      {/* Monthly class */}
      <div className="mt-6 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-moss">Aula do mês</h2>
        <button type="button" onClick={() => setAdding("aula")} className="inline-flex items-center gap-1 text-xs font-semibold text-moss"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Nova aula</button>
      </div>
      <div className="mt-1.5">
        {data.current ? <ClassView key={data.current.id} data={data.current} habits={data.habits} today={data.today} /> : (
          <button type="button" onClick={() => setAdding("aula")} className="w-full rounded-2xl border border-dashed border-line bg-white p-4 text-left">
            <p className="text-sm font-semibold text-ink">Registrar a aula</p>
            <p className="mt-1 text-xs leading-5 text-ink/55">Guarda as vivências pedidas (um hábito que você já faz ou um exercício novo), os pontos e reflexões, e junta tudo para levar à próxima aula.</p>
          </button>
        )}
      </div>
      {others.length ? (
        <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {others.map((item) => (
            <li key={item.id} className="border-t border-line/70 first:border-t-0">
              <Link prefetch={false} href={`/escola/${item.id}`} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{item.title || "Aula"}</span><span className="block text-xs text-ink/50">{shortDate(item.date)}/{item.date.slice(0, 4)}{item.date > data.today ? " · próxima" : ""}</span></span>
                <ChevronRight className="h-4 w-4 text-ink/35" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Archive */}
      {data.archive.length ? (
        <>
          <h2 className="mt-6 px-1 text-xs font-bold uppercase tracking-wider text-moss">Bastiões anteriores</h2>
          <label className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-white px-3">
            <Search className="h-4 w-4 text-ink/40" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por número ou nome" className="min-h-10 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <ul className="mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {archive.map((item) => (
              <li key={item.id} className="border-t border-line/70 first:border-t-0">
                <Link prefetch={false} href={`/escola/bastiao/${item.id}`} className="flex items-center gap-3 px-3 py-2.5">
                  {item.read ? <Check className="h-4 w-4 shrink-0 text-moss" aria-label="lido" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-[#d8cbb6]" aria-label="não marcado" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{bastiaoLabel(item)}</span>
                    <span className="block text-[11px] text-ink/50">semana de {weekLabel(item.weekStart)}{item.fromClass ? " · da aula" : ""}{item.ideas ? ` · ${item.ideas} ${item.ideas === 1 ? "ideia" : "ideias"}` : ""}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink/35" aria-hidden="true" />
                </Link>
              </li>
            ))}
            {!archive.length ? <li className="px-3 py-3 text-sm text-ink/50">Nada encontrado.</li> : null}
          </ul>
        </>
      ) : null}

      {adding === "bastiao" ? <NewBastiao hasClass={Boolean(data.current && data.current.date <= data.today)} onClose={() => setAdding(null)} /> : null}
      {adding === "aula" ? <NewClass today={data.today} onClose={() => setAdding(null)} /> : null}
    </>
  );
}

function NewClass({ today, onClose }: { today: string; onClose: () => void }) {
  const router = useRouter();
  const { act, error } = useEscola();
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  return (
    <Sheet title="Nova aula" onClose={onClose}>
      <div className="mt-3 space-y-3">
        <label className="block"><span className="text-sm font-semibold text-ink">Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm" /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">Tema <span className="font-normal text-ink/50">(opcional)</span></span><input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm" /></label>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={async () => { const created = await act<{ id: string }>("criarAula", { date, title }); if (created?.id) { onClose(); if (date > today) router.push(`/escola/${created.id}`); } }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper">Criar aula</button>
    </Sheet>
  );
}
