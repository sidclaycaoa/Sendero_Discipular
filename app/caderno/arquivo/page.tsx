import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ArchiveList } from "@/components/caderno/ArchiveList";
import { getActiveUser } from "@/lib/db/sendero";
import { getArchive } from "@/lib/db/caderno";

export const dynamic = "force-dynamic";

export default async function CadernoArchivePage() {
  const user = await getActiveUser();
  const archive = user ? await getArchive(user.id) : { notebooks: [], sections: [], pages: [] };
  return (
    <AppShell>
      <div className="space-y-4">
        <Link prefetch={false} href="/caderno" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Caderno</Link>
        <header>
          <h1 className="text-2xl font-semibold text-ink">Arquivo</h1>
          <p className="mt-1 text-sm text-ink/65">O que foi arquivado fica guardado aqui, sem nada apagado.</p>
        </header>
        <ArchiveList archive={archive} />
      </div>
    </AppShell>
  );
}
