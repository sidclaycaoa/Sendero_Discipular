"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Plus, Search } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { cadernoAction } from "@/components/caderno/shared";
import { NOTEBOOK_COLORS, whenEdited } from "@/lib/caderno-shared";
import type { NotebookCard } from "@/lib/db/caderno";

type Recent = { id: string; title: string; place: string; color: string; updatedAt: string };

/** Entry of the Caderno: search, quick note, the pages to continue and the notebooks. */
export function CadernoHome({ notebooks, recent, archived }: { notebooks: NotebookCard[]; recent: Recent[]; archived: number }) {
  const [sheet, setSheet] = useState<"note" | "notebook" | null>(null);
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-olive">Sendero</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Caderno</h1>
      </header>

      <form action="/caderno/busca" className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 shadow-soft">
        <Search className="h-4 w-4 shrink-0 text-ink/45" aria-hidden="true" />
        <input id="caderno-busca" name="q" type="search" enterKeyHint="search" placeholder="Buscar no Caderno" className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/45" />
      </form>

      <button type="button" onClick={() => setSheet("note")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-moss text-[15px] font-semibold text-white">
        <Plus className="h-4 w-4" aria-hidden="true" /> Nota rápida
      </button>

      {recent.length ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-olive">Continuar de onde parou</h2>
          <div className="space-y-2">
            {recent.map((page) => (
              <Link prefetch={false} key={page.id} href={`/caderno/pagina/${page.id}`} className="grid grid-cols-[6px_minmax(0,1fr)] gap-3 overflow-hidden rounded-xl border border-line bg-white py-2.5 pr-3">
                <span className="rounded-r" style={{ background: page.color }} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-ink">{page.title}</strong>
                  <small className="block truncate text-xs text-ink/60">{page.place} · editada {whenEdited(page.updatedAt)}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-olive">Cadernos</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {notebooks.map((notebook) => (
            <Link prefetch={false} key={notebook.id} href={`/caderno/${notebook.id}`} className="flex min-h-[92px] flex-col justify-between rounded-[6px_14px_14px_6px] py-3 pl-[18px] pr-3 text-white shadow-[inset_6px_0_0_rgba(0,0,0,0.22),0_6px_14px_rgba(31,37,40,0.12)]" style={{ background: notebook.color }}>
              <strong className="text-[14.5px] font-semibold leading-tight">{notebook.name}</strong>
              <small className="text-[11.5px] text-white/80">{counts(notebook)}</small>
            </Link>
          ))}
          <button type="button" onClick={() => setSheet("notebook")} className="flex min-h-[92px] items-center justify-center rounded-[6px_14px_14px_6px] border-[1.5px] border-dashed border-line text-[13.5px] font-semibold text-ink/60">+ Novo caderno</button>
        </div>
      </section>

      {archived ? (
        <Link prefetch={false} href="/caderno/arquivo" className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-ink/60">
          <Archive className="h-4 w-4" aria-hidden="true" /> Arquivo ({archived})
        </Link>
      ) : null}

      {sheet === "note" ? <QuickNoteSheet notebooks={notebooks} onClose={() => setSheet(null)} /> : null}
      {sheet === "notebook" ? <NotebookSheet onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

function counts(notebook: NotebookCard) {
  const pages = `${notebook.pages} página${notebook.pages === 1 ? "" : "s"}`;
  return notebook.sections ? `${notebook.sections} seç${notebook.sections === 1 ? "ão" : "ões"} · ${pages}` : pages;
}

/** A note in a few words; it lands in the Caixa de entrada unless another notebook is chosen. */
export function QuickNoteSheet({ notebooks, onClose }: { notebooks: Array<{ id: string; name: string; kind: string }>; onClose: () => void }) {
  const router = useRouter();
  const inbox = notebooks.find((notebook) => notebook.kind === "ENTRADA") ?? notebooks[0];
  const [text, setText] = useState("");
  const [target, setTarget] = useState(inbox?.id ?? "");
  const [state, setState] = useState<{ saving: boolean; error: string | null }>({ saving: false, error: null });
  async function save() {
    if (!text.trim()) return;
    setState({ saving: true, error: null });
    try {
      await cadernoAction({ action: "createPage", notebookId: target, text });
      onClose();
      router.refresh();
    } catch (error) {
      setState({ saving: false, error: (error as Error).message });
    }
  }
  return (
    <Sheet title="Nota rápida" onClose={onClose}>
      <textarea id="nota-rapida" autoFocus value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder="Escreva ou dite pelo microfone do teclado…" className="mt-3 w-full rounded-xl border border-line bg-[#fffdf8] p-3 caderno-serif text-base leading-6 text-ink" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-olive">Guardar em</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {notebooks.map((notebook) => (
          <button key={notebook.id} type="button" onClick={() => setTarget(notebook.id)} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${target === notebook.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70"}`}>{notebook.name}</button>
        ))}
      </div>
      <button type="button" onClick={save} disabled={state.saving || !text.trim()} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-sm font-semibold text-white disabled:opacity-50">{state.saving ? "Guardando…" : "Guardar"}</button>
      {state.error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{state.error}</p> : null}
    </Sheet>
  );
}

/** New notebook, or renaming and recoloring one (with `notebook`). */
export function NotebookSheet({ notebook, onClose, onArchived }: { notebook?: { id: string; name: string; color: string }; onClose: () => void; onArchived?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(notebook?.name ?? "");
  const [color, setColor] = useState(notebook?.color ?? NOTEBOOK_COLORS[0]);
  const [state, setState] = useState<{ saving: boolean; error: string | null }>({ saving: false, error: null });
  async function run(body: Record<string, unknown>, after?: () => void) {
    setState({ saving: true, error: null });
    try {
      await cadernoAction(body);
      onClose();
      if (after) after(); else router.refresh();
    } catch (error) {
      setState({ saving: false, error: (error as Error).message });
    }
  }
  return (
    <Sheet title={notebook ? "Caderno" : "Novo caderno"} onClose={onClose}>
      <label htmlFor="caderno-nome" className="mt-3 block text-sm font-semibold text-ink">Nome</label>
      <input id="caderno-nome" value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink" />
      <p className="mt-3 text-sm font-semibold text-ink">Cor</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {NOTEBOOK_COLORS.map((item) => (
          <button key={item} type="button" onClick={() => setColor(item)} aria-label={`Cor ${item}`} aria-pressed={color === item} className={`h-9 w-9 rounded-full ${color === item ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: item }} />
        ))}
      </div>
      <button type="button" disabled={state.saving || !name.trim()} onClick={() => run(notebook ? { action: "updateNotebook", id: notebook.id, name, color } : { action: "createNotebook", name, color })} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-sm font-semibold text-white disabled:opacity-50">{state.saving ? "Salvando…" : notebook ? "Salvar" : "Criar caderno"}</button>
      {notebook ? (
        <button type="button" disabled={state.saving} onClick={() => run({ action: "updateNotebook", id: notebook.id, archived: true }, onArchived)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-red-800">
          <Archive className="h-4 w-4" aria-hidden="true" /> Arquivar caderno
        </button>
      ) : null}
      {notebook ? <p className="mt-2 text-center text-xs text-ink/55">Arquivar esconde o caderno sem apagar nada. Ele volta pelo Arquivo.</p> : null}
      {state.error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{state.error}</p> : null}
    </Sheet>
  );
}
