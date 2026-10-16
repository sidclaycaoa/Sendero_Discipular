import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { AppShell, ModuleHeader } from "@/components/app/AppShell";
import { ReflectionCycleManager } from "@/components/refletir/ReflectionCycleManager";

export default function OrganizarReflexoesPage() {
  return (
    <AppShell>
      <Link href="/refletir" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink/70">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <ModuleHeader
        eyebrow="Ciclo de reflexões"
        title="Organizar"
        description="Ajuste em quais dias ou blocos cada reflexão aparece no ciclo de 30 dias."
        action={<SlidersHorizontal className="h-6 w-6 text-olive" />}
      />

      <ReflectionCycleManager />
    </AppShell>
  );
}
