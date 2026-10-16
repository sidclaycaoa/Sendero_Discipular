"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Target } from "lucide-react";
import { Card, Pill } from "@/components/app/AppShell";

type PendingItem = {
  label: string;
  group: string;
};

export function HomeProgressPanel({
  dailyPercentage,
  dailyDone,
  dailyPlanned,
  weeklyDone,
  weeklyPlanned,
  pendingItems
}: {
  dailyPercentage: number | null;
  dailyDone: number;
  dailyPlanned: number;
  weeklyDone: number;
  weeklyPlanned: number;
  pendingItems: PendingItem[];
}) {
  const [open, setOpen] = useState(false);
  const value = dailyPercentage ?? 0;

  return (
    <Card className="mt-4">
      <button className="w-full text-left" onClick={() => setOpen((current) => !current)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Target className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Progresso do dia</p>
              <p className="mt-1 text-xs text-ink/55">{dailyDone}/{dailyPlanned} itens reais concluídos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={value >= 80 ? "good" : "accent"}>{dailyPercentage === null ? "sem plano" : `${value}%`}</Pill>
            {open ? <ChevronUp className="h-4 w-4 text-ink/50" /> : <ChevronDown className="h-4 w-4 text-ink/50" />}
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-paper">
          <div className="h-3 rounded-full bg-gradient-to-r from-emerald-600 via-olive to-clay" style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-ink/55">
          <span>Semanal: {weeklyPlanned ? `${weeklyDone}/${weeklyPlanned}` : "em curso"}</span>
          <span>Meta de streak: 80%</span>
        </div>
      </button>

      {open ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-3 text-sm font-semibold text-moss">Falta para chegar a 100%</p>
          <div className="space-y-2">
            {pendingItems.length ? (
              pendingItems.map((item) => (
                <div key={`${item.group}-${item.label}`} className="flex items-start justify-between gap-3 rounded-md bg-paper p-3">
                  <p className="text-sm leading-5 text-ink">{item.label}</p>
                  <span className="shrink-0 text-xs font-semibold text-olive">{item.group}</span>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Nada pendente no planejado real de hoje.</p>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
