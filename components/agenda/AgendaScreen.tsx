"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { addDay, EventSheet, longDate, NewItemSheet, PriorityFlag, QuickAdd, shortDate, TaskSheet, useAgenda } from "@/components/agenda/sheets";
import type { AgendaEvent, AgendaTask, getAgendaDay, getAgendaWeek, getShopping } from "@/lib/db/agenda";

type Day = Awaited<ReturnType<typeof getAgendaDay>>;
type Week = Awaited<ReturnType<typeof getAgendaWeek>>;
type Shopping = Awaited<ReturnType<typeof getShopping>>;
export type AgendaView = "dia" | "semana" | "compras";
type Draft = { title: string; date: string; time: string; kind: "task" | "event" };

const WEEKDAY = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const href = (view: AgendaView, date: string) => `/tarefas?ver=${view}&data=${date}`;

export function AgendaScreen({ view, date, today, day, week, shopping }: { view: AgendaView; date: string; today: string; day: Day | null; week: Week | null; shopping: Shopping | null }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [task, setTask] = useState<AgendaTask | null>(null);
  const [event, setEvent] = useState<AgendaEvent | null>(null);
  return (
    <AppShell showDailyTonic={false}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight text-ink">Agenda</h1><p className="mt-0.5 truncate text-sm first-letter:uppercase text-ink/55">{view === "compras" ? "Coisas para comprar" : view === "semana" && week ? `Semana de ${shortDate(week.start)} a ${shortDate(addDay(week.start, 6))}` : longDate(date)}</p></div>
        {view !== "compras" ? <button type="button" aria-label="Nova tarefa ou compromisso" onClick={() => setDraft({ title: "", date, time: "", kind: "task" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-paper"><Plus className="h-5 w-5" /></button> : null}
      </div>
      <nav className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-[#e9e3d6] p-1" aria-label="Visão">
        {([["dia", "Dia"], ["semana", "Semana"], ["compras", "Compras"]] as const).map(([key, label]) => <Link key={key} prefetch={false} href={href(key, date)} className={`rounded-full py-2 text-center text-sm font-semibold ${view === key ? "bg-ink text-paper" : "text-ink/65"}`}>{label}</Link>)}
      </nav>

      {view === "dia" && day ? <DayView day={day} onTask={setTask} onEvent={setEvent} onMore={setDraft} /> : null}
      {view === "semana" && week ? <WeekView week={week} today={today} date={date} onTask={setTask} onEvent={setEvent} /> : null}
      {view === "compras" && shopping ? <ShoppingView items={shopping} /> : null}

      {draft ? <NewItemSheet draft={draft} onClose={() => setDraft(null)} /> : null}
      {task ? <TaskSheet task={task} today={today} onClose={() => setTask(null)} /> : null}
      {event ? <EventSheet event={event} onClose={() => setEvent(null)} /> : null}
    </AppShell>
  );
}

function minutesNow() {
  const [hour, minute] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).split(":").map(Number);
  return hour * 60 + minute;
}
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

function DayView({ day, onTask, onEvent, onMore }: { day: Day; onTask: (task: AgendaTask) => void; onEvent: (event: AgendaEvent) => void; onMore: (draft: Draft) => void }) {
  const { send, error } = useAgenda();
  const isToday = day.date === day.today;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!isToday) return;
    const tick = () => setNow(minutesNow());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [isToday]);

  const untimed = day.tasks.filter((task) => !task.time);
  const timed = [
    ...day.events.map((event) => ({ key: `e${event.id}`, time: event.time || "00:00", kind: "event" as const, event })),
    ...day.tasks.filter((task) => task.time).map((task) => ({ key: `t${task.id}`, time: task.time!, kind: "task" as const, task })),
    ...day.habits.map((habit) => ({ key: `h${habit.id}`, time: habit.time, kind: "habit" as const, habit })),
  ].sort((a, b) => a.time.localeCompare(b.time) || (a.kind === "habit" ? 1 : -1));
  const firstHour = Math.min(6, ...timed.map((item) => Number(item.time.slice(0, 2))));
  const hours = Array.from({ length: 24 - firstHour }, (_, index) => firstHour + index);

  return (
    <>
      <div className="mt-3 flex items-center gap-1">
        <Link prefetch={false} href={href("dia", addDay(day.date, -1))} aria-label="Dia anterior" className="grid h-9 w-8 shrink-0 place-items-center text-ink/50"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="grid flex-1 grid-cols-7 gap-0.5">
          {day.week.map((item) => {
            const selected = item.date === day.date;
            return (
              <Link prefetch={false} key={item.date} href={href("dia", item.date)} className={`rounded-xl py-1.5 text-center ${selected ? "bg-ink text-paper" : item.date === day.today ? "bg-white text-ink" : "text-ink"}`}>
                <span className={`block text-[10px] font-semibold ${selected ? "text-paper/70" : "text-ink/45"}`}>{WEEKDAY[new Date(`${item.date}T12:00:00Z`).getUTCDay()]}</span>
                <span className="block text-base font-semibold">{Number(item.date.slice(8, 10))}</span>
                <span className="flex h-1.5 justify-center gap-0.5">{Array.from({ length: Math.min(3, item.count) }, (_, index) => <i key={index} className={`h-1 w-1 rounded-full ${selected ? "bg-paper/80" : "bg-clay"}`} />)}</span>
              </Link>
            );
          })}
        </div>
        <Link prefetch={false} href={href("dia", addDay(day.date, 1))} aria-label="Próximo dia" className="grid h-9 w-8 shrink-0 place-items-center text-ink/50"><ChevronRight className="h-5 w-5" /></Link>
      </div>
      {!isToday ? <Link prefetch={false} href={href("dia", day.today)} className="mt-1 block text-center text-xs font-semibold text-moss">Voltar para hoje</Link> : null}

      <QuickAdd defaultDate={day.date} today={day.today} onMore={onMore} />

      {day.late.length ? (
        <>
          <div className="mt-4 flex items-baseline justify-between px-1"><h2 className="text-xs font-bold uppercase tracking-wider text-clay">Atrasadas · {day.late.length}</h2><button type="button" onClick={() => { if (window.confirm("Trazer as atrasadas para hoje? As que se repetem ficam como não feitas nos dias que passaram — a próxima continua no dia dela.")) void send("/api/agenda", "POST", { action: "remarcarAtrasadas" }); }} className="text-[11px] font-semibold text-ink/55 underline">trazer todas para hoje</button></div>
          <div role="list" className="mt-1.5 overflow-hidden rounded-2xl border border-clay/25 bg-white shadow-soft">{day.late.map((task) => <TaskRow key={task.id} task={task} onOpen={() => onTask(task)} note={`desde ${shortDate(task.date)}`} late />)}</div>
        </>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}

      <h2 className="mt-4 px-1 text-xs font-bold uppercase tracking-wider text-moss">{untimed.length ? `Tarefas do dia · ${untimed.length}` : "Tarefas do dia"}</h2>
      {untimed.length ? <div role="list" className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">{untimed.map((task) => <TaskRow key={task.id} task={task} onOpen={() => onTask(task)} />)}</div>
        : <p className="mt-1 px-1 text-sm text-ink/45">Nenhuma tarefa sem horário.</p>}

      <h2 className="mt-5 px-1 text-xs font-bold uppercase tracking-wider text-moss">Agenda do dia</h2>
      <div className="mt-1.5 rounded-2xl border border-line bg-white px-2 py-1 shadow-soft">
        {hours.map((hour) => {
          const items = timed.filter((item) => Number(item.time.slice(0, 2)) === hour);
          const showNow = now !== null && Math.floor(now / 60) === hour;
          const before = showNow ? items.filter((item) => toMinutes(item.time) <= now!) : items;
          const after = showNow ? items.filter((item) => toMinutes(item.time) > now!) : [];
          return (
            <div key={hour} className="grid grid-cols-[2.6rem_1fr] border-t border-line/60 first:border-t-0">
              <span className="pt-1.5 text-[11px] font-semibold tabular-nums text-ink/40">{String(hour).padStart(2, "0")}:00</span>
              <div className="min-h-[2.1rem] py-1">
                {before.map((item) => <TimelineItem key={item.key} item={item} onTask={onTask} onEvent={onEvent} />)}
                {showNow ? <div className="my-0.5 flex items-center gap-1.5 text-[10px] font-bold text-clay"><span>AGORA</span><i className="h-[2px] flex-1 rounded bg-clay" /></div> : null}
                {after.map((item) => <TimelineItem key={item.key} item={item} onTask={onTask} onEvent={onEvent} />)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

type TimelineEntry = { key: string; time: string } & ({ kind: "event"; event: AgendaEvent } | { kind: "task"; task: AgendaTask } | { kind: "habit"; habit: { title: string; time: string; done: boolean | null } });

function TimelineItem({ item, onTask, onEvent }: { item: TimelineEntry; onTask: (task: AgendaTask) => void; onEvent: (event: AgendaEvent) => void }) {
  if (item.kind === "habit") {
    // Done in green, still open (today or before) in red, future days neutral.
    const tone = item.habit.done === true ? "text-emerald-700" : item.habit.done === false ? "text-red-600/80" : "text-ink/40";
    return <p className={`flex items-center gap-1.5 py-0.5 text-[11px] ${tone}`}><i className="h-px w-3 bg-current opacity-50" />{item.time} · {item.habit.title}{item.habit.done ? " ✓" : ""}</p>;
  }
  if (item.kind === "event") {
    const { event } = item;
    return (
      <button type="button" onClick={() => onEvent(event)} className="my-0.5 block w-full rounded-lg border-l-[3px] border-[#5b8fcc] bg-[#eef4fb] px-2.5 py-1.5 text-left">
        <span className="block text-sm font-semibold text-ink">{event.title}</span>
        <span className="flex items-center gap-1 text-[11px] text-ink/55">{event.time}{event.endTime ? `–${event.endTime}` : ""}{event.location ? <><MapPin className="ml-1 h-3 w-3" aria-hidden="true" />{event.location}</> : null}</span>
      </button>
    );
  }
  return <div className="my-0.5 rounded-lg border border-line"><TaskRow task={item.task} onOpen={() => onTask(item.task)} note={item.task.time ?? undefined} compact /></div>;
}

/** A task line: tap the circle to finish, tap the text to open. */
function TaskRow({ task, onOpen, note, late, compact }: { task: AgendaTask; onOpen: () => void; note?: string; late?: boolean; compact?: boolean }) {
  const { send } = useAgenda();
  const [done, setDone] = useState(task.done);
  return (
    <div role="listitem" className={`flex items-center gap-3 border-t border-line/70 first:border-t-0 ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}>
      <button type="button" aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`} onClick={async () => { setDone(!done); if (!(await send(`/api/tasks/${task.id}`, "PATCH", { completed: !done }))) setDone(done); }}
        className={`grid shrink-0 place-items-center rounded-full border-2 ${compact ? "h-5 w-5" : "h-6 w-6"} ${done ? "border-moss bg-moss" : task.priority >= 3 ? "border-red-500" : "border-[#cfc8b9]"}`}>{done ? <span className="text-[10px] text-white">✓</span> : null}</button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={`flex items-center gap-1.5 text-[15px] font-semibold leading-5 ${done ? "text-ink/40 line-through" : "text-ink"} ${compact ? "text-sm" : ""}`}>{task.title}<PriorityFlag priority={task.priority} /></span>
        {note || task.recurring || task.origin !== "MANUAL" ? (
          <span className={`mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] ${late ? "text-clay" : "text-ink/50"}`}>
            {note ? <span>{note}</span> : null}
            {task.recurring ? <span className="inline-flex items-center gap-0.5"><Repeat2 className="h-3 w-3" aria-hidden="true" />repete</span> : null}
            {task.origin === "REFLECTION" ? <span>da reflexão</span> : task.origin === "DIARY" ? <span>do diário</span> : null}
          </span>
        ) : null}
      </button>
      <button type="button" onClick={onOpen} aria-label={`Editar ${task.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink/35"><Pencil className="h-4 w-4" /></button>
    </div>
  );
}

function WeekView({ week, today, date, onTask, onEvent }: { week: Week; today: string; date: string; onTask: (task: AgendaTask) => void; onEvent: (event: AgendaEvent) => void }) {
  return (
    <>
      <div className="mt-3 flex items-center justify-between">
        <Link prefetch={false} href={href("semana", addDay(week.start, -7))} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink/60"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> anterior</Link>
        {week.start !== addDay(today, -new Date(`${today}T12:00:00Z`).getUTCDay()) ? <Link prefetch={false} href={href("semana", today)} className="text-xs font-semibold text-moss">esta semana</Link> : null}
        <Link prefetch={false} href={href("semana", addDay(week.start, 7))} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-ink/60">próxima <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
      <div className="mt-1 space-y-2.5">
        {week.days.map((day) => {
          const items = [
            ...day.events.map((event) => ({ key: `e${event.id}`, time: event.time, node: <button type="button" onClick={() => onEvent(event)} className="flex w-full items-center gap-2 py-1.5 text-left"><span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-[#5b8fcc]">{event.time}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{event.title}</span></button> })),
            ...day.tasks.map((task) => ({ key: `t${task.id}`, time: task.time ?? "99", node: <button type="button" onClick={() => onTask(task)} className="flex w-full items-center gap-2 py-1.5 text-left"><span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-ink/40">{task.time ?? "—"}</span><span className={`min-w-0 flex-1 truncate text-sm ${task.done ? "text-ink/35 line-through" : "text-ink"}`}>{task.title}</span><PriorityFlag priority={task.priority} /></button> })),
          ].sort((a, b) => a.time.localeCompare(b.time));
          const isToday = day.date === today;
          return (
            <section key={day.date} className={`rounded-2xl border bg-white px-3 py-2 shadow-soft ${isToday ? "border-ink/40" : day.date === date ? "border-moss/40" : "border-line"}`}>
              <Link prefetch={false} href={href("dia", day.date)} className="flex items-baseline justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-clay" : "text-moss"}`}>{shortDate(day.date)}{isToday ? " · hoje" : ""}</span>
                <span className="text-[11px] text-ink/40">{items.length ? `${items.length}` : ""} ›</span>
              </Link>
              {items.length ? <div className="mt-1 divide-y divide-line/60">{items.map((item) => <div key={item.key}>{item.node}</div>)}</div> : <p className="py-1 text-xs text-ink/35">livre</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Things to buy: for the house, online… A line each, tick when bought. */
function ShoppingView({ items }: { items: Shopping }) {
  const { send, error } = useAgenda();
  const [title, setTitle] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const open = items.filter((item) => !(checked[item.id] ?? item.checked));
  const bought = items.filter((item) => checked[item.id] ?? item.checked);
  async function add() { if (title.trim() && await send("/api/shopping", "POST", { title })) setTitle(""); }
  async function toggle(id: string, value: boolean) { setChecked((state) => ({ ...state, [id]: value })); if (!(await send(`/api/shopping/${id}`, "PATCH", { checked: value }))) setChecked((state) => ({ ...state, [id]: !value })); }
  return (
    <>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-white px-3 shadow-soft">
        <Plus className="h-5 w-5 shrink-0 text-moss" aria-hidden="true" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} placeholder="Ex.: veda-rosca, lâmpada, capinha do celular" className="min-h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none" aria-label="Adicionar item" />
        {title.trim() ? <button type="button" onClick={add} className="min-h-9 shrink-0 rounded-lg bg-ink px-3 text-sm font-semibold text-paper">Adicionar</button> : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
      {open.length ? (
        <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {open.map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-t border-line/70 px-3 py-3 first:border-t-0">
              <button type="button" aria-label={`Comprei ${item.title}`} onClick={() => toggle(item.id, true)} className="h-6 w-6 shrink-0 rounded-md border-2 border-[#cfc8b9]" />
              <span className="min-w-0 flex-1 text-[15px] text-ink">{item.title}</span>
              <button type="button" aria-label={`Excluir ${item.title}`} onClick={() => void send(`/api/shopping/${item.id}`, "DELETE")} className="p-1 text-ink/30"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 px-1 text-sm text-ink/45">Nada para comprar.</p>}
      {bought.length ? (
        <>
          <div className="mt-4 flex items-baseline justify-between px-1"><h2 className="text-xs font-bold uppercase tracking-wider text-ink/45">Comprados · {bought.length}</h2><button type="button" onClick={() => void send("/api/agenda", "POST", { action: "limparComprados" })} className="text-[11px] font-semibold text-ink/55 underline">limpar</button></div>
          <ul className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white/60">
            {bought.map((item) => (
              <li key={item.id} className="flex items-center gap-3 border-t border-line/60 px-3 py-2.5 first:border-t-0">
                <button type="button" aria-label={`Desmarcar ${item.title}`} onClick={() => toggle(item.id, false)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-moss text-xs text-white">✓</button>
                <span className="min-w-0 flex-1 text-sm text-ink/40 line-through">{item.title}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
