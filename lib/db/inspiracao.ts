import { ensureReferenceLibrary, ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { randomIndexedPassage } from "@/lib/book-index";
import { longDate } from "@/lib/jornada-shared";

/**
 * "Uma passagem para hoje": a whole passage, with context, from the AD's books,
 * from the user's own class notes or from the phrases they kept. Each one says
 * where it comes from; a book's text is the book's own, never rewritten.
 */

export type InspirationSource = "tudo" | "livros" | "aulas";
export type Inspiration = {
  key: string;
  kind: "LIVRO" | "AULA" | "FRASE";
  text: string;
  heading: string;
  detail: string | null;
  href: string | null;
  /** Set for books: lets the passage (or a selected stretch of it) be kept in Frases. */
  bookPassageId: string | null;
};

type ClassRow = { id: string; date: string; title: string | null; notes: string | null; closing: string | null };

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** Paragraphs of a class note joined into chunks long enough to carry context. */
function chunks(value: string | null) {
  const out: string[] = [];
  let current = "";
  for (const paragraph of (value ?? "").split(/\n\s*\n|\n/).map((part) => part.trim()).filter(Boolean)) {
    current = current ? `${current}\n${paragraph}` : paragraph;
    if (current.length >= 200) { out.push(current); current = ""; }
  }
  if (current.length >= 120) out.push(current);
  return out.filter((chunk) => chunk.length <= 1600);
}

async function fromBooks(theme: string, exclude: string[]): Promise<Inspiration | null> {
  await ensureReferenceLibrary();
  const row = await randomIndexedPassage(getSenderoDb(), theme, exclude);
  if (!row) return null;
  return {
    key: `livro:${row.id}`, kind: "LIVRO", text: row.text.trim(), heading: `${row.author} · ${row.work}`,
    detail: row.location || (row.page ? `p. ${row.page}` : null), href: null, bookPassageId: row.id,
  };
}

async function fromClasses(userId: string, theme: string, exclude: string[]): Promise<Inspiration | null> {
  const rows = await getSenderoDb().prepare('SELECT id, date, title, notes, closing FROM "SchoolClass" WHERE userId = ? AND (notes IS NOT NULL OR closing IS NOT NULL)').bind(userId).all<ClassRow>();
  const words = theme.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/\p{L}{3,}/gu) ?? [];
  const all = rows.results.flatMap((row) => [...chunks(row.notes), ...chunks(row.closing)].map((text, index) => ({ row, text, key: `aula:${row.id}:${index}` })));
  const fits = (text: string) => !words.length || words.some((word) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(word));
  const matching = all.filter((item) => fits(item.text));
  const fresh = matching.filter((item) => !exclude.includes(item.key));
  const chosen = pick(fresh.length ? fresh : matching);
  if (!chosen) return null;
  return {
    key: chosen.key, kind: "AULA", text: chosen.text, heading: "Sua nota de aula",
    detail: [longDate(chosen.row.date), chosen.row.title].filter(Boolean).join(" · "), href: `/escola/${chosen.row.id}`, bookPassageId: null,
  };
}

async function fromPhrases(userId: string, theme: string, exclude: string[]): Promise<Inspiration | null> {
  const rows = await getSenderoDb().prepare('SELECT id, kind, text, author, work FROM "Passage" WHERE userId = ? AND archivedAt IS NULL').bind(userId).all<{ id: string; kind: string; text: string; author: string | null; work: string | null }>();
  const needle = theme.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const matching = rows.results.filter((row) => !needle || row.text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(needle));
  const fresh = matching.filter((row) => !exclude.includes(`frase:${row.id}`));
  const chosen = pick(fresh.length ? fresh : matching);
  if (!chosen) return null;
  return {
    key: `frase:${chosen.id}`, kind: "FRASE", text: chosen.text,
    heading: chosen.kind === "LITERAL" ? [chosen.author, chosen.work].filter(Boolean).join(" · ") : "Sua síntese",
    detail: "Das suas frases", href: "/caderno/frases", bookPassageId: null,
  };
}

export async function drawInspiration(userId: string, input: { source?: unknown; theme?: unknown; exclude?: unknown }) {
  await ensureSenderoSeeded();
  const source: InspirationSource = input.source === "livros" || input.source === "aulas" ? input.source : "tudo";
  const theme = typeof input.theme === "string" ? input.theme.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const exclude = Array.isArray(input.exclude) ? input.exclude.filter((item): item is string => typeof item === "string").slice(-40) : [];
  const books = exclude.filter((key) => key.startsWith("livro:")).map((key) => key.slice(6));
  const books_ = () => fromBooks(theme, books);
  const classes = () => fromClasses(userId, theme, exclude);
  const phrases = () => fromPhrases(userId, theme, exclude);
  // With everything allowed, the books come first more often than not; the rest follow in a random order.
  const others = [classes, phrases].sort(() => Math.random() - 0.5);
  const order = source === "livros" ? [books_] : source === "aulas" ? [classes] : Math.random() < 0.55 ? [books_, ...others] : [...others, books_];
  for (const draw of order) {
    const found = await draw();
    if (found) return { inspiration: found };
  }
  return { inspiration: null };
}
