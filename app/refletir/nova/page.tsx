export const dynamic = "force-dynamic";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { AppShell, ModuleHeader } from "@/components/app/AppShell";
import { NewReflectionForm } from "@/components/refletir/NewReflectionForm";

export default function NewReflectionPage() {
  return (
    <AppShell>
      <Link href="/refletir" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink/70">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <ModuleHeader
        eyebrow="Nova reflexão"
        title="Adicionar"
        description="Crie uma reflexão recorrente e escolha em qual bloco do ciclo de 30 dias ela deve aparecer."
        action={<Plus className="h-6 w-6 text-olive" />}
      />

      <NewReflectionForm />
    </AppShell>
  );
}
