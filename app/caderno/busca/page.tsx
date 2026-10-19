import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Snippet } from "@/components/caderno/shared";
import { getActiveUser } from "@/lib/db/sendero";
import { search, type SearchHit } from "@/lib/db/caderno";

export const dynamic = "force-dynamic";

const GROUPS: Array<{ kind: SearchHit["kind"]; label: string }> = [
  { kind: "PAGINA", label: "Páginas do Caderno" },
  { kind: "FRASE", label: "Frases" },
  { kind: "REFLEXAO", label: "Reflexões" },
  { kind: "DIARIO", label: "Diário" },
];

/** One search over the Caderno; "Incluir Reflexões e Diário" widens it when the user wants. */
export default async function CadernoSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tudo?: string }> }) {
  const { q = "", tudo } = await searchParams;
  const everywhere = tudo === "1";
  const user = await getActiveUser();
  const hits = user && q.trim() ? await search(user.id, q, everywhere) : [];
  const link = (all: boolean) => `/caderno/busca?q=${encodeURIComponent(q)}${all ? "&tudo=1" : ""}`;
  return (
    <AppShell>
      <div className="space-y-4">
        <Link prefetch={false} href="/caderno" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink/70"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Caderno</Link>
        <form action="/caderno/busca" className="flex items-center gap-2 rounded-xl border border-moss bg-white px-3 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-ink/45" aria-hidden="true" />
          <input id="caderno-busca" name="q" type="search" enterKeyHint="search" defaultValue={q} placeholder="Buscar no Caderno" className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/45" />
          {everywhere ? <input type="hidden" name="tudo" value="1" /> : null}
        </form>
        {q.trim() ? (
          <div className="flex flex-wrap gap-1.5">
            <Link prefetch={false} href={link(false)} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${everywhere ? "border-line bg-white text-ink/70" : "border-ink bg-ink text-white"}`}>Só o Caderno</Link>
            <Link prefetch={false} href={link(true)} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${everywhere ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70"}`}>Incluir Reflexões e Diário</Link>
          </div>
        ) : null}

        {q.trim() && !hits.length ? <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink/60">Nada encontrado para “{q}”{everywhere ? "" : " no Caderno. Toque em “Incluir Reflexões e Diário” para buscar também lá"}.</p> : null}

        {GROUPS.map((group) => {
          const items = hits.filter((hit) => hit.kind === group.kind);
          if (!items.length) return null;
          return (
            <section key={group.kind} className="space-y-2">
              <h2 className="flex justify-between text-xs font-semibold uppercase tracking-wide text-ink/60">{group.label}<span className="font-medium normal-case tracking-normal">{items.length}</span></h2>
              {items.map((hit) => {
                const body = (
                  <>
                    <strong className="block text-sm font-semibold text-ink">{hit.title}</strong>
                    {hit.snippet ? <p className="caderno-serif mt-1 text-[14.5px] leading-[1.45] text-ink/80"><Snippet text={hit.snippet} /></p> : null}
                    <small className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink/55">{hit.color ? <span className="h-2 w-2 rounded-sm" style={{ background: hit.color }} /> : null}{hit.place}</small>
                  </>
                );
                return hit.href
                  ? <Link prefetch={false} key={hit.kind + hit.id} href={hit.href} className="block rounded-xl border border-line bg-white p-3">{body}</Link>
                  : <div key={hit.kind + hit.id} className="rounded-xl border border-line bg-white p-3">{body}</div>;
              })}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
