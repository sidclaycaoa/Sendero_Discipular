"use client";

import { useState } from "react";
import Link from "next/link";
import { BookMarked, Check, HelpCircle, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { AutoText, useEscola } from "@/components/escola/shared";
import type { Bastiao, Idea } from "@/lib/db/escola";
import { MAX_LIVE_IDEAS } from "@/lib/escola-shared";

const input = "min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss";

/** A Bastião: read mark, key ideas (with ✦ to live this week), reading notes and the closing reflection. */
export function BastiaoCard({ bastiao, liveCount }: { bastiao: Bastiao; liveCount: number }) {
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
          <p className="text-[11px] font-bold uppercase tracking-wide text-clay">{bastiao.number ? `Bastião nº ${bastiao.number}` : "Bastião"}{bastiao.fromClass ? <span className="ml-1.5 rounded-full bg-clay/10 px-1.5 py-0.5 normal-case tracking-normal">da aula</span> : null}</p>
          <p className="text-base font-semibold leading-snug text-ink">{bastiao.name}</p>
        </button>
        <button type="button" onClick={async () => { setRead(!read); if (!(await act("editarBastiao", { id: bastiao.id, read: !read }))) setRead(read); }} className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ${read ? "bg-moss text-white" : "border border-line text-ink"}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />{read ? "Lido" : "Marcar lido"}</button>
      </div>

      <p className="mt-3 text-xs font-semibold text-ink/60">Ideias-força <span className="font-normal text-ink/45">· toque na ✦ para viver na semana (até {MAX_LIVE_IDEAS})</span></p>
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


export function NewBastiao({ hasClass, onClose }: { hasClass: boolean; onClose: () => void }) {
  const { act, error } = useEscola();
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [fromClass, setFromClass] = useState(false);
  return (
    <Sheet title="Bastião da semana" onClose={onClose}>
      <div className="mt-3 grid grid-cols-[5.5rem_1fr] gap-2">
        <label className="block"><span className="text-sm font-semibold text-ink">Nº</span><input inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} className={`mt-1.5 ${input}`} /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">Nome</span><input value={name} onChange={(event) => setName(event.target.value)} className={`mt-1.5 ${input}`} /></label>
      </div>
      <FromClassToggle checked={fromClass} onChange={setFromClass} hasClass={hasClass} />
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={async () => { if (await act("criarBastiao", { number: number ? Number(number) : null, name, fromClass })) onClose(); }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper">Salvar</button>
    </Sheet>
  );
}


function EditBastiao({ bastiao, onClose }: { bastiao: Bastiao; onClose: () => void }) {
  const { act, error } = useEscola();
  const [number, setNumber] = useState(bastiao.number ? String(bastiao.number) : "");
  const [name, setName] = useState(bastiao.name);
  const [fromClass, setFromClass] = useState(bastiao.fromClass);
  return (
    <Sheet title="Editar Bastião" onClose={onClose}>
      <div className="mt-3 grid grid-cols-[5.5rem_1fr] gap-2">
        <label className="block"><span className="text-sm font-semibold text-ink">Nº</span><input inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} className={`mt-1.5 ${input}`} /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">Nome</span><input value={name} onChange={(event) => setName(event.target.value)} className={`mt-1.5 ${input}`} /></label>
      </div>
      <FromClassToggle checked={fromClass} onChange={setFromClass} hasClass />
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={async () => { if (await act("editarBastiao", { id: bastiao.id, number: number ? Number(number) : null, name, ...(fromClass !== bastiao.fromClass ? { fromClass } : {}) })) onClose(); }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper">Salvar</button>
      <button type="button" onClick={async () => { if (window.confirm(`Excluir o Bastião “${bastiao.name}” com as ideias e anotações?`) && await act("excluirBastiao", { id: bastiao.id })) onClose(); }} className="mt-3 flex items-center gap-2 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir Bastião</button>
    </Sheet>
  );
}

/** "Veio da aula": links the Bastião to the class in course. */
function FromClassToggle({ checked, onChange, hasClass }: { checked: boolean; onChange: (value: boolean) => void; hasClass: boolean }) {
  return (
    <label className={`mt-3 flex items-center gap-2 text-sm font-semibold ${hasClass ? "text-ink" : "text-ink/40"}`}>
      <input type="checkbox" disabled={!hasClass} checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#b85d3b]" />
      Veio da aula {hasClass ? "" : <span className="font-normal">(registre a aula primeiro)</span>}
    </label>
  );
}
