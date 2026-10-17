"use client";

import Link from "next/link";
import { BookOpenText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type Tonic = {
  date: string;
  code: string;
  title: string;
  synthesis: string;
  phase: { sequence: number; title: string; objective: string };
};

export function DailyTonicStrip() {
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

  if (!tonic) return <div className="mb-4 h-20 animate-pulse rounded-2xl border border-violet-100 bg-violet-50/60" aria-label="Carregando tônica do dia" />;

  return (
    <section className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-soft" aria-label="Tônica do dia">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-700 text-white"><Sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Tônica de hoje · Fase {tonic.phase.sequence}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-violet-950">{tonic.code} · {tonic.title}</p>
          <p className="mt-1 text-sm leading-5 text-violet-900/75">{tonic.synthesis}</p>
        </div>
        <Link prefetch={false} href="/fases-ed" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-200 bg-white text-violet-800" aria-label="Consultar as sete fases da Escola do Discipulado"><BookOpenText className="h-5 w-5" /></Link>
      </div>
    </section>
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
