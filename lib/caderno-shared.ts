/** Caderno: labels and colors shared by the server and the screens. */

export const NOTEBOOK_COLORS = ["#5b4a8a", "#8a6d3b", "#3f6577", "#7a5a4e", "#46533b", "#9a4f3a", "#2f5d62", "#8a8d89"];

export const DEFAULT_NOTEBOOKS: Array<{ name: string; color: string; kind: "NORMAL" | "ENTRADA" }> = [
  { name: "Escola do Discipulado", color: "#5b4a8a", kind: "NORMAL" },
  { name: "Leituras", color: "#8a6d3b", kind: "NORMAL" },
  { name: "Aulas", color: "#3f6577", kind: "NORMAL" },
  { name: "Vida e trabalho", color: "#7a5a4e", kind: "NORMAL" },
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
