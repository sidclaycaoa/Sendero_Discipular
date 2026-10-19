"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { FRASES_COLOR } from "@/lib/caderno-shared";
import type { BookHit, SavedPassage } from "@/lib/db/frases";

type Mode = "book" | "literal" | "mine";

async function frasesAction<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/frases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!response) throw new Error("Sem conexão. Confira a internet e tente de novo.");
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar agora.");
  return data;
}

/**
 * The special notebook of phrases. Each card says plainly whether it is a
 * literal quotation (with its source) or the user's own synthesis.
 */
export function FrasesScreen({ passages, authors }: { passages: SavedPassage[]; authors: Array<{ name: string; count: number }> }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("TODAS");
  const [sheet, setSheet] = useState<{ kind: "new" } | { kind: "edit"; passage: SavedPassage } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = passages.filter((passage) => passage.kind === "SINTESE").length;
  const shown = passages.filter((passage) => filter === "TODAS" || (filter === "SINTESE" ? passage.kind === "SINTESE" : passage.kind === "LITERAL" && passage.author === filter));

  async function run(passage: SavedPassage, body: Record<string, unknown>, after?: (result: Record<string, unknown>) => void) {
    setBusy(passage.id);
    setError(null);
    try {
      const result = await frasesAction(body);
      if (after) after(result); else router.refresh();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70"}`;
  return (
    <div className="space-y-3">
      <Link prefetch={false} href="/caderno" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Caderno</Link>
      <header className="rounded-2xl p-4 text-white shadow-soft" style={{ background: FRASES_COLOR }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/70">Caderno especial</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight">Frases e passagens</h1>
        <p className="mt-1 text-[12.5px] text-white/80">{passages.length} frase{passages.length === 1 ? "" : "s"}{authors.length ? ` · ${authors.length} autor${authors.length === 1 ? "" : "es"}` : ""}</p>
      </header>

      <button type="button" onClick={() => setSheet({ kind: "new" })} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-[15px] font-semibold text-white">+ Nova frase</button>

      {passages.length ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button type="button" className={chip(filter === "TODAS")} onClick={() => setFilter("TODAS")}>Todas</button>
          {authors.map((author) => <button key={author.name} type="button" className={chip(filter === author.name)} onClick={() => setFilter(author.name)}>{author.name}</button>)}
          {mine ? <button type="button" className={chip(filter === "SINTESE")} onClick={() => setFilter("SINTESE")}>Minhas sínteses</button> : null}
        </div>
      ) : <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink/60">Nenhuma frase ainda. Toque em “+ Nova frase” para buscar nos livros do AD, digitar uma citação com a fonte ou guardar uma síntese sua.</p>}

      {error ? <p role="alert" className="text-sm font-semibold text-red-800">{error}</p> : null}

      {shown.map((passage) => (
        <article key={passage.id} id={passage.id} className="scroll-mt-4 rounded-2xl border border-line bg-[#fffdf8] p-4 shadow-soft target:ring-2 target:ring-moss">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] ${passage.kind === "LITERAL" ? "bg-[#e9e4f4] text-[#45386e]" : "bg-[#f3e7dc] text-[#6d4a2e]"}`}>{passage.kind === "LITERAL" ? "Citação literal" : "Minha síntese"}</span>
          <blockquote className="caderno-serif mt-2 whitespace-pre-wrap text-[16.5px] leading-[1.55] text-ink">{passage.kind === "LITERAL" ? `“${passage.text}”` : passage.text}</blockquote>
          <p className="mt-2 text-xs leading-5 text-ink/65">{source(passage)}</p>
          {passage.note ? <p className="mt-2 rounded-lg bg-paper p-2.5 text-[13px] leading-5 text-ink/80"><b className="font-semibold">Minha nota:</b> {passage.note}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-moss">
            <button type="button" disabled={busy === passage.id} onClick={() => run(passage, { action: "memorize", id: passage.id }, (result) => router.push(`/memorizar/${result.memorizationId}`))} className="min-h-9 disabled:opacity-50">Memorizar</button>
            <button type="button" onClick={() => setSheet({ kind: "edit", passage })} className="min-h-9">{passage.sourceType === "LIVRO_AD" ? "Nota" : "Editar"}</button>
            <button type="button" disabled={busy === passage.id} onClick={() => run(passage, { action: "archive", id: passage.id, archived: true })} className="min-h-9 text-ink/55 disabled:opacity-50">Arquivar</button>
          </div>
        </article>
      ))}

      {sheet?.kind === "new" ? <NewPhraseSheet onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === "edit" ? <EditPhraseSheet passage={sheet.passage} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

function source(passage: SavedPassage) {
  if (passage.kind === "SINTESE") return passage.sourceType === "PAGINA" ? "Nascida de uma página do Caderno" : "Escrita por você";
  const where = [passage.work, passage.edition, passage.location].filter(Boolean).join(" · ");
  return `${passage.author}${where ? ` · ${where}` : ""}${passage.sourceType === "LIVRO_AD" ? " · conferida no livro do AD" : " · digitada por você"}`;
}

function NewPhraseSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("book");
  const tab = (on: boolean) => `min-h-10 flex-1 rounded-lg text-[13px] font-semibold ${on ? "bg-white text-ink shadow-sm" : "text-ink/60"}`;
  return (
    <Sheet title="Nova frase" onClose={onClose}>
      <div className="mt-3 flex gap-1 rounded-xl bg-paper p-1" role="group" aria-label="Tipo de frase">
        <button type="button" className={tab(mode === "book")} aria-pressed={mode === "book"} onClick={() => setMode("book")}>Livros do AD</button>
        <button type="button" className={tab(mode === "literal")} aria-pressed={mode === "literal"} onClick={() => setMode("literal")}>Citação com fonte</button>
        <button type="button" className={tab(mode === "mine")} aria-pressed={mode === "mine"} onClick={() => setMode("mine")}>Minha síntese</button>
      </div>
      {mode === "book" ? <FromBook onClose={onClose} /> : <PhraseForm kind={mode === "mine" ? "SINTESE" : "LITERAL"} onClose={onClose} />}
    </Sheet>
  );
}

/** Search the seven books, open a passage, select the stretch to keep (or keep it whole). */
function FromBook({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BookHit[] | null>(null);
  const [chosen, setChosen] = useState<BookHit | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const area = useRef<HTMLTextAreaElement>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setState({ busy: true, error: null });
    try {
      setHits((await frasesAction<{ hits: BookHit[] }>({ action: "searchBooks", query })).hits);
      setState({ busy: false, error: null });
    } catch (failure) { setState({ busy: false, error: (failure as Error).message }); }
  }
  async function save() {
    if (!chosen) return;
    const input = area.current;
    const selection = input && input.selectionEnd > input.selectionStart ? input.value.slice(input.selectionStart, input.selectionEnd) : "";
    setState({ busy: true, error: null });
    try {
      await frasesAction({ action: "fromBook", passageId: chosen.id, selection, note });
      onClose();
      router.refresh();
    } catch (failure) { setState({ busy: false, error: (failure as Error).message }); }
  }

  if (chosen) return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-ink/60">{chosen.author} · {chosen.work} · {chosen.location}</p>
      <p className="mt-1 text-sm text-ink/80">Selecione com o dedo o trecho que quer guardar. Sem seleção, guardo o começo da passagem (até 900 letras).</p>
      <textarea ref={area} readOnly value={chosen.text} rows={9} aria-label="Passagem do livro" className="caderno-serif mt-2 w-full rounded-xl border border-line bg-[#fffdf8] p-3 text-[15px] leading-6 text-ink" />
      <label htmlFor="frase-nota-livro" className="mt-2 block text-sm font-semibold text-ink">Minha nota (opcional)</label>
      <textarea id="frase-nota-livro" value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-line bg-paper p-2.5 text-base" placeholder="Por que esta frase importa para você" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setChosen(null)} className="min-h-12 rounded-xl border border-line text-sm font-semibold">Voltar</button>
        <button type="button" disabled={state.busy} onPointerDown={(event) => event.preventDefault()} onClick={save} className="min-h-12 rounded-xl bg-moss text-sm font-semibold text-white disabled:opacity-50">{state.busy ? "Guardando…" : "Guardar o trecho"}</button>
      </div>
      {state.error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{state.error}</p> : null}
    </div>
  );

  return (
    <div className="mt-3">
      <form onSubmit={search} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3">
        <Search className="h-4 w-4 shrink-0 text-ink/45" aria-hidden="true" />
        <input id="frase-busca-livros" type="search" enterKeyHint="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Palavras da passagem (ex.: amanhecer tarefa)" className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
      </form>
      <p className="mt-1.5 text-xs text-ink/55">Busca nos 7 livros do AD: Marco Aurélio, Epicteto, Sêneca, Aristóteles, N. Sri Ram (2) e Psicologia.</p>
      {state.busy ? <p className="mt-3 text-sm text-ink/60">Buscando…</p> : null}
      {hits?.length === 0 ? <p className="mt-3 text-sm text-ink/60">Nada encontrado. Tente outras palavras.</p> : null}
      <ul className="mt-3 space-y-2">
        {hits?.map((hit) => (
          <li key={hit.id}><button type="button" onClick={() => setChosen(hit)} className="block w-full rounded-xl border border-line p-3 text-left">
            <span className="block text-xs font-semibold text-ink/60">{hit.author} · {hit.work} · {hit.location}</span>
            <span className="caderno-serif mt-1 block text-sm leading-5 text-ink">{hit.excerpt.length > 260 ? `${hit.excerpt.slice(0, 260)}…` : hit.excerpt}</span>
          </button></li>
        ))}
      </ul>
      {state.error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{state.error}</p> : null}
    </div>
  );
}

function PhraseForm({ kind, passage, onClose }: { kind: "LITERAL" | "SINTESE"; passage?: SavedPassage; onClose: () => void }) {
  const router = useRouter();
  const [fields, setFields] = useState({ text: passage?.text ?? "", author: passage?.author ?? "", work: passage?.work ?? "", edition: passage?.edition ?? "", location: passage?.location ?? "", note: passage?.note ?? "" });
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const set = (key: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields({ ...fields, [key]: event.target.value });
  async function save() {
    setState({ busy: true, error: null });
    try {
      await frasesAction(passage ? { action: "update", id: passage.id, ...fields } : { action: "create", kind, ...fields });
      onClose();
      router.refresh();
    } catch (failure) { setState({ busy: false, error: (failure as Error).message }); }
  }
  const input = "mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base";
  return (
    <div className="mt-3 space-y-2.5">
      {kind === "LITERAL" ? <p className="text-xs text-ink/60">Copie a frase exatamente como está no livro. Autor e obra são obrigatórios; sem fonte, guarde como síntese.</p> : <p className="text-xs text-ink/60">Uma ideia sua, com as suas palavras. Ela nunca aparece como citação de um autor.</p>}
      <div>
        <label htmlFor="frase-texto" className="block text-sm font-semibold text-ink">{kind === "LITERAL" ? "Citação" : "Síntese"}</label>
        <textarea id="frase-texto" value={fields.text} onChange={set("text")} rows={4} className="caderno-serif mt-1 w-full rounded-xl border border-line bg-[#fffdf8] p-3 text-base leading-6" />
      </div>
      {kind === "LITERAL" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor="frase-autor" className="block text-sm font-semibold text-ink">Autor</label><input id="frase-autor" value={fields.author} onChange={set("author")} className={input} /></div>
            <div><label htmlFor="frase-obra" className="block text-sm font-semibold text-ink">Obra</label><input id="frase-obra" value={fields.work} onChange={set("work")} className={input} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor="frase-edicao" className="block text-sm font-semibold text-ink">Edição</label><input id="frase-edicao" value={fields.edition} onChange={set("edition")} placeholder="editora, ano" className={input} /></div>
            <div><label htmlFor="frase-local" className="block text-sm font-semibold text-ink">Página ou trecho</label><input id="frase-local" value={fields.location} onChange={set("location")} placeholder="p. 28, cap. 3" className={input} /></div>
          </div>
        </>
      ) : null}
      <div>
        <label htmlFor="frase-nota" className="block text-sm font-semibold text-ink">Minha nota (opcional)</label>
        <textarea id="frase-nota" value={fields.note} onChange={set("note")} rows={2} className="mt-1 w-full rounded-xl border border-line bg-paper p-2.5 text-base" />
      </div>
      <button type="button" disabled={state.busy} onClick={save} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-sm font-semibold text-white disabled:opacity-50">{state.busy ? "Guardando…" : "Guardar"}</button>
      {state.error ? <p role="alert" className="text-sm font-semibold text-red-800">{state.error}</p> : null}
    </div>
  );
}

function EditPhraseSheet({ passage, onClose }: { passage: SavedPassage; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState(passage.note ?? "");
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  if (passage.sourceType !== "LIVRO_AD") return <Sheet title="Editar frase" onClose={onClose}><PhraseForm kind={passage.kind} passage={passage} onClose={onClose} /></Sheet>;
  async function save() {
    setState({ busy: true, error: null });
    try {
      await frasesAction({ action: "update", id: passage.id, note });
      onClose();
      router.refresh();
    } catch (failure) { setState({ busy: false, error: (failure as Error).message }); }
  }
  return (
    <Sheet title="Nota da frase" onClose={onClose}>
      <p className="mt-2 text-xs text-ink/60">O texto e a fonte vêm do livro e não mudam. A sua nota fica separada da citação.</p>
      <textarea id="frase-nota-edit" value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-line bg-paper p-3 text-base" />
      <button type="button" disabled={state.busy} onClick={save} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-sm font-semibold text-white disabled:opacity-50">{state.busy ? "Salvando…" : "Salvar nota"}</button>
      {state.error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{state.error}</p> : null}
    </Sheet>
  );
}
