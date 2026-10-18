"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import { TextForm } from "@/components/memorizar/TextForm";
import type { MemorizationText } from "@/lib/db/memorizacao";

export function MemorizeList({ texts, today }: { texts: MemorizationText[]; today: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(texts.length === 0);

  return (
    <section className="mt-4 space-y-3">
      {texts.map((text) => {
        const done = text.known >= text.lines.length;
        return (
          <Link prefetch={false} key={text.id} href={`/memorizar/${text.id}`} className="block">
            <Card>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-ink">{text.title}</p>
                  {text.source ? <p className="mt-0.5 truncate text-xs text-ink/55">{text.source}</p> : null}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-moss" style={{ width: `${Math.round((text.known / text.lines.length) * 100)}%` }} /></div>
                  <p className="mt-1.5 text-xs text-ink/60">
                    {done ? `Texto completo · ${text.lines.length} linhas de cor` : `${text.known} de ${text.lines.length} linhas de cor`}
                    {text.lastPracticeDate ? ` · ${text.lastPracticeDate === today ? "treinou hoje" : `último treino ${formatDate(text.lastPracticeDate)}`}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink/35" aria-hidden="true" />
              </div>
            </Card>
          </Link>
        );
      })}

      {adding ? (
        <Card>
          <p className="mb-3 text-sm font-semibold text-ink">Novo texto para decorar</p>
          <TextForm onDone={(id) => { setAdding(false); if (id) router.push(`/memorizar/${id}`); }} />
        </Card>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-moss"><Plus className="h-4 w-4" aria-hidden="true" /> Novo texto</button>
      )}
    </section>
  );
}

function formatDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}
