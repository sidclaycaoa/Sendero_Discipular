"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { Card } from "@/components/app/AppShell";

type DiaryTask = { id: string; title: string; dueDate: string };

/** Turns something the diary revealed into a concrete task (origin DIARY), shown in Tarefas. */
export function DiaryActions({ tasks, defaultDate }: { tasks: DiaryTask[]; defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function create() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "task", title, dueDate, origin: "DIARY" }) });
      const result = await response.json().catch(() => null) as { saved?: boolean; error?: string } | null;
      if (!response.ok || !result?.saved) throw new Error(result?.error ?? "Não foi possível criar a ação.");
      setTitle("");
      setOpen(false);
      setMessage({ ok: true, text: "Ação criada. Ela aparece em Tarefas." });
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Não foi possível criar a ação." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-moss">Ações nascidas do diário</h2>
        {!open ? (
          <button type="button" onClick={() => { setOpen(true); setMessage(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink">
            <ListPlus className="h-4 w-4" aria-hidden="true" /> Nova ação
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-ink/70">Quando uma resposta pedir atitude, transforme-a em uma tarefa simples e verificável.</p>
      {open ? (
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-semibold text-ink">O que vou fazer
            <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="Ex.: conversar com calma sobre…" className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss" />
          </label>
          <label className="block text-sm font-semibold text-ink">Quando
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-line text-sm font-semibold text-ink">Cancelar</button>
            <button type="button" onClick={create} disabled={saving || !title.trim() || !dueDate} className="min-h-11 rounded-lg bg-ink text-sm font-semibold text-paper disabled:opacity-50">{saving ? "Criando…" : "Criar ação"}</button>
          </div>
        </div>
      ) : null}
      {message ? <p role="status" className={`mt-3 text-sm font-semibold ${message.ok ? "text-emerald-800" : "text-red-800"}`}>{message.text}</p> : null}
      {tasks.length ? (
        <ul className="mt-3 divide-y divide-line text-sm">
          {tasks.map((task) => <li key={task.id} className="flex items-center justify-between gap-3 py-2"><span className="text-ink">{task.title}</span><span className="shrink-0 text-xs text-ink/60">{formatDate(task.dueDate)}</span></li>)}
        </ul>
      ) : null}
      {tasks.length ? <Link prefetch={false} href="/tarefas" className="mt-2 inline-block text-sm font-semibold text-moss">Ver na Agenda</Link> : null}
    </Card>
  );
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${dateKey.slice(0, 10)}T12:00:00Z`));
}
