"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { Archive, ArrowLeft, Bold, Heading2, Highlighter, History, Italic, List, ListChecks, ListOrdered, MoreHorizontal, MoveRight, Plus, Quote, Redo2, Undo2 } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { cadernoAction } from "@/components/caderno/shared";
import { whenEdited } from "@/lib/caderno-shared";
import type { NotePage, NotePageSummary, NoteSection, Notebook } from "@/lib/db/caderno";

type Props = {
  page: NotePage;
  notebook: Notebook;
  section: NoteSection | null;
  parent: { id: string; title: string } | null;
  children: NotePageSummary[];
  versions: number;
  notebooks: Notebook[];
  sections: NoteSection[];
};
type Draft = { title: string; content: string; text: string; at: string };
type SaveState = { kind: "idle" | "saving" | "saved" | "offline"; at?: string };

const SAVE_AFTER_MS = 1200;
const RETRY_AFTER_MS = 5000;
const draftKey = (id: string) => `sendero:caderno:rascunho:${id}`;

function readDraft(id: string): Draft | null {
  try { const raw = window.localStorage.getItem(draftKey(id)); return raw ? JSON.parse(raw) as Draft : null; } catch { return null; }
}
function writeDraft(id: string, draft: Draft | null) {
  try { if (draft) window.localStorage.setItem(draftKey(id), JSON.stringify(draft)); else window.localStorage.removeItem(draftKey(id)); } catch { /* private mode: the server save still runs */ }
}
function parseContent(content: string | null) {
  if (!content) return "";
  try { return JSON.parse(content); } catch { return content; }
}

/**
 * A page of the Caderno. It saves by itself after each pause; "salvo" appears
 * only when the server confirms. Until then the text is also kept on this
 * phone, so a failed connection never loses it.
 */
