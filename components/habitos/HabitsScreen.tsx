"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Check, Clock3, Flame, Minus, Pencil, Play, Plus, Settings2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Sheet } from "@/components/app/Sheet";
import { HabitConfigModal } from "@/components/habitos/HabitConfigModal";
import type { DayPeriod, DbHabit, HabitDashboard } from "@/lib/db/sendero";
import { DEFAULT_ML_PER_KG, FLAME_TIERS, flameTier, waterGoal } from "@/lib/habit-streak";
import { practiceHref } from "@/lib/practice";

type Props = { dashboard: HabitDashboard | null };
type Group = DbHabit["practiceGroup"];
type Filter = "TODOS" | Group;

const GROUPS: Record<Group, { label: string; short: string; dot: string; chip: string }> = {
  ED: { label: "Práticas da ED", short: "ED", dot: "bg-red-600", chip: "bg-red-50 text-red-800" },
  PSYCHOLOGY: { label: "Exercícios de psicologia", short: "Psico", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-900" },
  HABIT: { label: "Hábitos gerais", short: "Gerais", dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800" },
};
const FILTERS: Array<{ key: Filter; label: string }> = [{ key: "TODOS", label: "Hoje" }, { key: "ED", label: "ED" }, { key: "PSYCHOLOGY", label: "Psicologia" }, { key: "HABIT", label: "Gerais" }];
const PERIODS: Array<{ key: DayPeriod | "DIA"; label: string; hint: string; endsAt: number | null }> = [
  { key: "MANHA", label: "Manhã", hint: "até 12h", endsAt: 12 * 60 },
  { key: "TARDE", label: "Tarde", hint: "12h – 18h", endsAt: 18 * 60 },
  { key: "NOITE", label: "Noite", hint: "depois das 18h", endsAt: null },
  { key: "DIA", label: "Ao longo do dia", hint: "sem hora marcada", endsAt: null },
];
const GLASS_ML = 250;

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const periodOf = (habit: DbHabit): DayPeriod | "DIA" => habit.scheduledTime
  ? (toMinutes(habit.scheduledTime) < 12 * 60 ? "MANHA" : toMinutes(habit.scheduledTime) < 18 * 60 ? "TARDE" : "NOITE")
  : habit.dayPeriod ?? "DIA";
const isDone = (habit: DbHabit) => habit.cadence === "WEEKLY" ? habit.todayCount > 0 || habit.progress >= habit.targetCount : habit.progress >= habit.targetCount;
const clockOf = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Minutes since midnight in São Paulo, refreshed every minute; null while rendering on the server.
function subscribeMinute(callback: () => void) { const timer = window.setInterval(callback, 30_000); return () => window.clearInterval(timer); }
function readMinute() {
  const [hour, minute] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).split(":").map(Number);
  return hour * 60 + minute;
}

/** A daily habit is late once its hour (or the end of its period) has passed without being done. */
function isLate(habit: DbHabit, now: number | null) {
  if (now === null || habit.cadence !== "DAILY" || isDone(habit)) return false;
  if (habit.scheduledTime) return now > toMinutes(habit.scheduledTime);
  const end = PERIODS.find((period) => period.key === periodOf(habit))?.endsAt;
  return end != null && now >= end;
}

export function HabitsScreen({ dashboard }: Props) {
  const router = useRouter();
  const [data, setData] = useState(dashboard);
  const [filter, setFilter] = useState<Filter>("TODOS");
  const [openId, setOpenId] = useState<string | null>(null);
  const [waterOpen, setWaterOpen] = useState(false);
  const [waterSettingsOpen, setWaterSettingsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<DbHabit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useSyncExternalStore(subscribeMinute, readMinute, () => null);
  // Saves for the same habit go out one after another, so the last tap always wins;
  // the screen reloads from the server only once the last pending save is done.
  const queues = useRef(new Map<string, { tail: Promise<void>; pending: number }>());
  // New server data (after router.refresh) replaces the optimistic copy.
  const [serverDashboard, setServerDashboard] = useState(dashboard);
  if (dashboard !== serverDashboard) {
    setServerDashboard(dashboard);
    setData(dashboard);
  }

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error("Não foi possível salvar a alteração.");
  }

  async function saveProgress(habit: DbHabit, progress: number, note = habit.note) {
    if (!data) return;
    const next = Math.max(0, progress);
    const countForToday = habit.cadence === "WEEKLY" ? Math.max(0, next - (habit.progress - habit.todayCount)) : next;
    // Time-based habits show the week, but each day stores its own minutes.
    const minutesForToday = habit.cadence === "TIME_BASED" ? Math.max(0, next - (habit.progress - habit.todayMinutes)) : 0;
    setData((current) => current ? { ...current, habits: current.habits.map((item) => item.id === habit.id ? { ...item, progress: next, todayCount: habit.cadence === "TIME_BASED" ? item.todayCount : countForToday, todayMinutes: minutesForToday, note, doneAt: item.doneAt ?? new Date().toISOString() } : item) } : current);
    setError(null);
    const payload = { habitId: habit.id, dateKey: data.dateKey, count: habit.cadence === "TIME_BASED" ? 0 : countForToday, minutes: minutesForToday, note };
    const queue = queues.current.get(habit.id) ?? { tail: Promise.resolve(), pending: 0 };
    const save = queue.tail.then(() => request("/api/habits/progress", "POST", payload));
    queue.tail = save.catch(() => undefined);
    queue.pending += 1;
    queues.current.set(habit.id, queue);
    try {
      await save;
    } catch {
      setError(`Não foi possível salvar “${habit.title}”. Verifique a conexão e tente de novo.`);
    } finally {
      queue.pending -= 1;
      if ([...queues.current.values()].every((item) => item.pending === 0)) router.refresh();
    }
  }

  /** The round button: done/undone, one more for counted habits, or the sheet for timed ones. */
  function tap(habit: DbHabit) {
    if (habit.cadence === "TIME_BASED") { setOpenId(habit.id); return; }
    if (habit.cadence === "WEEKLY") { void saveProgress(habit, habit.todayCount > 0 ? Math.max(0, habit.progress - habit.todayCount) : habit.progress + 1); return; }
    if (habit.targetCount > 1) { void saveProgress(habit, habit.progress >= habit.targetCount ? 0 : habit.progress + 1); return; }
    void saveProgress(habit, isDone(habit) ? 0 : 1);
  }

  async function addWater(amount: number) {
    if (!data || !amount) return;
    setData({ ...data, waterMl: Math.max(0, data.waterMl + amount) });
    try { await request("/api/habits/water", "POST", { amountMl: amount, dateKey: data.dateKey }); }
    catch { setError("Não foi possível registrar a água."); }
    finally { router.refresh(); }
  }

  async function deleteHabit(habit: DbHabit) {
    if (!window.confirm(`Excluir “${habit.title}”? Os registros já feitos serão preservados no histórico.`)) return;
    setOpenId(null);
    setData((current) => current ? { ...current, habits: current.habits.filter((item) => item.id !== habit.id) } : current);
    try { await request(`/api/habits/template/${habit.id}`, "DELETE"); } finally { router.refresh(); }
  }

  if (!data) return <AppShell><p className="py-10 text-sm text-slate-500">Preparando seus hábitos…</p></AppShell>;

  const daily = data.habits.filter((habit) => habit.cadence === "DAILY");
  const doneToday = daily.filter(isDone).length;
  const late = daily.filter((habit) => isLate(habit, now)).length;
  const visible = data.habits.filter((habit) => filter === "TODOS" || habit.practiceGroup === filter);
  const openHabit = data.habits.find((habit) => habit.id === openId) ?? null;
  const sections = PERIODS.map((period) => ({
    ...period,
    habits: visible.filter((habit) => habit.cadence === "DAILY" && periodOf(habit) === period.key)
      .sort((a, b) => (a.scheduledTime ?? "99").localeCompare(b.scheduledTime ?? "99")),
  })).filter((section) => section.habits.length);
  const week = visible.filter((habit) => habit.cadence !== "DAILY");
  const today = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${data.dateKey}T12:00:00Z`));

  return <AppShell>
    <div className="flex items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight text-ink">Hábitos</h1><p className="mt-0.5 text-sm first-letter:uppercase text-ink/55">{today}</p></div>
      <button type="button" aria-label="Novo hábito" className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-paper" onClick={() => { setEditingHabit(null); setConfigOpen(true); }}><Plus className="h-5 w-5" /></button>
    </div>
    <HabitConfigModal key={configOpen ? editingHabit?.id ?? "novo" : "fechado"} open={configOpen} habit={editingHabit} onClose={() => { setConfigOpen(false); setEditingHabit(null); }} onSaved={() => { setConfigOpen(false); setEditingHabit(null); router.refresh(); }} />
    {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}

    <section className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#46533b ${daily.length ? (doneToday / daily.length) * 360 : 0}deg, #ece6da 0deg)` }}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-bold text-ink">{doneToday}/{daily.length}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Ritmo de hoje</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(Object.keys(GROUPS) as Group[]).map((group) => {
            const pending = data.habits.filter((habit) => habit.practiceGroup === group && habit.cadence === "DAILY" && !isDone(habit)).length;
            return <span key={group} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${GROUPS[group].chip}`}><i className={`h-1.5 w-1.5 rounded-full ${GROUPS[group].dot}`} />{GROUPS[group].short} {pending}</span>;
          })}
          {late ? <span className="whitespace-nowrap rounded-full bg-clay/10 px-2 py-0.5 text-[11px] font-semibold text-clay">{late} atrasado{late > 1 ? "s" : ""}</span> : null}
        </div>
      </div>
    </section>

    <WaterRow waterMl={data.waterMl} goalMl={data.waterGoalMl} onAdd={addWater} onMore={() => setWaterOpen(true)} onSettings={() => setWaterSettingsOpen(true)} />

    <div role="tablist" aria-label="Filtrar" className="mt-4 grid grid-cols-4 gap-1.5">
      {FILTERS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`flex min-h-9 items-center justify-center gap-1 rounded-full border px-1 text-xs font-semibold ${filter === item.key ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/70"}`}>{item.key !== "TODOS" ? <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${GROUPS[item.key].dot}`} /> : null}{item.label}</button>)}
    </div>

    {sections.map((section) => (
      <section key={section.key} className="mt-4">
        <div className="flex items-baseline justify-between px-1"><h2 className="text-xs font-bold uppercase tracking-wider text-moss">{section.label}</h2><span className="text-[11px] text-ink/45">{section.hint}</span></div>
        <ul className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">{section.habits.map((habit) => <HabitRow key={habit.id} habit={habit} late={isLate(habit, now)} onTap={() => tap(habit)} onOpen={() => setOpenId(habit.id)} />)}</ul>
      </section>
    ))}
    {week.length ? (
      <section className="mt-4">
        <div className="flex items-baseline justify-between px-1"><h2 className="text-xs font-bold uppercase tracking-wider text-moss">Esta semana</h2><span className="text-[11px] text-ink/45">metas semanais</span></div>
        <ul className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">{week.map((habit) => <HabitRow key={habit.id} habit={habit} late={false} onTap={() => tap(habit)} onOpen={() => setOpenId(habit.id)} />)}</ul>
      </section>
    ) : null}
    {!sections.length && !week.length ? <p className="mt-6 rounded-2xl border border-dashed border-line p-4 text-center text-sm text-ink/60">Nada cadastrado neste grupo. Use o + para criar.</p> : null}
    <p className="mt-3 text-center text-xs text-ink/45">Toque no nome para ver o contexto, a nota, editar ou excluir.</p>

    {openHabit ? <HabitSheet habit={openHabit} onClose={() => setOpenId(null)} onSave={(progress, note) => saveProgress(openHabit, progress, note)} onEdit={() => { setEditingHabit(openHabit); setOpenId(null); setConfigOpen(true); }} onDelete={() => deleteHabit(openHabit)} /> : null}
    {waterSettingsOpen ? <WaterSettingsSheet settings={data.water} onClose={() => setWaterSettingsOpen(false)} onSaved={() => { setWaterSettingsOpen(false); router.refresh(); }} /> : null}
    {waterOpen ? <WaterSheet waterMl={data.waterMl} onAdd={(amount) => { void addWater(amount); }} onClose={() => setWaterOpen(false)} /> : null}
  </AppShell>;
}

