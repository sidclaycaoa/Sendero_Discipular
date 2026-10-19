import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { PageEditor } from "@/components/caderno/PageEditor";
import { getActiveUser } from "@/lib/db/sendero";
import { getPage } from "@/lib/db/caderno";

export const dynamic = "force-dynamic";

export default async function NotePagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getActiveUser();
  if (!user) notFound();
  const data = await getPage(user.id, (await params).id);
  if (!data || data.page.archivedAt) notFound();
  // A new key after a restore or a move opens the editor again with the server's text.
  return <AppShell showDailyTonic={false}><PageEditor key={data.page.updatedAt} {...data} /></AppShell>;
}
