import { AppShell } from "@/components/app/AppShell";
import { LeituraScreen } from "@/components/leitura/LeituraScreen";
import { getActiveUser } from "@/lib/db/sendero";
import { getReadingOverview } from "@/lib/db/leitura";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";

export const dynamic = "force-dynamic";

export default async function LeituraPage() {
  const user = await getActiveUser();
  if (!user) return <AppShell><p className="py-10 text-sm text-ink/60">Perfil indisponível.</p></AppShell>;
  await ensureSenderoSeeded();
  const [data, habit] = await Promise.all([
    getReadingOverview(user.id),
    getSenderoDb().prepare('SELECT targetCount FROM "HabitTemplate" WHERE userId = ? AND isActive = 1 AND practiceTool = \'LEITURA\' LIMIT 1').bind(user.id).first<{ targetCount: number }>(),
  ]);
  return (
    <AppShell showDailyTonic={false}>
      <LeituraScreen data={data} weeklyGoal={habit?.targetCount ?? null} />
    </AppShell>
  );
}
