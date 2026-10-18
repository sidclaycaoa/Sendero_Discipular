import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { BastiaoCard } from "@/components/escola/BastiaoCard";
import { getActiveUser } from "@/lib/db/sendero";
import { getBastiao } from "@/lib/db/escola";

export const dynamic = "force-dynamic";

export default async function BastiaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getActiveUser();
  const bastiao = user ? await getBastiao(user.id, id) : null;
  if (!bastiao) notFound();
  const end = new Date(Date.parse(`${bastiao.weekStart}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  return (
    <AppShell showDailyTonic={false}>
      <Link prefetch={false} href="/escola" className="mb-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Escola</Link>
      <p className="mb-2 px-1 text-xs text-ink/50">Semana de {bastiao.weekStart.slice(8, 10)}/{bastiao.weekStart.slice(5, 7)} a {end.slice(8, 10)}/{end.slice(5, 7)}</p>
      <BastiaoCard bastiao={bastiao} liveCount={bastiao.ideas.filter((idea) => idea.live).length} />
    </AppShell>
  );
}
