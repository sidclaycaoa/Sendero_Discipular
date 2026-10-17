import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ReflectionWriter } from "@/components/refletir/ReflectionWriter";
import { getActiveUser, getReflectionCycleWindow, getReflectionEntryForWindow, getReflectionTopicById } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function ReflectionWritePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ date?: string; dia?: string; mes?: string }>;
}) {
  const today = getSaoPauloDateKey();
  const query = await searchParams;
  const requestedDateKey = isDateKey(query?.date) ? query?.date : undefined;
  const selectedCycleDay = query?.dia ? Number(query.dia) : undefined;
  const user = await getActiveUser().catch((error) => {
    console.error("Failed to load active user on reflection detail", error);
    return null;
  });
  if (!user) notFound();

  const { id } = await params;
  const reflection = await getReflectionTopicById(user.id, id).catch((error) => {
    console.error("Failed to load reflection detail", error);
    return null;
  });
  if (!reflection) notFound();

  let initialText = "";
  let entryDateKey = requestedDateKey ?? today;
  const cycleWindow = getReflectionCycleWindow(user.cycleAnchorDate, selectedCycleDay, query?.mes);
  const candidateDateKeys = requestedDateKey ? [requestedDateKey] : cycleWindow.dateKeys;

  try {
    const todayEntry = await getReflectionEntryForWindow(user.id, reflection.templateId, candidateDateKeys);
    initialText = todayEntry?.contentText ?? "";
    entryDateKey = todayEntry?.date.toISOString().slice(0, 10) ?? entryDateKey;
  } catch (error) {
    console.error("Failed to load reflection entry", error);
  }

  return (
    <AppShell>
      <Link href={query?.mes ? `/refletir?mes=${query.mes}${selectedCycleDay ? `&dia=${selectedCycleDay}` : ""}` : "/refletir"} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink/70">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <ReflectionWriter
        key={`${reflection.templateId}:${entryDateKey}`}
        reflection={reflection}
        initialText={initialText}
        dateKey={entryDateKey}
        backHref={query?.mes ? `/refletir?mes=${query.mes}${selectedCycleDay ? `&dia=${selectedCycleDay}` : ""}` : selectedCycleDay ? `/refletir?dia=${selectedCycleDay}` : "/refletir"}
      />
    </AppShell>
  );
}

function isDateKey(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
