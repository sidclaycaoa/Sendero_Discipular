import { AppShell } from "@/components/app/AppShell";
import { JornadaScreen } from "@/components/jornada/JornadaScreen";
import { PercursoSections } from "@/components/inicio/PercursoSections";
import { getActiveUser } from "@/lib/db/sendero";
import { getJourney } from "@/lib/db/jornada";
import { getPercursoData } from "@/lib/db/percurso";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function JornadaPage() {
  const user = await getActiveUser();
  if (!user) return <AppShell><p className="text-sm text-ink/70">Usuário não encontrado.</p></AppShell>;
  const todayKey = getSaoPauloDateKey();
  const [journey, percurso] = await Promise.all([
    getJourney(user.id, todayKey),
    getPercursoData(user.id, todayKey).catch((error) => { console.error("Failed to load percurso", error); return null; }),
  ]);
  return (
    <AppShell>
      <JornadaScreen data={journey} todayKey={todayKey} />
      {percurso ? <PercursoSections data={percurso} /> : null}
    </AppShell>
  );
}
