import { BookOpenText, Sparkles } from "lucide-react";
import { AppShell, Card, ModuleHeader, Pill } from "@/components/app/AppShell";
import { getActiveUser, getDailyDiscipleshipTonic, getDiscipleshipCatalog } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function FasesEdPage() {
  const user = await getActiveUser();
  const [catalog, tonic] = user ? await Promise.all([
    getDiscipleshipCatalog(user.id),
    getDailyDiscipleshipTonic(user.id, getSaoPauloDateKey()),
  ]) : [[], null];

  return <AppShell>
    <ModuleHeader eyebrow="Escola do Discipulado" title="As sete fases da ED" description="Uma referência para retomar a estrutura do caminho e reconhecer a tônica vivida a cada dia." action={<BookOpenText className="h-6 w-6 text-olive" />} />
    {tonic ? <Card className="mt-4 border-violet-200 bg-violet-50"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-700 text-white"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Tônica de hoje</p><p className="mt-1 text-base font-semibold text-violet-950">{tonic.code} · {tonic.title}</p><p className="mt-1 text-sm leading-5 text-violet-900">Fase {tonic.phase.sequence} · {tonic.phase.title}</p></div></div></Card> : null}
    <div className="mt-5 space-y-4">
      {catalog.map((phase) => <Card key={phase.id} className="border-olive/20"><div className="flex items-start gap-3"><Pill tone="accent">Fase {phase.sequence}</Pill><div className="min-w-0"><h2 className="text-lg font-semibold text-ink">{phase.title}</h2><p className="mt-1 text-sm leading-6 text-ink/70"><span className="font-semibold text-ink">Objetivo:</span> {phase.objective}</p></div></div><ol className="mt-4 space-y-2 border-t border-line pt-4">{phase.topics.map((topic) => { const current = tonic?.id === topic.id; return <li key={topic.id} className={`flex gap-3 rounded-xl px-3 py-2.5 text-sm leading-5 ${current ? "bg-violet-100 text-violet-950" : "bg-paper text-ink/80"}`}><span className="shrink-0 font-bold">{topic.code}</span><span className="font-medium">{topic.title}</span>{current ? <span className="ml-auto shrink-0 text-xs font-bold uppercase tracking-wide text-violet-700">Hoje</span> : null}</li>; })}</ol></Card>)}
    </div>
  </AppShell>;
}
