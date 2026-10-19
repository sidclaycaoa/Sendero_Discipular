import { AppShell } from "@/components/app/AppShell";
import { CadernoHome } from "@/components/caderno/CadernoHome";
import { getActiveUser } from "@/lib/db/sendero";
import { getCadernoHome } from "@/lib/db/caderno";

export const dynamic = "force-dynamic";

export default async function CadernoPage() {
  const user = await getActiveUser();
  if (!user) return <AppShell><p className="text-sm text-ink/70">Usuário não encontrado.</p></AppShell>;
  const data = await getCadernoHome(user.id);
  return <AppShell><CadernoHome {...data} /></AppShell>;
}
