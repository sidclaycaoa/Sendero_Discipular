import { NotebookPen } from "lucide-react";
import { AppShell, Card, ModuleHeader, Pill } from "@/components/app/AppShell";
import { DiaryActions } from "@/components/diario/DiaryActions";
import { DiaryWriter } from "@/components/diario/DiaryWriter";
import { getActiveUser, getDailyDiscipleshipTonic, getDiaryBornTasks, getDiaryEntry } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";
import { getLiveIdeas } from "@/lib/db/escola";
import { LiveIdeasList } from "@/components/escola/shared";

export const dynamic = "force-dynamic";

const fixedQuestions = [
  "O que eu percebi sobre mim hoje?",
  "Onde eu consegui agir com mais consciência?"
];

const rotatingQuestions = [
  "Que desejo, medo ou impulso apareceu com mais força?",
  "Qual pequena ação concreta nasce do que vivi hoje?",
  "Em que ponto eu repeti um padrão antigo?",
  "O que merece gratidão ou reconhecimento neste dia?",
  "Que tarefa prática ajudaria a sustentar meu crescimento amanhã?"
];

export default async function DiarioPage() {
  const today = getTodayLabel();
  const todayKey = getSaoPauloDateKey();
  const user = await getActiveUser();
  const [savedEntry, tonic, diaryTasks, live] = user ? await Promise.all([
    getDiaryEntry(user.id, todayKey).catch(() => null),
    getDailyDiscipleshipTonic(user.id, todayKey).catch(() => null),
    getDiaryBornTasks(user.id).catch(() => []),
    getLiveIdeas(user.id, todayKey).catch(() => ({ ideas: [] })),
  ]) : [null, null, [], { ideas: [] }];
  const ideas = live.ideas;
  const questions = [...fixedQuestions, getRotatingQuestion(), tonic
    ? `Sobre a Tônica de hoje — ${tonic.code} · ${tonic.title}`
    : "Sobre a Tônica de hoje"];
  // The week's Bastião ideas get their own question, kept once answered.
  if (ideas.length || savedEntry?.answers[4]?.trim()) questions.push("Sobre o Bastião da semana — como vivi as ideias escolhidas hoje?");

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Registro diário"
        title="Diário"
        description="Registre o dia com sinceridade e extraia uma direção prática para amanhã."
        action={<NotebookPen className="h-6 w-6 text-olive" />}
      />

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Perguntas de hoje</h2>
          <Pill tone="accent">{today}</Pill>
        </div>
        {tonic ? <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Quarta reflexão · Tônica do dia</p><p className="mt-1 text-base font-semibold leading-6 text-violet-950">Fase {tonic.phase.sequence} · {tonic.phase.title}</p><p className="mt-1 text-sm leading-6 text-violet-900">{tonic.code} · {tonic.title}</p><p className="mt-2 text-sm leading-5 text-violet-900/75">Objetivo: {tonic.phase.objective}</p></div> : null}
        {ideas.length ? (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-clay">Quinta reflexão · Para viver nesta semana</p>
            <LiveIdeasList ideas={ideas} compact />
          </div>
        ) : null}
        <DiaryWriter questions={questions} dateKey={todayKey} initialAnswers={savedEntry?.answers} />
      </Card>

      <DiaryActions tasks={diaryTasks} defaultDate={addOneDay(todayKey)} />
    </AppShell>
  );
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short"
  }).format(new Date());
}

function getRotatingQuestion() {
  const day = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    day: "numeric"
  }).format(new Date()));

  return rotatingQuestions[(day - 1) % rotatingQuestions.length];
}

function addOneDay(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
