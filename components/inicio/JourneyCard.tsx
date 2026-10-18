import Link from "next/link";
import type { JourneyCardData } from "@/lib/db/jornada";
import { STAGES, longDate, roman } from "@/lib/jornada-shared";

/** Início: the labor of the month on the journey, and a quiet line on a day a stone of the path is reached. */
export function JourneyCard({ journey }: { journey: JourneyCardData }) {
  const { stage } = journey;
  const circumference = 2 * Math.PI * 26;
  return (
    <>
      {stage === null ? (
        <Link prefetch={false} href="/jornada" className="mt-4 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-vase p-4 text-[#f1e6da] shadow-soft">
          <span className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-double border-terra font-myth text-2xl font-bold text-terra" aria-hidden="true">{roman(journey.position)}</span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-terra">Jornada · prólogo</span>
            <strong className="mt-0.5 block font-myth text-xl font-semibold leading-tight text-[#fbf3ea]">{journey.labor}</strong>
            <span className="mt-1 block text-[13px] text-[#d9cbbd]">{journey.hero} começa em {longDate(journey.prelude!)}</span>
            <span className="mt-1.5 block text-[13px] font-semibold text-terra">Ler o primeiro trabalho ›</span>
          </span>
        </Link>
      ) : <Link prefetch={false} href="/jornada" className="mt-4 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-vase p-4 text-[#f1e6da] shadow-soft">
        <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`Etapa ${stage.index + 1} de ${STAGES.length}`}>
          <circle cx="32" cy="32" r="26" fill="none" stroke="#3a322c" strokeWidth="5" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="#c46a3d" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${circumference * ((stage.index + 0.5) / STAGES.length)} ${circumference}`} transform="rotate(-90 32 32)" />
          <text x="32" y="38" textAnchor="middle" fontFamily="'Cormorant SC', Georgia, serif" fontSize="18" fontWeight="700" fill="#fbf3ea">{stage.index + 1}/{STAGES.length}</text>
        </svg>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-terra">Jornada · {journey.hero} {roman(journey.position)} · {STAGES[stage.index].name.toLocaleLowerCase("pt-BR")}</span>
          <strong className="mt-0.5 block font-myth text-xl font-semibold leading-tight text-[#fbf3ea]">{journey.labor}</strong>
          <span className="mt-1 block truncate text-[13px] text-[#d9cbbd]">{journey.monster ? `“${journey.monster}”` : "Dê nome ao monstro deste mês"}</span>
          <span className="mt-1.5 block text-[13px] font-semibold text-terra">Abrir a jornada ›</span>
        </span>
      </Link>}
      {journey.marks.length ? (
        <p className="mt-3 flex items-center gap-2.5 rounded-xl border border-[#e6d6c4] bg-[#fbf5ee] p-3 text-sm text-[#4a3424]">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0"><path d="M3 17 C5 10 9 6 11 4 C13 6 17 10 19 17 Z" fill="#c46a3d" /><path d="M2 18 H20" stroke="#1d1a17" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <span><b>Hoje, na jornada:</b> {journey.marks.join(" · ")}.</span>
        </p>
      ) : null}
    </>
  );
}
