import { Award, Compass, Flame, Lock, Sparkles } from "lucide-react";
import { AppShell, Card, ModuleHeader, Pill } from "@/components/app/AppShell";
import { getActiveUser, getReportDashboard } from "@/lib/db/sendero";

const achievements = [
  { name: "Olhar Interior", progress: "32/50", phase: "formação" },
  { name: "Retorno ao Caminho", progress: "4/7", phase: "inicio" },
  { name: "Constancia Silenciosa", progress: "oculta", phase: "bloqueada" }
];

export const dynamic = "force-dynamic";

export default async function CaminhoPage() {
  const user = await getActiveUser();
  const report = user ? await getReportDashboard(user.id) : null;
  const karma = (report?.totalReflections ?? 0) * 10 + (report?.activeDays ?? 0) * 5 + (report?.habitDailyDone ?? 0) * 3;
  const level = Math.max(1, Math.floor(karma / 400) + 1);
  const nextLevel = level * 400;
  const progress = Math.min(100, Math.round((karma / nextLevel) * 100));
  const journeyLevels = Array.from({ length: 7 }, (_, index) => ({ level: index + 1, name: ["Início", "Ritmo", "Prática", "Constância", "Serviço", "Síntese", "Direção"][index], unlocked: index + 1 <= level }));
  const achievements = [
    { name: "Olhar Interior", progress: `${report?.totalReflections ?? 0} reflexões`, phase: "formação" },
    { name: "Retorno ao Caminho", progress: `${report?.activeDays ?? 0} dias ativos`, phase: "presença" },
    { name: "Constância Silenciosa", progress: report?.habitDailyDone ? `${report.habitDailyDone} práticas` : "em construção", phase: report?.habitDailyDone ? "prática" : "bloqueada" },
  ];
  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Jornada e Karma"
        title="Caminho"
        description="Progressão por ação real, conquistas simbólicas e narrativa do ciclo sem virar jogo infantil."
        action={<Compass className="h-6 w-6 text-olive" />}
      />

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-olive">Nível {level}</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{journeyLevels[Math.min(level - 1, journeyLevels.length - 1)]?.name}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">Agir com consciência: uma ideia só aprofunda quando encontra forma no mundo.</p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-clay to-ink text-paper shadow-soft">
            <Flame className="h-7 w-7" />
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-ink/60">
            <span>{karma} karma</span>
            <span>{nextLevel} próximo nível</span>
          </div>
          <div className="h-3 rounded-full bg-paper">
            <div className="h-3 rounded-full bg-clay" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-moss">Mapa de niveis</h2>
          <Pill tone="accent">presença real</Pill>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {journeyLevels.map((item) => (
            <div key={item.level} className="text-center">
              <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${item.unlocked ? "bg-ink text-paper" : "bg-paper text-slate-400"}`}>
                {item.level}
              </div>
              <p className="mt-2 truncate text-[10px] text-slate-500">{item.name}</p>
            </div>
          ))}
        </div>
      </Card>

      <section className="mt-4 space-y-3">
        <h2 className="text-xs font-bold uppercase text-slate-500">Conquistas</h2>
        {achievements.map((item) => (
          <Card key={item.name}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-paper text-moss">
                {item.phase === "bloqueada" ? <Lock className="h-5 w-5" /> : <Award className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-1 text-xs text-ink/55">{item.phase}</p>
              </div>
              <Pill>{item.progress}</Pill>
            </div>
          </Card>
        ))}
      </section>

      <Card className="mt-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-moss">
          <Sparkles className="h-4 w-4" />
          Jornada do Heroi
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/70">A narrativa do ciclo fica separada dos níveis: ela conta o sentido da travessia, não apenas pontos.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-md bg-paper p-3 text-center">
            <p className="text-lg font-semibold text-ink">{report?.activeDays ?? 0}</p>
            <p className="text-xs text-slate-500">dias ativos</p>
          </div>
          <div className="rounded-md bg-paper p-3 text-center">
            <p className="text-lg font-semibold text-ink">{report?.habitDailyDone ?? 0}</p>
            <p className="text-xs text-slate-500">práticas</p>
          </div>
          <div className="rounded-md bg-paper p-3 text-center">
            <p className="text-lg font-semibold text-ink">{report?.totalReflections ?? 0}</p>
            <p className="text-xs text-slate-500">reflexões</p>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
