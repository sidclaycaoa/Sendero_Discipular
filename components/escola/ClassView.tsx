"use client";

import { useState } from "react";
import Link from "next/link";
import { BookMarked, Check, ClipboardCopy, HelpCircle, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { AutoText, LiveIdeasList, useEscola } from "@/components/escola/shared";
import type { Bastiao, Idea, SchoolClass } from "@/lib/db/escola";
import { bastiaoLabel, MAX_LIVE_IDEAS } from "@/lib/escola-shared";

const formatDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
const input = "min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss";

/** One class: its Bastiões with key ideas, the practices asked, and what to bring to the next class. */
export function ClassView({ data, habits, today }: { data: SchoolClass; habits: Array<{ id: string; title: string }>; today: string }) {
  const { act, error } = useEscola();
  const [adding, setAdding] = useState<"bastiao" | "vivencia" | null>(null);
  const [editingClass, setEditingClass] = useState(false);
  const live = data.bastioes.flatMap((bastiao) => bastiao.ideas.filter((idea) => idea.live).map((idea) => ({ id: idea.id, text: idea.text, bastiao: bastiaoLabel(bastiao), doneToday: idea.doneToday, last7: idea.last7 })));
  const liveCount = live.length;
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

      {liveCount ? (
        <section className="mt-4">
          <div className="flex items-baseline justify-between px-1"><h3 className="text-xs font-bold uppercase tracking-wider text-moss">Para viver até a próxima aula</h3><span className="text-[11px] text-ink/45">vivi hoje?</span></div>
          <div className="mt-1.5"><LiveIdeasList ideas={live} /></div>
        </section>
      ) : null}

      <div className="mt-4 flex items-baseline justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-moss">Bastiões</h3>
        <button type="button" onClick={() => setAdding("bastiao")} className="inline-flex items-center gap-1 text-xs font-semibold text-moss"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Bastião</button>
      </div>
      {data.bastioes.length ? (
        <div className="mt-1.5 space-y-3">{data.bastioes.map((bastiao) => <BastiaoCard key={bastiao.id} bastiao={bastiao} liveCount={liveCount} />)}</div>
      ) : <button type="button" onClick={() => setAdding("bastiao")} className="mt-1.5 w-full rounded-2xl border border-dashed border-line p-4 text-sm text-ink/60">Registrar o Bastião desta aula (número e nome)</button>}

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

      {adding === "bastiao" ? <NewBastiao classId={data.id} onClose={() => setAdding(null)} /> : null}
      {adding === "vivencia" ? <NewPractice classId={data.id} habits={habits.filter((habit) => !data.practices.some((practice) => practice.habitId === habit.id))} onClose={() => setAdding(null)} /> : null}
      {editingClass ? <EditClass data={data} onClose={() => setEditingClass(false)} /> : null}
    </>
  );
}

