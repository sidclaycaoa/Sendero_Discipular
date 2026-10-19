import { AppShell } from "@/components/app/AppShell";
import { FrasesScreen } from "@/components/caderno/FrasesScreen";
import { getActiveUser } from "@/lib/db/sendero";
import { listPassages } from "@/lib/db/frases";

export const dynamic = "force-dynamic";

export default async function FrasesPage() {
  const user = await getActiveUser();
  const data = user ? await listPassages(user.id) : { passages: [], authors: [] };
  return <AppShell><FrasesScreen {...data} /></AppShell>;
}
