"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

type AiTonic = {
  title: string;
  synthesis: string;
  practicalDirection: string;
  questions: string[];
};

export function AiTonicBox({
  reflections,
  habits = []
}: {
  reflections: Array<{ topic: string; subtopic?: string; orientation?: string }>;
  habits?: Array<{ title: string; group?: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [tonic, setTonic] = useState<AiTonic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = useMemo(() => {
    const signature = JSON.stringify({ reflections, habits });
    return `sendero:tonica:${new Date().toISOString().slice(0, 10)}:${hashText(signature)}`;
  }, [habits, reflections]);

  useEffect(() => {
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) {
      setTonic(JSON.parse(cached));
      return;
    }

    void generate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  async function generate(isAutomatic = false) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/tonica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflections, habits })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.fallback ?? "Configure a chave de IA para gerar a Tônica automaticamente.");
        return;
      }

      setTonic(data.tonic);
      window.sessionStorage.setItem(cacheKey, JSON.stringify(data.tonic));
    } catch {
      setError(isAutomatic ? "Não foi possível gerar a Tônica automaticamente agora." : "Não foi possível chamar a IA agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-dashed border-olive/35 bg-paper/70 p-3">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-olive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Síntese com IA</p>
          {loading ? (
            <p className="mt-1 text-sm leading-6 text-ink/70">Lendo reflexões e hábitos do dia...</p>
          ) : tonic ? (
            <div className="mt-2 space-y-2 text-sm leading-6 text-ink/75">
              <p className="font-semibold text-ink">{tonic.title}</p>
              <p>{tonic.synthesis}</p>
              <p className="rounded-md bg-white p-2">{tonic.practicalDirection}</p>
              <ul className="space-y-1">
                {(tonic.questions ?? []).map((question) => (
                  <li key={question} className="text-xs leading-5 text-ink/62">- {question}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-1 text-sm leading-6 text-ink/70">
              A Tônica será gerada automaticamente quando a IA estiver disponível.
            </p>
          )}
          {error ? <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

function hashText(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
