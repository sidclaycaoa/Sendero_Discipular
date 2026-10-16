"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/app/AppShell";

type ReflectionInsight = {
  title?: string;
  synthesis?: string;
  recurringPatterns?: string[];
  questions?: string[];
};

export function ReflectionInsightBox({
  title,
  currentPrompt,
  history
}: {
  title: string;
  currentPrompt: string;
  history: Array<{ date?: string; topic?: string; excerpt: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<ReflectionInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = useMemo(() => `sendero:reflection-insight:${hashText(JSON.stringify({ title, currentPrompt, history }))}`, [currentPrompt, history, title]);

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
          body: JSON.stringify({ kind: "reflection", title, currentPrompt, history })
        });
        const data = await response.json();
        if (!response.ok) {
          setError("Não foi possível gerar a leitura deste tema agora.");
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
  }, [cacheKey, currentPrompt, history, title]);

  return (
    <Card className="mt-4 border-olive/25 bg-gradient-to-br from-white to-emerald-50">
      <div className="flex gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-olive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Leitura da IA sobre este tema</p>
          {loading ? <p className="mt-1 text-sm leading-6 text-ink/70">Lendo suas respostas anteriores...</p> : null}
          {error ? <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
          {insight ? (
            <div className="mt-2 space-y-2 text-sm leading-6 text-ink/75">
              <p className="font-semibold text-ink">{insight.title}</p>
              <p>{insight.synthesis}</p>
              {insight.recurringPatterns?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-olive">Padrões percebidos</p>
                  <ul className="mt-1 space-y-1">
                    {insight.recurringPatterns.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ) : null}
              {insight.questions?.length ? (
                <div className="rounded-md bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-olive">Perguntas para aprofundar</p>
                  <ul className="mt-1 space-y-1">
                    {insight.questions.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function hashText(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