export function PageEditor({ page, notebook, section, parent, children, versions, notebooks, sections }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: page.updatedAt });
  const [recovered, setRecovered] = useState<Draft | null>(null);
  const [sheet, setSheet] = useState<"menu" | "move" | "versions" | null>(null);
  const [focused, setFocused] = useState(false);
  const timer = useRef<number | null>(null);
  const pending = useRef<Draft | null>(null);
  const inFlight = useRef(false);
  const titleRef = useRef(title);
  // The editor keeps the callbacks of its first render; this ref always points to the current one.
  const scheduleRef = useRef<() => void>(() => undefined);
  const flushRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => undefined);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      TaskList,
      TaskItem.configure({ nested: true, a11y: { checkboxLabel: (_node, checked) => (checked ? "Desmarcar item" : "Marcar item") } }),
      Highlight,
      Placeholder.configure({ placeholder: "Escreva aqui…" }),
    ],
    content: parseContent(page.content),
    editorProps: { attributes: { class: "caderno-page min-h-[45vh] outline-none", spellcheck: "true", autocapitalize: "sentences" } },
    onUpdate: () => scheduleRef.current(),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  });

  const snapshot = useCallback((): Draft | null => {
    if (!editor) return null;
    return { title: titleRef.current, content: JSON.stringify(editor.getJSON()), text: editor.getText({ blockSeparator: "\n" }), at: new Date().toISOString() };
  }, [editor]);

  const flush = useCallback(async (keepalive = false) => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const draft = pending.current;
    if (!draft || inFlight.current) return;
    inFlight.current = true;
    setSave({ kind: "saving" });
    try {
      const response = await fetch("/api/caderno", { method: "POST", keepalive, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "savePage", id: page.id, title: draft.title, content: draft.content, text: draft.text }) });
      const data = await response.json().catch(() => ({})) as { updatedAt?: string };
      if (!response.ok) throw new Error();
      if (pending.current === draft) { pending.current = null; writeDraft(page.id, null); }
      setSave({ kind: "saved", at: data.updatedAt ?? new Date().toISOString() });
    } catch {
      setSave({ kind: "offline" });
      timer.current = window.setTimeout(() => { void flushRef.current(); }, RETRY_AFTER_MS);
    } finally {
      inFlight.current = false;
      if (pending.current && !timer.current) timer.current = window.setTimeout(() => { void flushRef.current(); }, SAVE_AFTER_MS);
    }
  }, [page.id]);

  const schedule = useCallback(() => {
    const draft = snapshot();
    if (!draft) return;
    pending.current = draft;
    writeDraft(page.id, draft);
    setSave((current) => (current.kind === "offline" ? current : { kind: "saving" }));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, SAVE_AFTER_MS);
  }, [flush, page.id, snapshot]);

  useEffect(() => { scheduleRef.current = schedule; flushRef.current = flush; }, [schedule, flush]);

  // A copy left on this phone, newer than the server's, is offered back once.
  useEffect(() => {
    const draft = readDraft(page.id);
    // Reading this phone's storage can only happen after the first render (the server has none).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (draft && draft.at > page.updatedAt && (draft.title !== page.title || draft.content !== page.content)) setRecovered(draft);
    else if (draft) writeDraft(page.id, null);
  }, [page.id, page.updatedAt, page.title, page.content]);

  // Leaving the app or the page sends what is still pending.
  useEffect(() => {
    const away = () => { if (document.visibilityState === "hidden") void flush(true); };
    const hide = () => { void flush(true); };
    document.addEventListener("visibilitychange", away);
    window.addEventListener("pagehide", hide);
    return () => { document.removeEventListener("visibilitychange", away); window.removeEventListener("pagehide", hide); void flush(true); };
  }, [flush]);

  // A new page opens with the cursor in the title, and the title grows with its lines.
  const titleInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!page.title && !page.plainText) titleInput.current?.focus(); }, [page.title, page.plainText]);
  useLayoutEffect(() => {
    const input = titleInput.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [title]);

  function changeTitle(value: string) {
    titleRef.current = value;
    setTitle(value);
    schedule();
  }

  function recover() {
    if (!recovered || !editor) return;
    titleRef.current = recovered.title;
    setTitle(recovered.title);
    editor.commands.setContent(parseContent(recovered.content));
    setRecovered(null);
    schedule();
  }

  const place = [notebook.name, section?.name, parent?.title].filter(Boolean);

  return (
    <div className={focused ? "pb-20" : ""}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link prefetch={false} href={parent ? `/caderno/pagina/${parent.id}` : `/caderno/${notebook.id}`} className="flex min-h-11 min-w-0 items-center gap-2 text-[12.5px] text-ink/65">
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: notebook.color }} />
          <span className="truncate">{place.join(" › ")}</span>
        </Link>
        <button type="button" onClick={() => setSheet("menu")} aria-label="Mais opções da página" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-ink/70"><MoreHorizontal className="h-5 w-5" /></button>
      </div>

      {recovered ? (
        <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Este iPhone guardou um texto desta página que não chegou ao servidor ({whenEdited(recovered.at)}).</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={recover} className="min-h-10 rounded-lg bg-amber-800 px-3 text-sm font-semibold text-white">Recuperar esse texto</button>
            <button type="button" onClick={() => { writeDraft(page.id, null); setRecovered(null); }} className="min-h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold">Manter o do servidor</button>
          </div>
        </div>
      ) : null}

      <article className="rounded-2xl border border-line bg-[#fffdf8] px-4 pb-6 pt-4 shadow-soft">
        <textarea ref={titleInput} id="pagina-titulo" value={title} onChange={(event) => changeTitle(event.target.value.replace(/\n/g, " "))} rows={1} placeholder="Título" aria-label="Título da página" className="caderno-title block w-full resize-none overflow-hidden bg-transparent text-ink outline-none placeholder:text-ink/30" />
        <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px] text-ink/50">
          <span>criada {whenEdited(page.createdAt)}</span><span>·</span>
          <SaveBadge state={save} />
        </p>
        <div className="mt-3"><EditorContent editor={editor} /></div>
      </article>

      {children.length ? (
        <section className="mt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-olive">Subpáginas</h2>
          <ul className="divide-y divide-[#f0ebe1] overflow-hidden rounded-xl border border-line bg-white">
            {children.map((child) => (
              <li key={child.id}><Link prefetch={false} href={`/caderno/pagina/${child.id}`} className="block px-4 py-2.5"><strong className="block truncate text-sm font-semibold text-ink">{child.title}</strong><small className="block truncate text-xs text-ink/60">{whenEdited(child.updatedAt)}{child.preview ? ` · ${child.preview}` : ""}</small></Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      {focused && editor ? <Toolbar editor={editor} /> : null}

      {sheet === "menu" ? (
        <PageMenu
          pageId={page.id} parentId={page.parentId} versions={versions}
          onClose={() => setSheet(null)}
          onMove={() => setSheet("move")}
          onVersions={() => setSheet("versions")}
          beforeLeave={() => flush()}
          backHref={parent ? `/caderno/pagina/${parent.id}` : `/caderno/${notebook.id}`}
        />
      ) : null}
      {sheet === "move" ? <MoveSheet pageId={page.id} notebookId={page.notebookId} sectionId={page.sectionId} notebooks={notebooks.filter((item) => item.kind !== "FRASES")} sections={sections} beforeMove={() => flush()} onClose={() => setSheet(null)} /> : null}
      {sheet === "versions" ? <VersionsSheet pageId={page.id} beforeRestore={() => flush()} onClose={() => setSheet(null)} onRestored={() => { setSheet(null); router.refresh(); }} /> : null}
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state.kind === "saving") return <span>salvando…</span>;
  if (state.kind === "offline") return <span className="font-semibold text-amber-800">sem conexão: guardado neste iPhone, tentando de novo</span>;
  return <span className="font-semibold text-emerald-800">✓ salvo {state.at ? whenEdited(state.at) : ""}</span>;
}

/** Formatting bar, kept just above the iPhone keyboard while writing. */
function Toolbar({ editor }: { editor: Editor }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const place = () => setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    place();
    viewport.addEventListener("resize", place);
    viewport.addEventListener("scroll", place);
    return () => { viewport.removeEventListener("resize", place); viewport.removeEventListener("scroll", place); };
  }, []);
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"), italic: current.isActive("italic"), heading: current.isActive("heading", { level: 2 }),
      bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"), task: current.isActive("taskList"),
      quote: current.isActive("blockquote"), mark: current.isActive("highlight"),
      undo: current.can().undo(), redo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const buttons: Array<{ label: string; icon: ReactNode; on?: boolean; disabled?: boolean; run: () => void }> = [
    { label: "Negrito", icon: <Bold className="h-4 w-4" />, on: active.bold, run: () => chain().toggleBold().run() },
    { label: "Itálico", icon: <Italic className="h-4 w-4" />, on: active.italic, run: () => chain().toggleItalic().run() },
    { label: "Título", icon: <Heading2 className="h-4 w-4" />, on: active.heading, run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: "Lista", icon: <List className="h-4 w-4" />, on: active.bullet, run: () => chain().toggleBulletList().run() },
    { label: "Lista numerada", icon: <ListOrdered className="h-4 w-4" />, on: active.ordered, run: () => chain().toggleOrderedList().run() },
    { label: "Caixinhas de marcar", icon: <ListChecks className="h-4 w-4" />, on: active.task, run: () => chain().toggleTaskList().run() },
    { label: "Citação", icon: <Quote className="h-4 w-4" />, on: active.quote, run: () => chain().toggleBlockquote().run() },
    { label: "Destaque", icon: <Highlighter className="h-4 w-4" />, on: active.mark, run: () => chain().toggleHighlight().run() },
    { label: "Desfazer", icon: <Undo2 className="h-4 w-4" />, disabled: !active.undo, run: () => chain().undo().run() },
    { label: "Refazer", icon: <Redo2 className="h-4 w-4" />, disabled: !active.redo, run: () => chain().redo().run() },
  ];
  return (
    <div className="fixed inset-x-0 z-[60] border-t border-line bg-[#f2efe7] px-2 py-1.5" style={{ bottom: offset }} role="toolbar" aria-label="Formatação">
      <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto">
        {buttons.map((button) => (
          // pointerdown keeps the cursor in the text, so the keyboard does not close
          <button key={button.label} type="button" aria-label={button.label} aria-pressed={button.on} disabled={button.disabled} onPointerDown={(event) => event.preventDefault()} onClick={button.run}
            className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border px-2 disabled:opacity-35 ${button.on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{button.icon}</button>
        ))}
      </div>
    </div>
  );
}

function PageMenu({ pageId, parentId, versions, onClose, onMove, onVersions, beforeLeave, backHref }: { pageId: string; parentId: string | null; versions: number; onClose: () => void; onMove: () => void; onVersions: () => void; beforeLeave: () => Promise<void>; backHref: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function subpage() {
    try {
      await beforeLeave();
      const result = await cadernoAction<{ id: string }>({ action: "createPage", parentId: pageId });
      router.push(`/caderno/pagina/${result.id}`);
    } catch (failure) { setError((failure as Error).message); }
  }
  async function archive() {
    try {
      await beforeLeave();
      await cadernoAction({ action: "archivePage", id: pageId, archived: true });
      router.push(backHref);
      router.refresh();
    } catch (failure) { setError((failure as Error).message); }
  }
  const item = "flex min-h-12 w-full items-center gap-3 border-b border-[#f0ebe1] text-left text-[15px] font-semibold text-ink last:border-b-0";
  return (
    <Sheet title="Página" onClose={onClose}>
      <div className="mt-2">
        <button type="button" onClick={subpage} className={item}><Plus className="h-4 w-4 text-moss" /> Nova subpágina{parentId ? " (no mesmo nível)" : ""}</button>
        <button type="button" onClick={onMove} className={item}><MoveRight className="h-4 w-4 text-moss" /> Mover para outro caderno ou seção</button>
        <button type="button" onClick={onVersions} className={item}><History className="h-4 w-4 text-moss" /> Versões anteriores ({versions})</button>
        <button type="button" onClick={archive} className={`${item} text-red-800`}><Archive className="h-4 w-4" /> Arquivar página</button>
      </div>
      <p className="mt-2 text-xs text-ink/55">Arquivar esconde a página sem apagar. Ela volta pelo Arquivo, na entrada do Caderno.</p>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
    </Sheet>
  );
}

function MoveSheet({ pageId, notebookId, sectionId, notebooks, sections, beforeMove, onClose }: { pageId: string; notebookId: string; sectionId: string | null; notebooks: Notebook[]; sections: NoteSection[]; beforeMove: () => Promise<void>; onClose: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState(notebookId);
  const [targetSection, setTargetSection] = useState<string | null>(sectionId);
  const [error, setError] = useState<string | null>(null);
  const options = sections.filter((section) => section.notebookId === target);
  async function move() {
    try {
      await beforeMove();
      await cadernoAction({ action: "movePage", id: pageId, notebookId: target, sectionId: targetSection });
      onClose();
      router.refresh();
    } catch (failure) { setError((failure as Error).message); }
  }
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70"}`;
  return (
    <Sheet title="Mover página" onClose={onClose}>
      <p className="mt-3 text-sm font-semibold text-ink">Caderno</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{notebooks.map((notebook) => <button key={notebook.id} type="button" className={chip(target === notebook.id)} onClick={() => { setTarget(notebook.id); setTargetSection(null); }}>{notebook.name}</button>)}</div>
      <p className="mt-3 text-sm font-semibold text-ink">Seção</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={chip(targetSection === null)} onClick={() => setTargetSection(null)}>Sem seção</button>
        {options.map((section) => <button key={section.id} type="button" className={chip(targetSection === section.id)} onClick={() => setTargetSection(section.id)}>{section.name}</button>)}
      </div>
      <p className="mt-3 text-xs text-ink/55">As subpáginas vão junto. Uma subpágina movida sozinha vira página.</p>
      <button type="button" onClick={move} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-moss text-sm font-semibold text-white">Mover</button>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
    </Sheet>
  );
}

function VersionsSheet({ pageId, beforeRestore, onClose, onRestored }: { pageId: string; beforeRestore: () => Promise<void>; onClose: () => void; onRestored: () => void }) {
  const [versions, setVersions] = useState<Array<{ id: string; title: string; preview: string; createdAt: string }> | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cadernoAction<{ versions: Array<{ id: string; title: string; preview: string; createdAt: string }> }>({ action: "listVersions", id: pageId })
      .then((result) => setVersions(result.versions)).catch((failure) => setError((failure as Error).message));
  }, [pageId]);
  async function restore(id: string) {
    try {
      await beforeRestore();
      await cadernoAction({ action: "restoreVersion", id });
      onRestored();
    } catch (failure) { setError((failure as Error).message); }
  }
  return (
    <Sheet title="Versões anteriores" onClose={onClose}>
      <p className="mt-1 text-xs text-ink/60">Uma versão é guardada a cada 10 minutos de escrita. Restaurar também guarda o texto de agora, então dá para voltar atrás.</p>
      {versions === null && !error ? <p className="mt-4 text-sm text-ink/60">Carregando…</p> : null}
      {versions?.length === 0 ? <p className="mt-4 text-sm text-ink/60">Ainda não há versões anteriores desta página.</p> : null}
      <ul className="mt-3 space-y-2">
        {versions?.map((version) => (
          <li key={version.id} className="rounded-xl border border-line p-3">
            <p className="text-xs font-semibold text-ink/60">{whenEdited(version.createdAt)}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{version.title}</p>
            {version.preview ? <p className="caderno-serif mt-1 text-sm leading-5 text-ink/75">{version.preview}</p> : null}
            {confirming === version.id ? (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => restore(version.id)} className="min-h-10 rounded-lg bg-moss px-3 text-sm font-semibold text-white">Sim, restaurar</button>
                <button type="button" onClick={() => setConfirming(null)} className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold">Cancelar</button>
              </div>
            ) : <button type="button" onClick={() => setConfirming(version.id)} className="mt-2 text-sm font-semibold text-moss">Restaurar esta versão</button>}
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
    </Sheet>
  );
}
