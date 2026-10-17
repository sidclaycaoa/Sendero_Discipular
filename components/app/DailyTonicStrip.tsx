"use client";

import Link from "next/link";
import { BookOpenText, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type Tonic = {
  date: string;
  code: string;
  title: string;
  synthesis: string;
  phase: { sequence: number; title: string; objective: string };
};

/** Collapsed to one line on module screens; Início shows it open. */
export function DailyTonicStrip({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [tonic, setTonic] = useState<Tonic | null>(null);

  useEffect(() => {
    let active = true;
    // The tonic changes once a day, so reuse it across page changes instead of refetching.
    const cacheKey = `sendero:tonica:${todayKey()}`;
    const cached = readCachedTonic(cacheKey);
    const load = cached ? Promise.resolve(cached) : fetch("/api/discipulado/tonica")
      .then((response) => response.ok ? response.json() as Promise<{ tonic?: Tonic }> : null)
      .then((data) => {
        if (data?.tonic) {
          try { window.sessionStorage.setItem(cacheKey, JSON.stringify(data.tonic)); } catch {}
        }
        return data?.tonic ?? null;
      });
    void load.then((value) => { if (active && value) setTonic(value); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!tonic) return <div className="mb-4 h-[60px] animate-pulse rounded-2xl border border-violet-100 bg-violet-50/60" aria-label="Carregando tônica do dia" />;

  return (
    <details open={defaultOpen || undefined} className="group mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-soft" aria-label="Tônica do dia">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-700 text-white"><Sparkles className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-violet-800">Tônica de hoje · Fase {tonic.phase.sequence}</span>
          <span className="mt-0.5 block text-sm font-semibold leading-5 text-violet-950">{tonic.code} · {tonic.title}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-violet-700 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex items-start gap-3 border-t border-violet-100 px-3 pb-3 pt-2">
        <p className="min-w-0 flex-1 text-sm leading-5 text-violet-900/80">{tonic.synthesis}</p>
        <Link prefetch={false} href="/fases-ed" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-200 bg-white text-violet-800" aria-label="Consultar as sete fases da Escola do Discipulado"><BookOpenText className="h-5 w-5" /></Link>
      </div>
    </details>
  );
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function readCachedTonic(key: string): Tonic | null {
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? JSON.parse(value) as Tonic : null;
  } catch {
    return null;
  }
}
