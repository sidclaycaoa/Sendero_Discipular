"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug, Lightbulb, MessageSquarePlus } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";

/** Quiet button at the end of every screen to log a bug or an improvement idea. */
export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"BUG" | "MELHORIA">("MELHORIA");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, description, page: pathname }) });
      const result = await response.json().catch(() => null) as { saved?: boolean; error?: string } | null;
      if (!response.ok || !result?.saved) throw new Error(result?.error ?? "Não foi possível registrar agora.");
      setDescription("");
      setOpen(false);
      setStatus({ ok: true, text: kind === "BUG" ? "Bug registrado nas pendências." : "Melhoria registrada nas pendências." });
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Não foi possível registrar agora." });
    } finally {
      setSaving(false);
    }
  }

  // A panel above the bottom menu: inline at the end of the page, the text box sat under the menu on the iPhone.
  return (
    <div className="mt-10 border-t border-line/70 pt-4">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => { setOpen(true); setStatus(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-moss">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /> Reportar bug ou melhoria
        </button>
        <Link prefetch={false} href="/pendencias" className="text-sm font-semibold text-ink/60 underline">Pendências do app</Link>
      </div>
      {status ? <p role="status" className={`mt-3 text-center text-sm font-semibold ${status.ok ? "text-emerald-800" : "text-red-800"}`}>{status.text}</p> : null}
      {open ? (
        <Sheet title="O que você quer registrar?" onClose={() => setOpen(false)}>
          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Tipo">
            <KindButton active={kind === "BUG"} onClick={() => setKind("BUG")} icon={<Bug className="h-4 w-4" />} label="Bug" />
            <KindButton active={kind === "MELHORIA"} onClick={() => setKind("MELHORIA")} icon={<Lightbulb className="h-4 w-4" />} label="Melhoria" />
          </div>
          <label htmlFor="feedback-text" className="sr-only">Descrição</label>
          <textarea id="feedback-text" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder={kind === "BUG" ? "O que aconteceu e o que você esperava?" : "Qual melhoria ajudaria aqui?"} className="mt-3 w-full rounded-lg border border-line bg-paper p-3 text-base outline-none focus:border-moss" />
          {status && !status.ok ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{status.text}</p> : null}
          <button type="button" onClick={send} disabled={saving || !description.trim()} className="mt-3 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-50">{saving ? "Enviando…" : "Registrar"}</button>
          <p className="mt-2 text-xs text-ink/55">Tela: {pathname}</p>
        </Sheet>
      ) : null}
    </div>
  );
}

function KindButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${active ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink"}`}>
      {icon}{label}
    </button>
  );
}
