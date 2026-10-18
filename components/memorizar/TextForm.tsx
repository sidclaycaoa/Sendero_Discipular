"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { splitLines } from "@/lib/memorize-text";

type Initial = { id?: string; title: string; source: string; text: string };

/** New text or edit: one line of the text = one passage learned at a time. */
export function TextForm({ initial, onDone }: { initial?: Initial; onDone: (id?: string) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = splitLines(text).length;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/memorizar", { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: initial?.id, title, source, text }) });
      const body = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(body.error);
      router.refresh();
      onDone(body.id ?? initial?.id);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block"><span className="text-sm font-semibold text-ink">Título</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: As sete fases da ED" className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss" />
      </label>
      <label className="block"><span className="text-sm font-semibold text-ink">Referência <span className="font-normal text-ink/50">(opcional)</span></span>
        <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Livro, aula ou apostila de onde veio" className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss" />
      </label>
      <label className="block"><span className="text-sm font-semibold text-ink">Texto</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={9} placeholder={"Cole o texto inteiro aqui.\nCada linha vira um trecho para decorar.\nQuebre as linhas onde fizer sentido."} className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm leading-6 outline-none focus:border-moss" />
        <span className="mt-1 block text-xs text-ink/55">{lines ? `${lines} ${lines === 1 ? "linha" : "linhas"} para decorar. Linhas em branco são ignoradas.` : "Uma linha por trecho; linhas em branco são ignoradas."}</span>
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-red-800">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="min-h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-50">{saving ? "Salvando…" : "Salvar texto"}</button>
        <button type="button" onClick={() => onDone()} className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-ink">Cancelar</button>
      </div>
    </div>
  );
}
