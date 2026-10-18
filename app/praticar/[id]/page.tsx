import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { PracticePlayer } from "@/components/praticar/PracticePlayer";
import { getActiveUser, getPracticeHabit } from "@/lib/db/sendero";
import { practiceTool } from "@/lib/practice";

export const dynamic = "force-dynamic";

export default async function PraticarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getActiveUser();
  const habit = user ? await getPracticeHabit(user.id, id) : null;
  const tool = practiceTool(habit?.practiceTool);
  if (!habit || !tool) notFound();
  if (tool.kind === "link") redirect(tool.href);
  return (
    <AppShell showDailyTonic={false}>
      <PracticePlayer habit={habit} tool={tool} />
    </AppShell>
  );
}
