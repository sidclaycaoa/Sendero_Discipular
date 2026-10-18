"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Flag, Plus, Repeat2, Trash2 } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import type { AgendaEvent, AgendaTask } from "@/lib/db/agenda";
import { parseQuickAdd } from "@/lib/quick-add";

const input = "mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-moss";
export const addDay = (dateKey: string, days: number) => new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const plusHour = (time: string) => `${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, "0")}:${time.slice(3, 5)}`;
export const longDate = (dateKey: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${dateKey}T12:00:00Z`));
export const shortDate = (dateKey: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${dateKey}T12:00:00Z`)).replace(".", "");

/** Sends an Agenda change and reloads the screen; returns the error message, if any. */
export function useAgenda() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function send(url: string, method: string, body?: unknown) {
    setError(null);
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    if (!response?.ok) {
      const message = (await response?.json().catch(() => null) as { error?: string } | null)?.error ?? "Não foi possível salvar. Confira a conexão.";
      setError(message);
      return false;
    }
    router.refresh();
    return true;
  }
  return { send, error };
}

/** "Ligar pro contador amanhã 15h": shows what was understood and saves in one tap. */
export function QuickAdd({ defaultDate, today, onMore }: { defaultDate: string; today: string; onMore: (draft: { title: string; date: string; time: string; kind: "task" | "event" }) => void }) {
  const { send, error } = useAgenda();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"task" | "event">("task");
  const parsed = parseQuickAdd(text, today);
  const date = parsed.date ?? defaultDate;
  const time = parsed.time ?? "";

  async function save() {
    if (!parsed.title) return;
    const ok = kind === "event" && time
      ? await send("/api/tasks", "POST", { kind: "event", title: parsed.title, startsAt: `${date}T${time}`, endsAt: `${date}T${plusHour(time)}` })
      : await send("/api/tasks", "POST", { title: parsed.title, dueDate: date, dueTime: time || null });
    if (ok) { setText(""); setKind("task"); }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 shadow-soft">
        <Plus className="h-5 w-5 shrink-0 text-moss" aria-hidden="true" />
        <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); }} placeholder="Ex.: ligar pro contador amanhã 15h" className="min-h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none" aria-label="Adicionar tarefa ou compromisso" />
        {parsed.title ? <button type="button" onClick={save} className="min-h-9 shrink-0 rounded-lg bg-ink px-3 text-sm font-semibold text-paper">Salvar</button> : null}
      </div>
      {parsed.title ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px] font-semibold">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">📅 {date === today ? "hoje" : date === addDay(today, 1) ? "amanhã" : shortDate(date)}</span>
          {time ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">⏰ {time}</span> : null}
          {time ? <button type="button" onClick={() => setKind(kind === "task" ? "event" : "task")} className="rounded-full bg-paper px-2 py-0.5 text-ink/70">{kind === "task" ? "tarefa · trocar p/ compromisso" : "compromisso · trocar p/ tarefa"}</button> : null}
          <button type="button" onClick={() => onMore({ title: parsed.title, date, time, kind })} className="rounded-full px-2 py-0.5 text-ink/50 underline">mais opções</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-1 px-1 text-sm font-semibold text-red-800">{error}</p> : null}
    </div>
  );
}

/** Full form for a new task or event: date, hour, priority, repetition, place. */
export function NewItemSheet({ draft, onClose }: { draft: { title: string; date: string; time: string; kind: "task" | "event" }; onClose: () => void }) {
  const { send, error } = useAgenda();
  const [kind, setKind] = useState(draft.kind);
  const [title, setTitle] = useState(draft.title);
  const [date, setDate] = useState(draft.date);
  const [time, setTime] = useState(draft.time || (draft.kind === "event" ? "09:00" : ""));
  const [endTime, setEndTime] = useState(draft.time ? plusHour(draft.time) : "10:00");
  const [priority, setPriority] = useState(2);
  const [repeat, setRepeat] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  async function save() {
    const recurrence = repeat ? { frequency: repeat } : undefined;
    const ok = kind === "event"
      ? await send("/api/tasks", "POST", { kind: "event", title, startsAt: `${date}T${time || "09:00"}`, endsAt: endTime ? `${date}T${endTime}` : undefined, location, description, recurrence })
      : await send("/api/tasks", "POST", { title, dueDate: date, dueTime: time || null, priority, description, recurrence });
    if (ok) onClose();
  }

  return (
    <Sheet title={kind === "event" ? "Novo compromisso" : "Nova tarefa"} onClose={onClose}>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {([["task", "Tarefa"], ["event", "Compromisso"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setKind(key)} className={`min-h-10 rounded-full border text-sm font-semibold ${kind === key ? "border-ink bg-ink text-paper" : "border-line text-ink/70"}`}>{label}</button>)}
      </div>
      <div className="mt-3 space-y-3">
        <label className="block"><span className="text-sm font-semibold text-ink">O quê</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={input} /></label>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <label className="block"><span className="text-sm font-semibold text-ink">Dia</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={input} /></label>
          <label className="block"><span className="text-sm font-semibold text-ink">{kind === "event" ? "Início" : "Hora"}</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`${input} w-[6.5rem]`} /></label>
          {kind === "event" ? <label className="block"><span className="text-sm font-semibold text-ink">Fim</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={`${input} w-[6.5rem]`} /></label> : null}
        </div>
        {kind === "task" ? (
          <div><span className="text-sm font-semibold text-ink">Importância</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">{([[1, "Leve"], [2, "Normal"], [3, "Muito importante"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPriority(value)} className={`min-h-9 rounded-full border text-xs font-semibold ${priority === value ? "border-ink bg-ink text-paper" : "border-line text-ink/70"}`}>{label}</button>)}</div>
          </div>
        ) : <label className="block"><span className="text-sm font-semibold text-ink">Onde <span className="font-normal text-ink/50">(opcional)</span></span><input value={location} onChange={(event) => setLocation(event.target.value)} className={input} /></label>}
        <label className="block"><span className="text-sm font-semibold text-ink">Repetir</span>
          <select value={repeat} onChange={(event) => setRepeat(event.target.value as typeof repeat)} className={input}><option value="">Não repete</option><option value="daily">Todo dia</option><option value="weekly">Toda semana</option><option value="monthly">Todo mês</option></select>
        </label>
        <label className="block"><span className="text-sm font-semibold text-ink">Detalhes <span className="font-normal text-ink/50">(opcional)</span></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-moss" /></label>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" disabled={!title.trim()} onClick={save} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-40">Salvar</button>
    </Sheet>
  );
}

