/** Text helpers for Memorização, shared by the server and the practice screen. */

export const splitLines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/** First letter of each word, keeping punctuation: "Somos discípulos, sempre." → "S d, s." */
export function initials(line: string) {
  return line.split(/\s+/).filter(Boolean).map((word) => {
    const match = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}])[\p{L}\p{N}'’-]*([^\p{L}\p{N}]*)$/u);
    return match ? `${match[1]}${match[2]}${match[3]}` : word;
  }).join(" ");
}

/** Word lengths, to draw the hidden line as blanks of the right size. */
export const wordLengths = (line: string) => line.split(/\s+/).filter(Boolean).map((word) => word.length);
