"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cadernoAction } from "@/components/caderno/shared";
import { whenEdited } from "@/lib/caderno-shared";

type Archive = {
  notebooks: Array<{ id: string; name: string; color: string; archivedAt: string }>;
  sections: Array<{ id: string; name: string; archivedAt: string; notebook: string; color: string }>;
  pages: Array<{ id: string; title: string; preview: string; archivedAt: string; notebook: string; color: string }>;
};

/** What was archived: it comes back with one tap; deleting a page for good asks first. */
export function ArchiveList({ archive }: { archive: Archive }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(body: Record<string, unknown>) {
    setError(null);
    try {
      await cadernoAction(body);
      setConfirming(null);
      router.refresh();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  const empty = !archive.notebooks.length && !archive.sections.length && !archive.pages.length;
  const row = "flex items-center gap-3 rounded-xl border border-line bg-white p-3";
  const restore = "shrink-0 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-moss";
  return (
    <div className="space-y-4">
      {empty ? <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink/60">O arquivo está vazio.</p> : null}
      {archive.notebooks.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/60">Cadernos</h2>
          {archive.notebooks.map((item) => (
            <div key={item.id} className={row}>
              <span className="h-8 w-2 shrink-0 rounded" style={{ background: item.color }} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{item.name}</strong><small className="text-xs text-ink/55">arquivado {whenEdited(item.archivedAt)}</small></span>
              <button type="button" className={restore} onClick={() => run({ action: "updateNotebook", id: item.id, archived: false })}>Trazer de volta</button>
            </div>
          ))}
        </section>
      ) : null}
      {archive.sections.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/60">Seções</h2>
          {archive.sections.map((item) => (
            <div key={item.id} className={row}>
              <span className="h-8 w-2 shrink-0 rounded" style={{ background: item.color }} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{item.name}</strong><small className="text-xs text-ink/55">{item.notebook} · arquivada {whenEdited(item.archivedAt)}</small></span>
              <button type="button" className={restore} onClick={() => run({ action: "updateSection", id: item.id, archived: false })}>Trazer de volta</button>
            </div>
          ))}
        </section>
      ) : null}
      {archive.pages.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/60">Páginas</h2>
          {archive.pages.map((item) => (
            <div key={item.id} className="rounded-xl border border-line bg-white p-3">
              <div className="flex items-center gap-3">
                <span className="h-8 w-2 shrink-0 rounded" style={{ background: item.color }} />
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{item.title}</strong><small className="block truncate text-xs text-ink/55">{item.notebook} · arquivada {whenEdited(item.archivedAt)}{item.preview ? ` · ${item.preview}` : ""}</small></span>
                <button type="button" className={restore} onClick={() => run({ action: "archivePage", id: item.id, archived: false })}>Trazer de volta</button>
              </div>
              {confirming === item.id ? (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-950">
                  <p className="font-semibold">Apagar “{item.title}” de vez? O texto e as versões anteriores somem e não há como recuperar.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => run({ action: "deletePage", id: item.id, confirm: true })} className="min-h-10 rounded-lg bg-red-800 px-3 text-sm font-semibold text-white">Sim, apagar de vez</button>
                    <button type="button" onClick={() => setConfirming(null)} className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold">Cancelar</button>
                  </div>
                </div>
              ) : <button type="button" onClick={() => setConfirming(item.id)} className="mt-2 text-xs font-semibold text-red-800">Apagar de vez…</button>}
            </div>
          ))}
        </section>
      ) : null}
      {error ? <p role="alert" className="text-sm font-semibold text-red-800">{error}</p> : null}
    </div>
  );
}
