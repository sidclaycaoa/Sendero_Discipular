"use client";

import { type MouseEvent, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Card } from "@/components/app/AppShell";

const sections = [
  { id: "reflections", label: "Reflexões · ciclo + AD" },
  { id: "passages", label: "Trechos indexados" },
  { id: "diary", label: "Diário" },
  { id: "habits", label: "Hábitos" },
  { id: "tasks", label: "Tarefas" },
  { id: "water", label: "Água" }
];

export function ReportExportPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedSections, setSelectedSections] = useState(() => sections.map((section) => section.id));
  const [message, setMessage] = useState<string | null>(null);

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("sections", selectedSections.join(","));
    params.set("t", String(Date.now()));
    return `/api/reports/export?${params.toString()}`;
  }, [from, selectedSections, to]);

  function toggleSection(sectionId: string) {
    setSelectedSections((current) => {
      if (current.includes(sectionId)) return current.filter((id) => id !== sectionId);
      return [...current, sectionId];
    });
  }

  function startDownload(event: MouseEvent<HTMLAnchorElement>) {
    if (!selectedSections.length) {
      event.preventDefault();
      return;
    }
    setMessage("Download iniciado. Verifique a pasta de downloads do navegador.");
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-moss">
        <Download className="h-4 w-4" />
        Exportação
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-olive">De</span>
          <input className="mt-1 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-olive">Até</span>
          <input className="mt-1 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase text-olive">Conteúdo</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {sections.map((section) => {
            const active = selectedSections.includes(section.id);
            return (
              <button
                key={section.id}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-line bg-white text-ink/55"}`}
                onClick={() => toggleSection(section.id)}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {message ? <p className="mt-3 rounded-md bg-paper p-3 text-sm text-ink/70">{message}</p> : null}

      <a
        aria-disabled={!selectedSections.length}
        className={`mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold ${selectedSections.length ? "bg-ink text-paper" : "pointer-events-none bg-slate-200 text-slate-500"}`}
        download={`sendero-export-${from || "inicio"}-a-${to || new Date().toISOString().slice(0, 10)}.csv`}
        href={selectedSections.length ? downloadUrl : undefined}
        onClick={startDownload}
      >
        <FileText className="h-4 w-4" />
        Baixar CSV filtrado
      </a>
    </Card>
  );
}
