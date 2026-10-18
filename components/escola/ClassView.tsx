"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { AutoText, useEscola } from "@/components/escola/shared";
import type { SchoolClass } from "@/lib/db/escola";
import { bastiaoLabel } from "@/lib/escola-shared";

const formatDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
const input = "min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss";

/** One (monthly) class: the practices asked, the Bastiões of its period, and what to bring to the next class. */
export function ClassView({ data, habits, today }: { data: SchoolClass; habits: Array<{ id: string; title: string }>; today: string }) {
  const { act, error } = useEscola();
  const [adding, setAdding] = useState<"vivencia" | null>(null);
  const [editingClass, setEditingClass] = useState(false);
  const inCourse = data.date <= today && (!data.until || today < data.until);
  const save = (action: string, id: string, field: string) => (value: string) => act(action, { id, [field]: value }, false);

  return (
    <>
      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-clay">{inCourse ? "Aula em curso" : "Aula"} · {formatDate(data.date)}{data.until ? ` até ${formatDate(data.until)}` : ""}</p>
            <h2 className="mt-0.5 text-lg font-semibold leading-snug text-ink">{data.title || "Sem tema"}</h2>
          </div>
          <button type="button" onClick={() => setEditingClass(true)} aria-label="Editar a aula" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink/60"><MoreHorizontal className="h-4 w-4" /></button>
        </div>
        <div className="mt-3"><AutoText label="O que foi dito na aula" value={data.notes} onSave={save("editarAula", data.id, "notes")} placeholder="Ideias, orientações do professor…" rows={2} /></div>
      </section>

      {data.bastioes.length ? (
        <>
          <h3 className="mt-4 px-1 text-xs font-bold uppercase tracking-wider text-moss">Bastiões do período</h3>
          <ul className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {data.bastioes.map((bastiao) => {
              const lived = bastiao.ideas.filter((idea) => idea.live);
              return (
                <li key={bastiao.id} className="border-t border-line/70 first:border-t-0">
                  <Link prefetch={false} href={`/escola/bastiao/${bastiao.id}`} className="flex items-center gap-3 px-3 py-2.5">
                    {bastiao.read ? <Check className="h-4 w-4 shrink-0 text-moss" aria-label="lido" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-clay" aria-label="a ler" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{bastiaoLabel(bastiao)}</span>
                      <span className="block text-[11px] text-ink/50">semana de {formatDate(bastiao.weekStart)}{bastiao.fromClass ? " · veio da aula" : ""}{lived.length ? ` · ${lived.length} ${lived.length === 1 ? "ideia vivida" : "ideias vividas"}` : ""}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <div className="mt-5 flex items-baseline justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-moss">Vivências da aula</h3>
        <button type="button" onClick={() => setAdding("vivencia")} className="inline-flex items-center gap-1 text-xs font-semibold text-moss"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Vivência</button>
      </div>
      {data.practices.length ? (
        <div className="mt-1.5 space-y-3">
          {data.practices.map((practice) => (
            <article key={practice.id} className="rounded-2xl border border-line bg-white p-3.5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">{practice.title}</p>
                  {practice.last7 ? (
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-ink/50">
                      <span className="inline-flex gap-[3px]">{practice.last7.map((value, index) => <i key={index} className={`h-[5px] w-[5px] rounded-full ${value ? "bg-moss" : index === 6 ? "border border-moss/50" : "bg-[#e3dccd]"}`} />)}</span>
                      {practice.doneToday ? "feito hoje" : "em Hábitos"}
                    </p>
                  ) : null}
                </div>
                <button type="button" aria-label={`Tirar ${practice.title} da aula`} onClick={() => { if (window.confirm(`Tirar “${practice.title}” desta aula? O hábito continua em Hábitos.`)) void act("excluirVivencia", { id: practice.id }); }} className="p-1 text-ink/35"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2"><AutoText value={practice.points} onSave={save("editarVivencia", practice.id, "points")} placeholder="Pontos e reflexões: como foi, o que percebi…" rows={2} /></div>
            </article>
          ))}
        </div>
      ) : <button type="button" onClick={() => setAdding("vivencia")} className="mt-1.5 w-full rounded-2xl border border-dashed border-line p-4 text-sm text-ink/60">Registrar o exercício pedido na aula (pode ser um que você já faz)</button>}

      <BringToClass data={data} />
      {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}

      {adding === "vivencia" ? <NewPractice classId={data.id} habits={habits.filter((habit) => !data.practices.some((practice) => practice.habitId === habit.id))} onClose={() => setAdding(null)} /> : null}
      {editingClass ? <EditClass data={data} onClose={() => setEditingClass(false)} /> : null}
    </>
  );
}

function NewPractice({ classId, habits, onClose }: { classId: string; habits: Array<{ id: string; title: string }>; onClose: () => void }) {
  const { act, error } = useEscola();
  const [mode, setMode] = useState<"existente" | "novo">(habits.length ? "existente" : "novo");
  const [habitId, setHabitId] = useState(habits[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("PSYCHOLOGY");
  const [cadence, setCadence] = useState("DAILY");
  return (
    <Sheet title="Vivência da aula" onClose={onClose}>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {([["existente", "Um que já faço"], ["novo", "Exercício novo"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setMode(key)} className={`min-h-10 rounded-full border text-sm font-semibold ${mode === key ? "border-ink bg-ink text-paper" : "border-line text-ink/70"}`}>{label}</button>)}
      </div>
      {mode === "existente" ? (
        <label className="mt-3 block"><span className="text-sm font-semibold text-ink">Hábito</span>
          <select value={habitId} onChange={(event) => setHabitId(event.target.value)} className={`mt-1.5 ${input}`}>{habits.map((habit) => <option key={habit.id} value={habit.id}>{habit.title}</option>)}</select>
          <span className="mt-1 block text-xs text-ink/55">Ex.: “vamos fazer o Diário e o Tratak todos os dias”. O hábito continua igual em Hábitos.</span>
        </label>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block"><span className="text-sm font-semibold text-ink">Nome do exercício</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Observar a impaciência ao falar" className={`mt-1.5 ${input}`} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-sm font-semibold text-ink">Grupo</span><select value={group} onChange={(event) => setGroup(event.target.value)} className={`mt-1.5 ${input}`}><option value="PSYCHOLOGY">Psicologia</option><option value="ED">ED</option><option value="HABIT">Geral</option></select></label>
            <label className="block"><span className="text-sm font-semibold text-ink">Frequência</span><select value={cadence} onChange={(event) => setCadence(event.target.value)} className={`mt-1.5 ${input}`}><option value="DAILY">Diário</option><option value="WEEKLY">Semanal</option></select></label>
          </div>
          <p className="text-xs text-ink/55">Ele também aparece em Hábitos, para marcar no dia a dia.</p>
        </div>
      )}
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={async () => { if (await act("criarVivencia", mode === "existente" ? { id: classId, habitId } : { id: classId, title, group, cadence })) onClose(); }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper">Salvar</button>
    </Sheet>
  );
}

function EditClass({ data, onClose }: { data: SchoolClass; onClose: () => void }) {
  const { act, error } = useEscola();
  const [date, setDate] = useState(data.date);
  const [title, setTitle] = useState(data.title);
  return (
    <Sheet title="Editar aula" onClose={onClose}>
      <div className="mt-3 space-y-3">
        <label className="block"><span className="text-sm font-semibold text-ink">Data da aula</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`mt-1.5 ${input}`} /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">Tema</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={`mt-1.5 ${input}`} /></label>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={async () => { if (await act("editarAula", { id: data.id, date, title })) onClose(); }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper">Salvar</button>
      <button type="button" onClick={async () => { if (window.confirm("Excluir esta aula? Os Bastiões ficam guardados; as vivências saem da aula (os hábitos continuam).") && await act("excluirAula", { id: data.id })) { onClose(); window.location.href = "/escola"; } }} className="mt-3 flex items-center gap-2 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir aula</button>
    </Sheet>
  );
}

/** Everything noted during the period, ready to bring to the next class. */
function BringToClass({ data }: { data: SchoolClass }) {
  const { act } = useEscola();
  const [copied, setCopied] = useState(false);
  const lines = [
    `Aula de ${formatDate(data.date)}${data.title ? ` — ${data.title}` : ""}`,
    ...data.bastioes.flatMap((bastiao) => [
      "", `Bastião ${bastiaoLabel(bastiao)}${bastiao.read ? " (lido)" : ""}${bastiao.fromClass ? " · da aula" : ""}`,
      ...bastiao.ideas.filter((idea) => idea.live).map((idea) => `• Vivi: ${idea.text} (${idea.daysLived} ${idea.daysLived === 1 ? "dia" : "dias"})`),
      ...(bastiao.reflection ? [`Reflexão: ${bastiao.reflection}`] : []),
    ]),
    ...data.practices.flatMap((practice) => ["", `Vivência: ${practice.title}${practice.last7 ? ` (${practice.last7.reduce<number>((sum, value) => sum + value, 0)}/7 dias)` : ""}`, ...(practice.points ? [practice.points] : [])]),
  ];
  const summary = lines.join("\n");
  return (
    <section className="mt-5 rounded-2xl border border-clay/25 bg-clay/5 p-3.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-clay">Levar para a próxima aula</h3>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-5 text-ink/80">{summary}</pre>
      <div className="mt-3"><AutoText label="Pontos que quero levar" value={data.closing} onSave={(value) => act("editarAula", { id: data.id, closing: value }, false)} placeholder="O que quero compartilhar ou perguntar na aula" rows={2} /></div>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${summary}${data.closing ? `\n\nPara levar:\n${data.closing}` : ""}`); setCopied(true); } catch { setCopied(false); } }} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink"><ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />{copied ? "Copiado" : "Copiar resumo"}</button>
    </section>
  );
}
