"use client";

import { useState } from "react";
import { CheckCircle2, Edit3, Save } from "lucide-react";
import { useRouter } from "next/navigation";

export function DiaryWriter({
  questions,
  dateKey,
  initialAnswers
}: {
  questions: string[];
  dateKey: string;
  initialAnswers?: string[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<string[]>(
    questions.map((_, index) => initialAnswers?.[index] ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialAnswers?.some((answer) => answer.trim())));
  const [editing, setEditing] = useState(!initialAnswers?.some((answer) => answer.trim()));
  const [error, setError] = useState<string | null>(null);

  async function saveDiary() {
    if (!answers.some((answer) => answer.trim())) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, answers })
      });

      const result = await response.json().catch(() => null) as { saved?: boolean; error?: string } | null;
      if (!response.ok || !result?.saved) {
        setError(result?.error || "Não foi possível salvar o diário agora.");
        return;
      }

      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Não foi possível conectar com o servidor para salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (saved && !editing) return (
    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
      <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700" />
      <p className="mt-3 text-base font-semibold text-emerald-950">Você concluiu o diário de hoje.</p>
      <p className="mt-2 text-sm leading-6 text-emerald-900/75">Volte amanhã para refletir novamente. A constância transforma observação em caminho.</p>
      <button onClick={() => setEditing(true)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800"><Edit3 className="h-4 w-4" />Editar o diário de hoje</button>
    </div>
  );

  return (
    <>
      <div className="mt-4 space-y-4">
        {questions.map((question, index) => (
          <label key={question} className="block">
            <span className="text-sm font-semibold leading-6 text-ink">
              {index + 1}. {question}
            </span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-md border border-line bg-paper p-3 text-sm outline-none focus:border-moss"
              placeholder="Escreva com verdade, sem pressa..."
              value={answers[index]}
              onChange={(event) => {
                setAnswers((current) =>
                  current.map((answer, answerIndex) => (answerIndex === index ? event.target.value : answer))
                );
                setSaved(false);
              }}
            />
          </label>
        ))}
      </div>

      {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}

      <button
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50"
        disabled={saving || !answers.some((answer) => answer.trim())}
        onClick={saveDiary}
      >
        <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar diário"}
      </button>
    </>
  );
}
