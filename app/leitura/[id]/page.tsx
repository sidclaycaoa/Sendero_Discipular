import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { ItemScreen } from "@/components/leitura/ItemScreen";
import { getSaoPauloDateKey } from "@/lib/date";
import { getActiveUser } from "@/lib/db/sendero";
import { getReadingItem } from "@/lib/db/leitura";

export const dynamic = "force-dynamic";

export default async function LeituraItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getActiveUser();
  const detail = user ? await getReadingItem(user.id, id) : null;
  if (!detail) notFound();
  return (
    <AppShell showDailyTonic={false}>
      <ItemScreen key={detail.item.updatedAt} detail={detail} today={getSaoPauloDateKey()} />
    </AppShell>
  );
}
