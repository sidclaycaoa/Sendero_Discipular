/** Text helpers for Memorização, shared by the server and the practice screen. */

export const splitLines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export const words = (line: string) => line.split(/\s+/).filter(Boolean);

/** Word lengths, to draw the hidden line as blanks of the right size. */
export const wordLengths = (line: string) => words(line).map((word) => word.length);

/** A word split into the punctuation around it and the part to hide: "discípulos," → ["", "discípulos", ","]. */
export function wordParts(word: string): [string, string, string] {
  const match = word.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
  return match && match[2] ? [match[1], match[2], match[3]] : ["", word, ""];
}

/**
 * Which words of a line to hide, for a share between 0 and 1. The order is a
 * shuffle fixed by the line and the round, so the 80% stage hides the same
 * words as the 50% stage plus some more, and a new round draws other words.
 */
export function hiddenWords(line: string, share: number, round = 0) {
  const count = words(line).length;
  if (count === 0 || share <= 0) return new Set<number>();
  let seed = round * 2654435761;
  for (const char of line) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return new Set(order.slice(0, Math.min(count, Math.max(1, Math.round(count * share)))));
}
