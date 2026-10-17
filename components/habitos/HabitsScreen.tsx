"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Droplets, Minus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { AppShell, Card, ModuleHeader } from "@/components/app/AppShell";
import { HabitConfigModal } from "@/components/habitos/HabitConfigModal";
import type { DbHabit, HabitDashboard } from "@/lib/db/sendero";

type Props = { dashboard: HabitDashboard | null };

export function HabitsScreen({ dashboard }: Props) {
  const router = useRouter();
  const [data, setData] = useState(dashboard);
  const [customWater, setCustomWater] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<DbHabit | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Saves for the same habit go out one after another, so the last tap always wins;
  // the screen reloads from the server only once the last pending save is done.
  const queues = useRef(new Map<string, { tail: Promise<void>; pending: number }>());
  // New server data (after router.refresh) replaces the optimistic copy.
  const [serverDashboard, setServerDashboard] = useState(dashboard);
  if (dashboard !== serverDashboard) {
    setServerDashboard(dashboard);
    setData(dashboard);
  }

  const daily = data?.habits.filter((habit) => habit.cadence === "DAILY") ?? [];
  const practiceGroups: Array<{ code: DbHabit["practiceGroup"]; title: string; detail: string; tone: "red" | "yellow" | "green" }> = [
    { code: "ED", title: "Práticas da ED", detail: "Exercícios para sustentar a via discipular.", tone: "red" },
    { code: "PSYCHOLOGY", title: "Exercícios de psicologia", detail: "Observação e trabalho consciente da psique.", tone: "yellow" },
    { code: "HABIT", title: "Hábitos gerais", detail: "Escolhas de cuidado, organização e estudo.", tone: "green" },
  ];
  const completed = daily.filter((habit) => habit.progress >= habit.targetCount).length;
  const percentage = daily.length ? Math.round((completed / daily.length) * 100) : 0;

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error("Não foi possível salvar a alteração.");
  }

  async function saveProgress(habit: DbHabit, progress: number, note = habit.note) {
    if (!data) return;
    const next = Math.max(0, progress);
    const countForToday = habit.cadence === "WEEKLY" ? Math.max(0, next - (habit.progress - habit.todayCount)) : next;
    setData((current) => current ? { ...current, habits: current.habits.map((item) => item.id === habit.id ? { ...item, progress: next, todayCount: habit.cadence === "TIME_BASED" ? item.todayCount : countForToday, note } : item) } : current);
    setError(null);
    const payload = { habitId: habit.id, dateKey: data.dateKey, count: habit.cadence === "TIME_BASED" ? 0 : countForToday, minutes: habit.cadence === "TIME_BASED" ? next : 0, note };
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

  async function addWater(amount: number) {
    if (!data || amount <= 0) return;
    setData({ ...data, waterMl: data.waterMl + amount }); setSaving("water");
    try { await request("/api/habits/water", "POST", { amountMl: amount, dateKey: data.dateKey }); router.refresh(); }
    catch { router.refresh(); } finally { setSaving(null); }
  }

  function editHabit(habit: DbHabit) { setEditingHabit(habit); setConfigOpen(true); }

  async function deleteHabit(habit: DbHabit) {
    if (!window.confirm(`Excluir “${habit.title}”? Os registros já feitos serão preservados no histórico.`)) return;
    setData((current) => current ? { ...current, habits: current.habits.filter((item) => item.id !== habit.id) } : current); setSaving(habit.id);
    try { await request(`/api/habits/template/${habit.id}`, "DELETE"); router.refresh(); }
    catch { router.refresh(); } finally { setSaving(null); }
  }

  if (!data) return <AppShell><p className="py-10 text-sm text-slate-500">Preparando seus hábitos…</p></AppShell>;

  return <AppShell>
    <ModuleHeader eyebrow="Prática cotidiana" title="Hábitos" description="Pequenas escolhas repetidas, com presença e direção." action={<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper" onClick={() => { setEditingHabit(null); setConfigOpen(true); }}><Plus className="h-4 w-4" /> Novo</button>} />
    <HabitConfigModal key={configOpen ? editingHabit?.id ?? "novo" : "fechado"} open={configOpen} habit={editingHabit} onClose={() => { setConfigOpen(false); setEditingHabit(null); }} onSaved={() => { setConfigOpen(false); setEditingHabit(null); router.refresh(); }} />
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
    <section className="mt-5 grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
      <WaterCard waterMl={data.waterMl} goalMl={data.waterGoalMl} customWater={customWater} setCustomWater={setCustomWater} addWater={addWater} saving={saving === "water"} />
      <Card className="flex flex-col justify-between !bg-ink !text-paper"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-paper/75">Ritmo de hoje</p><Sparkles className="h-5 w-5 text-amber-300" /></div><div className="mt-5 flex items-end justify-between"><div><p className="text-4xl font-semibold tracking-tight">{completed}<span className="text-xl text-paper/55">/{daily.length}</span></p><p className="mt-1 text-sm text-paper/70">práticas concluídas</p></div><div className="grid h-16 w-16 place-items-center rounded-full border-4 border-paper/20 text-sm font-bold" style={{ background: `conic-gradient(#f6c36a ${percentage * 3.6}deg, transparent 0deg)` }}><span className="grid h-12 w-12 place-items-center rounded-full !bg-ink">{percentage}%</span></div></div></Card>
    </section>
    <section className="mt-7">
      <p className="text-xs font-bold uppercase tracking-wider text-olive">Pendências gerais</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {practiceGroups.map((group) => { const habits = data.habits.filter((habit) => habit.practiceGroup === group.code); const pending = habits.filter((habit) => habit.progress < habit.targetCount).length; return <div key={group.code} className={`rounded-xl border p-3 ${group.tone === "red" ? "border-red-200 bg-red-50" : group.tone === "yellow" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-xl font-semibold text-ink">{pending}</p><p className="mt-1 text-[11px] font-bold leading-4 text-ink/65">{group.code === "ED" ? "ED" : group.code === "PSYCHOLOGY" ? "Psicologia" : "Hábitos"}</p></div>; })}
      </div>
    </section>
    <div className="mt-7 space-y-6">
      {practiceGroups.map((group) => <PracticeGroupSection key={group.code} title={group.title} detail={group.detail} tone={group.tone} habits={data.habits.filter((habit) => habit.practiceGroup === group.code)} saving={saving} onChange={saveProgress} onEdit={editHabit} onDelete={deleteHabit} />)}
    </div>
  </AppShell>;
}

function WaterCard({ waterMl, goalMl, customWater, setCustomWater, addWater, saving }: { waterMl: number; goalMl: number; customWater: string; setCustomWater: (value: string) => void; addWater: (value: number) => void; saving: boolean }) {
  const pct = Math.min(100, Math.round((waterMl / goalMl) * 100));
  function submitCustomWater() {
    const amount = Number(customWater);
    if (amount > 0) { addWater(amount); setCustomWater(""); }
  }
  return (
    <Card className="overflow-hidden border-blue-100 bg-gradient-to-br from-blue-50 to-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white"><Droplets className="h-5 w-5" /></span>
          <div><p className="text-sm font-semibold text-ink">Água</p><p className="mt-0.5 text-2xl font-semibold tracking-tight text-blue-700">{waterMl}<span className="ml-1 text-sm font-medium">ml</span></p></div>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">meta {goalMl / 1000}L · {pct}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} /></div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[100, 200, 300, 500].map((value) => <button key={value} type="button" disabled={saving} className="min-h-10 rounded-xl bg-white px-2 text-xs font-bold text-blue-700 shadow-sm ring-1 ring-blue-100 disabled:opacity-50" onClick={() => addWater(value)}>+{value}</button>)}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_44px] gap-2">
        <input className="min-h-11 w-full min-w-0 rounded-xl border border-blue-100 bg-white px-3 text-sm outline-none focus:border-blue-400" inputMode="numeric" placeholder="Outro volume (ml)" value={customWater} onChange={(event) => setCustomWater(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitCustomWater(); }} />
        <button type="button" aria-label="Adicionar volume de água" disabled={saving} className="grid min-h-11 place-items-center rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={submitCustomWater}><Plus className="h-5 w-5" /></button>
      </div>
    </Card>
  );
}

function PracticeGroupSection({ title, detail, tone, habits, saving, onChange, onEdit, onDelete }: { title: string; detail: string; tone: "red" | "yellow" | "green"; habits: DbHabit[]; saving: string | null; onChange: (habit: DbHabit, progress: number, note?: string) => Promise<void>; onEdit: (habit: DbHabit) => void; onDelete: (habit: DbHabit) => Promise<void> }) {
  const daily = habits.filter((habit) => habit.cadence === "DAILY");
  const weekly = habits.filter((habit) => habit.cadence === "WEEKLY");
  const timed = habits.filter((habit) => habit.cadence === "TIME_BASED");
  const completed = daily.filter((habit) => habit.progress >= habit.targetCount).length;
  const colors = tone === "red" ? "border-red-300 bg-red-50/45 text-red-800" : tone === "yellow" ? "border-amber-300 bg-amber-50/55 text-amber-900" : "border-emerald-300 bg-emerald-50/45 text-emerald-800";
  return <section className={`rounded-2xl border-l-4 p-4 shadow-soft ${colors}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider">{title}</p><h2 className="mt-1 text-lg font-semibold text-ink">{detail}</h2></div>{daily.length ? <p className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-ink/70">{completed}/{daily.length} hoje</p> : null}</div>{habits.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-current/25 bg-white/70 p-4"><p className="text-sm font-semibold text-ink">Sem exercícios cadastrados.</p><p className="mt-1 text-sm leading-5 text-ink/65">Use “Novo” e escolha esta classificação ao criar um item.</p></div> : <div className="mt-4 space-y-3">{daily.map((habit) => <DailyHabitCard key={habit.id} habit={habit} saving={saving === habit.id} onChange={(value) => onChange(habit, value)} onEdit={() => onEdit(habit)} onDelete={() => onDelete(habit)} />)}{weekly.map((habit) => <WeeklyHabitCard key={habit.id} habit={habit} saving={saving === habit.id} onChange={(value) => onChange(habit, value)} onEdit={() => onEdit(habit)} onDelete={() => onDelete(habit)} />)}{timed.map((habit) => <TimedHabitCard key={habit.id} habit={habit} saving={saving === habit.id} onChange={(value, note) => onChange(habit, value, note)} onEdit={() => onEdit(habit)} onDelete={() => onDelete(habit)} />)}</div>}</section>;
}

function DailyHabitCard({ habit, saving, onChange, onEdit, onDelete }: { habit: DbHabit; saving: boolean; onChange: (value: number) => void; onEdit: () => void; onDelete: () => void }) {
  const done = habit.progress >= habit.targetCount; const isCount = habit.targetCount > 1;
  return <Card className={done ? "border-emerald-200 bg-emerald-50/40" : ""}><div className="flex items-start gap-3"><button type="button" aria-label={`Marcar ${habit.title}`} disabled={saving} onClick={() => onChange(done ? 0 : isCount ? habit.progress + 1 : 1)} className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="h-5 w-5" /></button><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold leading-5 text-ink">{habit.title}</p>{habit.description && <p className="mt-1 text-sm leading-5 text-slate-600">{habit.description}</p>}</div><Actions onEdit={onEdit} onDelete={onDelete} /></div>{isCount && <div className="mt-4 flex items-center gap-3"><button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-paper text-ink" onClick={() => onChange(habit.progress - 1)}><Minus className="h-4 w-4" /></button><span className="min-w-12 text-center text-sm font-bold text-ink">{habit.progress}/{habit.targetCount}</span><button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper" onClick={() => onChange(habit.progress + 1)}><Plus className="h-4 w-4" /></button><Progress value={habit.progress} target={habit.targetCount} /></div>}</div></div></Card>;
}

function WeeklyHabitCard({ habit, saving, onChange, onEdit, onDelete }: { habit: DbHabit; saving: boolean; onChange: (value: number) => void; onEdit: () => void; onDelete: () => void }) {
  const marked = habit.todayCount > 0;
  return <Card><div className="flex items-start gap-3"><button type="button" disabled={saving} onClick={() => onChange(marked ? Math.max(0, habit.progress - habit.todayCount) : habit.progress + 1)} className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${marked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="h-5 w-5" /></button><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{habit.title}</p><p className="mt-1 text-xs text-slate-500">{habit.progress}/{habit.targetCount} nesta semana{marked ? " · feito hoje" : ""}</p></div><Actions onEdit={onEdit} onDelete={onDelete} /></div><Progress value={habit.progress} target={habit.targetCount} /></div></div></Card>;
}

function TimedHabitCard({ habit, saving, onChange, onEdit, onDelete }: { habit: DbHabit; saving: boolean; onChange: (value: number, note?: string) => void; onEdit: () => void; onDelete: () => void }) {
  const [custom, setCustom] = useState(""); const [note, setNote] = useState(habit.note); const [savedNote, setSavedNote] = useState(habit.note); if (habit.note !== savedNote) { setSavedNote(habit.note); setNote(habit.note); }
  return <Card><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700"><Clock3 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{habit.title}</p><p className="mt-1 text-xs text-slate-500">{habit.progress} min de {habit.targetCount} min</p></div><Actions onEdit={onEdit} onDelete={onDelete} /></div><Progress value={habit.progress} target={habit.targetCount} /><div className="mt-4 flex flex-wrap gap-2">{[15, 30, 45, 60].map((value) => <button type="button" disabled={saving} key={value} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700" onClick={() => onChange(habit.progress + value)}>+{value} min</button>)}</div><div className="mt-3 grid grid-cols-[1fr_40px] gap-2"><input className="min-h-10 w-full min-w-0 rounded-xl border border-line px-3 text-sm" inputMode="numeric" placeholder="Outros minutos" value={custom} onChange={(event) => setCustom(event.target.value)} /><button type="button" className="grid place-items-center rounded-xl bg-ink text-paper" onClick={() => { const value = Number(custom); if (value > 0) { onChange(habit.progress + value); setCustom(""); } }}><Plus className="h-4 w-4" /></button></div><textarea className="mt-3 min-h-20 w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-olive" placeholder="Uma nota sobre esta prática (opcional)" value={note} onChange={(event) => setNote(event.target.value)} /><button type="button" className="mt-2 text-xs font-semibold text-olive" onClick={() => onChange(habit.progress, note)}>Salvar nota</button></div></div></Card>;
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="flex gap-1"><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-paper" onClick={onEdit} aria-label="Editar hábito"><Pencil className="h-4 w-4" /></button><button type="button" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" onClick={onDelete} aria-label="Excluir hábito"><Trash2 className="h-4 w-4" /></button></div>; }
function Progress({ value, target }: { value: number; target: number }) { return <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, Math.round((value / target) * 100))}%` }} /></div>; }
