"use client";
import { useState, type FormEvent } from "react";
import { Card } from "@/components/app/AppShell";
import { type ADRecord, type Passage, type HistoryRecord } from "@/lib/ad";

const field = "mt-1 min-h-11 w-full rounded-md border border-line bg-paper p-3 text-sm text-ink";
const button = "min-h-11 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50";
const dateNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
async function call(body: object) {
  const r = await fetch("/api/ad", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await r.json(); if (!r.ok) throw new Error(result.error); return result;
}
async function read(params: Record<string, string>) {
  const r = await fetch(`/api/ad?${new URLSearchParams(params)}`, { cache: "no-store" });
  const result = await r.json(); if (!r.ok) throw new Error(result.error); return result;
}

export function ADPanel({ initialHistory, initialProposals, initialPassages, initialFilters, selectedId }: { initialHistory: { total: number; records: HistoryRecord[] }; initialProposals: ADRecord[]; initialPassages: Passage[]; initialFilters: { from: string; to: string; theme: string; kind: string }; selectedId?: string }) {
  const [history, setHistory] = useState(initialHistory); const [proposals, setProposals] = useState(initialProposals); const [passages, setPassages] = useState(initialPassages);
  const [showForm, setShowForm] = useState(false); const [showSources, setShowSources] = useState(false);
  const [sourceQuery, setSourceQuery] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters); const [offset, setOffset] = useState(0);
  async function refresh(page = 0, selectedFilters = filters) {
    const [h, p, s] = await Promise.all([read({ ...selectedFilters, offset: String(page) }), read({ action: "proposals" }), read({ action: "passages" })]);
    setHistory(h); setProposals(p.proposals); setPassages(s.passages); setOffset(page);
  }
  async function act(fn: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Falha no AD."); } finally { setBusy(false); } }
  async function propose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
    await act(async () => {
      await call({ action: "propose", date: data.get("date"), theme: data.get("theme"), summary: data.get("summary"), context: data.get("context"), openQuestion: data.get("openQuestion"), practice: data.get("practice"), citations: passages.filter(p => data.getAll("passageIds").includes(p.id)).map(p => ({ passageId: p.id, start: p.quoteStart, end: p.quoteEnd })) });
      setShowForm(false); await refresh(); setMessage("Proposta pronta. Revise abaixo e confirme para registrar a síntese.");
    });
  }
  return <section id="historico-ad" className="mt-4 scroll-mt-4">
    <Card>
      <p className="text-xs font-bold uppercase text-olive">AD · Apoio Discipular</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">Reflexões AD</h2>
      <p className="mt-2 text-sm leading-6 text-ink/65">Aprendizados da conversa, registrados após sua confirmação. Você pode guardar várias reflexões no mesmo dia e retomá-las junto ao Diário e ao ciclo.</p>
      <div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={() => setShowForm(!showForm)}>Preparar reflexão AD</button><button className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-moss" onClick={() => setShowSources(!showSources)}>Trechos indexados das obras aprovadas</button></div>
      <p className="mt-3 text-xs text-ink/60">O AD consulta os sete livros integralmente aprovados. As citações são recortes literais do índice, com a origem disponível.</p>
      {message && <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {showForm && <form className="mt-5 space-y-3" onSubmit={propose}>
        <label className="block text-sm font-semibold">Data<input name="date" type="date" className={field} required defaultValue={dateNow()} /></label>
        <label className="block text-sm font-semibold">Tema<input name="theme" className={field} maxLength={240} required /></label>
        <label className="block text-sm font-semibold">Síntese para sua aprovação<textarea name="summary" className={field} rows={4} maxLength={6000} required /></label>
        <label className="block text-sm font-semibold">Contexto<textarea name="context" className={field} rows={3} maxLength={6000} required /></label>
        <label className="block text-sm font-semibold">Pergunta em aberto<textarea name="openQuestion" className={field} rows={2} maxLength={2000} required /></label>
        <label className="block text-sm font-semibold">Prática possível<textarea name="practice" className={field} rows={2} maxLength={2000} /></label>
        <fieldset><legend className="text-sm font-semibold">Referências filosóficas · até dois trechos indexados</legend><label className="mt-2 block text-sm">Buscar nos livros<input className={field} value={sourceQuery} onChange={e => setSourceQuery(e.target.value)} /></label><button type="button" className="mt-2 min-h-11 px-3 text-sm font-semibold text-moss" disabled={busy} onClick={() => act(async () => { const r = await read({ action: "passages", query: sourceQuery }); setPassages(r.passages); })}>Recuperar trechos</button><div className="mt-2 max-h-64 space-y-2 overflow-y-auto">{passages.map(p => <label key={p.id} className="flex items-start gap-3 rounded-md border border-line p-3 text-sm"><input className="mt-1" type="checkbox" name="passageIds" value={p.id} /><span><span className="font-semibold">{p.author} · {p.work}</span><span className="mt-1 block">“{p.excerpt}”</span><span className="mt-1 block text-xs text-ink/60">{p.edition} · {p.location}</span></span></label>)}{!passages.length && <p className="text-sm text-ink/60">Nenhum trecho recuperado para esta busca. A proposta será identificada como aplicação pessoal sem citação.</p>}</div></fieldset>
        <button disabled={busy} className={button}>Preparar para revisão</button>
      </form>}
    </Card>
    {showSources && <IndexBrowser busy={busy} act={act} />}
    {!!proposals.length && <Card className="mt-4"><h3 className="text-lg font-semibold text-ink">Propostas aguardando sua confirmação</h3><div className="mt-3 space-y-4">{proposals.map(p => <article key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4"><p className="text-xs text-olive">{p.date} · Proposta, ainda não registrada</p><h4 className="mt-1 font-semibold">{p.theme}</h4><RecordBody record={p} /><p className="mt-3 text-xs text-ink/60">{p.sourceStatus}</p><div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => act(async () => { const r = await call({ action: "confirm", proposalId: p.id, confirmation: "confirmo" }); const focusedFilters = { from: r.record.date, to: r.record.date, kind: "AD", theme: "" }; setFilters(focusedFilters); await refresh(0, focusedFilters); setMessage(`Reflexão AD registrada. ID: ${r.record.id}. Visível no histórico abaixo.`); })}>Confirmo · registrar esta síntese</button><button className="min-h-11 px-3 text-sm text-ink/60" disabled={busy} onClick={() => act(async () => { await call({ action: "dismiss", proposalId: p.id }); await refresh(); })}>Descartar proposta</button></div></article>)}</div></Card>}
    <Card className="mt-4"><h3 className="text-lg font-semibold text-ink">Histórico integrado</h3><p className="mt-1 text-sm text-ink/60">Diário, reflexões do ciclo e Reflexões AD · {history.total} registros</p>
      <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void act(() => refresh()); }}>
        <label className="text-xs font-semibold">De<input type="date" className={field} value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
        <label className="text-xs font-semibold">Até<input type="date" className={field} value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
        <label className="text-xs font-semibold">Tema ou texto<input className={field} value={filters.theme} onChange={e => setFilters({ ...filters, theme: e.target.value })} /></label>
        <label className="text-xs font-semibold">Tipo<select className={field} value={filters.kind} onChange={e => setFilters({ ...filters, kind: e.target.value })}><option value="">Todos</option><option value="AD">Reflexões AD</option><option value="CICLO">Reflexões do ciclo</option><option value="DIARIO">Diário</option></select></label><button className={button} disabled={busy}>Filtrar histórico</button>
      </form>
      <div className="mt-5 space-y-3">{history.records.map(r => <details key={`${r.kind}-${r.id}`} open={r.id === selectedId || undefined} className="rounded-lg border border-line p-4"><summary className="cursor-pointer text-sm text-ink"><span className="text-xs text-olive">{r.date} · {r.kind === "AD" ? "AD / conversa" : r.kind === "CICLO" ? "Reflexão do ciclo" : "Diário"}</span><span className="mt-1 block font-semibold">{r.theme}</span><span className="mt-2 block font-normal text-ink/70">{r.summary.slice(0, 180)}{r.summary.length > 180 ? "…" : ""}</span></summary><div className="mt-4 border-t border-line pt-3"><RecordBody record={r} /><p className="mt-3 break-all text-xs text-ink/45">Registro: {r.id}</p></div></details>)}{!history.records.length && <p className="text-sm text-ink/60">Nenhum registro neste filtro.</p>}</div>
      <div className="mt-4 flex items-center justify-between gap-2 text-sm"><button disabled={busy || offset === 0} className="min-h-11 px-2 disabled:opacity-30" onClick={() => act(() => refresh(Math.max(0, offset - 25)))}>Anterior</button><span>{history.total ? `${offset + 1}–${offset + history.records.length} de ${history.total}` : "0 registros"}</span><button disabled={busy || offset + 25 >= history.total} className="min-h-11 px-2 disabled:opacity-30" onClick={() => act(() => refresh(offset + 25))}>Próxima</button></div>
    </Card>
  </section>;
}

function RecordBody({ record: r }: { record: Pick<ADRecord, "summary" | "context" | "openQuestion" | "practice" | "references"> }) {
  let context = r.context;
  if (context?.startsWith("{")) { try { const data = JSON.parse(context); context = [data.thirdAnswer, data.tonicAnswer].filter(Boolean).join("\n\n"); } catch { /* show original */ } }
  return <div className="space-y-3 text-sm leading-6 text-ink/80"><p className="whitespace-pre-wrap">{r.summary}</p>{context && <p className="whitespace-pre-wrap"><strong>Contexto: </strong>{context}</p>}{r.openQuestion && <p><strong>Pergunta em aberto: </strong>{r.openQuestion}</p>}{r.practice && <p><strong>Prática: </strong>{r.practice}</p>}{r.references.map(p => <blockquote key={p.id} className="whitespace-pre-wrap border-l-2 border-olive pl-3"><p>“{p.excerpt}”</p><cite className="text-xs not-italic text-ink/60">{p.author} · {p.work} · {p.edition} · {p.location}</cite></blockquote>)}</div>;
}

type IndexedWork = { id: string; title: string; author: string; edition: string; sourceUrl: string; status: string; unitCount: number; passageCount: number; characterCount: number };
function IndexBrowser({ busy, act }: { busy: boolean; act: (fn: () => Promise<void>) => Promise<void> }) {
  const [works, setWorks] = useState<IndexedWork[]>([]); const [workId, setWorkId] = useState("");
  const [query, setQuery] = useState(""); const [offset, setOffset] = useState(0); const [results, setResults] = useState<Passage[]>([]); const [loaded, setLoaded] = useState(false);
  async function search(page = 0) {
    const [w, p] = await Promise.all([read({ action: "works" }), read({ action: "passages", workId, query, offset: String(page) })]);
    setWorks(w.works); setResults(p.passages); setOffset(page); setLoaded(true);
  }
  return <Card className="mt-4"><h3 className="text-lg font-semibold">Trechos indexados das obras aprovadas</h3><p className="mt-2 text-sm leading-6 text-ink/60">Índice automático dos sete arquivos originais. Autor, obra e edição acompanham o texto literal; a localização identifica a página do PDF ou seção do EPUB. Não há cadastro nem aprovação de passagens.</p>
    <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void act(() => search()); }}><label className="block text-sm font-semibold">Obra<select className={field} value={workId} onChange={e => setWorkId(e.target.value)}><option value="">Todas as sete obras</option>{works.map(w => <option key={w.id} value={w.id}>{w.author} · {w.title}</option>)}</select></label><label className="block text-sm font-semibold">Tema ou palavras do texto<input className={field} value={query} onChange={e => setQuery(e.target.value)} placeholder="atenção, serenidade, responsabilidade…" /></label><button disabled={busy} className={button}>{loaded ? "Buscar no índice" : "Consultar obras e índice"}</button></form>
    {loaded && <div className="mt-4 space-y-3">{works.map(w => <article key={w.id} className="rounded-md bg-paper p-3 text-sm"><h4 className="font-semibold">{w.author} · {w.title}</h4><p className="mt-1 text-xs text-ink/60">{w.edition}</p>{w.status === "INDEXED" ? <><p className="mt-1 text-xs text-olive">{w.unitCount} páginas/seções · {w.passageCount} trechos · conteúdo indexado automaticamente</p><a href={w.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block min-h-8 text-xs font-semibold text-moss">Conferir arquivo original</a></> : <p className="mt-1 text-sm text-amber-800">Esta obra precisa ser importada em lote.</p>}</article>)}</div>}
    <div className="mt-4 space-y-3">{results.map(p => <details key={p.id} className="rounded-md border border-line p-3 text-sm"><summary className="cursor-pointer"><span className="font-semibold">{p.author} · {p.work}</span><span className="mt-1 block text-xs text-olive">{p.location}</span></summary><blockquote className="mt-3 whitespace-pre-wrap leading-6">{p.text}</blockquote><p className="mt-3 text-xs text-ink/60">{p.edition}</p><a href={p.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block min-h-8 text-xs font-semibold text-moss">Conferir origem</a><p className="break-all text-xs text-ink/40">ID: {p.id}</p></details>)}{loaded && !results.length && <p className="text-sm text-ink/60">Não há trechos recuperados para esta busca. O AD não deve inventar citações.</p>}</div>
    {loaded && <div className="mt-4 flex justify-between"><button disabled={busy || !offset} className="min-h-11 px-2 text-sm disabled:opacity-30" onClick={() => act(() => search(Math.max(0, offset-25)))}>Anterior</button><button disabled={busy || results.length < 25} className="min-h-11 px-2 text-sm disabled:opacity-30" onClick={() => act(() => search(offset+25))}>Próxima</button></div>}
  </Card>;
}
