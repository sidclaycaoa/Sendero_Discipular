import { TasksScreen } from "@/components/tarefas/TasksScreen";
import { getActiveUser, getPlannerData } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function TarefasPage({ searchParams }: { searchParams?: Promise<{ data?: string }> }) {
  const params = await searchParams;
  const selectedDate = isDateKey(params?.data) ? params.data : getSaoPauloDateKey();
  const user = await getActiveUser();
  const planner = user ? await getPlannerData(user.id, selectedDate) : { tasks: [], events: [], shopping: [], rangeStart: selectedDate, rangeEnd: selectedDate };
  return <TasksScreen {...planner} selectedDate={selectedDate} />;
}

function isDateKey(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
