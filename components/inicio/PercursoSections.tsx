import Link from "next/link";
import { Download } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import type { PercursoData, PracticeGroupCode } from "@/lib/db/percurso";

export const groupStyle: Record<PracticeGroupCode, { label: string; color: string; track: string }> = {
  ED: { label: "Práticas ED", color: "#b23a2c", track: "#f4dcd8" },
  PSYCHOLOGY: { label: "Psicologia", color: "#a87600", track: "#f5ead0" },
  HABIT: { label: "Hábitos", color: "#4f7a3a", track: "#dfe9d6" },
};

const heatShades = ["#ebe6dc", "#d6dcc6", "#a9b48c", "#66704f", "#3a4429"];

export function TodayRings({ groups, reflections }: { groups: PercursoData["today"]["groups"]; reflections: { done: number; total: number } }) {
  const rings = [
    ...groups.map((group) => ({
      id: group.code, label: groupStyle[group.code].label, color: groupStyle[group.code].color, track: groupStyle[group.code].track,
      value: group.total ? `${group.done}/${group.total}` : "—", ratio: group.ratio,
    })),
    { id: "REFLECTION", label: "Reflexões e Diário", color: "#6a46b8", track: "#e6ddf6", value: `${reflections.done}/${reflections.total}`, ratio: reflections.total ? reflections.done / reflections.total : 0 },
  ];
  return (
    <Card className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">O dia até agora</h2>
        <Link prefetch={false} href="/habitos" className="text-sm font-semibold text-moss">Marcar práticas</Link>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {rings.map((ring) => <Ring key={ring.id} {...ring} />)}
      </div>
    </Card>
  );
}

function Ring({ label, value, ratio, color, track }: { id: string; label: string; value: string; ratio: number; color: string; track: string }) {
  const circumference = 2 * Math.PI * 30;
  const filled = circumference * Math.max(0, Math.min(1, ratio));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 74 74" className="h-[68px] w-[68px]" role="img" aria-label={`${label}: ${value}`}>
        <circle cx="37" cy="37" r="30" fill="none" stroke={track} strokeWidth="8" />
        <circle cx="37" cy="37" r="30" fill="none" stroke={color} strokeWidth="8" strokeLinecap={filled > 0 ? "round" : "butt"} strokeDasharray={`${filled} ${circumference}`} transform="rotate(-90 37 37)" />
        <text x="37" y="42" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1f2528">{value}</text>
      </svg>
      <span className="text-center text-xs font-semibold leading-4 text-ink/75">{label}</span>
    </div>
  );
}

