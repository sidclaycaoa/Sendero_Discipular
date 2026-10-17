import { ADSection } from "@/components/refletir/ADSection";
import Link from "next/link";
import { AlertCircle, BookOpenText, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Plus, Play, SlidersHorizontal } from "lucide-react";
import { AppShell, Card, ModuleHeader, Pill } from "@/components/app/AppShell";
import { PostponeButton } from "@/components/refletir/PostponeButton";
import {
  getActiveUser,
  getCurrentReflectionMonthKey,
  getCurrentReflectionCycleDay,
  getReflectionPageData,
  getReflectionCycleWindow,
  getReflectionStats,
  normalizeReflectionMonthKey,
  shiftReflectionMonthKey,
} from "@/lib/db/sendero";
import type { DbReflectionTopic, OverdueReflectionTopic, ReflectionCycleSummary } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function RefletirPage({ searchParams }: { searchParams?: Promise<{ dia?: string; mes?: string; registroAD?: string; fila?: string }> }) {
  const params = await searchParams;
  const selectedCycleDay = params?.dia ? Number(params.dia) : undefined;
  const selectedMonth = normalizeReflectionMonthKey(params?.mes);
  const currentMonth = getCurrentReflectionMonthKey();
  const previousMonth = shiftReflectionMonthKey(selectedMonth, -1);
  const nextMonth = shiftReflectionMonthKey(selectedMonth, 1);
  const todayKey = getSaoPauloDateKey();
  const includePreviousMonth = params?.fila === "anterior";
  const user = await getActiveUser().catch((error) => {
    console.error("Failed to load active user on /refletir", error);
    return null;
  });

  if (!user) {
    return (
      <AppShell>
        <ModuleHeader
          eyebrow="Reflexões estruturadas"
          title="Refletir"
          description="Não foi possível carregar suas reflexões agora. Tente novamente em alguns instantes."
          action={<BookOpenText className="h-6 w-6 text-olive" />}
        />
      </AppShell>
    );
  }

  let topics: DbReflectionTopic[] = [];
  let cycleSummaries: ReflectionCycleSummary[] = [];
  let overdueTopics: OverdueReflectionTopic[] = [];
  let stats = { totalReflections: 0, topics: 0 };
  let overdueCounts = { currentMonth: 0, previousMonth: 0 };
  const cycleWindow = getReflectionCycleWindow(user.cycleAnchorDate, selectedCycleDay, selectedMonth);
  const currentWindow = getReflectionCycleWindow(user.cycleAnchorDate, getCurrentReflectionCycleDay(), currentMonth);

  try {
    const [reflectionData, loadedStats] = await Promise.all([
      getReflectionPageData(user.id, user.cycleAnchorDate, selectedCycleDay, selectedMonth, 400, includePreviousMonth),
      getReflectionStats(user.id),
    ]);
    topics = reflectionData.topics;
    cycleSummaries = reflectionData.cycleSummaries;
    overdueTopics = reflectionData.overdue;
    overdueCounts = reflectionData.overdueCounts;
    stats = loadedStats;
  } catch (error) {
    console.error("Failed to load /refletir data", error);
  }

  const doneCount = topics.filter((topic) => topic.status === "feita").length;
  const pendingCount = topics.length - doneCount;

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Reflexões estruturadas"
        title="Refletir"
        description="Escolha uma tônica, registre sua resposta e retome depois para revisar o que amadureceu."
        action={<BookOpenText className="h-6 w-6 text-olive" />}
      />

      <a href="#historico-ad" className="mt-4 inline-flex min-h-11 items-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-moss">Reflexões AD · histórico e obras aprovadas</a>

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-olive">Bloco {cycleWindow.days.join("-")}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Reflexões do ciclo</h2>
            <p className="mt-1 text-xs text-ink/55">{cycleWindow.dateKeys.join(" a ")}</p>
          </div>
          <Pill tone="accent">{stats.totalReflections} no histórico</Pill>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Feitas" value={String(doneCount)} />
          <MiniStat label="Pendentes" value={String(pendingCount)} />
          <MiniStat label="Temas do bloco" value={String(topics.length)} />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-paper p-2">
          <Link prefetch={false} href={`/refletir?mes=${previousMonth}&dia=${cycleWindow.days[0]}`} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink" aria-label="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 text-center">
            <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase text-olive"><CalendarDays className="h-4 w-4" /> Ciclo mensal</p>
            <p className="mt-1 text-base font-semibold text-ink">{formatMonthLabel(selectedMonth)}</p>
          </div>
          {selectedMonth < currentMonth ? (
            <Link prefetch={false} href={`/refletir?mes=${nextMonth}&dia=${cycleWindow.days[0]}`} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink" aria-label="Próximo mês">
              <ChevronRight className="h-5 w-5" />
            </Link>
          ) : <span className="h-10 w-10" aria-hidden="true" />}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Filtrar ciclo</p>
            <p className="mt-1 text-xs text-ink/55">Verde sem pendências, amarelo parcial, vermelho pendente.</p>
          </div>
          <div className="flex gap-2">
            <Link prefetch={false} href="/refletir/organizar" className="flex min-h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink">
              <SlidersHorizontal className="h-4 w-4" />
            </Link>
            <Link prefetch={false} href="/refletir/nova" className="flex min-h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Nova
            </Link>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
          {Array.from({ length: 15 }).map((_, index) => {
            const day = index * 2 + 1;
            const active = cycleWindow.days[0] === day;
            const isCurrent = selectedMonth === currentMonth && currentWindow.days[0] === day;
            const summary = cycleSummaries.find((item) => item.day === day);
            const isPastOrCurrent = (summary?.dateKeys.at(-1) ?? `${selectedMonth}-01`) <= todayKey;

            return (
              <Link
                key={day}
                prefetch={false}
                href={`/refletir?mes=${selectedMonth}&dia=${day}`}
                className={`rounded-md px-2 py-2 text-center text-xs font-semibold ${getCycleColorClass({ active, isCurrent, isPastOrCurrent, summary })}`}
                title={`${summary?.done ?? 0}/${summary?.total ?? 0} feitas`}
              >
                <span>{day}-{day + 1}{isCurrent ? " ✓" : ""}</span>
                <span className="mt-1 block text-[10px] font-medium opacity-80">{summary?.done ?? 0}/{summary?.total ?? 0}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      <section className="mt-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-olive">Bloco selecionado</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Reflexões dos dias {cycleWindow.days.join(" e ")}</h2>
          </div>
          <Pill tone={pendingCount === 0 ? "good" : "warn"}>{doneCount}/{topics.length} feitas</Pill>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
        {topics.map((item) => {
          const reflectionDate = item.entryDate ?? cycleWindow.dateKeys[0];
          const isOverdue = item.status !== "feita" && cycleWindow.dateKeys.at(-1)! < todayKey;
          return <ReflectionCard key={item.id} item={item} reflectionDate={reflectionDate} cycleDay={cycleWindow.days[0]} selectedMonth={selectedMonth} isOverdue={isOverdue} />;
        })}
        </div>
      </section>

      <section id="fila" className="mt-7 scroll-mt-4 border-t border-line pt-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-red-700"><AlertCircle className="h-4 w-4" /> Fila de recuperação</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Pendências anteriores</h2>
            <p className="mt-1 text-sm text-ink/60">Da mais antiga para a mais recente. É só continuar rolando e responder.</p>
          </div>
          <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-red-100 px-2.5 py-1 text-sm font-bold text-red-800">{overdueTopics.length}</span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Período da fila">
          <QueueFilter href={queueHref(selectedMonth, cycleWindow.days[0], false)} active={!includePreviousMonth} label={`${capitalize(formatMonthName(selectedMonth))} · ${overdueCounts.currentMonth}`} />
          <QueueFilter href={queueHref(selectedMonth, cycleWindow.days[0], true)} active={includePreviousMonth} label={`+ ${formatMonthName(shiftReflectionMonthKey(selectedMonth, -1))} · ${overdueCounts.previousMonth}`} />
        </div>
        {overdueTopics.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {overdueTopics.map((item) => (
              <ReflectionCard
                key={`${item.id}-${item.dueDate}`}
                item={item}
                reflectionDate={item.dueDate}
                cycleDay={item.cycleDay}
                selectedMonth={selectedMonth}
                isOverdue
                dueDate={item.dueDate}
              />
            ))}
          </div>
        ) : (
          <Card className="border border-emerald-400 bg-emerald-50 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-700" />
            <p className="mt-2 font-semibold text-emerald-900">Nenhuma reflexão vencida</p>
            <p className="mt-1 text-sm text-emerald-800/75">Sua fila anterior está em dia.</p>
          </Card>
        )}
      </section>
      <ADSection userId={user.id} selectedId={params?.registroAD} />
    </AppShell>
  );
}

function ReflectionCard({
  item,
  reflectionDate,
  cycleDay,
  selectedMonth,
  isOverdue,
  dueDate,
}: {
  item: DbReflectionTopic;
  reflectionDate: string;
  cycleDay: number;
  selectedMonth: string;
  isOverdue: boolean;
  dueDate?: string;
}) {
  const done = item.status === "feita";
  const subtopic = uniqueText(item.topic, item.subtopic);
  const orientation = uniqueText([item.topic, item.subtopic].filter(Boolean).join(" "), item.orientation);
  const stateClass = done
    ? "border border-emerald-600 bg-emerald-50"
    : isOverdue
      ? "border border-red-500 bg-red-50"
      : "border border-amber-500 bg-amber-50";

  return (
    <Card className={stateClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold ${done ? "text-emerald-800" : isOverdue ? "text-red-800" : "text-amber-800"}`}>
            {item.period} - {item.category}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-6 text-ink">{item.topic}</h3>
          {subtopic ? <p className="mt-1 text-xs text-ink/60">{subtopic}</p> : null}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${done ? "bg-emerald-700 text-white" : isOverdue ? "bg-red-700 text-white" : "bg-amber-500 text-amber-950"}`}>
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : isOverdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
          {done ? "Feita" : isOverdue ? "Vencida" : "Pendente"}
        </span>
      </div>
      {dueDate ? <p className="mt-3 text-xs font-semibold text-red-800">Prevista para {formatDateLabel(dueDate)}</p> : null}
      {orientation ? <p className="mt-3 text-sm leading-6 text-ink/75">{orientation}</p> : null}
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Link prefetch={false} href={`/refletir/${item.id}?date=${reflectionDate}&dia=${cycleDay}&mes=${selectedMonth}`} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-paper">
          <Play className="h-4 w-4" /> {done ? "Revisar" : "Refletir"}
        </Link>
        {!done ? <PostponeButton compact templateId={item.templateId} dateKey={reflectionDate} /> : null}
      </div>
    </Card>
  );
}

function getCycleColorClass({
  active,
  isCurrent,
  isPastOrCurrent,
  summary
}: {
  active: boolean;
  isCurrent: boolean;
  isPastOrCurrent: boolean;
  summary?: ReflectionCycleSummary;
}) {
  if (active) return "bg-ink text-paper ring-2 ring-ink";
  if (!isPastOrCurrent) return isCurrent ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500" : "bg-paper text-ink/65";
  if (!summary || summary.total === 0 || summary.pending === 0) return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300";
  if (summary.done > 0) return "bg-amber-100 text-amber-900 ring-1 ring-amber-300";
  return "bg-red-100 text-red-900 ring-1 ring-red-300";
}

function QueueFilter({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link prefetch={false} href={href} aria-current={active ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${active ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink"}`}>
      {label}
    </Link>
  );
}

function queueHref(month: string, day: number, includePreviousMonth: boolean) {
  return `/refletir?mes=${month}&dia=${day}${includePreviousMonth ? "&fila=anterior" : ""}#fila`;
}

function formatMonthName(monthKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${monthKey}-15T12:00:00.000Z`));
}

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-paper p-3">
      <p className="text-xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink/55">{label}</p>
    </div>
  );
}

function formatMonthLabel(monthKey: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthKey}-15T12:00:00.000Z`));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function uniqueText(reference: string, value?: string) {
  if (!value?.trim()) return "";
  const normalize = (text: string) => text.trim().toLocaleLowerCase("pt-BR").replace(/[\s.;:,!?]+/g, " ");
  const normalizedValue = normalize(value);
  return normalize(reference).includes(normalizedValue) ? "" : value;
}
