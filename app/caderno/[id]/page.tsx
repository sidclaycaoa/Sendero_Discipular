import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { NotebookScreen } from "@/components/caderno/NotebookScreen";
import { getActiveUser } from "@/lib/db/sendero";
import { getNotebook } from "@/lib/db/caderno";

export const dynamic = "force-dynamic";

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getActiveUser();
  if (!user) notFound();
  const data = await getNotebook(user.id, (await params).id);
  if (!data) notFound();
  return <AppShell><NotebookScreen {...data} /></AppShell>;
}
