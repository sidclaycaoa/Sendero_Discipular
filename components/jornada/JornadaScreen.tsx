"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import { Sheet } from "@/components/app/Sheet";
import type { JourneyCycle, JourneyData, JourneyLabor, JourneyMyth } from "@/lib/db/jornada";
import { FIELD_LABELS, STAGES, longDate, roman, type CycleField } from "@/lib/jornada-shared";

type Open =
  | { kind: "text"; cycle: JourneyCycle; field: CycleField }
  | { kind: "close"; cycle: JourneyCycle; labor: JourneyLabor }
  | { kind: "labor"; labor: JourneyLabor; elixir: string | null }
  | { kind: "myth"; myth: JourneyMyth };

/**
 * The month's labor of the myth, the wheel of the seven stages, the practices
 * used as weapons, what has happened so far, the path of the myth, the myths
 * still to come and the stones of the path.
 */
export function JornadaScreen({ data, todayKey }: { data: JourneyData; todayKey: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const { labor, myth } = data;
  const futureMyths = data.myths.filter((item) => item.position > (data.prelude !== null ? 1 : myth.position));
  const stageName = data.prelude !== null ? null : STAGES[data.stage.index].name;

  return (
    <div className="space-y-4">
      <Link prefetch={false} href="/inicio" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Início</Link>

      <section className="relative overflow-hidden rounded-2xl bg-vase px-5 pb-5 pt-6 text-[#f1e6da] shadow-soft" aria-label="O trabalho do mês">
        <Meander className="top-0" />
        <div className="flex items-center gap-4">
          <Medal number={labor.position} state="now" size="lg" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-terra">{myth.hero} · {roman(labor.position)} de {roman(myth.labors.length)}</p>
            <h1 className="mt-1 font-myth text-[30px] font-semibold leading-none text-[#fbf3ea]">{labor.title}</h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#d9cbbd]">{labor.story}</p>
        <p className="mt-3 text-sm leading-6 text-[#f6ece2]"><b className="font-semibold text-terra">O que simboliza:</b> {labor.symbol}</p>
        <p className="mt-3 border-t border-[#3a322c] pt-3 text-sm leading-6 text-[#f6ece2]"><b className="font-semibold text-terra">A pergunta do mês:</b> {labor.question}</p>
        {data.prelude !== null ? (
          <p className="mt-4 rounded-xl border border-[#4a3f37] bg-[#2c2622] p-3 text-sm leading-6 text-[#f1e6da]"><span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-terra">Prólogo · começa em {longDate(data.prelude)}</span>Até lá, leia o primeiro trabalho com calma e pense: qual é o seu leão?</p>
        ) : (
          <button type="button" onClick={() => setOpen({ kind: "text", cycle: data.cycle, field: "monster" })} className="mt-4 block w-full rounded-xl border border-[#4a3f37] bg-[#2c2622] p-3 text-left">
            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#b7a493]">O meu monstro</span>
            <span className={`mt-1 block text-[15px] ${data.cycle.monster ? "italic text-[#fbf3ea]" : "text-[#b7a493]"}`}>{data.cycle.monster ? `“${data.cycle.monster}”` : "Toque para dar nome ao monstro deste mês"}</span>
          </button>
        )}
        <Meander className="bottom-0" />
      </section>

      {data.prelude === null ? <CurrentCycle data={data} setOpen={setOpen} /> : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-bronze">{myth.hero} · {myth.tradition}</p>
        <h2 className="mt-1 font-myth text-2xl font-semibold text-ink">{myth.title}</h2>
        <p className="mt-1 text-sm leading-6 text-ink/70">{myth.summary}</p>
        <div className="relative mt-3">
          <span className="absolute bottom-6 left-[27px] top-6 w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--color-line)_0_6px,transparent_6px_11px)]" aria-hidden="true" />
          {data.path.map((station) => (
            <button key={station.labor.id} type="button" onClick={() => setOpen({ kind: "labor", labor: station.labor, elixir: station.elixir })} className="relative grid w-full grid-cols-[56px_minmax(0,1fr)] items-center gap-3 py-1.5 text-left">
              <Medal number={station.labor.position} state={station.state} />
              <span className="min-w-0">
                <strong className={`block font-myth text-lg font-semibold leading-tight ${station.state === "ahead" ? "text-ink/60" : "text-ink"}`}>{station.labor.title}</strong>
                <small className={`mt-0.5 block text-[12.5px] leading-snug ${station.state === "now" ? "font-semibold text-bronze" : "text-ink/60"}`}>{stationNote(station, stageName, data.prelude)}</small>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {futureMyths.length ? (
        <Card>
          <h2 className="text-lg font-semibold text-ink">Os mitos que virão</h2>
          <p className="mt-1 text-xs text-ink/60">Um trabalho por mês, nesta ordem. Toque para ver as etapas.</p>
          <div className="mt-3 divide-y divide-[#f0ebe1]">
            {futureMyths.map((item) => (
              <button key={item.id} type="button" onClick={() => setOpen({ kind: "myth", myth: item })} className="flex w-full items-center gap-3 py-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] border-double border-line font-myth text-sm font-bold text-ink/60">{roman(item.position)}</span>
                <span className="min-w-0 flex-1"><strong className="block font-myth text-lg font-semibold leading-tight text-ink">{item.hero}</strong><small className="block text-xs text-ink/60">{item.title} · {item.labors.length} meses</small></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink/40" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-ink">Pedras do caminho</h2>
        <p className="mt-1 text-xs leading-5 text-ink/60">Marcos tirados dos seus registros. Não medem o quanto você cresceu, só mostram o chão que já foi percorrido.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {data.stones.map((stone) => (
            <div key={stone.value + stone.label} className={`min-w-0 rounded-[14px_18px_12px_16px] border p-3 ${stone.next ? "border-dashed border-line" : "border-line bg-paper"}`}>
              <b className={`block font-semibold leading-tight tabular-nums ${stone.next ? "text-base text-ink/65" : "text-xl"} ${stone.tone === "water" ? "text-[#2f6f8f]" : ""}`}>{stone.value}</b>
              <span className="mt-1 block text-xs leading-4 text-ink/60">{stone.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {open?.kind === "text" ? <TextSheet open={open} onClose={() => setOpen(null)} /> : null}
      {open?.kind === "close" ? <CloseSheet cycle={open.cycle} labor={open.labor} todayKey={todayKey} onClose={() => setOpen(null)} /> : null}
      {open?.kind === "labor" ? (
        <Sheet title={open.labor.title} onClose={() => setOpen(null)}>
          <LaborText labor={open.labor} />
          {open.elixir ? <p className="mt-3 rounded-xl bg-paper p-3 text-sm italic text-ink/80">“{open.elixir}”</p> : null}
        </Sheet>
      ) : null}
      {open?.kind === "myth" ? (
        <Sheet title={`${open.myth.hero} · ${open.myth.title}`} onClose={() => setOpen(null)}>
          <p className="mt-2 text-sm leading-6 text-ink/75">{open.myth.summary}</p>
          <ol className="mt-4 space-y-4">
            {open.myth.labors.map((item) => (
              <li key={item.id} className="border-t border-[#f0ebe1] pt-3">
                <p className="font-myth text-lg font-semibold text-ink"><span className="text-terra">{roman(item.position)}</span> · {item.title}</p>
                <LaborText labor={item} compact />
              </li>
            ))}
          </ol>
        </Sheet>
      ) : null}
    </div>
  );
}

/** The month being lived: returns still to close, the wheel, the weapons and what has happened. */
function CurrentCycle({ data, setOpen }: { data: Extract<JourneyData, { prelude: null }>; setOpen: (open: Open) => void }) {
  const { cycle, labor, stage } = data;
  const current = STAGES[stage.index];
  const closing = stage.index === STAGES.length - 1 && !cycle.outcome;
  const written = (Object.keys(FIELD_LABELS) as CycleField[]).filter((field) => cycle[field]);
  return (
    <>
        {data.pendingReturns.map(({ cycle: past, labor: pastLabor }) => (
          <button key={past.id} type="button" onClick={() => setOpen({ kind: "close", cycle: past, labor: pastLabor })} className="flex w-full items-center gap-3 rounded-xl border border-[#e6d6c4] bg-[#fbf5ee] p-4 text-left text-[#4a3424]">
            <span className="min-w-0 flex-1 text-sm"><b className="block">Retorno pendente: {pastLabor.title}</b>Feche o trabalho de {monthName(past.month)}.</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        ))}

        <Card>
          <h2 className="text-lg font-semibold text-ink">A travessia</h2>
          <div className="mt-3 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3">
            <Wheel index={stage.index} label={current.name} detail={stage.ended ? "mês encerrado" : `dia ${stage.day} de ${stage.days}`} />
            <ol className="space-y-1">
              {STAGES.map((item, index) => (
                <li key={item.name} className={`grid grid-cols-[18px_minmax(0,1fr)] items-baseline gap-1.5 text-[13px] ${index === stage.index ? "font-semibold text-ink" : index < stage.index ? "text-ink/65" : "text-ink/40"}`}>
                  <b className={`font-myth text-sm ${index === stage.index ? "text-terra" : ""}`}>{roman(index + 1)}</b>
                  <span>{item.name}{index < stage.index ? " ✓" : ""}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-3 border-t border-[#f0ebe1] pt-3">
            <p className="text-sm leading-6 text-ink"><strong className="text-bronze">{current.name}.</strong> {current.prompt}</p>
            {current.field ? <TextButton text={cycle[current.field]} label={current.fieldLabel!} onClick={() => setOpen({ kind: "text", cycle, field: current.field! })} /> : null}
            {closing ? <button type="button" onClick={() => setOpen({ kind: "close", cycle, labor })} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-vase text-sm font-semibold text-[#fbf3ea]">Fechar o trabalho</button> : null}
            {cycle.outcome ? <p className="mt-3 rounded-xl bg-paper p-3 text-sm text-ink/80">{cycle.outcome === "CUMPRIDO" ? "Trabalho cumprido e gravado no caminho." : "O monstro ainda vive: este trabalho volta no próximo mês."}</p> : null}
          </div>
        </Card>

        {data.weapons.length ? (
          <Card>
            <h2 className="text-lg font-semibold text-ink">As armas</h2>
            <p className="mt-1 text-xs text-ink/60">As suas práticas diárias da ED. Últimos 7 dias.</p>
            <div className="mt-3 space-y-2.5">
              {data.weapons.map((weapon) => (
                <div key={weapon.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold"><span className="h-2 w-2 shrink-0 rounded-full bg-[#b23a2c]" /><span className="truncate">{weapon.title}</span></span>
                  <span className="flex shrink-0 gap-1" aria-label={`${weapon.days.filter(Boolean).length} de 7 dias`}>
                    {weapon.days.map((done, index) => <i key={index} className={`block h-2.5 w-2.5 rounded-full ${done ? "bg-[#b23a2c]" : "bg-[#efeae0]"}`} />)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="text-lg font-semibold text-ink">O que já aconteceu</h2>
          <ol className="mt-3 space-y-3 border-l-2 border-[#f3e2d6] pl-4">
            <Mark when={`${shortDate(cycle.startDate)} · O chamado`}>Começou {labor.title}.</Mark>
            {written.map((field) => (
              <Mark key={field} when={FIELD_LABELS[field]} onClick={() => setOpen({ kind: "text", cycle, field })}><em className="not-italic text-ink/80">“{cycle[field]}”</em></Mark>
            ))}
            {data.falls.map((fall) => (
              <Mark key={fall.from} when={`${shortDate(fall.from)} · Uma descida`} dark>{`Sem práticas da ED de ${shortDate(fall.from)} a ${shortDate(fall.to)}.`} {fall.back ? <b className="font-semibold text-emerald-800">Voltou em {shortDate(fall.back)}.</b> : <b className="font-semibold text-terra">A volta ainda está por vir.</b>}</Mark>
            ))}
          </ol>
          <p className="mt-4 border-t border-[#f0ebe1] pt-3 text-xs leading-5 text-ink/60">Testemunhas até aqui: {data.witness.practiceDays} de {data.witness.days} dias com prática da ED · {data.witness.diaries} Diário{data.witness.diaries === 1 ? "" : "s"} · {data.witness.reflections} reflex{data.witness.reflections === 1 ? "ão" : "ões"}. Elas não fecham o trabalho: quem decide é você.</p>
        </Card>
    </>
  );
}

function LaborText({ labor, compact = false }: { labor: JourneyLabor; compact?: boolean }) {
  return (
    <div className={compact ? "mt-1 space-y-1.5" : "mt-3 space-y-3"}>
      <p className="text-sm leading-6 text-ink/80">{labor.story}</p>
      <p className="text-sm leading-6 text-ink"><b className="font-semibold text-bronze">Simboliza:</b> {labor.symbol}</p>
      <p className="text-sm leading-6 text-ink"><b className="font-semibold text-bronze">Pergunta:</b> {labor.question}</p>
    </div>
  );
}

function TextButton({ text, label, onClick }: { text: string | null; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 block w-full rounded-xl border border-line bg-paper p-3 text-left">
      <span className="block text-xs font-semibold text-ink/60">{label}</span>
      <span className={`mt-1 block text-sm leading-6 ${text ? "text-ink" : "text-ink/45"}`}>{text ?? "Toque para escrever"}</span>
    </button>
  );
}

function TextSheet({ open, onClose }: { open: Extract<Open, { kind: "text" }>; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState(open.cycle[open.field] ?? "");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  async function save() {
    setState("saving");
    const response = await fetch("/api/jornada", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: open.cycle.id, field: open.field, text }) }).catch(() => null);
    if (!response?.ok) { setState("error"); return; }
    router.refresh();
    onClose();
  }
  return (
    <Sheet title={FIELD_LABELS[open.field]} onClose={onClose}>
      <textarea id={`jornada-${open.field}`} value={text} onChange={(event) => setText(event.target.value)} rows={6} className="mt-3 w-full rounded-xl border border-line bg-paper p-3 text-base leading-6 text-ink" placeholder="Com as suas palavras…" />
      <button type="button" onClick={save} disabled={state === "saving"} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-sm font-semibold text-white disabled:opacity-50">{state === "saving" ? "Salvando…" : "Salvar"}</button>
      {state === "error" ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">Não foi possível salvar agora. Confira a conexão e tente de novo.</p> : null}
    </Sheet>
  );
}

function CloseSheet({ cycle, labor, todayKey, onClose }: { cycle: JourneyCycle; labor: JourneyLabor; todayKey: string; onClose: () => void }) {
  const router = useRouter();
  const [elixir, setElixir] = useState(cycle.elixir ?? "");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  async function close(outcome: "CUMPRIDO" | "REPETIR") {
    setState("saving");
    const send = (method: "PATCH" | "POST", body: object) => fetch("/api/jornada", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((response) => response.ok).catch(() => false);
    const saved = elixir.trim() === (cycle.elixir ?? "") || await send("PATCH", { id: cycle.id, field: "elixir", text: elixir });
    if (!saved || !await send("POST", { id: cycle.id, outcome })) { setState("error"); return; }
    router.refresh();
    onClose();
  }
  return (
    <Sheet title="O retorno" onClose={onClose}>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.06em] text-bronze">{labor.title} · {monthName(cycle.month)}{cycle.month === todayKey.slice(0, 7) ? "" : " (mês encerrado)"}</p>
      <p className="mt-3 font-myth text-2xl font-semibold leading-tight text-ink">O que você traz de volta?</p>
      <label htmlFor="jornada-elixir-close" className="mt-3 block text-sm font-semibold text-ink">O elixir: o que mudou em você</label>
      <textarea id="jornada-elixir-close" value={elixir} onChange={(event) => setElixir(event.target.value)} rows={5} className="mt-1.5 w-full rounded-xl border border-line bg-paper p-3 text-base leading-6 text-ink" placeholder="Com as suas palavras…" />
      <div className="mt-4 grid gap-2">
        <button type="button" disabled={state === "saving"} onClick={() => close("CUMPRIDO")} className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-vase text-sm font-semibold text-[#fbf3ea] disabled:opacity-50">Trabalho cumprido<small className="text-xs font-normal opacity-80">gravar no caminho</small></button>
        <button type="button" disabled={state === "saving"} onClick={() => close("REPETIR")} className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-line bg-white text-sm font-semibold text-moss disabled:opacity-50">O monstro ainda vive<small className="text-xs font-normal opacity-80">viver este trabalho de novo no próximo mês</small></button>
      </div>
      {state === "error" ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">Não foi possível fechar agora. Confira a conexão e tente de novo.</p> : null}
    </Sheet>
  );
}

function Mark({ when, children, dark = false, onClick }: { when: string; children: ReactNode; dark?: boolean; onClick?: () => void }) {
  const body = <><time className="block text-[11.5px] font-bold text-bronze">{when}</time><span className="text-sm leading-6 text-ink">{children}</span></>;
  return (
    <li className="relative">
      <span className={`absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border-2 ${dark ? "border-vase bg-vase" : "border-terra bg-white"}`} aria-hidden="true" />
      {onClick ? <button type="button" onClick={onClick} className="block text-left">{body}</button> : body}
    </li>
  );
}

function Medal({ number, state, size = "md" }: { number: number; state: "done" | "now" | "lived" | "ahead"; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-[58px] w-[58px] text-[22px]" : "h-14 w-14 text-[19px]";
  const look = state === "now" ? "bg-terra text-vase border-[3px] border-double border-vase shadow-[0_0_0_5px_#f3e2d6]"
    : state === "done" ? "bg-vase text-terra border-[3px] border-double border-terra"
    : state === "lived" ? "bg-[#f3e2d6] text-vase border-[1.5px] border-terra"
    : "bg-paper text-ink/40 border-[1.5px] border-line";
  return <span className={`relative z-[1] grid shrink-0 place-items-center rounded-full font-myth font-bold ${box} ${look}`} aria-hidden="true">{roman(number)}</span>;
}

function Wheel({ index, label, detail }: { index: number; label: string; detail: string }) {
  const r = 50;
  const circumference = 2 * Math.PI * r;
  const portion = (index + 0.5) / STAGES.length;
  return (
    <svg viewBox="0 0 132 132" className="h-[132px] w-[132px]" role="img" aria-label={`Etapa ${index + 1} de 7: ${label}`}>
      <circle cx="66" cy="66" r={r} fill="none" style={{ stroke: "var(--wheel-track)" }} strokeWidth="6" />
      <circle cx="66" cy="66" r={r} fill="none" stroke="#c46a3d" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${circumference * portion} ${circumference}`} transform="rotate(-90 66 66)" />
      {STAGES.map((stage, i) => {
        const angle = -Math.PI / 2 + (i / STAGES.length) * 2 * Math.PI;
        const x = 66 + r * Math.cos(angle);
        const y = 66 + r * Math.sin(angle);
        const now = i === index;
        const done = i < index;
        return (
          <g key={stage.name}>
            <circle cx={x} cy={y} r={now ? 10 : 8} style={{ fill: now ? "#c46a3d" : done ? "#1d1a17" : "var(--wheel-ahead)", stroke: now || done ? "#1d1a17" : "var(--wheel-ahead-line)" }} strokeWidth={now ? 2 : 1.5} />
            <text x={x} y={y + 3.4} textAnchor="middle" fontSize={now ? 10 : 9} fontWeight="700" style={{ fill: now ? "#1d1a17" : done ? "#c46a3d" : "var(--wheel-ahead-text)" }}>{i + 1}</text>
          </g>
        );
      })}
      <text x="66" y="64" textAnchor="middle" fontSize="13" fontWeight="700" className="fill-ink" fontFamily="'Cormorant SC', Georgia, serif">{label}</text>
      <text x="66" y="78" textAnchor="middle" fontSize="9.5" style={{ fill: "var(--wheel-detail)" }}>{detail}</text>
    </svg>
  );
}

function Meander({ className }: { className: string }) {
  return <span aria-hidden="true" className={`absolute inset-x-0 h-2.5 opacity-55 ${className}`} style={{ background: "repeating-linear-gradient(90deg, #c46a3d 0 2px, transparent 2px 10px, #c46a3d 10px 12px, transparent 12px 20px)" }} />;
}

function stationNote(station: JourneyData["path"][number], stageName: string | null, prelude: string | null) {
  if (prelude && station.labor.position === 1) return `começa em ${longDate(prelude)}`;
  if (station.state === "now") return `agora · ${(stageName ?? "").toLocaleLowerCase("pt-BR")}`;
  if (station.state === "done") return station.elixir ? `“${excerpt(station.elixir)}”` : `cumprido${station.closedMonth ? ` em ${monthName(station.closedMonth)}` : ""}`;
  if (station.state === "lived") return station.times > 1 ? `vivido ${station.times} vezes` : "vivido, retorno pendente";
  return excerpt(station.labor.symbol, 70);
}

function excerpt(text: string, size = 90) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return clean;
  const cut = clean.lastIndexOf(" ", size);
  return `${clean.slice(0, cut > size / 2 ? cut : size)}…`;
}

function monthName(monthKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthKey}-15T12:00:00Z`));
}

function shortDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`)).replace(".", "").replace(" de ", " ");
}
