"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/app/AppShell";

type DiaryInsight = {
  title?: string;
  synthesis?: string;
  growthSignals?: string[];
  stagnationSignals?: string[];
  questions?: string[];
};

const diaryHistory = [
  {
    date: "2026-05-29",
    excerpt: "Percebi que alguns excessos nascem como compensação emocional antes mesmo da comida."
  },
  {
    date: "2026-05-28",
    excerpt: "A organização no trabalho tem sustentado pequenas melhoras, mas a casa ainda pede mais presença."
  },
  {
    date: "2026-05-25",
    excerpt: "As dificuldades familiares e de escola parecem campo real para perseverança e consciência."
  }
];

export function DiaryInsightBox() {
  const [insight, setInsight] = useState<DiaryInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = useMemo(() => `sendero:diary-insight:${new Date().toISOString().slice(0, 10)}`, []);

  useEffect(() => {
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) {
      setInsight(JSON.parse(cached));
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/ai/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "diary",
            title: "Leitura do Diário",
            periods: ["última semana", "última quinzena", "último mês"],
            history: diaryHistory
          })
        });
        const data = await response.json();
        if (!response.ok) {
          setError("Não foi possível gerar a leitura do diário agora.");
          return;
        }
        setInsight(data.insight);
        window.sessionStorage.setItem(cacheKey, JSON.stringify(data.insight));
      } catch {
        setError("Não foi possível conectar com a IA agora.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [cacheKey]);

  return (
    <Card className="mt-4 border-olive/25 bg-gradient-to-br from-white to-emerald-50">
      <div className="flex gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-olive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Leitura de crescimento</p>
          {loading ? <p className="mt-1 text-sm leading-6 text-ink/70">Lendo semana, quinzena e mês...</p> : null}
          {error ? <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
          {insight ? (
            <div className="mt-2 space-y-3 text-sm leading-6 text-ink/75">
              <p className="font-semibold text-ink">{insight.title}</p>
              <p>{insight.synthesis}</p>
              <SignalList title="Sinais de crescimento" items={insight.growthSignals} />
              <SignalList title="Possíveis estagnações" items={insight.stagnationSignals} />
              <SignalList title="Perguntas para hoje" items={insight.questions} boxed />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function SignalList({ title, items, boxed = false }: { title: string; items?: string[]; boxed?: boolean }) {
  if (!items?.length) return null;

  return (
    <div className={boxed ? "rounded-md bg-white p-3" : ""}>
      <p className="text-xs font-semibold uppercase text-olive">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}
