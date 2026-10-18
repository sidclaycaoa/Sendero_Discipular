import { InicioScreen } from "@/components/inicio/InicioScreen";
import { getActiveUser, getDailyDiscipleshipTonic, getDiaryEntry, getDiscipleshipCatalog, getOpenTasks, getReflectionAttendance, getReflectionPageData } from "@/lib/db/sendero";
import type { ReflectionAttendance } from "@/lib/db/sendero";
import { getPercursoData } from "@/lib/db/percurso";
import { countOpenMasterQuestions } from "@/lib/db/pendencias";
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
  let tonicPosition: { current: number; total: number } | null = null;
  let attendance: { current: ReflectionAttendance; previous: ReflectionAttendance } | null = null;
  let masterQuestions = 0;
  const todayKey = getSaoPauloDateKey();

  try {
    const [reflectionData, loadedTasks, diaryEntry, loadedPercurso, tonic, catalog, loadedAttendance, openMasterQuestions] = await Promise.all([
      getReflectionPageData(user.id, user.cycleAnchorDate, undefined, undefined, 60),
      getOpenTasks(user.id),
      getDiaryEntry(user.id, todayKey),
      getPercursoData(user.id, todayKey).catch((error) => { console.error("Failed to load percurso", error); return null; }),
      getDailyDiscipleshipTonic(user.id, todayKey).catch(() => null),
      getDiscipleshipCatalog(user.id).catch(() => []),
      getReflectionAttendance(user.id, todayKey).catch(() => null),
      countOpenMasterQuestions(user.id).catch(() => 0),
    ]);
    masterQuestions = openMasterQuestions;
    attendance = loadedAttendance;

    topics = reflectionData.topics;
    overdueReflections = reflectionData.overdue;
    openTasks = loadedTasks;
    diaryDone = Boolean(diaryEntry);
    percurso = loadedPercurso;
    const topicIds = catalog.flatMap((phase) => phase.topics.map((topic) => topic.id));
    const position = tonic ? topicIds.indexOf(tonic.id) : -1;
    tonicPosition = position >= 0 ? { current: position + 1, total: topicIds.length } : null;
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
      tonicPosition={tonicPosition}
      attendance={attendance}
      masterQuestions={masterQuestions}
    />
  );
}
