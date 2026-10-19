"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, CalendarCheck2, CheckSquare2, Home, LoaderCircle, NotebookTabs, Sparkles } from "lucide-react";
import { DailyTonicStrip } from "@/components/app/DailyTonicStrip";
import { FeedbackButton } from "@/components/app/FeedbackButton";
import { KeepAwake } from "@/components/app/KeepAwake";
import { LockGuard } from "@/components/app/LockGuard";

const navItems = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/refletir", label: "Refletir", icon: BookOpenText },
  { href: "/habitos", label: "Hábitos", icon: CheckSquare2 },
  { href: "/tarefas", label: "Agenda", icon: CalendarCheck2 },
  { href: "/caderno", label: "Caderno", icon: NotebookTabs }
];

// After this long in the background the app reopens on Início, like a native app.
const RETURN_HOME_AFTER_MS = 30 * 60 * 1000;

/** Screens where the user may be mid-writing; never navigate away from them. */
function isWritingScreen(pathname: string) {
  return pathname === "/diario" || pathname === "/configuracoes" || pathname === "/jornada" || pathname.startsWith("/caderno/pagina") || pathname.startsWith("/leitura") || pathname.startsWith("/memorizar") || /^\/refletir\/(?!organizar$)[^/]+$/.test(pathname);
}

export function AppShell({ children, showDailyTonic = true }: { children: ReactNode; showDailyTonic?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const visiblePendingHref = pendingHref === pathname ? null : pendingHref;
  function onReturn(awayMs: number) {
    if (awayMs > RETURN_HOME_AFTER_MS && !isWritingScreen(pathname)) goHome();
  }

  function goHome() {
    if (pathname === "/inicio" || pathname === "/") {
      router.refresh();
    } else {
      router.push("/inicio");
    }
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fffaf0_0,#f7f4ed_34%,#ece5d7_100%)] text-ink">
      <LockGuard onReturn={onReturn} />
      <KeepAwake />
      {visiblePendingHref ? <div className="fixed inset-x-0 top-0 z-50 h-1 animate-pulse bg-clay" aria-hidden="true" /> : null}

      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen border-r border-line/80 bg-ink px-4 py-6 text-paper md:flex md:flex-col">
          <Link href="/inicio" className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-paper/55">Sendero</p>
            <p className="mt-1 text-lg font-semibold">Caminho Discipular</p>
          </Link>
          <nav className="mt-6 space-y-1" aria-label="Navegação principal">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} pendingHref={visiblePendingHref} setPendingHref={setPendingHref} prefetchRoute={router.prefetch} />
            ))}
          </nav>
          <p className="mt-auto px-3 text-xs leading-5 text-paper/45">O essencial visível. O caminho em movimento.</p>
        </aside>

        <main className="min-w-0 px-4 pb-28 pt-4 md:px-8 md:py-8 xl:px-12">
          <div className="mx-auto w-full max-w-6xl">{showDailyTonic ? <DailyTonicStrip /> : null}{children}<FeedbackButton /></div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-1 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_30px_rgba(31,37,40,0.10)] backdrop-blur md:hidden" aria-label="Navegação principal">
          <div className="grid grid-cols-5 gap-1">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} pendingHref={visiblePendingHref} setPendingHref={setPendingHref} prefetchRoute={router.prefetch} mobile />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  pendingHref,
  setPendingHref,
  prefetchRoute,
  mobile = false,
}: {
  item: (typeof navItems)[number];
  pathname: string;
  pendingHref: string | null;
  setPendingHref: (href: string | null) => void;
  prefetchRoute: (href: string) => void;
  mobile?: boolean;
}) {
  const active = pathname === item.href || (item.href !== "/inicio" && pathname.startsWith(`${item.href}/`));
  const pending = pendingHref === item.href;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (active) {
          event.preventDefault();
          return;
        }
        setPendingHref(item.href);
      }}
      onPointerEnter={() => prefetchRoute(item.href)}
      onPointerDown={() => prefetchRoute(item.href)}
      className={mobile
        ? `touch-manipulation flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[9px] font-semibold transition active:scale-95 ${active ? "bg-ink text-paper" : "text-ink/58"}`
        : `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${active ? "bg-paper text-ink" : "text-paper/65 hover:bg-white/8 hover:text-paper"}`}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span className={mobile ? "max-w-full truncate" : "truncate"}>{item.label}</span>
    </Link>
  );
}

export function ModuleHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="rounded-xl border border-line bg-white/82 p-4 shadow-soft md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-olive">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink md:text-3xl">{title}</h1>
        </div>
        {action}
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/68">{description}</p>
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white p-4 shadow-soft md:p-5 ${className}`}>{children}</section>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "accent" }) {
  const styles = {
    neutral: "bg-paper text-ink/70",
    good: "bg-emerald-50 text-emerald-800",
    warn: "bg-red-50 text-red-800",
    accent: "bg-orange-50 text-clay"
  };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

export function AiSoonNote() {
  return (
    <div className="flex gap-3 rounded-md border border-dashed border-olive/40 bg-white/55 p-3 text-sm leading-6 text-ink/70">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-olive" aria-hidden="true" />
      <p>IA preparada para fase futura: sínteses, perguntas de aprofundamento e direcionais sem substituir sua decisão.</p>
    </div>
  );
}
