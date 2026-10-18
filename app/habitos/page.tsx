import { HabitsScreen } from "@/components/habitos/HabitsScreen";
import { getLiveIdeas } from "@/lib/db/escola";
import { getActiveUser, getHabitDashboard } from "@/lib/db/sendero";

export default async function HabitosPage() {
  const user = await getActiveUser();
  const [dashboard, live] = user ? await Promise.all([getHabitDashboard(user.id), getLiveIdeas(user.id)]) : [null, null];
  return <HabitsScreen dashboard={dashboard} ideas={live?.ideas ?? []} />;
}
