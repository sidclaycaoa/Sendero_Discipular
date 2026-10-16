"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Card, Pill } from "@/components/app/AppShell";
import type { ReflectionTemplateSettings } from "@/lib/db/sendero";

const allDays = Array.from({ length: 30 }).map((_, index) => index + 1);
const blocks = Array.from({ length: 15 }).map((_, index) => {
  const day = index * 2 + 1;
  return { label: `${day}-${day + 1}`, days: [day, day + 1] };
});

export function ReflectionCycleManager() {
  const [items, setItems] = useState<ReflectionTemplateSettings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reflections/templates")
      .then((response) => response.json())
      .then((data) => setItems(data.templates ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Card className="mt-4"><p className="text-sm text-ink/70">Carregando reflexões...</p></Card>;
  }

  return (
    <section className="mt-4 space-y-3">
      {items.map((item) => (
        <ReflectionCycleEditor key={item.id} item={item} />
      ))}
    </section>
  );
}

function ReflectionCycleEditor({ item }: { item: ReflectionTemplateSettings }) {
  const [cycleDays, setCycleDays] = useState(item.cycleDays);
  const [period, setPeriod] = useState(item.period);
  const [endDate, setEndDate] = useState(item.endDate ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isEveryDay = useMemo(() => cycleDays.length === 30, [cycleDays]);

  function toggleBlock(days: number[]) {
    setCycleDays((current) => {
      const selected = days.every((day) => current.includes(day));
      const next = selected ? current.filter((day) => !days.includes(day)) : [...current, ...days];
      return Array.from(new Set(next)).sort((a, b) => a - b);
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch(`/api/reflections/template/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleDays,
          period,
          endDate: endDate || null
        })
      });

      if (response.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-5 text-ink">{item.topic}</h2>
          {item.subtopic ? <p className="mt-1 text-xs text-ink/55">{item.subtopic}</p> : null}
        </div>
        <Pill tone={isEveryDay ? "good" : "neutral"}>{isEveryDay ? "todos" : `${cycleDays.length} dias`}</Pill>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Período</span>
          <select className="mt-1 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" value={period} onChange={(event) => { setPeriod(event.target.value as ReflectionTemplateSettings["period"]); setSaved(false); }}>
            <option value="MORNING">Manhã</option>
            <option value="AFTERNOON">Tarde</option>
            <option value="NIGHT">Noite</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Data final</span>
          <input className="mt-1 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setSaved(false); }} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800" onClick={() => { setCycleDays(allDays); setSaved(false); }}>
          Todos os dias
        </button>
        <button className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink/65" onClick={() => { setCycleDays([]); setSaved(false); }}>
          Limpar
        </button>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {blocks.map((block) => {
          const selected = block.days.every((day) => cycleDays.includes(day));
          return (
            <button
              key={block.label}
              className={`rounded-md px-2 py-2 text-xs font-semibold ${selected ? "bg-ink text-paper" : "bg-paper text-ink/65"}`}
              onClick={() => toggleBlock(block.days)}
            >
              {block.label}
            </button>
          );
        })}
      </div>

      <button className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-ink text-sm font-semibold text-paper disabled:opacity-60" onClick={save} disabled={saving || cycleDays.length === 0}>
        <Save className="h-4 w-4" /> {saving ? "Salvando..." : saved ? "Salvo" : "Salvar ajuste"}
      </button>
    </Card>
  );
}
