import { AppShell } from "@/components/app/AppShell";
import { EscolaScreen } from "@/components/escola/EscolaScreen";
import { getActiveUser } from "@/lib/db/sendero";
import { getSchoolOverview } from "@/lib/db/escola";

export const dynamic = "force-dynamic";

export default async function EscolaPage() {
  const user = await getActiveUser();
  if (!user) return <AppShell><p className="py-10 text-sm text-ink/60">Perfil indisponível.</p></AppShell>;
  return (
    <AppShell showDailyTonic={false}>
      <EscolaScreen data={await getSchoolOverview(user.id)} />
    </AppShell>
  );
}
