"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { ClassView } from "@/components/escola/ClassView";
import { useEscola } from "@/components/escola/shared";
import type { getSchoolOverview } from "@/lib/db/escola";

type Overview = Awaited<ReturnType<typeof getSchoolOverview>>;
const formatDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`;

export function EscolaScreen({ data }: { data: Overview }) {
  const [adding, setAdding] = useState(false);
  const others = data.classes.filter((item) => item.id !== data.current?.id);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight text-ink">Escola</h1><p className="mt-0.5 text-sm text-ink/55">Aulas, Bastiões e vivências</p></div>
        <button type="button" aria-label="Nova aula" onClick={() => setAdding(true)} className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-paper"><Plus className="h-5 w-5" /></button>
      </div>

      <div className="mt-3">
        {data.current ? <ClassView key={data.current.id} data={data.current} habits={data.habits} today={data.today} /> : (
          <button type="button" onClick={() => setAdding(true)} className="w-full rounded-2xl border border-dashed border-line bg-white p-5 text-left">
            <p className="text-base font-semibold text-ink">Registrar a aula</p>
            <p className="mt-1 text-sm leading-6 text-ink/60">Cada aula guarda os Bastiões (nº e nome, ideias-força, anotações), as vivências pedidas e o que levar para a aula seguinte.</p>
          </button>
        )}
      </div>

      {others.length ? (
        <>
          <h2 className="mt-6 px-1 text-xs font-bold uppercase tracking-wider text-moss">Outras aulas</h2>
          <ul className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {others.map((item) => (
              <li key={item.id} className="border-t border-line/70 first:border-t-0">
                <Link prefetch={false} href={`/escola/${item.id}`} className="flex items-center gap-3 px-3 py-3">
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{item.title || "Aula"}</span><span className="block text-xs text-ink/50">{formatDate(item.date)}{item.date > data.today ? " · próxima" : ""}</span></span>
                  <ChevronRight className="h-4 w-4 text-ink/35" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {adding ? <NewClass today={data.today} onClose={() => setAdding(false)} /> : null}
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