function BastiaoCard({ bastiao, liveCount }: { bastiao: Bastiao; liveCount: number }) {
  const { act, error } = useEscola();
  const [read, setRead] = useState(bastiao.read);
  const [idea, setIdea] = useState("");
  const [menu, setMenu] = useState<Idea | null>(null);
  const [editing, setEditing] = useState(false);

  async function addIdea() {
    if (!idea.trim()) return;
    if (await act("criarIdeia", { id: bastiao.id, text: idea })) setIdea("");
  }

  return (
    <article className="rounded-2xl border border-line bg-white p-3.5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 text-left">
          {bastiao.number ? <p className="text-[11px] font-bold uppercase tracking-wide text-clay">Bastião nº {bastiao.number}</p> : <p className="text-[11px] font-bold uppercase tracking-wide text-clay">Bastião</p>}
          <p className="text-base font-semibold leading-snug text-ink">{bastiao.name}</p>
        </button>
        <button type="button" onClick={async () => { setRead(!read); if (!(await act("editarBastiao", { id: bastiao.id, read: !read }))) setRead(read); }} className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ${read ? "bg-moss text-white" : "border border-line text-ink"}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />{read ? "Lido" : "Marcar lido"}</button>
      </div>

      <p className="mt-3 text-xs font-semibold text-ink/60">Ideias-força <span className="font-normal text-ink/45">· toque na ✦ para viver (até {MAX_LIVE_IDEAS} por aula)</span></p>
      {bastiao.ideas.length ? (
        <ul className="mt-1.5 space-y-1.5">
          {bastiao.ideas.map((item) => (
            <li key={item.id} className="flex items-start gap-2 rounded-lg bg-paper px-2.5 py-2">
              <button type="button" aria-label={item.live ? "Deixar de viver esta ideia" : "Viver esta ideia na semana"} disabled={!item.live && liveCount >= MAX_LIVE_IDEAS} onClick={() => void act("editarIdeia", { id: item.id, live: !item.live })} className={`mt-0.5 shrink-0 disabled:opacity-25 ${item.live ? "text-clay" : "text-ink/30"}`}><Sparkles className="h-4 w-4" fill={item.live ? "currentColor" : "none"} /></button>
              <p className="min-w-0 flex-1 text-sm leading-5 text-ink">{item.text}</p>
              <button type="button" aria-label="Mais opções" onClick={() => setMenu(item)} className="shrink-0 text-ink/40"><MoreHorizontal className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex gap-2">
        <input value={idea} onChange={(event) => setIdea(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addIdea(); }} placeholder="Nova ideia-força…" className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss" />
        <button type="button" aria-label="Adicionar ideia" onClick={addIdea} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-paper"><Plus className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 space-y-3">
        <AutoText label="Anotações da leitura" value={bastiao.notes} onSave={(value) => act("editarBastiao", { id: bastiao.id, notes: value }, false)} placeholder="O que tocou você, trechos, perguntas…" />
        <AutoText label="O que este Bastião mudou em mim?" value={bastiao.reflection} onSave={(value) => act("editarBastiao", { id: bastiao.id, reflection: value }, false)} placeholder="Escreva no fim da semana" rows={2} />
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}

      {menu ? <IdeaMenu idea={menu} onClose={() => setMenu(null)} /> : null}
      {editing ? <EditBastiao bastiao={bastiao} onClose={() => setEditing(false)} /> : null}
    </article>
  );
}

function IdeaMenu({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const { act, error } = useEscola();
  const [text, setText] = useState(idea.text);
  const [question, setQuestion] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Sheet title="Ideia-força" onClose={onClose}>
      <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} className="mt-3 w-full rounded-lg border border-line bg-paper p-3 text-sm leading-6" />
      <button type="button" disabled={text === idea.text} onClick={async () => { if (await act("editarIdeia", { id: idea.id, text })) onClose(); }} className="mt-1 text-sm font-semibold text-moss disabled:text-ink/35">Salvar texto</button>
      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <button type="button" onClick={async () => { const done = await act<{ id: string }>("enviarIdeia", { id: idea.id, to: "MEMORIZAR" }); if (done?.id) setSent("memorizar"); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-ink"><BookMarked className="h-4 w-4 text-moss" aria-hidden="true" /> Levar para a Memorização</button>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Sua dúvida sobre esta ideia (opcional)" className={input} />
        <button type="button" onClick={async () => { if (await act("enviarIdeia", { id: idea.id, to: "MESTRE", question })) setSent("mestre"); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-ink"><HelpCircle className="h-4 w-4 text-violet-700" aria-hidden="true" /> Levar ao mestre</button>
        {sent === "memorizar" ? <p className="text-sm text-moss">Criado na <Link prefetch={false} href="/memorizar" className="font-semibold underline">Memorização</Link>.</p> : null}
        {sent === "mestre" ? <p className="text-sm text-moss">Guardado em <Link prefetch={false} href="/mestre" className="font-semibold underline">Para falar com meu mestre</Link>.</p> : null}
        <button type="button" onClick={async () => { if (window.confirm("Excluir esta ideia?") && await act("excluirIdeia", { id: idea.id })) onClose(); }} className="flex min-h-11 items-center gap-2 px-1 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir ideia</button>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
    </Sheet>
  );
}

function NewBastiao({ classId, onClose }: { classId: string; onClose: () => void }) {
  const { act, error } = useEscola();
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  return (
    <Sheet title="Bastião da aula" onClose={onClose}>
      <div className="mt-3 grid grid-cols-[5.5rem_1fr] gap-2">
        <label className="block"><span className="text-sm font-semibold text-ink">Nº</span><input inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} className={`mt-1.5 ${input}`} /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">Nome</span><input value={name} onChange={(event) => setName(event.target.value)} className={`mt-1.5 ${input}`} /></label>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={async () => { if (await act("criarBastiao", { classId, number: number ? Number(number) : null, name })) onClose(); }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper">Salvar</button>
    </Sheet>
  );
}

function EditBastiao({ bastiao, onClose }: { bastiao: Bastiao; onClose: () => void }) {
  const { act, error } = useEscola();
  const [number, setNumber] = useState(bastiao.number ? String(bastiao.number) : "");
  const [name, setName] = useState(bastiao.name);
  return (
    <Sheet title="Editar Bastião" onClose={onClose}>
      <div className="mt-3 grid grid-cols-[5.5rem_1fr] gap-2">
        <label className="block"><span className="text-sm font-semibold text-ink">Nº</span><input inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} className={`mt-1.5 ${input}`} /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">Nome</span><input value={name} onChange={(event) => setName(event.target.value)} className={`mt-1.5 ${input}`} /></label>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={async () => { if (await act("editarBastiao", { id: bastiao.id, number: number ? Number(number) : null, name })) onClose(); }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper">Salvar</button>
      <button type="button" onClick={async () => { if (window.confirm(`Excluir o Bastião “${bastiao.name}” com as ideias e anotações?`) && await act("excluirBastiao", { id: bastiao.id })) onClose(); }} className="mt-3 flex items-center gap-2 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir Bastião</button>
    </Sheet>
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
      "", `Bastião ${bastiaoLabel(bastiao)}${bastiao.read ? " (lido)" : ""}`,
      ...bastiao.ideas.filter((idea) => idea.live).map((idea) => `• Vivi: ${idea.text} (${idea.last7.reduce<number>((sum, value) => sum + value, 0)}/7 dias)`),
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
