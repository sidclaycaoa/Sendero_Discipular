import type { ReactNode } from "react";
import { Database, Download, KeyRound, LogOut, Settings, Shield, SlidersHorizontal } from "lucide-react";
import { AppShell, Card, ModuleHeader, Pill } from "@/components/app/AppShell";
import { AppearanceCard } from "@/components/configuracoes/AppearanceCard";
import { RemindersPanel } from "@/components/configuracoes/RemindersPanel";
import { listReminders, REMINDER_KINDS } from "@/lib/db/lembretes";
import { getActiveUser, getHabitDashboard, getReflectionStats } from "@/lib/db/sendero";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const user = await getActiveUser();
  const [stats, habits, reminders] = user
    ? await Promise.all([getReflectionStats(user.id), getHabitDashboard(user.id), listReminders(user.id)])
    : [{ totalReflections: 0, topics: 0 }, null, []];
  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Base e preferencias"
        title="Configurações"
        description="Perfil, categorias, reflexões atuais, exportação, privacidade e preparação para IA."
        action={<Settings className="h-6 w-6 text-olive" />}
      />

      <AppearanceCard />

      <RemindersPanel reminders={reminders} kinds={REMINDER_KINDS} />

      <section className="mt-4 space-y-3">
        <ConfigItem icon={<KeyRound className="h-5 w-5" />} title="Perfil atual" detail={user ? `${user.name} · uso pessoal protegido.` : "Perfil indisponível."} />
        <ConfigItem icon={<SlidersHorizontal className="h-5 w-5" />} title="Ciclo e hábitos" detail={`Ciclo de 30 dias · ${habits?.habits.length ?? 0} hábitos ativos.`} />
        <ConfigItem icon={<Database className="h-5 w-5" />} title="Base de reflexões" detail={`${stats.totalReflections} reflexões salvas em ${stats.topics} temas ativos.`} />
        <ConfigItem icon={<Download className="h-5 w-5" />} title="Exportar dados" detail="A exportação por seções está disponível em Relatórios." />
        <ConfigItem icon={<Shield className="h-5 w-5" />} title="Privacidade" detail="Acesso por senha e bloqueio por PIN após 5 minutos fora do app." />
      </section>

      <a href="/sair" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800">
        <LogOut className="h-4 w-4" aria-hidden="true" /> Sair agora
      </a>
      <p className="mt-2 text-center text-xs leading-5 text-ink/55">Fecha o acesso neste aparelho. Para voltar, será pedida a senha.</p>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Status da migração</p>
            <p className="mt-1 text-xs text-ink/55">Backup real migrado e referências visuais preservadas.</p>
          </div>
          <Pill tone="good">migrado</Pill>
        </div>
      </Card>
    </AppShell>
  );
}

function ConfigItem({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <Card>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper text-moss">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-ink/65">{detail}</p>
        </div>
      </div>
    </Card>
  );
}
