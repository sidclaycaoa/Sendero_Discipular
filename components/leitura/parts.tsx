"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/app/Sheet";
import type { ReadingItem, ReadingKind, ReadingStatus } from "@/lib/db/leitura";

const COVERS = [
  ["#7a5b42", "#3e2c20"], ["#2f4a5c", "#1b2b36"], ["#5b3d5e", "#352339"], ["#46533b", "#2a3323"],
  ["#8a6a2a", "#5a4318"], ["#7b3b3b", "#4a2020"], ["#3d5a57", "#22383a"], ["#55506e", "#312d45"],
];
const KIND_LABEL: Record<ReadingKind, string> = { LIVRO: "Livro", APOSTILA: "Apostila", TEXTO: "Texto", AULA: "Aula" };

/** A cover drawn from the title, so nothing is fetched from outside. */
export function Cover({ item, size = "md" }: { item: Pick<ReadingItem, "title" | "author" | "kind">; size?: "sm" | "md" | "lg" }) {
  const hash = [...item.title].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const [from, to] = COVERS[hash % COVERS.length];
  const box = size === "lg" ? "h-40 w-28 p-3 text-sm" : size === "md" ? "h-28 w-20 p-2 text-[11px]" : "h-24 w-[4.25rem] p-1.5 text-[9.5px]";
  return (
    <div className={`flex shrink-0 flex-col justify-between rounded-md font-semibold leading-tight text-[#f5ead2] shadow-[0_6px_14px_rgba(0,0,0,.18)] ${box}`} style={{ background: `linear-gradient(160deg, ${from}, ${to})` }} aria-hidden="true">
      <span className="line-clamp-4">{item.title}</span>
      <span className="text-[0.8em] font-medium uppercase tracking-wide opacity-75">{item.author || KIND_LABEL[item.kind]}</span>
    </div>
  );
}

export function progressLabel(item: Pick<ReadingItem, "totalPages" | "currentPage" | "progress">) {
  return item.totalPages ? `p. ${item.currentPage} de ${item.totalPages}` : `${item.progress}% lido`;
}

export function dueLabel(dueDate: string | null, today: string) {
  if (!dueDate) return null;
  const days = Math.round((Date.parse(`${dueDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (days < 0) return { text: `atrasada ${-days} ${days === -1 ? "dia" : "dias"}`, late: true };
  if (days === 0) return { text: "para hoje", late: true };
  return { text: days === 1 ? "para amanhã" : `para daqui a ${days} dias`, late: days <= 2 };
}

/** New reading or edit: kind, title, author, pages (or percent), status and, for class readings, the due date. */
export function ItemForm({ item, onClose, onSaved }: { item?: ReadingItem; onClose: () => void; onSaved: (id: string) => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<ReadingKind>(item?.kind ?? "LIVRO");
  const [title, setTitle] = useState(item?.title ?? "");
  const [author, setAuthor] = useState(item?.author ?? "");
  const [pages, setPages] = useState(item?.totalPages ? String(item.totalPages) : "");
  const [status, setStatus] = useState<ReadingStatus>(item?.status ?? "LENDO");
  const [dueDate, setDueDate] = useState(item?.dueDate ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/leitura", { method: item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item?.id, kind, title, author, totalPages: pages ? Number(pages) : null, status, dueDate: kind === "AULA" ? dueDate : null, note }) });
      const body = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(body.error);
      router.refresh();
      onSaved(body.id ?? item?.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss";
  return (
    <Sheet title={item ? "Editar leitura" : "Nova leitura"} onClose={onClose}>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {(Object.keys(KIND_LABEL) as ReadingKind[]).map((key) => <button key={key} type="button" onClick={() => setKind(key)} className={`min-h-9 rounded-full border text-xs font-semibold ${kind === key ? "border-ink bg-ink text-paper" : "border-line text-ink/70"}`}>{KIND_LABEL[key]}</button>)}
      </div>
      <div className="mt-3 space-y-3">
        <label className="block"><span className="text-sm font-semibold text-ink">Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "AULA" ? "Ex.: Texto pedido na aula 12" : "Ex.: A Tranquilidade da Alma"} className={input} /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">{kind === "LIVRO" ? "Autor" : "Autor ou curso"} <span className="font-normal text-ink/50">(opcional)</span></span><input value={author} onChange={(event) => setAuthor(event.target.value)} className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-sm font-semibold text-ink">Páginas</span><input inputMode="numeric" value={pages} onChange={(event) => setPages(event.target.value.replace(/\D/g, ""))} placeholder="sem páginas" className={input} /></label>
          <label className="block"><span className="text-sm font-semibold text-ink">Situação</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ReadingStatus)} className={input}><option value="LENDO">Lendo</option><option value="QUERO">Quero ler</option><option value="PAUSADO">Pausado</option><option value="LIDO">Lido</option></select>
          </label>
        </div>
        {!pages ? <p className="-mt-1 text-xs text-ink/55">Sem páginas, o avanço é marcado em % (bom para textos e apostilas sem numeração).</p> : null}
        {kind === "AULA" ? <label className="block"><span className="text-sm font-semibold text-ink">Ler até</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={input} /></label> : null}
        <label className="block"><span className="text-sm font-semibold text-ink">Observação <span className="font-normal text-ink/50">(opcional)</span></span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder={kind === "AULA" ? "O que o professor pediu" : "Por que ler, de onde veio a indicação…"} className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-moss" /></label>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" onClick={save} disabled={saving} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-50">{saving ? "Salvando…" : "Salvar"}</button>
    </Sheet>
  );
}