function HabitRow({ habit, late, onTap, onOpen }: { habit: DbHabit; late: boolean; onTap: () => void; onOpen: () => void }) {
  const done = isDone(habit);
  const href = practiceHref(habit.id, habit.practiceTool);
  const counted = habit.cadence === "DAILY" && habit.targetCount > 1;
  const share = Math.min(1, habit.progress / habit.targetCount);
  const when = habit.scheduledTime ?? (habit.dayPeriod ? null : habit.cadence === "DAILY" ? "ao longo do dia" : null);
  return (
    <li className="flex items-center gap-3 border-t border-line/70 px-3 py-2.5 first:border-t-0">
      {habit.cadence === "TIME_BASED" ? (
        <button type="button" onClick={onTap} aria-label={`Registrar tempo: ${habit.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700"><Clock3 className="h-4 w-4" /></button>
      ) : counted && !done ? (
        <button type="button" onClick={onTap} aria-label={`Somar 1: ${habit.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#46533b ${share * 360}deg, #e7e1d5 0deg)` }}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[10px] font-bold text-ink">{habit.progress}/{habit.targetCount}</span>
        </button>
      ) : (
        <button type="button" onClick={onTap} aria-label={`${done ? "Desmarcar" : "Marcar"} ${habit.title}`} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${done ? "border-moss bg-moss text-white" : "border-[#cfc8b9] bg-white text-transparent"}`}><Check className="h-4 w-4" /></button>
      )}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={`text-[15px] font-semibold leading-5 ${done ? "text-ink/45 line-through decoration-ink/30" : "text-ink"}`}>{habit.title}</p>
        {habit.description ? <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-ink/55">{habit.description}</p> : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4 text-ink/50">
          <Recent habit={habit} />
          <i className={`h-1.5 w-1.5 rounded-full ${GROUPS[habit.practiceGroup].dot}`} />
          {habit.cadence === "DAILY" ? (
            <>
              {[
                when || late ? <span key="when" className={late ? "font-semibold text-clay" : ""}>{[when, late ? "atrasado" : null].filter(Boolean).join(" · ")}</span> : null,
                done && habit.doneAt ? <span key="done">feito {clockOf(habit.doneAt)}</span> : counted && !done ? <span key="count">toque para +1</span> : null,
              ].filter(Boolean).flatMap((part, index) => index ? [<span key={`sep${index}`} aria-hidden="true">·</span>, part] : [part])}
              {habit.remind ? <Bell className="h-3 w-3" aria-label="com lembrete" /> : null}
            </>
          ) : habit.cadence === "WEEKLY" ? (
            <span>{habit.progress} de {habit.targetCount} na semana{habit.todayCount ? " · feito hoje" : ""}</span>
          ) : (
            <span>{habit.progress} de {habit.targetCount} min na semana</span>
          )}
        </p>
        {habit.cadence !== "DAILY" ? <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[#ece6da]"><span className="block h-full rounded-full bg-moss" style={{ width: `${share * 100}%` }} /></span> : null}
      </button>
      {href ? <Link prefetch={false} href={href} className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-line px-2.5 text-[11px] font-semibold text-moss"><Play className="h-3 w-3" aria-hidden="true" /> Praticar</Link> : null}
    </li>
  );
}

/** The last 7 days (or weeks) as dots, and the run when it is worth showing. */
function Recent({ habit }: { habit: DbHabit }) {
  const last = habit.history.slice(-7);
  const unit = habit.cadence === "DAILY" ? (habit.streak === 1 ? "dia" : "dias") : (habit.streak === 1 ? "semana" : "semanas");
  return (
    <span className="mr-1 inline-flex items-center gap-1.5">
      <span className="inline-flex gap-[3px]" aria-label={`${last.filter((value) => value === 1).length} de ${last.length} ${habit.cadence === "DAILY" ? "últimos dias" : "últimas semanas"}`}>
        {last.map((value, index) => <i key={index} className={`h-[5px] w-[5px] rounded-full ${value === 1 ? "bg-moss" : value === 0 ? (index === last.length - 1 ? "border border-moss/50" : "bg-[#e3dccd]") : "bg-transparent"}`} />)}
      </span>
      {habit.streak >= (habit.cadence === "DAILY" ? 3 : 2) ? <span className="inline-flex items-center gap-0.5 font-semibold text-ink/70" aria-label={`sequência de ${habit.streak} ${unit}, chama ${flameTier(habit.streak, habit.cadence === "DAILY").name.toLowerCase()}`}><TierFlame streak={habit.streak} daily={habit.cadence === "DAILY"} className="h-3.5 w-3.5" />{habit.streak}</span> : null}
    </span>
  );
}

function WaterRow({ waterMl, goalMl, onAdd, onMore, onSettings }: { waterMl: number; goalMl: number; onAdd: (amount: number) => void; onMore: () => void; onSettings: () => void }) {
  const glasses = Math.max(1, Math.round(goalMl / GLASS_ML));
  const full = Math.min(glasses, Math.floor(waterMl / GLASS_ML));
  return (
    <section className="mt-2.5 flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2"><p className="text-sm font-semibold text-ink">Água <span className="font-normal text-ink/60">{(waterMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} de {(goalMl / 1000).toLocaleString("pt-BR")} L</span></p><span className="flex items-center gap-2"><button type="button" onClick={onMore} className="text-[11px] font-semibold text-blue-700">outro volume</button><button type="button" onClick={onSettings} aria-label="Ajustar a meta de água" className="grid h-6 w-6 place-items-center rounded-md text-ink/45"><Settings2 className="h-3.5 w-3.5" /></button></span></div>
        <div className="mt-1.5 flex gap-1" aria-label={`${full} de ${glasses} copos`}>
          {Array.from({ length: glasses }, (_, index) => (
            <button key={index} type="button" onClick={() => onAdd(GLASS_ML)} aria-label="Mais um copo de 250 ml" className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-b-md border-[1.5px] border-t-0 border-blue-300">
              {index < full ? <span className="absolute inset-x-0 bottom-0 h-[80%] bg-blue-400" /> : null}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => onAdd(GLASS_ML)} aria-label="Mais um copo de 250 ml" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500 text-white"><Plus className="h-5 w-5" /></button>
    </section>
  );
}

function HabitSheet({ habit, onClose, onSave, onEdit, onDelete }: { habit: DbHabit; onClose: () => void; onSave: (progress: number, note: string) => Promise<void>; onEdit: () => void; onDelete: () => void }) {
  const [note, setNote] = useState(habit.note);
  const [custom, setCustom] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const href = practiceHref(habit.id, habit.practiceTool);
  const schedule = [habit.scheduledTime, habit.dayPeriod ? PERIODS.find((period) => period.key === habit.dayPeriod)?.label : null].filter(Boolean).join(" · ");
  return (
    <Sheet title={habit.title} onClose={onClose}>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/55"><i className={`h-1.5 w-1.5 rounded-full ${GROUPS[habit.practiceGroup].dot}`} />{GROUPS[habit.practiceGroup].label}{schedule ? ` · ${schedule}` : ""}{habit.remind ? " · avisa no celular" : ""}</p>
      {habit.description ? <p className="mt-3 rounded-lg bg-paper p-3 text-sm leading-6 text-ink/80">{habit.description}</p> : null}
      <History habit={habit} />

      {habit.cadence === "TIME_BASED" ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink">{habit.progress} de {habit.targetCount} min nesta semana</p>
          <div className="mt-2 grid grid-cols-4 gap-2">{[15, 30, 45, 60].map((value) => <button key={value} type="button" className="min-h-10 rounded-xl bg-violet-50 text-sm font-bold text-violet-700" onClick={() => onSave(habit.progress + value, note)}>+{value}</button>)}</div>
          <div className="mt-2 grid grid-cols-[1fr_44px] gap-2"><input className="min-h-10 min-w-0 rounded-xl border border-line px-3 text-sm" inputMode="numeric" placeholder="Outros minutos" value={custom} onChange={(event) => setCustom(event.target.value)} /><button type="button" aria-label="Somar minutos" className="grid place-items-center rounded-xl bg-ink text-paper" onClick={() => { const value = Number(custom); if (value > 0) { void onSave(habit.progress + value, note); setCustom(""); } }}><Plus className="h-4 w-4" /></button></div>
        </div>
      ) : habit.targetCount > 1 ? (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" aria-label="Menos um" className="grid h-10 w-10 place-items-center rounded-full bg-paper text-ink" onClick={() => onSave(habit.progress - 1, note)}><Minus className="h-4 w-4" /></button>
          <span className="min-w-16 text-center text-base font-bold text-ink">{habit.progress}/{habit.targetCount}</span>
          <button type="button" aria-label="Mais um" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper" onClick={() => onSave(habit.progress + 1, note)}><Plus className="h-4 w-4" /></button>
          <span className="text-xs text-ink/55">{habit.cadence === "WEEKLY" ? "nesta semana" : "hoje"}</span>
        </div>
      ) : null}

      <label className="mt-4 block"><span className="text-sm font-semibold text-ink">Nota de hoje <span className="font-normal text-ink/50">(opcional)</span></span>
        <textarea value={note} onChange={(event) => { setNote(event.target.value); setNoteSaved(false); }} rows={3} placeholder="O que você percebeu…" className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus:border-moss" />
      </label>
      <button type="button" disabled={note === habit.note && !noteSaved} onClick={async () => { await onSave(habit.progress, note); setNoteSaved(true); }} className="mt-1 text-sm font-semibold text-moss disabled:text-ink/35">{noteSaved && note === habit.note ? "Nota salva" : "Salvar nota"}</button>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {href ? <Link prefetch={false} href={href} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-paper"><Play className="h-4 w-4" aria-hidden="true" /> Praticar</Link> : null}
        <button type="button" onClick={onEdit} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-ink"><Pencil className="h-4 w-4" aria-hidden="true" /> Editar</button>
        <button type="button" onClick={onDelete} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir</button>
      </div>
    </Sheet>
  );
}

/** The flame in the colour of the run's tier. */
function TierFlame({ streak, daily, className }: { streak: number; daily: boolean; className: string }) {
  const tier = flameTier(streak, daily);
  return <Flame className={className} fill={tier.fill} stroke={tier.stroke} strokeWidth={1.6} aria-hidden="true" />;
}

/** Where the run is on the colour ladder, and what comes next. */
function FlameLadder({ streak, daily }: { streak: number; daily: boolean }) {
  const tier = flameTier(streak, daily);
  const unit = (count: number) => (daily ? (count === 1 ? "dia" : "dias") : (count === 1 ? "semana" : "semanas"));
  return (
    <div className="mt-3 rounded-xl border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        {FLAME_TIERS.map((item, index) => <Flame key={item.name} className={`h-4 w-4 ${index > tier.index ? "opacity-25" : ""}`} fill={item.fill} stroke={item.stroke} strokeWidth={1.6} aria-label={item.name} />)}
      </div>
      <p className="mt-1.5 text-center text-xs text-ink/65">{streak ? <>Chama <strong>{tier.name.toLowerCase()}</strong></> : "Comece a sequência hoje"}{tier.next ? ` · ${tier.next.name.toLowerCase()} em ${tier.next.left} ${unit(tier.next.left)}` : " · o topo"}</p>
    </div>
  );
}

/** The run, the record and the last 3 months (or 13 weeks) in squares. */
function History({ habit }: { habit: DbHabit }) {
  const daily = habit.cadence === "DAILY";
  const unit = (count: number) => (daily ? (count === 1 ? "dia" : "dias") : (count === 1 ? "semana" : "semanas"));
  const rows = daily ? 7 : 1;
  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-paper p-2"><p className="flex items-center justify-center gap-1 text-lg font-semibold text-ink"><TierFlame streak={habit.streak} daily={daily} className="h-5 w-5" />{habit.streak}</p><p className="text-[11px] text-ink/55">{unit(habit.streak)} seguidos</p></div>
        <div className="rounded-xl bg-paper p-2"><p className="text-lg font-semibold text-ink">{habit.bestStreak}</p><p className="text-[11px] text-ink/55">recorde ({unit(habit.bestStreak)})</p></div>
        <div className="rounded-xl bg-paper p-2"><p className="text-lg font-semibold text-ink">{habit.monthRate ?? Math.round((habit.history.filter((value) => value === 1).length / Math.max(1, habit.history.filter((value) => value !== null).length)) * 100)}%</p><p className="text-[11px] text-ink/55">{daily ? "deste mês" : "das 13 semanas"}</p></div>
      </div>
      <FlameLadder streak={habit.streak} daily={daily} />
      <div className="mt-3 grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }} aria-label={daily ? "Últimos 3 meses" : "Últimas 13 semanas"}>
        {habit.history.map((value, index) => <i key={index} className={`aspect-square rounded-[3px] ${value === 1 ? "bg-moss" : value === 0 ? "bg-[#ebe5d8]" : "bg-transparent"}`} />)}
      </div>
      <p className="mt-1.5 text-[11px] text-ink/45">{daily ? "Últimos 3 meses, um quadrado por dia (hoje no fim)." : "Últimas 13 semanas."} Uma falha isolada não quebra a sequência; duas seguidas, sim.</p>
    </div>
  );
}

function WaterSettingsSheet({ settings, onClose, onSaved }: { settings: HabitDashboard["water"]; onClose: () => void; onSaved: () => void }) {
  const [weight, setWeight] = useState(settings.weightKg ? String(settings.weightKg).replace(".", ",") : "");
  const [perKg, setPerKg] = useState(String(settings.mlPerKg ?? DEFAULT_ML_PER_KG));
  const [fixed, setFixed] = useState(settings.fixedGoalMl ? String(settings.fixedGoalMl) : "");
  const [useFixed, setUseFixed] = useState(Boolean(settings.fixedGoalMl));
  const [saving, setSaving] = useState(false);
  const weightKg = Number(weight.replace(",", "."));
  const goal = waterGoal({ weightKg, waterMlPerKg: Number(perKg), waterGoalMl: useFixed ? Number(fixed) : null });
  async function save() {
    setSaving(true);
    const response = await fetch("/api/habits/water", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weightKg, mlPerKg: Number(perKg), fixedGoalMl: useFixed ? Number(fixed) : null }) }).catch(() => null);
    setSaving(false);
    if (response?.ok) onSaved();
  }
  return (
    <Sheet title="Meta de água" onClose={onClose}>
      <p className="mt-1 text-sm leading-6 text-ink/65">A referência comum para adultos saudáveis é de 30 a 35 ml por kg de peso por dia. Calor, treino e suor pedem mais; se você tiver alguma condição renal ou cardíaca, siga a orientação do seu médico.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block"><span className="text-sm font-semibold text-ink">Peso (kg)</span><input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Ex.: 108" disabled={useFixed} className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm disabled:opacity-45" /></label>
        <label className="block"><span className="text-sm font-semibold text-ink">ml por kg</span><select value={perKg} onChange={(event) => setPerKg(event.target.value)} disabled={useFixed} className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm disabled:opacity-45">{[30, 35, 40].map((value) => <option key={value} value={value}>{value} ml/kg</option>)}</select></label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5 accent-[#46533b]" checked={useFixed} onChange={(event) => setUseFixed(event.target.checked)} /> Usar uma meta fixa</label>
      {useFixed ? <input inputMode="numeric" value={fixed} onChange={(event) => setFixed(event.target.value)} placeholder="Meta em ml, ex.: 3500" className="mt-2 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm" /> : null}
      <p className="mt-4 rounded-xl bg-blue-50 p-3 text-center text-sm text-blue-900">Sua meta: <strong>{(goal / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L por dia</strong> · {Math.round(goal / GLASS_ML)} copos de 250 ml</p>
      <button type="button" onClick={save} disabled={saving} className="mt-4 min-h-12 w-full rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-50">{saving ? "Salvando…" : "Salvar meta"}</button>
    </Sheet>
  );
}

function WaterSheet({ waterMl, onAdd, onClose }: { waterMl: number; onAdd: (amount: number) => void; onClose: () => void }) {
  const [custom, setCustom] = useState("");
  return (
    <Sheet title="Água" onClose={onClose}>
      <p className="mt-1 text-sm text-ink/60">Hoje: {waterMl} ml</p>
      <div className="mt-3 grid grid-cols-4 gap-2">{[100, 200, 300, 500].map((value) => <button key={value} type="button" className="min-h-11 rounded-xl bg-blue-50 text-sm font-bold text-blue-700" onClick={() => { onAdd(value); onClose(); }}>+{value}</button>)}</div>
      <div className="mt-2 grid grid-cols-[1fr_44px] gap-2"><input className="min-h-11 min-w-0 rounded-xl border border-line px-3 text-sm" inputMode="numeric" placeholder="Outro volume (ml)" value={custom} onChange={(event) => setCustom(event.target.value)} /><button type="button" aria-label="Adicionar" className="grid place-items-center rounded-xl bg-blue-500 text-white" onClick={() => { const value = Number(custom); if (value > 0) { onAdd(value); onClose(); } }}><Plus className="h-5 w-5" /></button></div>
      {waterMl > 0 ? <button type="button" className="mt-4 text-sm font-semibold text-ink/60" onClick={() => { onAdd(-Math.min(GLASS_ML, waterMl)); onClose(); }}>Desfazer um copo (−{Math.min(GLASS_ML, waterMl)} ml)</button> : null}
    </Sheet>
  );
}
