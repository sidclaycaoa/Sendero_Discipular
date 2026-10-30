"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Highlight from "@tiptap/extension-highlight";
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Archive, ArrowDownToLine, ArrowLeft, Bold, CalendarDays, ChevronDown, ClipboardCopy, ClipboardPaste, Heading2, Heading3, Highlighter, History, IndentDecrease, IndentIncrease, Italic, List, ListChecks, ListOrdered, Minus, MoreHorizontal, MoveRight, Plus, Quote, Redo2, RemoveFormatting, Share2, Sparkles, Strikethrough, Underline, Undo2 } from "lucide-react";
import { Sheet } from "@/components/app/Sheet";
import { DateStamp, IndentKeys, indent, insertDateStamp, outdent, toggleQuote } from "@/components/caderno/editor-extensions";
import { cadernoAction, copyText } from "@/components/caderno/shared";
import { COMMENT_COLORS, HIGHLIGHT_COLORS, NOTE_COLORS, PAGE_FONTS, dateStampLabel, pageToText, synthesisRequest, todayKey, whenEdited } from "@/lib/caderno-shared";
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
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      DateStamp,
      IndentKeys,
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
  const pageText = () => (editor ? pageToText(editor.getJSON()) : page.plainText);

  return (
    // While writing, room below the text lets its last lines rise above the keyboard and the bar.
    <div style={focused ? { paddingBottom: "55vh" } : undefined}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link prefetch={false} href={parent ? `/caderno/pagina/${parent.id}` : `/caderno/${notebook.id}`} className="flex min-h-11 min-w-0 items-center gap-2 text-[12.5px] text-ink/65">
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: notebook.color }} />
          <span className="truncate">{place.join(" › ")}</span>
        </Link>
        <button type="button" onClick={() => setSheet("menu")} aria-label="Mais opções da página" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-ink/70"><MoreHorizontal className="h-5 w-5" /></button>
      </div>

      <PageActions title={title} text={pageText} editor={editor} />

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
        <Synthesis pageId={page.id} initial={page.synthesis ?? ""} request={() => synthesisRequest(titleRef.current, pageText())} />
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

/** Buttons at the top of the page: copy the plain text, share it, go to its end to keep writing. */
function PageActions({ title, text, editor }: { title: string; text: () => string; editor: Editor | null }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  // Sharing exists only in the phone's browser, known after the first render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCanShare(typeof navigator.share === "function"); }, []);
  const whole = () => [title.trim(), text()].filter(Boolean).join("\n\n");
  async function copy() {
    setCopied(await copyText(whole()));
    window.setTimeout(() => setCopied(false), 2500);
  }
  function share() {
    void navigator.share({ title: title.trim() || "Página do Caderno", text: whole() }).catch(() => undefined);
  }
  function toEnd() {
    if (!editor) return;
    editor.chain().focus("end").scrollIntoView().run();
  }
  const pill = "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[12.5px] font-semibold text-ink/80";
  return (
    <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      <button type="button" onClick={copy} className={pill}><ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />{copied ? "Copiado ✓" : "Copiar tudo"}</button>
      {canShare ? <button type="button" onClick={share} className={pill}><Share2 className="h-3.5 w-3.5" aria-hidden="true" />Compartilhar</button> : null}
      <button type="button" onClick={toEnd} className={pill}><ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />Escrever no fim</button>
    </div>
  );
}

const SYNTHESIS_SAVE_MS = 1000;

/**
 * The page's synthesis, folded at the top. "Copiar para a IA" copies a request
 * with the whole page, to paste in a conversation with an AI outside the app;
 * the answer is pasted back here. No AI runs inside the app.
 */
