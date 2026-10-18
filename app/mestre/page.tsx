import { HelpCircle } from "lucide-react";
import { AppShell, ModuleHeader } from "@/components/app/AppShell";
import { MasterQuestionList } from "@/components/mestre/MasterQuestionList";
import { getActiveUser } from "@/lib/db/sendero";
import { listMasterQuestions } from "@/lib/db/pendencias";

export const dynamic = "force-dynamic";

export default async function MestrePage() {
  const user = await getActiveUser();
  const items = user ? await listMasterQuestions(user.id) : [];
  return (
    <AppShell>
      <ModuleHeader eyebrow="Escola do Discipulado" title="Para falar com meu mestre" description="Dúvidas guardadas das reflexões e do Diário, com o contexto em que surgiram." action={<HelpCircle className="h-6 w-6 text-violet-700" />} />
      <MasterQuestionList items={items} />
    </AppShell>
  );
}
