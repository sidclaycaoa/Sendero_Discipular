"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookmarkPlus, Sparkles } from "lucide-react";
import type { Inspiration, InspirationSource } from "@/lib/db/inspiracao";

const SOURCES: Array<{ key: InspirationSource; label: string }> = [
  { key: "tudo", label: "Surpreenda-me" },
  { key: "livros", label: "Dos livros" },
  { key: "aulas", label: "Das minhas aulas" },
];

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!response) throw new Error("Sem conexão. Confira a internet e tente de novo.");
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível agora.");
  return data;
}

/**
 * A fortune cookie made of the masters: a whole passage, with context, to read
 * slowly on waking or before sleeping. Books are shown exactly as indexed.
 */
export function InspiracaoScreen() {
  const [source, setSource] = useState<InspirationSource>("tudo");
  const [theme, setTheme] = useState("");
  const [current, setCurrent] = useState<Inspiration | null>(null);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const seen = useRef<string[]>([]);
  const body = useRef<HTMLParagraphElement>(null);

  async function draw() {
    setBusy(true);
    setMessage(null);
    try {
      const { inspiration } = await post<{ inspiration: Inspiration | null }>("/api/inspiracao", { source, theme, exclude: seen.current });
      setEmpty(!inspiration);
      if (inspiration) { setCurrent(inspiration); seen.current = [...seen.current, inspiration.key].slice(-40); }
    } catch (failure) {
      setMessage({ tone: "error", text: (failure as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function keep() {
    if (!current?.bookPassageId) return;
    // A selected stretch is kept as is; without a selection the whole passage is kept, if it is short enough.
    const selected = window.getSelection();
    const stretch = selected && body.current && selected.rangeCount && body.current.contains(selected.anchorNode) ? selected.toString().trim() : "";
    const selection = stretch || current.text;
    if (selection.length > 900) { setMessage({ tone: "error", text: "A passagem é longa. Selecione com o dedo o trecho que quer guardar (até 900 letras) e toque de novo." }); return; }
    try {
      await post("/api/frases", { action: "fromBook", passageId: current.bookPassageId, selection });
      setMessage({ tone: "ok", text: "Guardado em Frases e passagens." });
    } catch (failure) {
      setMessage({ tone: "error", text: (failure as Error).message });
    }
  }

  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70"}`;
  return (
    <div className="space-y-3">
      <Link prefetch={false} href="/inicio" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Início</Link>
      <header className="rounded-2xl bg-ink p-4 text-paper shadow-soft">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-paper/60">Para ler devagar</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight">Uma passagem para hoje</h1>
        <p className="mt-1 text-[12.5px] text-paper/75">Um trecho inteiro, com contexto, dos mestres e das suas aulas. Para acordar ou para dormir.</p>
      </header>

      <div className="rounded-xl border border-line bg-white p-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SOURCES.map((item) => <button key={item.key} type="button" onClick={() => setSource(item.key)} className={chip(source === item.key)}>{item.label}</button>)}
        </div>
        <label className="mt-2 block text-xs font-semibold text-ink/60" htmlFor="tema">Sobre um tema (opcional)</label>
        <input id="tema" value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="coragem, tempo, morte, hábito…" className="mt-1 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-base" />
        <button type="button" onClick={draw} disabled={busy} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-moss text-[15px] font-semibold text-white disabled:opacity-60"><Sparkles className="h-4 w-4" aria-hidden="true" /> {busy ? "Procurando…" : current ? "Outra passagem" : "Abrir uma passagem"}</button>
      </div>

      {empty ? <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink/70">Nada encontrado {theme ? <>sobre “{theme}” </> : null}nesta fonte. Tente outro tema, ou outra fonte.</p> : null}

      {current && !empty ? (
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-olive">{current.kind === "LIVRO" ? "Do livro" : current.kind === "AULA" ? "Da sua aula" : "Das suas frases"}</p>
          <p ref={body} className="caderno-serif mt-3 whitespace-pre-line text-[19px] leading-8 text-ink">{current.text}</p>
          <p className="mt-4 text-sm font-semibold text-ink">{current.heading}</p>
          {current.detail ? <p className="text-sm text-ink/60">{current.detail}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            {current.bookPassageId ? <button type="button" onClick={keep} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink"><BookmarkPlus className="h-4 w-4" aria-hidden="true" /> Guardar nas Frases</button> : null}
            {current.href ? <Link prefetch={false} href={current.href} className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink">Abrir {current.kind === "AULA" ? "a aula" : "as frases"}</Link> : null}
          </div>
          {current.bookPassageId ? <p className="mt-2 text-xs text-ink/50">Dica: selecione com o dedo só o trecho que quer guardar.</p> : null}
        </article>
      ) : null}

      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm font-semibold ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>{message.text}</p> : null}
    </div>
  );
}