function Synthesis({ pageId, initial, request }: { pageId: string; initial: string; request: () => string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const latest = useRef(initial);
  const area = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const sent = latest.current;
    try {
      await cadernoAction({ action: "saveSynthesis", id: pageId, synthesis: sent });
      if (latest.current === sent) setState("saved");
    } catch { setState("error"); }
  }, [pageId]);
  useEffect(() => () => { if (timer.current) void send(); }, [send]);
  useLayoutEffect(() => {
    const input = area.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.max(input.scrollHeight, 88)}px`;
  }, [value, open]);

  function change(next: string) {
    latest.current = next;
    setValue(next);
    setState("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void send(); }, SYNTHESIS_SAVE_MS);
  }
  async function copyRequest() {
    setCopied(await copyText(request()));
    window.setTimeout(() => setCopied(false), 3000);
  }
  async function paste() {
    try {
      const answer = (await navigator.clipboard.readText()).trim();
      if (answer) change(value.trim() ? `${value.trim()}\n\n${answer}` : answer);
    } catch {
      area.current?.focus();
    }
  }

  const button = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[12.5px] font-semibold text-ink/80";
  return (
    <section className="mt-3 rounded-xl border border-[#e8e0cf] bg-[#faf6ec]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 text-left">
        <Sparkles className="h-4 w-4 shrink-0 text-bronze" aria-hidden="true" />
        <span className="text-[13px] font-semibold text-ink">Síntese</span>
        {!open ? <span className="caderno-serif min-w-0 flex-1 truncate text-[13px] text-ink/60">{value.trim() || "ainda não escrita"}</span> : <span className="flex-1" />}
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink/50 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="px-3 pb-3">
          <textarea ref={area} value={value} onChange={(event) => change(event.target.value)} placeholder="A ideia central desta página, em poucas frases." aria-label="Síntese da página"
            className="caderno-serif block w-full resize-none rounded-lg border border-line bg-white p-2.5 text-[15px] leading-6 text-ink outline-none" />
          <p className="mt-1 text-[11.5px] text-ink/50">{state === "saving" ? "salvando…" : state === "error" ? <span className="font-semibold text-amber-800">não foi salva: confira a internet e mexa no texto de novo</span> : value.trim() ? "✓ salva" : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={copyRequest} className={button}><ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />{copied ? "Copiado ✓" : "Copiar para a IA"}</button>
            <button type="button" onClick={paste} className={button}><ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />Colar a resposta</button>
          </div>
          <p className="mt-2 text-[11.5px] leading-4 text-ink/55">&quot;Copiar para a IA&quot; copia um pedido de síntese junto com o texto da página. Cole numa conversa com a IA e traga a resposta para cá com &quot;Colar a resposta&quot;.</p>
        </div>
      ) : null}
    </section>
  );
}

type BarButton = { label: string; icon: ReactNode; on?: boolean; disabled?: boolean; run: () => void };

// pointerdown keeps the cursor in the text, so the keyboard does not close
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

function BarButtons({ buttons }: { buttons: BarButton[] }) {
  return buttons.map((button) => (
    <button key={button.label} type="button" aria-label={button.label} title={button.label} aria-pressed={button.on} disabled={button.disabled} onPointerDown={keepFocus} onClick={button.run}
      className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border px-2 disabled:opacity-35 ${button.on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{button.icon}</button>
  ));
}

function Swatch({ name, color, on, run, ring }: { name: string; color: string; on: boolean; run: () => void; ring?: boolean }) {
  return (
    <button type="button" aria-label={name} title={name} aria-pressed={on} onPointerDown={keepFocus} onClick={run}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-ink" : "border-transparent"}`}>
      <span className={`block h-[18px] w-[18px] rounded-full ${ring ? "border border-[#cfc6b5]" : ""}`} style={{ background: color }} />
    </button>
  );
}

const MARGIN = 14;

/**
 * Formatting bar, kept just above the iPhone keyboard while writing: the two
 * color sets (notes and comments) always in sight, the common buttons in a row,
 * and "⋯" for the rest. The page scrolls so the cursor never hides behind it.
 */