export function PercursoSections({ data, tonicPosition }: { data: PercursoData; tonicPosition: { current: number; total: number } | null }) {
  const milestones = [
    ...(tonicPosition ? [{ label: "Ciclo das tônicas", current: tonicPosition.current, target: tonicPosition.total, note: tonicPosition.current === tonicPosition.total ? "fecha hoje" : `${tonicPosition.current} de ${tonicPosition.total}` }] : []),
    ...data.milestones.map((item) => ({ ...item, note: `${item.current} · faltam ${item.target - item.current}` })),
  ];
  const maxMonthly = Math.max(1, ...data.monthly.map((month) => month.count));
  const [currentLabel, previousLabel] = [monthName(data.compare.currentMonth), monthName(data.compare.previousMonth)];

  return (
    <div className="mt-8" aria-label="Percurso">
      <div className="flex items-end justify-between gap-3 border-t border-line pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-olive">Avanço real, sem placar</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Percurso</h2>
        </div>
      </div>

      <Card className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink">Mapa de presença</h3>
          <span className="text-xs text-ink/60">últimas {data.heatmap.weeks.length} semanas</span>
        </div>
        <div className="mt-3 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${data.heatmap.weeks.length}, minmax(0, 1fr))` }}>
          {data.heatmap.weeks.map((_, column) => {
            const label = data.heatmap.monthLabels.find((item) => item.column === column)?.label;
            return <span key={column} className="overflow-visible whitespace-nowrap text-[10px] font-semibold text-ink/55">{label ?? ""}</span>;
          })}
        </div>
        <div role="img" aria-label={`Mapa de presença: ${data.heatmap.presentDays30} dias com registros nos últimos 30 dias; mais escuro, mais presença`} className="mt-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${data.heatmap.weeks.length}, minmax(0, 1fr))` }}>
          {data.heatmap.weeks.map((week, column) => (
            <div key={column} className="grid gap-[3px]">
              {week.map((day) => <span key={day.date} title={day.date} className="block aspect-square rounded-[2px]" style={day.future ? { boxShadow: "inset 0 0 0 1px #ded7ca" } : { background: heatShades[day.level] }} />)}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-ink/80"><strong>{data.heatmap.presentDays30} de 30</strong> dias presentes no último mês</p>
          <span className="flex items-center gap-1 text-[11px] text-ink/55" aria-hidden="true">menos {heatShades.map((shade) => <span key={shade} className="block h-2.5 w-2.5 rounded-[2px]" style={{ background: shade }} />)} mais</span>
        </div>
      </Card>

      <section className="mt-4 grid grid-cols-2 gap-3" aria-label="Constância">
        <Stat value={data.constancy.quickReturns} tone="text-emerald-800" title="Retomadas no dia seguinte" detail="Falhou um dia e voltou no outro. Práticas ED, 30 dias." />
        <Stat value={data.constancy.longPauses} tone="text-amber-800" title="Pausas de 2+ dias" detail="Onde o “nunca falhe duas vezes” escapou." />
      </section>

      <Card className="mt-4">
        <h3 className="text-lg font-semibold text-ink">Força das práticas</h3>
        <p className="mt-1 text-xs leading-5 text-ink/60">Sobe com a constância e cai devagar: um dia ruim não apaga semanas de prática. Comparado a 30 dias atrás.</p>
        <div className="mt-4 space-y-4">
          {data.strength.map((item) => {
            const style = groupStyle[item.code];
            return (
              <div key={item.code}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: style.color }} />{groupFullName(item.code)}</span>
                  {item.value === null ? <span className="text-ink/60">sem práticas diárias ativas</span> : <span className="font-semibold">{item.value}% <Delta value={item.delta} /></span>}
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#efeae0]"><div className="h-full rounded-full" style={{ width: `${item.value ?? 0}%`, background: style.color }} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-4">
        <h3 className="text-lg font-semibold text-ink">{capitalize(currentLabel)} × {previousLabel}</h3>
        <p className="mt-1 text-xs text-ink/60">Mesmo trecho do mês: dias 1 a {data.compare.day}</p>
        <div className="mt-3 divide-y divide-[#f0ebe1]">
          {data.compare.rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_64px_64px_48px] items-center gap-2 py-2.5">
              <span className="text-sm font-semibold">{row.label}</span>
              <span className="text-right text-base font-semibold">{formatValue(row.now, row.unit)}</span>
              <span className="text-right text-sm text-ink/60">{formatValue(row.before, row.unit)}</span>
              <span className="text-right text-sm"><Delta value={row.unit ? null : row.now - row.before} arrowOnly={row.unit ? Math.sign(row.now - row.before) : undefined} /></span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink">Reflexões por mês</h3>
          <span className="text-xs text-ink/60">* mês em andamento</span>
        </div>
        <div role="img" aria-label={`Reflexões por mês: ${data.monthly.map((month) => `${month.label} ${month.count}`).join(", ")}`} className="mt-4 grid h-36 grid-cols-7 items-end gap-2">
          {data.monthly.map((month) => (
            <div key={month.month} className="flex h-full flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold text-ink/75">{month.count}</span>
              <div className="w-full rounded-t-md rounded-b-sm" style={{ height: `${Math.max(3, Math.round(month.count / maxMonthly * 100))}px`, background: month.partial ? "#c9d1b4" : "#66704f" }} />
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-ink/55">
          {data.monthly.map((month) => <span key={month.month}>{month.label}{month.partial ? "*" : ""}</span>)}
        </div>
      </Card>

      <Card className="mt-4">
        <h3 className="text-lg font-semibold text-ink">Intenção que virou ação</h3>
        <dl className="mt-2 divide-y divide-[#f0ebe1] text-sm">
          <Row label="Tarefas nascidas de reflexões" value={data.coherence.reflectionTasks ? `${data.coherence.reflectionTasksDone} de ${data.coherence.reflectionTasks} feitas` : "nenhuma ainda"} />
          <Row label="Reflexões AD registradas no mês" value={String(data.coherence.adThisMonth)} />
        </dl>
      </Card>

      <Card className="mt-4">
        <h3 className="text-lg font-semibold text-ink">Próximos marcos</h3>
        <div className="mt-3 space-y-4">
          {milestones.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{item.label}</span>
                <span className="whitespace-nowrap text-ink/60">{item.note}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#efeae0]"><div className="h-full rounded-full bg-olive" style={{ width: `${Math.round(item.current / item.target * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>

      {data.memory ? (
        <Card className="mt-4 border border-dashed border-[#cbbfa8] bg-[#fbf8f1]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6d3b]">Há cerca de 3 meses você escreveu</p>
          <blockquote className="mt-2 text-base leading-7 text-[#3b3224]">“{data.memory.excerpt}”</blockquote>
          <p className="mt-2 text-xs text-[#6b5d45]">Reflexão · {formatDate(data.memory.date)} · {data.memory.topic}</p>
        </Card>
      ) : null}

      <Link prefetch={false} href="/relatorios" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-moss">
        <Download className="h-4 w-4" /> Exportar dados por período
      </Link>
    </div>
  );
}

function Stat({ value, tone, title, detail }: { value: number; tone: string; title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3.5">
      <p className={`text-3xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-4 text-ink/60">{detail}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-2.5"><dt>{label}</dt><dd className="whitespace-nowrap font-semibold">{value}</dd></div>;
}

function Delta({ value, arrowOnly }: { value: number | null; arrowOnly?: number }) {
  const sign = arrowOnly ?? Math.sign(value ?? 0);
  if (!sign) return <span className="font-semibold text-ink/50">=</span>;
  const arrow = sign > 0 ? "↑" : "↓";
  const text = arrowOnly !== undefined ? arrow : `${arrow} ${Math.abs(value ?? 0)}`;
  return <span className={`font-semibold ${sign > 0 ? "text-emerald-800" : "text-red-800"}`}>{text}</span>;
}

function groupFullName(code: PracticeGroupCode) {
  return code === "ED" ? "Práticas ED" : code === "PSYCHOLOGY" ? "Exercícios de psicologia" : "Hábitos gerais";
}

function formatValue(value: number, unit?: "ml") {
  return unit === "ml" ? `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L` : String(value);
}

function monthName(monthKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${monthKey}-15T12:00:00.000Z`));
}

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00.000Z`));
}
