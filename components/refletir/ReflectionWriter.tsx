"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ListPlus, Save } from "lucide-react";
import { Card, Pill } from "@/components/app/AppShell";
import { PostponeButton } from "@/components/refletir/PostponeButton";

type ReflectionWriterProps = {
  reflection: {
    id?: string;
    templateId?: string;
    topic: string;
    subtopic: string;
    orientation: string;
    category: string;
    period: string;
    status: string;
  };
  history?: Array<{ date?: string; topic?: string; excerpt: string }>;
  initialText?: string;
  dateKey?: string;
  backHref?: string;
};

type NextReflection = {
  href: string;
  topic: string;
  subtopic: string;
  isOverdue: boolean;
};

export function ReflectionWriter({
  reflection,
  initialText = "",
  dateKey,
  backHref = "/refletir"
}: ReflectionWriterProps) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(Boolean(initialText));
  const [postponed, setPostponed] = useState(false);
  const [postponedToDate, setPostponedToDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ next: NextReflection | null } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(!initialText);
  const subtopic = uniqueText(reflection.topic, reflection.subtopic);
  const orientation = uniqueText([reflection.topic, reflection.subtopic].filter(Boolean).join(" "), reflection.orientation);

  useEffect(() => {
    if (!timerRunning) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerRunning]);

  // Each reflection mounts a fresh writer (keyed by template and date in the page),
  // so no state can carry over; just start at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
    const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [elapsedSeconds]);

  async function saveReflection() {
    if (!reflection.templateId || !dateKey || !text.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/reflections/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: reflection.templateId, date: dateKey, contentText: text, reflectionTimeSeconds: elapsedSeconds })
      });

      const result = await response.json().catch(() => null) as { saved?: boolean; error?: string; next?: NextReflection | null } | null;
      if (!response.ok || !result?.saved) {
        setError(result?.error || "Não foi possível salvar no banco agora.");
        return;
      }

      setSaved(true);
      setPostponed(false);
      setTimerRunning(false);
      setCompletion({ next: result.next ?? null });
    } catch {
      setError("Não foi possível conectar com o servidor para salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function createTask() {
    if (!reflection.templateId) return;
    setCreatingTask(true);
    setError(null);

    try {
      const response = await fetch("/api/reflections/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: reflection.templateId })
      });

      if (!response.ok) {
        setError("Não foi possível criar a tarefa agora.");
        return;
      }

      setTaskCreated(true);
    } catch {
      setError("Não foi possível conectar com o servidor para criar a tarefa.");
    } finally {
      setCreatingTask(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-olive">{reflection.period} - {reflection.category}</p>
            <h1 className="mt-2 text-lg font-semibold leading-6 text-ink">{reflection.topic}</h1>
            {subtopic ? <p className="mt-1 text-sm text-ink/55">{subtopic}</p> : null}
          </div>
          <Pill tone={saved ? "good" : postponed ? "warn" : "neutral"}>{saved ? "salva" : postponed ? "postergada" : reflection.status}</Pill>
        </div>

        {orientation ? <p className="mt-4 rounded-md bg-paper p-3 text-sm leading-6 text-ink/75">{orientation}</p> : null}

        <div className="mt-4 flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-moss">
            <Clock3 className="h-4 w-4" />
            Tempo de reflexão
          </div>
          <Pill tone="accent">{timerLabel}</Pill>
        </div>
      </Card>

      <Card className="mt-4">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Sua reflexão</span>
          <textarea
            className="mt-3 min-h-64 w-full resize-none rounded-md border border-line bg-paper p-3 text-sm leading-6 outline-none focus:border-moss"
            placeholder="Escreva a resposta desta data."
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setSaved(false);
              setPostponed(false);
            }}
          />
        </label>

        {saved ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Reflexão salva para {dateKey}.</p> : null}
        {taskCreated ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Tarefa criada para hoje.</p> : null}
        {postponed ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800">Reflexão postergada{postponedToDate ? ` para ${postponedToDate}` : ""}.</p> : null}
        {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-paper disabled:opacity-45" disabled={!text.trim() || saving} onClick={saveReflection}>
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <PostponeButton
            templateId={reflection.templateId}
            dateKey={dateKey}
            onPostponed={(nextDate) => {
              setPostponed(true);
              setPostponedToDate(nextDate);
              setSaved(false);
            }}
          />
        </div>

        <button className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink disabled:opacity-50" onClick={createTask} disabled={creatingTask || taskCreated}>
          <ListPlus className="h-4 w-4" />
          {creatingTask ? "Criando tarefa..." : taskCreated ? "Tarefa criada" : "Criar tarefa a partir desta reflexão"}
        </button>
      </Card>

      {completion ? <ReflectionCompletionDialog next={completion.next} onBack={() => router.push(backHref)} onNext={(href) => { setCompletion(null); window.scrollTo({ top: 0, left: 0, behavior: "auto" }); router.push(href); }} /> : null}

    </>
  );
}

function ReflectionCompletionDialog({ next, onBack, onNext }: { next: NextReflection | null; onBack: () => void; onNext: (href: string) => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/55 p-3 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Reflexão salva">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <CheckCircle2 className="h-10 w-10 text-emerald-700" />
        <p className="mt-3 text-lg font-semibold text-ink">Reflexão salva.</p>
        {next ? <>
          <p className="mt-2 text-sm leading-6 text-ink/70">A próxima na sua fila já está pronta para você continuar.</p>
          <div className={`mt-4 rounded-xl border p-3 ${next.isOverdue ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <p className={`text-xs font-bold uppercase ${next.isOverdue ? "text-red-800" : "text-amber-800"}`}>{next.isOverdue ? "Pendência anterior" : "Próxima do ciclo atual"}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{next.topic}</p>
            {next.subtopic ? <p className="mt-1 text-xs text-ink/65">{next.subtopic}</p> : null}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={onBack} className="min-h-12 rounded-xl border border-line px-3 text-sm font-semibold text-ink">Voltar à lista</button>
            <button type="button" onClick={() => onNext(next.href)} className="min-h-12 rounded-xl bg-ink px-3 text-sm font-semibold text-paper">Ir para a próxima</button>
          </div>
        </> : <>
          <p className="mt-2 text-sm leading-6 text-ink/70">Não há outra reflexão pendente nesta fila agora.</p>
          <button type="button" onClick={onBack} className="mt-5 min-h-12 w-full rounded-xl bg-ink px-3 text-sm font-semibold text-paper">Voltar às reflexões</button>
        </>}
      </div>
    </div>
  );
}

function uniqueText(reference: string, value?: string) {
  if (!value?.trim()) return "";
  const normalize = (text: string) => text.trim().toLocaleLowerCase("pt-BR").replace(/[\s.;:,!?]+/g, " ");
  const normalizedValue = normalize(value);
  return normalize(reference).includes(normalizedValue) ? "" : value;
}
