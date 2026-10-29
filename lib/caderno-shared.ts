/** Caderno: labels and colors shared by the server and the screens. */

export const NOTEBOOK_COLORS = ["#5b4a8a", "#8a6d3b", "#3f6577", "#7a5a4e", "#46533b", "#9a4f3a", "#2f5d62", "#8a8d89"];

/** The special notebook of phrases: black, like the cover of a commonplace book. */
export const FRASES_COLOR = "#1d1a17";

export const DEFAULT_NOTEBOOKS: Array<{ name: string; color: string; kind: "NORMAL" | "ENTRADA" | "FRASES" }> = [
  { name: "Escola do Discipulado", color: "#5b4a8a", kind: "NORMAL" },
  { name: "Leituras", color: "#8a6d3b", kind: "NORMAL" },
  { name: "Aulas", color: "#3f6577", kind: "NORMAL" },
  { name: "Vida e trabalho", color: "#7a5a4e", kind: "NORMAL" },
  { name: "Frases e passagens", color: FRASES_COLOR, kind: "FRASES" },
  { name: "Caixa de entrada", color: "#8a8d89", kind: "ENTRADA" },
];

/** Search results mark the matching words between these two characters. */
export const MARK_START = "\u0002";
export const MARK_END = "\u0003";

/** "hoje, 21:40", "ontem", "12 out". */
export function whenEdited(iso: string, now = new Date()) {
  const zone = "America/Sao_Paulo";
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(date);
  const date = new Date(iso);
  const today = day(now);
  const yesterday = day(new Date(now.getTime() - 86_400_000));
  if (day(date) === today) return `hoje, ${new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(date)}`;
  if (day(date) === yesterday) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "numeric", month: "short", year: day(date).slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" }).format(date).replace(".", "").replace(/ de /g, " ");
}

/** First words of a page, for previews. */
export function preview(text: string, size = 90) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return clean;
  const cut = clean.lastIndexOf(" ", size);
  return `${clean.slice(0, cut > size / 2 ? cut : size)}…`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Today in the user's time zone, YYYY-MM-DD. */
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** The date mark of a page: "29/out" (from "2026-10-29"). */
export function dateStampLabel(dateKey: string) {
  const [, month, day] = dateKey.split("-").map(Number);
  return month && day ? `${day}/${MONTHS[month - 1]}` : "data";
}

/** The same mark in full, shown when it is touched: "29 de outubro de 2026". */
export function dateStampTitle(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return month && day ? `${day} de ${MONTHS_LONG[month - 1]} de ${year}` : "";
}

/** Text colors of the Caderno: one set for the notes, another for comments on them. */
export const NOTE_COLORS = [
  { name: "Tinta", value: null },
  { name: "Azul", value: "#1f4e8c" },
  { name: "Verde", value: "#2f6b3a" },
  { name: "Vinho", value: "#8a2b3a" },
] as const;
export const COMMENT_COLORS = [
  { name: "Terracota", value: "#c0502b" },
  { name: "Violeta", value: "#7a3fa0" },
  { name: "Céu", value: "#1f7fa6" },
  { name: "Ouro", value: "#a77a12" },
] as const;
export const HIGHLIGHT_COLORS = [
  { name: "Amarelo", value: "#fbeeb8" },
  { name: "Verde", value: "#d9ecd0" },
  { name: "Azul", value: "#d6e6f5" },
  { name: "Rosa", value: "#f6dbe0" },
] as const;

/** Faces of the Caderno, all served by the app itself (SIL Open Font License). */
export const PAGE_FONTS = [
  { name: "Livro", value: null, css: '"Source Serif 4", Georgia, serif' },
  { name: "Clara", value: '"Atkinson Hyperlegible", system-ui, sans-serif', css: '"Atkinson Hyperlegible", system-ui, sans-serif' },
  { name: "Manuscrita", value: '"Caveat", cursive', css: '"Caveat", cursive' },
] as const;

/** What "Copiar para a IA" puts on the clipboard: the request and the page, ready to paste in a chat. */
export function synthesisRequest(title: string, text: string) {
  return [
    "Faça uma síntese desta página do meu caderno de estudos.",
    "- Em português, em no máximo 6 frases curtas.",
    "- Fiel ao que escrevi: não acrescente ideias de fora nem conselhos.",
    "- Comece pela ideia central; depois o que devo levar para a vida.",
    "- Responda só com a síntese, sem introdução.",
    "",
    `Título: ${title || "Sem título"}`,
    "",
    text.trim(),
  ].join("\n");
}

type DocNode = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: DocNode[] };

/**
 * A page as plain text to paste anywhere: lists keep their marks and levels
 * ("•", "1.", "☐"), quotations start with ">", date marks read "[29/out]".
 */
export function pageToText(doc: DocNode): string {
  const inline = (node: DocNode): string => (node.content ?? []).map((child) => {
    if (child.type === "text") return child.text ?? "";
    if (child.type === "hardBreak") return "\n";
    if (child.type === "dateStamp") return `[${dateStampLabel(String(child.attrs?.date ?? ""))}]`;
    return inline(child);
  }).join("");
  const blocks = (nodes: DocNode[] = [], indent = ""): string[] => nodes.flatMap((node) => {
    switch (node.type) {
      case "bulletList":
      case "orderedList":
      case "taskList":
        return (node.content ?? []).flatMap((item, index) => {
          const mark = node.type === "bulletList" ? "• " : node.type === "orderedList" ? `${Number(node.attrs?.start ?? 1) + index}. ` : item.attrs?.checked ? "☑ " : "☐ ";
          const [first, ...rest] = blocks(item.content, `${indent}   `);
          return [`${indent}${mark}${(first ?? "").trimStart()}`, ...rest];
        });
      case "blockquote":
        return blocks(node.content).map((line) => `${indent}> ${line}`);
      case "horizontalRule":
        return [`${indent}———`];
      default:
        return inline(node).split("\n").map((line) => `${indent}${line}`);
    }
  });
  return blocks(doc.content).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
