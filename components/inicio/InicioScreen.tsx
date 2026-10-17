import Link from "next/link";
import { ArrowRight, BookOpenText, CalendarCheck2, Clock3, Moon, Settings, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { DailyTonicStrip } from "@/components/app/DailyTonicStrip";
import { calculateMortem } from "@/lib/services/MortemService";
import { PercursoSections, TodayRings } from "@/components/inicio/PercursoSections";
import type { PercursoData } from "@/lib/db/percurso";
import type { DbReflectionTopic, OpenTask, OverdueReflectionTopic } from "@/lib/db/sendero";

type InicioScreenProps = { realUser?: { name: string; birthDate: string; mortemTargetAge: number }; realReflectionTopics?: DbReflectionTopic[]; overdueReflections?: OverdueReflectionTopic[]; openTasks?: OpenTask[]; diaryDone?: boolean; todayKey?: string; percurso?: PercursoData | null; tonicPosition?: { current: number; total: number } | null };

export function InicioScreen({ realUser, realReflectionTopics = [], overdueReflections = [], openTasks = [], diaryDone = false, todayKey = new Date().toISOString().slice(0, 10), percurso = null, tonicPosition = null }: InicioScreenProps) {
  const topics = realReflectionTopics;
  const pending = topics.filter(topic => topic.status !== "feita").length;
  const lateTasks = openTasks.filter(task => task.proximity === "late").length;
  const reflectionsDone = topics.length - pending + (diaryDone ? 1 : 0);
  const mortem = realUser ? calculateMortem(realUser.birthDate, realUser.mortemTargetAge, new Date(`${todayKey}T12:00:00.000Z`)) : null;
  const action = !diaryDone ? { href: "/diario", label: "Registrar o diário de hoje", detail: "Um registro consciente encerra o dia com direção." } : pending ? { href: "/refletir", label: `${pending} reflex${pending === 1 ? "ão pendente" : "ões pendentes"}`, detail: "Retome uma por vez; a fila fica organizada na tela de reflexões." } : lateTasks ? { href: "/tarefas", label: `${lateTasks} tarefa${lateTasks === 1 ? " atrasada" : "s atrasadas"}`, detail: "Escolha a mais importante e dê um próximo passo concreto." } : { href: "/habitos", label: "Sustentar os hábitos de hoje", detail: "A constância preserva o caminho quando não há urgências." };
  return <AppShell showDailyTonic={false}>
    <header className="rounded-2xl bg-ink p-5 text-paper shadow-soft">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-paper/65">{greeting()}, {realUser?.name ?? "Sidclay"}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Trilha Discipular</h1></div><Link prefetch={false} href="/configuracoes" className="shrink-0 rounded-full border border-white/15 bg-white/10 p-3" aria-label="Configurações"><Settings className="h-5 w-5" /></Link></div>
      {mortem ? <div className="mt-5 grid grid-cols-[1fr_auto] gap-4 border-t border-white/10 pt-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-paper/55">Mortem</p><p className="mt-1 text-2xl font-semibold text-paper">{mortem.livedPercentage.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% <span className="text-sm font-medium text-paper/60">vivido</span></p></div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wide text-paper/55">Tempo restante</p><p className="mt-1 text-xl font-semibold text-clay">{mortem.remainingDays.toLocaleString("pt-BR")} <span className="text-sm font-medium text-paper/60">dias</span></p></div></div> : null}
    </header>

    <div className="mt-4"><DailyTonicStrip /></div>

    {percurso ? <TodayRings groups={percurso.today.groups} reflections={{ done: reflectionsDone, total: topics.length + 1 }} /> : null}

    <Link prefetch={false} href={action.href} className="mt-4 block rounded-2xl bg-emerald-800 p-5 text-white shadow-soft transition active:scale-[0.99]"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Direção de hoje</p><p className="mt-2 text-lg font-semibold leading-6">{action.label}</p><p className="mt-2 text-sm leading-5 text-emerald-100">{action.detail}</p><p className="mt-4 flex items-center gap-2 text-sm font-semibold">Abrir agora <ArrowRight className="h-4 w-4" /></p></div></div></Link>

    <section className="mt-4 grid grid-cols-2 gap-3" aria-label="Resumo do dia">
      <BigNumber href="/refletir" icon={<BookOpenText />} label="Reflexões" value={String(pending)} note={pending ? "a retomar" : "em dia"} tone={pending ? "warn" : "good"} />
      <BigNumber href="/refletir" icon={<Clock3 />} label="Pendências" value={String(overdueReflections.length)} note="de ciclos anteriores" tone={overdueReflections.length ? "alert" : "good"} />
      <BigNumber href="/diario" icon={<Moon />} label="Diário" value={diaryDone ? "feito" : "hoje"} note={diaryDone ? "registro concluído" : "ainda pendente"} tone={diaryDone ? "good" : "warn"} />
      <BigNumber href="/tarefas" icon={<CalendarCheck2 />} label="Tarefas" value={String(lateTasks)} note={lateTasks ? "atrasadas" : "sem atrasos"} tone={lateTasks ? "alert" : "good"} />
    </section>


    {percurso ? <PercursoSections data={percurso} tonicPosition={tonicPosition} /> : null}
  </AppShell>;
}

function BigNumber({ href, icon, label, value, note, tone }: { href: string; icon: React.ReactNode; label: string; value: string; note: string; tone: "good" | "warn" | "alert" }) {
  const style = tone === "alert" ? "border-red-200 bg-red-50 text-red-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900";
  return <Link prefetch={false} href={href} className={`min-w-0 rounded-xl border p-3 ${style}`}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span><span className="truncate">{label}</span></div><p className="mt-3 truncate text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 min-h-4 text-xs leading-4 opacity-75">{note}</p></Link>;
}
function greeting() { const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date())); return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"; }
