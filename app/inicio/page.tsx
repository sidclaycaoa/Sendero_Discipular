import { InicioScreen } from "@/components/inicio/InicioScreen";
import { getActiveUser, getDiaryEntry, getOpenTasks, getReflectionPageData, getReflectionStats } from "@/lib/db/sendero";
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
  let totalReflections = 0;
  const todayKey = getSaoPauloDateKey();

  try {
    const [reflectionData, loadedTasks, diaryEntry, stats] = await Promise.all([
      getReflectionPageData(user.id, user.cycleAnchorDate, undefined, undefined, 60),
      getOpenTasks(user.id),
      getDiaryEntry(user.id, todayKey),
      getReflectionStats(user.id),
    ]);

    topics = reflectionData.topics.slice(0, 8);
    overdueReflections = reflectionData.overdue;
    openTasks = loadedTasks;
    diaryDone = Boolean(diaryEntry);
    totalReflections = stats.totalReflections;
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
      totalReflections={totalReflections}
    />
  );
}
