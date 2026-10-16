export const dynamic = "force-dynamic";
import { HabitsScreen } from "@/components/habitos/HabitsScreen";
import { getActiveUser, getHabitDashboard } from "@/lib/db/sendero";

export default async function HabitosPage() {
  const user = await getActiveUser();
  const dashboard = user ? await getHabitDashboard(user.id) : null;
  return <HabitsScreen dashboard={dashboard} />;
}
