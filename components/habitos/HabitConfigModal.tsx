"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { DbHabit } from "@/lib/db/sendero";

type Cadence = "DAILY" | "WEEKLY" | "TIME_BASED";
type PracticeGroup = "ED" | "PSYCHOLOGY" | "HABIT";

export function HabitConfigModal({ open, habit, onClose, onSaved }: { open: boolean; habit?: DbHabit | null; onClose: () => void; onSaved?: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<Cadence>("DAILY");
  const [practiceGroup, setPracticeGroup] = useState<PracticeGroup>("HABIT");
  const [target, setTarget] = useState(1);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(habit?.title ?? "");
    setDescription(habit?.description ?? "");
    setCadence(habit?.cadence ?? "DAILY");
    setPracticeGroup(habit?.practiceGroup ?? "HABIT");
    setTarget(habit?.targetCount ?? 1);
    setSaved(false); setError(null);
  }, [open, habit]);

  if (!open) return null;

  async function save() {
    if (!title.trim()) { setError("Informe o nome do hábito."); return; }
    setSaving(true); setSaved(false); setError(null);
    try {
      const response = await fetch(habit ? `/api/habits/template/${habit.id}` : "/api/habits/template", {
        method: habit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, cadence, targetCount: target, practiceGroup })
      });
      if (!response.ok) { setError("Não foi possível salvar o hábito."); return; }
      setSaved(true);
      if (!habit) { setTitle(""); setDescription(""); setTarget(1); }
      onSaved?.();
    } catch { setError("Não foi possível conectar com o servidor."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 sm:items-center sm:px-5">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-soft sm:rounded-xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-olive">{habit ? "Editar hábito" : "Novo hábito"}</p><h2 className="mt-1 text-xl font-semibold text-ink">Configurar recorrência</h2></div><button className="rounded-md border border-line p-2" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 space-y-4">
          <Field label="Nome do hábito" value={title} onChange={setTitle} placeholder="Ex.: Eu Sou Discípulo" />
          <Field label="Detalhamento" value={description} onChange={setDescription} placeholder="Como este hábito deve ser vivido?" />
          <label className="block"><span className="text-sm font-semibold text-ink">Classificação</span><select className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" value={practiceGroup} onChange={(event) => setPracticeGroup(event.target.value as PracticeGroup)}><option value="ED">Prática da ED</option><option value="PSYCHOLOGY">Exercício de psicologia</option><option value="HABIT">Hábito geral</option></select></label>
          <label className="block"><span className="text-sm font-semibold text-ink">Frequência</span><select className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)}><option value="DAILY">Diário</option><option value="WEEKLY">Semanal</option><option value="TIME_BASED">Por tempo</option></select></label>
          <label className="block"><span className="text-sm font-semibold text-ink">{cadence === "WEEKLY" ? "Vezes por semana" : cadence === "TIME_BASED" ? "Meta em minutos" : "Vezes por dia"}</span><input className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" type="number" min="1" value={target} onChange={(event) => setTarget(Math.max(1, Number(event.target.value)))} /></label>
          <div><div className="flex items-center justify-between"><span className="text-sm font-semibold text-ink">Dias da semana</span><button className="text-xs font-semibold text-emerald-700" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Todos</button></div><div className="mt-2 grid grid-cols-7 gap-1">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <button key={`${day}-${index}`} className={`min-h-9 rounded-md border text-sm font-semibold ${days.includes(index) ? "border-emerald-700 bg-emerald-700 text-white" : "border-line bg-paper text-ink"}`} onClick={() => setDays((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])}>{day}</button>)}</div></div>
        </div>
        <div className="sticky bottom-0 -mx-5 mt-5 border-t border-line bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {saved ? <p className="mb-3 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{habit ? "Alterações salvas." : "Hábito salvo."}</p> : null}
          {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
          <button className="min-h-12 w-full rounded-xl bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50" onClick={save} disabled={saving}>{saving ? "Salvando..." : habit ? "Salvar alterações" : "Salvar hábito"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="text-sm font-semibold text-ink">{label}</span><input className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
