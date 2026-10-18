"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { DbHabit } from "@/lib/db/sendero";
import { PRACTICE_TOOLS } from "@/lib/practice";

type Cadence = "DAILY" | "WEEKLY" | "TIME_BASED";
type PracticeGroup = "ED" | "PSYCHOLOGY" | "HABIT";

export function HabitConfigModal({ open, habit, onClose, onSaved }: { open: boolean; habit?: DbHabit | null; onClose: () => void; onSaved?: () => void }) {
  // Mounted fresh for each habit (keyed by the caller), so the form starts from its values.
  const [title, setTitle] = useState(habit?.title ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [cadence, setCadence] = useState<Cadence>(habit?.cadence ?? "DAILY");
  const [practiceGroup, setPracticeGroup] = useState<PracticeGroup>(habit?.practiceGroup ?? "HABIT");
  const [target, setTarget] = useState(habit?.targetCount ?? 1);
  const [practiceTool, setPracticeTool] = useState<string>(habit?.practiceTool ?? "");
  const [dayPeriod, setDayPeriod] = useState<string>(habit?.dayPeriod ?? "");
  const [scheduledTime, setScheduledTime] = useState(habit?.scheduledTime ?? "");
  const [remind, setRemind] = useState(habit?.remind ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function save() {
    if (!title.trim()) { setError("Informe o nome do hábito."); return; }
    setSaving(true); setSaved(false); setError(null);
    try {
      const response = await fetch(habit ? `/api/habits/template/${habit.id}` : "/api/habits/template", {
        method: habit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, cadence, targetCount: target, practiceGroup, practiceTool: practiceTool || null, dayPeriod: dayPeriod || null, scheduledTime: scheduledTime || null, remind: remind && Boolean(scheduledTime) })
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
          <label className="block"><span className="text-sm font-semibold text-ink">Contexto <span className="font-normal text-ink/50">(aparece pequeno abaixo do nome)</span></span><textarea className="mt-2 w-full rounded-md border border-line bg-paper p-3 text-sm leading-5 outline-none focus:border-moss" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que lembrar ao fazer este hábito" /></label>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="block"><span className="text-sm font-semibold text-ink">Período</span><select className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" value={dayPeriod} onChange={(event) => setDayPeriod(event.target.value)}><option value="">Ao longo do dia</option><option value="MANHA">Manhã</option><option value="TARDE">Tarde</option><option value="NOITE">Noite</option></select></label>
            <label className="block"><span className="text-sm font-semibold text-ink">Horário</span><input type="time" className="mt-2 min-h-10 w-[7.25rem] rounded-md border border-line bg-paper px-2 text-sm" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} /></label>
          </div>
          {scheduledTime ? (
            <div className="-mt-1 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setScheduledTime("")} className="text-xs font-semibold text-ink/55">Tirar horário</button>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5 accent-[#46533b]" checked={remind} onChange={(event) => setRemind(event.target.checked)} /> Avisar no celular</label>
            </div>
          ) : <p className="-mt-2 text-xs text-ink/55">Com horário, o hábito aparece como atrasado depois dele e pode avisar no celular.</p>}
          <label className="block"><span className="text-sm font-semibold text-ink">Ferramenta de prática</span>
            <select className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" value={practiceTool} onChange={(event) => setPracticeTool(event.target.value)}>
              <option value="">Nenhuma</option>
              {Object.values(PRACTICE_TOOLS).map((tool) => <option key={tool.key} value={tool.key}>{tool.label}</option>)}
            </select>
            <span className="mt-1 block text-xs text-ink/55">Com uma ferramenta, o hábito ganha o botão “Praticar” (música, tempo ou imagem).</span>
          </label>
          <label className="block"><span className="text-sm font-semibold text-ink">Classificação</span><select className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" value={practiceGroup} onChange={(event) => setPracticeGroup(event.target.value as PracticeGroup)}><option value="ED">Prática da ED</option><option value="PSYCHOLOGY">Exercício de psicologia</option><option value="HABIT">Hábito geral</option></select></label>
          <label className="block"><span className="text-sm font-semibold text-ink">Frequência</span><select className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)}><option value="DAILY">Diário</option><option value="WEEKLY">Semanal</option><option value="TIME_BASED">Por tempo</option></select></label>
          <label className="block"><span className="text-sm font-semibold text-ink">{cadence === "WEEKLY" ? "Vezes por semana" : cadence === "TIME_BASED" ? "Meta em minutos" : "Vezes por dia"}</span><input className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm" type="number" min="1" value={target} onChange={(event) => setTarget(Math.max(1, Number(event.target.value)))} /></label>
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