/** A task: done, tomorrow, another day or hour, importance, details, delete. */
export function TaskSheet({ task, today, onClose }: { task: AgendaTask; today: string; onClose: () => void }) {
  const { send, error } = useAgenda();
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [time, setTime] = useState(task.time ?? "");
  const [priority, setPriority] = useState<number>(task.priority);
  const [description, setDescription] = useState(task.description);
  const run = async (body: Record<string, unknown>) => { if (await send(`/api/tasks/${task.id}`, "PATCH", body)) onClose(); };
  return (
    <Sheet title="Tarefa" onClose={onClose}>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => run({ completed: !task.done })} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold ${task.done ? "border border-line text-ink" : "bg-moss text-white"}`}><Check className="h-4 w-4" aria-hidden="true" />{task.done ? "Reabrir" : "Concluir"}</button>
        <button type="button" onClick={() => run({ dueDate: addDay(task.date < today ? today : task.date, 1) })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold text-ink"><CalendarClock className="h-4 w-4" aria-hidden="true" /> Para amanhã</button>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block"><span className="text-sm font-semibold text-ink">O quê</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={input} /></label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block"><span className="text-sm font-semibold text-ink">Dia</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={input} /></label>
          <label className="block"><span className="text-sm font-semibold text-ink">Hora</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`${input} w-[6.5rem]`} /></label>
        </div>
        <div className="grid grid-cols-3 gap-1.5">{([[1, "Leve"], [2, "Normal"], [3, "Muito importante"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPriority(value)} className={`min-h-9 rounded-full border text-xs font-semibold ${priority === value ? "border-ink bg-ink text-paper" : "border-line text-ink/70"}`}>{label}</button>)}</div>
        <label className="block"><span className="text-sm font-semibold text-ink">Detalhes</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-moss" /></label>
        {task.recurring ? <p className="flex items-center gap-1.5 text-xs text-ink/55"><Repeat2 className="h-3.5 w-3.5" aria-hidden="true" /> Tarefa que se repete: a mudança vale só para esta vez.</p> : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" disabled={!title.trim()} onClick={() => run({ title, dueDate: date, dueTime: time || null, priority, description })} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-40">Salvar</button>
      <button type="button" onClick={async () => { if (window.confirm(`Excluir “${task.title}”?`) && await send(`/api/tasks/${task.id}`, "DELETE")) onClose(); }} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir</button>
    </Sheet>
  );
}

export function EventSheet({ event, onClose }: { event: AgendaEvent; onClose: () => void }) {
  const { send, error } = useAgenda();
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time);
  const [endTime, setEndTime] = useState(event.endTime);
  const [location, setLocation] = useState(event.location);
  const [description, setDescription] = useState(event.description);
  return (
    <Sheet title="Compromisso" onClose={onClose}>
      <div className="mt-3 space-y-3">
        <label className="block"><span className="text-sm font-semibold text-ink">O quê</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={input} /></label>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <label className="block"><span className="text-sm font-semibold text-ink">Dia</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={input} /></label>
          <label className="block"><span className="text-sm font-semibold text-ink">Início</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`${input} w-[6.5rem]`} /></label>
          <label className="block"><span className="text-sm font-semibold text-ink">Fim</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={`${input} w-[6.5rem]`} /></label>
        </div>
        <label className="block"><span className="text-sm font-semibold text-ink">Onde</span><input value={location} onChange={(event) => setLocation(event.target.value)} className={input} /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">Detalhes</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-moss" /></label>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      <button type="button" disabled={!title.trim()} onClick={async () => { if (await send(`/api/tasks/${event.id}`, "PATCH", { kind: "event", title, startsAt: `${date}T${time || "09:00"}`, endsAt: endTime ? `${date}T${endTime}` : undefined, location, description })) onClose(); }} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-40">Salvar</button>
      <button type="button" onClick={async () => { if (window.confirm(`Excluir “${event.title}”?`) && await send(`/api/tasks/${event.id}?kind=event`, "DELETE")) onClose(); }} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir</button>
    </Sheet>
  );
}

export function PriorityFlag({ priority }: { priority: number }) {
  return priority >= 3 ? <Flag className="h-3.5 w-3.5 shrink-0 text-red-600" fill="currentColor" aria-label="muito importante" /> : null;
}
