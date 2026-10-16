"use client";

import { useState } from "react";
import type { HabitIndicator } from "@/lib/db/sendero";
import { Card } from "@/components/app/AppShell";

export function HabitIndicatorPanel({ indicators }: { indicators: HabitIndicator[] }) {
  const [selectedId, setSelectedId] = useState(indicators[0]?.id ?? ""); const selected = indicators.find(item => item.id === selectedId);
  if (!selected) return null;
  const percentage = Math.round(selected.completedDays / 30 * 100); const variation = selected.completedDays - selected.previousCompletedDays; const max = Math.max(selected.target, ...selected.series.map(point => point.value), 1);
  const points = selected.series.map((point, index) => `${index / 29 * 100},${100 - point.value / max * 88}`).join(" ");
  return <Card className="mt-4"><p className="text-sm font-semibold text-moss">Indicadores por prática</p><p className="mt-1 text-sm text-ink/60">Veja a constância de cada hábito nos últimos 30 dias.</p><select className="mt-4 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm font-semibold text-ink" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{indicators.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric value={`${selected.completedDays}/30`} label="dias atingidos" /><Metric value={`${percentage}%`} label="efetividade" /><Metric value={`${variation > 0 ? "+" : ""}${variation}`} label="vs. 30 dias anteriores" /></div>
    <div className="mt-4 rounded-xl border border-line bg-paper p-3"><div className="mb-2 flex justify-between text-xs text-ink/60"><span>Histórico diário</span><span>meta: {selected.target}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full overflow-visible"><line x1="0" x2="100" y1={100 - selected.target / max * 88} y2={100 - selected.target / max * 88} stroke="#b88955" strokeDasharray="3 3" strokeWidth="1" /><polyline points={points} fill="none" stroke="#1f6b52" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></div>
  </Card>;
}
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-lg bg-paper p-3"><p className="text-lg font-semibold text-ink">{value}</p><p className="mt-1 text-[11px] leading-4 text-ink/55">{label}</p></div>; }
