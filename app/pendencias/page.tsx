import { ListTodo } from "lucide-react";
import { AppShell, ModuleHeader } from "@/components/app/AppShell";
import { FeedbackList } from "@/components/pendencias/FeedbackList";
import { getActiveUser } from "@/lib/db/sendero";
import { listFeedback } from "@/lib/db/pendencias";

export const dynamic = "force-dynamic";

export default async function PendenciasPage() {
  const user = await getActiveUser();
  const items = user ? await listFeedback(user.id) : [];
  return (
    <AppShell>
      <ModuleHeader eyebrow="Melhoria contínua" title="Pendências do app" description="Bugs e melhorias que você registrou. Ficam aqui até serem resolvidos." action={<ListTodo className="h-6 w-6 text-olive" />} />
      <FeedbackList items={items} />
    </AppShell>
  );
}
