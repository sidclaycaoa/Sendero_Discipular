"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/app/AppShell";

const allDays = Array.from({ length: 30 }).map((_, index) => index + 1);
const blocks = Array.from({ length: 15 }).map((_, index) => {
  const day = index * 2 + 1;
  return { label: `${day}-${day + 1}`, days: [day, day + 1] };
});

export function NewReflectionForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [orientation, setOrientation] = useState("");
  const [period, setPeriod] = useState<"MORNING" | "AFTERNOON" | "NIGHT">("NIGHT");
  const [cycleDays, setCycleDays] = useState<number[]>([1, 2]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!topic.trim()) {
      setError("Informe o título da reflexão.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/reflections/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          subtopic,
          orientation,
          period,
          cycleDays,
          endDate: endDate || null
        })
      });

      if (!response.ok) {
        setError("Não foi possível salvar a reflexão.");
        return;
      }

      router.push(`/refletir?dia=${cycleDays[0] ?? 1}`);
      router.refresh();
    } catch {
      setError("Não foi possível conectar com o servidor.");
    } finally {
      setSaving(false);
    }
  }

  function toggleBlock(days: number[]) {
    setCycleDays((current) => {
      const selected = days.every((day) => current.includes(day));
      const next = selected ? current.filter((day) => !days.includes(day)) : [...current, ...days];
      return Array.from(new Set(next)).sort((a, b) => a - b);
    });
  }

  return (
    <Card className="mt-4 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-ink">Título</span>
        <input className="mt-2 min-h-11 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" value={topic} onChange={(event) => setTopic(event.target.value)} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-ink">Subtítulo</span>
        <input className="mt-2 min-h-11 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" value={subtopic} onChange={(event) => setSubtopic(event.target.value)} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-ink">Orientação</span>
        <textarea className="mt-2 min-h-28 w-full resize-none rounded-md border border-line bg-paper p-3 text-sm outline-none focus:border-moss" value={orientation} onChange={(event) => setOrientation(event.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Período</span>
          <select className="mt-2 min-h-11 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" value={period} onChange={(event) => setPeriod(event.target.value as "MORNING" | "AFTERNOON" | "NIGHT")}>
            <option value="MORNING">Manhã</option>
            <option value="AFTERNOON">Tarde</option>
            <option value="NIGHT">Noite</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-ink">Data final</span>
          <input className="mt-2 min-h-11 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Quando aparece</span>
          <button className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800" onClick={() => setCycleDays(allDays)}>
            Todos os dias
          </button>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2">
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
      </div>

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

      <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-60" onClick={submit} disabled={saving}>
        <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar reflexão"}
      </button>
    </Card>
  );
}
