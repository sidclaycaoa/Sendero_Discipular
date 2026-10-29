import { BookMarked } from "lucide-react";
import { AppShell, ModuleHeader } from "@/components/app/AppShell";
import { MemorizeList } from "@/components/memorizar/MemorizeList";
import { getSaoPauloDateKey } from "@/lib/date";
import { getActiveUser } from "@/lib/db/sendero";
import { listMemorizationTexts } from "@/lib/db/memorizacao";

export const dynamic = "force-dynamic";

export default async function MemorizarPage() {
  const user = await getActiveUser();
  const texts = user ? await listMemorizationTexts(user.id) : [];
  return (
    <AppShell showDailyTonic={false}>
      <ModuleHeader eyebrow="Prática da ED" title="Memorização" description="Textos decorados linha a linha: ler, metade escondida, 80% escondido, de cor. Cada linha nova se soma às que você já sabe." action={<BookMarked className="h-6 w-6 text-olive" />} />
      <MemorizeList texts={texts} today={getSaoPauloDateKey()} />
    </AppShell>
  );
}
