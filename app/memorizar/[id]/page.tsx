import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { Trainer } from "@/components/memorizar/Trainer";
import { getActiveUser } from "@/lib/db/sendero";
import { getMemorizationHabit, getMemorizationText } from "@/lib/db/memorizacao";

export const dynamic = "force-dynamic";

export default async function MemorizarTextoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getActiveUser();
  const [text, habit] = user ? await Promise.all([getMemorizationText(user.id, id), getMemorizationHabit(user.id)]) : [null, null];
  if (!text) notFound();
  // Remounts after saving, so progress and edits come back from the database.
  return (
    <AppShell showDailyTonic={false}>
      <Trainer key={text.updatedAt} text={text} hasHabit={Boolean(habit)} />
    </AppShell>
  );
}
