"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Pencil, Plus } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { NotebookSheet } from "@/components/caderno/CadernoHome";
import { cadernoAction } from "@/components/caderno/shared";
import { whenEdited } from "@/lib/caderno-shared";
import type { NotePageSummary, NoteSection, Notebook } from "@/lib/db/caderno";

type Props = { notebook: Notebook; sections: NoteSection[]; pages: NotePageSummary[] };

/**
 * One notebook: its loose pages, then each section with its pages, one under the
 * other (no tabs). "Organizar" shows arrows to change the order.
 */
export function NotebookScreen({ notebook, sections, pages }: Props) {
  const router = useRouter();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [organizing, setOrganizing] = useState(false);
  const [sheet, setSheet] = useState<{ kind: "notebook" } | { kind: "section"; section?: NoteSection } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const result = await cadernoAction<{ id?: string }>(body);
      return result;
    } catch (failure) {
      setError((failure as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function newPage(sectionId: string | null) {
    const result = await run({ action: "createPage", notebookId: notebook.id, sectionId });
    if (result?.id) router.push(`/caderno/pagina/${result.id}`);
  }

  async function move(kind: "section" | "page", id: string, direction: "up" | "down") {
    if (await run({ action: "reorder", kind, id, direction })) router.refresh();
  }

  const loose = pages.filter((page) => !page.sectionId && !page.parentId);
  const toggle = (id: string) => setClosed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className="space-y-3">
      <Link prefetch={false} href="/caderno" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Caderno</Link>

      <header className="rounded-2xl p-4 text-white shadow-soft" style={{ background: notebook.color }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/75">Caderno</p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight">{notebook.name}</h1>
            <p className="mt-1 text-[12.5px] text-white/85">{sections.length ? `${sections.length} seç${sections.length === 1 ? "ão" : "ões"} · ` : ""}{pages.length} página{pages.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" onClick={() => setSheet({ kind: "notebook" })} aria-label="Editar caderno" className="rounded-full bg-white/15 p-2.5"><Pencil className="h-4 w-4" /></button>
        </div>
      </header>

      {pages.length || sections.length ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => setOrganizing(!organizing)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${organizing ? "border-moss bg-moss/10 text-moss" : "border-line text-ink/65"}`}>{organizing ? "Pronto" : "Organizar"}</button>
        </div>
      ) : null}

      {loose.length ? (
        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <PageList pages={pages} parents={loose} organizing={organizing} onMove={(id, direction) => move("page", id, direction)} />
        </section>
      ) : null}

      {sections.map((section, index) => {
        const sectionPages = pages.filter((page) => page.sectionId === section.id);
        const open = !closed.has(section.id);
        return (
          <section key={section.id} className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex items-center gap-1 pr-2">
              <button type="button" onClick={() => toggle(section.id)} aria-expanded={open} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3.5 text-left">
                {open ? <ChevronDown className="h-4 w-4 shrink-0 text-ink/45" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink/45" aria-hidden="true" />}
                <strong className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink">{section.name}</strong>
                <small className="shrink-0 text-xs text-ink/55">{sectionPages.length} pág.</small>
              </button>
              {organizing ? (
                <>
                  <Arrow label={`Subir ${section.name}`} disabled={busy || index === 0} onClick={() => move("section", section.id, "up")} up />
                  <Arrow label={`Descer ${section.name}`} disabled={busy || index === sections.length - 1} onClick={() => move("section", section.id, "down")} />
                  <button type="button" onClick={() => setSheet({ kind: "section", section })} aria-label={`Editar ${section.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-ink/60"><Pencil className="h-4 w-4" /></button>
                </>
              ) : null}
            </div>
            {open ? (
              <div className="border-t border-[#f0ebe1]">
                <PageList pages={pages} parents={sectionPages.filter((page) => !page.parentId)} organizing={organizing} onMove={(id, direction) => move("page", id, direction)} />
                <button type="button" disabled={busy} onClick={() => newPage(section.id)} className="flex min-h-11 w-full items-center gap-2 border-t border-[#f0ebe1] px-5 text-[13px] font-semibold text-moss disabled:opacity-50"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Página nesta seção</button>
              </div>
            ) : null}
          </section>
        );
      })}

      {!pages.length && !sections.length ? <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink/60">Caderno vazio. Crie a primeira página, ou uma seção para separar os assuntos.</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => newPage(null)} className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-white text-[13.5px] font-semibold text-moss disabled:opacity-50">+ Página</button>
        <button type="button" disabled={busy} onClick={() => setSheet({ kind: "section" })} className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-white text-[13.5px] font-semibold text-moss disabled:opacity-50">+ Seção</button>
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-red-800">{error}</p> : null}

      {sheet?.kind === "notebook" ? <NotebookSheet notebook={notebook} onClose={() => setSheet(null)} onArchived={() => router.push("/caderno")} /> : null}
      {sheet?.kind === "section" ? <SectionSheet notebookId={notebook.id} section={sheet.section} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

function PageList({ pages, parents, organizing, onMove }: { pages: NotePageSummary[]; parents: NotePageSummary[]; organizing: boolean; onMove: (id: string, direction: "up" | "down") => void }) {
  return (
    <ul className="divide-y divide-[#f0ebe1]">
      {parents.map((page, index) => {
        const children = pages.filter((child) => child.parentId === page.id);
        return (
          <li key={page.id}>
            <PageRow page={page} organizing={organizing} first={index === 0} last={index === parents.length - 1} onMove={onMove} />
            {children.length ? (
              <ul className="divide-y divide-[#f0ebe1] border-t border-[#f0ebe1]">
                {children.map((child, childIndex) => <li key={child.id}><PageRow page={child} child organizing={organizing} first={childIndex === 0} last={childIndex === children.length - 1} onMove={onMove} /></li>)}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function PageRow({ page, child = false, organizing, first, last, onMove }: { page: NotePageSummary; child?: boolean; organizing: boolean; first: boolean; last: boolean; onMove: (id: string, direction: "up" | "down") => void }) {
  return (
    <div className="flex items-center gap-1 pr-2">
      <Link prefetch={false} href={`/caderno/pagina/${page.id}`} className={`block min-w-0 flex-1 py-2.5 pr-2 ${child ? "pl-10" : "pl-5"}`}>
        <strong className="block truncate text-sm font-semibold text-ink">{child ? "↳ " : ""}{page.title}</strong>
        <small className="block truncate text-xs text-ink/60">{whenEdited(page.updatedAt)}{page.preview ? ` · ${page.preview}` : ""}</small>
      </Link>
      {organizing ? (
        <>
          <Arrow label={`Subir ${page.title}`} disabled={first} onClick={() => onMove(page.id, "up")} up />
          <Arrow label={`Descer ${page.title}`} disabled={last} onClick={() => onMove(page.id, "down")} />
        </>
      ) : null}
    </div>
  );
}

function Arrow({ label, disabled, onClick, up = false }: { label: string; disabled: boolean; onClick: () => void; up?: boolean }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink/70 disabled:opacity-30">
      {up ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );
}

function SectionSheet({ notebookId, section, onClose }: { notebookId: string; section?: NoteSection; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(section?.name ?? "");
  const [state, setState] = useState<{ saving: boolean; error: string | null }>({ saving: false, error: null });
  async function run(body: Record<string, unknown>) {
    setState({ saving: true, error: null });
    try {
      await cadernoAction(body);
      onClose();
      router.refresh();
    } catch (error) {
      setState({ saving: false, error: (error as Error).message });
    }
  }
  return (
    <Sheet title={section ? "Seção" : "Nova seção"} onClose={onClose}>
      <label htmlFor="secao-nome" className="mt-3 block text-sm font-semibold text-ink">Nome</label>
      <input id="secao-nome" autoFocus value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink" />
      <button type="button" disabled={state.saving || !name.trim()} onClick={() => run(section ? { action: "updateSection", id: section.id, name } : { action: "createSection", notebookId, name })} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-sm font-semibold text-white disabled:opacity-50">{state.saving ? "Salvando…" : section ? "Salvar" : "Criar seção"}</button>
      {section ? (
        <>
          <button type="button" disabled={state.saving} onClick={() => run({ action: "updateSection", id: section.id, archived: true })} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold text-red-800">Arquivar seção</button>
          <p className="mt-2 text-center text-xs text-ink/55">As páginas da seção ficam guardadas e voltam junto com ela, pelo Arquivo.</p>
        </>
      ) : null}
      {state.error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{state.error}</p> : null}
    </Sheet>
  );
}