function Toolbar({ editor }: { editor: Editor }) {
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  // Keeps the line being written above the bar (the phone only knows about the keyboard).
  const reveal = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (editor.isDestroyed || !editor.isFocused) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight) - (bar.current?.offsetHeight ?? 0) - MARGIN;
      let caret: { top: number; bottom: number };
      try { caret = editor.view.coordsAtPos(editor.state.selection.head); } catch { return; }
      if (caret.bottom > bottom) window.scrollBy({ top: caret.bottom - bottom });
      else if (caret.top < top + MARGIN) window.scrollBy({ top: caret.top - top - MARGIN });
    });
  }, [editor]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const place = () => { if (viewport) setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)); };
    const resized = () => { place(); reveal(); };
    place();
    viewport?.addEventListener("resize", resized);
    viewport?.addEventListener("scroll", place);
    editor.on("selectionUpdate", reveal);
    editor.on("update", reveal);
    reveal();
    return () => {
      viewport?.removeEventListener("resize", resized);
      viewport?.removeEventListener("scroll", place);
      editor.off("selectionUpdate", reveal);
      editor.off("update", reveal);
    };
  }, [editor, reveal]);
  useEffect(() => { reveal(); }, [more, reveal]);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"), italic: current.isActive("italic"), underline: current.isActive("underline"), strike: current.isActive("strike"),
      heading: current.isActive("heading", { level: 2 }), small: current.isActive("heading", { level: 3 }),
      bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"), task: current.isActive("taskList"),
      inList: current.isActive("listItem") || current.isActive("taskItem"),
      quote: current.isActive("blockquote"), mark: current.isActive("highlight"),
      highlight: (current.getAttributes("highlight").color as string | undefined) ?? null,
      color: (current.getAttributes("textStyle").color as string | undefined) ?? null,
      font: (current.getAttributes("textStyle").fontFamily as string | undefined) ?? null,
      align: (["center", "right", "justify"] as const).find((side) => current.isActive({ textAlign: side })) ?? "left",
      undo: current.can().undo(), redo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const setColor = (value: string | null) => (value ? chain().setColor(value).run() : chain().unsetColor().run());

  const main: BarButton[] = [
    { label: "Negrito", icon: <Bold className="h-4 w-4" />, on: active.bold, run: () => chain().toggleBold().run() },
    { label: "Itálico", icon: <Italic className="h-4 w-4" />, on: active.italic, run: () => chain().toggleItalic().run() },
    { label: "Título", icon: <Heading2 className="h-4 w-4" />, on: active.heading, run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: "Lista", icon: <List className="h-4 w-4" />, on: active.bullet, run: () => chain().toggleBulletList().run() },
    { label: "Lista numerada", icon: <ListOrdered className="h-4 w-4" />, on: active.ordered, run: () => chain().toggleOrderedList().run() },
    { label: "Caixinhas de marcar", icon: <ListChecks className="h-4 w-4" />, on: active.task, run: () => chain().toggleTaskList().run() },
    { label: "Recuar (voltar um nível)", icon: <IndentDecrease className="h-4 w-4" />, disabled: !active.inList, run: () => outdent(editor) },
    { label: "Avançar (subtópico)", icon: <IndentIncrease className="h-4 w-4" />, run: () => indent(editor) },
    { label: "Citação", icon: <Quote className="h-4 w-4" />, on: active.quote, run: () => toggleQuote(editor) },
    { label: "Destaque", icon: <Highlighter className="h-4 w-4" />, on: active.mark, run: () => chain().toggleHighlight().run() },
    { label: `Marca de data (${dateStampLabel(todayKey())})`, icon: <CalendarDays className="h-4 w-4" />, run: () => insertDateStamp(editor, todayKey()) },
    { label: "Desfazer", icon: <Undo2 className="h-4 w-4" />, disabled: !active.undo, run: () => chain().undo().run() },
    { label: "Refazer", icon: <Redo2 className="h-4 w-4" />, disabled: !active.redo, run: () => chain().redo().run() },
  ];
  const extra: BarButton[] = [
    { label: "Sublinhado", icon: <Underline className="h-4 w-4" />, on: active.underline, run: () => chain().toggleUnderline().run() },
    { label: "Tachado", icon: <Strikethrough className="h-4 w-4" />, on: active.strike, run: () => chain().toggleStrike().run() },
    { label: "Título menor", icon: <Heading3 className="h-4 w-4" />, on: active.small, run: () => chain().toggleHeading({ level: 3 }).run() },
    { label: "Linha divisória", icon: <Minus className="h-4 w-4" />, run: () => chain().setHorizontalRule().run() },
    { label: "Limpar formatação", icon: <RemoveFormatting className="h-4 w-4" />, run: () => chain().unsetAllMarks().run() },
  ];
  const aligns: BarButton[] = [
    { label: "Alinhar à esquerda", icon: <AlignLeft className="h-4 w-4" />, on: active.align === "left", run: () => chain().unsetTextAlign().run() },
    { label: "Centralizar", icon: <AlignCenter className="h-4 w-4" />, on: active.align === "center", run: () => chain().setTextAlign("center").run() },
    { label: "Alinhar à direita", icon: <AlignRight className="h-4 w-4" />, on: active.align === "right", run: () => chain().setTextAlign("right").run() },
    { label: "Justificar", icon: <AlignJustify className="h-4 w-4" />, on: active.align === "justify", run: () => chain().setTextAlign("justify").run() },
  ];
  const label = "shrink-0 text-[9.5px] font-semibold uppercase text-ink/55";

  return (
    <div ref={bar} className="fixed inset-x-0 z-[60] border-t border-line bg-[#f2efe7] px-2 pb-1.5 pt-1" style={{ bottom: offset }} role="toolbar" aria-label="Formatação">
      <div className="mx-auto max-w-2xl">
        {more ? (
          <div className="mb-1 space-y-1 border-b border-line pb-1.5">
            <div className="flex gap-1 overflow-x-auto"><BarButtons buttons={extra} /></div>
            <div className="flex gap-1 overflow-x-auto"><BarButtons buttons={aligns} /></div>
            <div className="flex items-center gap-1 overflow-x-auto">
              <span className={label}>Letra</span>
              {PAGE_FONTS.map((font) => (
                <button key={font.name} type="button" aria-pressed={active.font === font.value} onPointerDown={keepFocus} onClick={() => (font.value ? chain().setFontFamily(font.value).run() : chain().unsetFontFamily().run())}
                  className={`h-9 shrink-0 rounded-lg border px-3 text-[15px] ${active.font === font.value ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`} style={{ fontFamily: font.css }}>{font.name}</button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 overflow-x-auto">
              <span className={`${label} mr-1`}>Destaque</span>
              {HIGHLIGHT_COLORS.map((color) => <Swatch key={color.value} name={`Destaque ${color.name.toLowerCase()}`} color={color.value} ring on={active.highlight === color.value} run={() => chain().setHighlight({ color: color.value }).run()} />)}
              <button type="button" onPointerDown={keepFocus} onClick={() => chain().unsetHighlight().run()} className="h-7 shrink-0 rounded-lg border border-line bg-white px-2 text-[12px] font-semibold text-ink/70">sem destaque</button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-0.5 overflow-x-auto pb-1" aria-label="Cores">
          <span className={`${label} mr-0.5`}>Anotação</span>
          {NOTE_COLORS.map((color) => <Swatch key={color.name} name={`Anotação: ${color.name.toLowerCase()}`} color={color.value ?? "var(--page-ink)"} on={active.color === color.value} run={() => setColor(color.value)} />)}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          <span className={`${label} mr-0.5`}>Comentário</span>
          {COMMENT_COLORS.map((color) => <Swatch key={color.name} name={`Comentário: ${color.name.toLowerCase()}`} color={color.value} on={active.color === color.value} run={() => setColor(color.value)} />)}
        </div>
        <div className="flex gap-1">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto"><BarButtons buttons={main} /></div>
          <button type="button" aria-label="Mais opções de formatação" aria-expanded={more} onPointerDown={keepFocus} onClick={() => setMore(!more)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${more ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}><MoreHorizontal className="h-4 w-4" /></button>
        </div>
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
