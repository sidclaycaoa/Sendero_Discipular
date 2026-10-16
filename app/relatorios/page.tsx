import type { ReactNode } from "react";
import { BarChart3, Droplets, NotebookPen, Sparkles } from "lucide-react";
import { AppShell, Card, ModuleHeader, Pill } from "@/components/app/AppShell";
import { ReportExportPanel } from "@/components/relatorios/ReportExportPanel";
import { getActiveUser, getReportDashboard } from "@/lib/db/sendero";
import { getHabitIndicators } from "@/lib/db/sendero";
import { HabitIndicatorPanel } from "@/components/relatorios/HabitIndicatorPanel";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const user = await getActiveUser();
  const [report, indicators] = user ? await Promise.all([getReportDashboard(user.id), getHabitIndicators(user.id)]) : [null, []];
  const rows = report ? [
    { label: "Reflexões registradas", value: report.reflectionDone, color: "bg-emerald-600" },
    { label: "Diários preenchidos", value: report.diaryDone, color: "bg-blue-500" },
    { label: "Hábitos diários concluídos", value: report.habitDailyDone, color: "bg-amber-500" },
    { label: "Práticas semanais realizadas", value: report.habitWeeklyProgress, color: "bg-violet-500" },
  ] : [];
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <AppShell>
    <ModuleHeader eyebrow="Verdade dos dados" title="Relatórios" description="Registros reais da semana, sem números ilustrativos." action={<BarChart3 className="h-6 w-6 text-olive" />} />
    <Card className="mt-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-olive">Semana atual</p><h2 className="mt-1 text-lg font-semibold text-ink">{report?.weekLabel ?? "Sem dados"}</h2></div><Pill tone="good">{report?.activeDays ?? 0} dias ativos</Pill></div><div className="mt-5 space-y-4">{rows.map((row) => <div key={row.label}><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-ink">{row.label}</span><span className="text-slate-500">{row.value}</span></div><div className="h-2 rounded-full bg-paper"><div className={`h-2 rounded-full ${row.color}`} style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} /></div></div>)}</div></Card>
    <section className="mt-4 grid grid-cols-2 gap-3"><Metric icon={<Droplets className="h-4 w-4" />} label="Média de água" value={report ? `${report.waterAverageMl} ml` : "—"} /><Metric icon={<NotebookPen className="h-4 w-4" />} label="Reflexões totais" value={String(report?.totalReflections ?? 0)} /></section>
    <HabitIndicatorPanel indicators={indicators} />
    <Card className="mt-4"><div className="flex items-center gap-2 text-sm font-semibold text-moss"><Sparkles className="h-4 w-4" /> Registros por categoria</div><div className="mt-4 space-y-3">{report?.categories.length ? report.categories.map((item) => <div key={item.label}><div className="flex justify-between text-sm"><span className="font-medium text-ink">{item.label}</span><span className="text-slate-500">{item.value} reflexões</span></div><div className="mt-1 h-2 rounded-full bg-paper"><div className="h-2 rounded-full" style={{ width: `${Math.max(4, Math.min(100, item.value / Math.max(1, report.totalReflections) * 100))}%`, backgroundColor: item.color }} /></div></div>) : <p className="text-sm text-slate-500">Ainda não há dados para agrupar.</p>}</div></Card>
    <ReportExportPanel />
  </AppShell>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <Card><div className="flex items-center gap-2 text-xs font-semibold uppercase text-olive">{icon}{label}</div><p className="mt-3 text-2xl font-semibold text-ink">{value}</p></Card>; }
