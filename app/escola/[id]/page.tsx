import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ClassView } from "@/components/escola/ClassView";
import { getSaoPauloDateKey } from "@/lib/date";
import { getActiveUser } from "@/lib/db/sendero";
import { getSchoolClass, getSchoolOverview } from "@/lib/db/escola";

export const dynamic = "force-dynamic";

export default async function AulaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getActiveUser();
  const today = getSaoPauloDateKey();
  const [detail, overview] = user ? await Promise.all([getSchoolClass(user.id, id, today), getSchoolOverview(user.id, today)]) : [null, null];
  if (!detail || !overview) notFound();
  return (
    <AppShell showDailyTonic={false}>
      <Link prefetch={false} href="/escola" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Escola</Link>
      <ClassView data={detail} habits={overview.habits} today={today} />
    </AppShell>
  );
}
