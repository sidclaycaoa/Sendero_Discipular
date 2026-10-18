import { InicioScreen } from "@/components/inicio/InicioScreen";
import { getActiveUser, getDiaryEntry, getOpenTasks, getReflectionAttendance, getReflectionPageData } from "@/lib/db/sendero";
import type { ReflectionAttendance } from "@/lib/db/sendero";
import { getJourneyCard, type JourneyCardData } from "@/lib/db/jornada";
import { getPercursoData } from "@/lib/db/percurso";
import { countOpenMasterQuestions } from "@/lib/db/pendencias";
import { getLiveIdeas } from "@/lib/db/escola";
import type { PercursoData } from "@/lib/db/percurso";
import type { DbReflectionTopic, OpenTask, OverdueReflectionTopic } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const user = await getActiveUser().catch((error) => {
    console.error("Failed to load active user on /inicio", error);
    return null;
  });

  if (!user) {
    return <InicioScreen />;
  }

  let topics: DbReflectionTopic[] = [];
  let overdueReflections: OverdueReflectionTopic[] = [];
  let openTasks: OpenTask[] = [];
  let diaryDone = false;
  let percurso: PercursoData | null = null;
  let journey: JourneyCardData | null = null;
  let attendance: { current: ReflectionAttendance; previous: ReflectionAttendance } | null = null;
  let masterQuestions = 0;
  let school: { ideas: number; livedToday: number } | null = null;
  const todayKey = getSaoPauloDateKey();

  try {
    const [reflectionData, loadedTasks, diaryEntry, loadedPercurso, loadedJourney, loadedAttendance, openMasterQuestions, live] = await Promise.all([
      getReflectionPageData(user.id, user.cycleAnchorDate, undefined, undefined, 60),
      getOpenTasks(user.id),
      getDiaryEntry(user.id, todayKey),
      getPercursoData(user.id, todayKey).catch((error) => { console.error("Failed to load percurso", error); return null; }),
      getJourneyCard(user.id, todayKey).catch((error) => { console.error("Failed to load jornada", error); return null; }),
      getReflectionAttendance(user.id, todayKey).catch(() => null),
      countOpenMasterQuestions(user.id).catch(() => 0),
      getLiveIdeas(user.id, todayKey).catch(() => null),
    ]);
    school = live ? { ideas: live.ideas.length, livedToday: live.ideas.filter((idea) => idea.doneToday).length } : null;
    masterQuestions = openMasterQuestions;
    journey = loadedJourney;
    attendance = loadedAttendance;

    topics = reflectionData.topics;
    overdueReflections = reflectionData.overdue;
    openTasks = loadedTasks;
    diaryDone = Boolean(diaryEntry);
    percurso = loadedPercurso;
  } catch (error) {
    console.error("Failed to load /inicio data", error);
  }

  return (
    <InicioScreen
      realUser={{
        name: user.name,
        birthDate: user.birthDate?.toISOString().slice(0, 10) ?? "1994-01-21",
        mortemTargetAge: user.mortemTargetAge
      }}
      realReflectionTopics={topics}
      overdueReflections={overdueReflections}
      openTasks={openTasks}
      diaryDone={diaryDone}
      todayKey={todayKey}
      percurso={percurso}
      school={school}
      journey={journey}
      attendance={attendance}
      masterQuestions={masterQuestions}
    />
  );
}
