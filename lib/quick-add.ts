/**
 * Understands short Portuguese phrases for the Agenda quick add:
 * "ligar pro contador amanhã 15h" → { title: "Ligar pro contador", date: tomorrow, time: "15:00" }.
 * Recognised: hoje, amanhã, depois de amanhã, weekdays ("sexta", "na próxima terça"),
 * "dia 25", "25/10", "25/10/2027"; hours "15h", "15h30", "15:30", "às 9".
 */

const WEEKDAYS: Array<[RegExp, number]> = [
  [/domingo/, 0], [/segunda(?:-feira)?/, 1], [/ter[cç]a(?:-feira)?/, 2], [/quarta(?:-feira)?/, 3],
  [/quinta(?:-feira)?/, 4], [/sexta(?:-feira)?/, 5], [/s[aá]bado/, 6],
];

const shift = (dateKey: string, days: number) => new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const pad = (value: number) => String(value).padStart(2, "0");

export type QuickAdd = { title: string; date: string | null; time: string | null };

export function parseQuickAdd(input: string, today: string): QuickAdd {
  let text = ` ${input.trim()} `;
  let date: string | null = null;
  let time: string | null = null;
  const take = (pattern: RegExp, read: (match: RegExpMatchArray) => void) => {
    const match = text.toLocaleLowerCase("pt-BR").match(pattern);
    if (!match || match.index === undefined) return false;
    read(match);
    text = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
    return true;
  };

  // Hour first, so "dia 25 às 15h" keeps both: "15h", "15h30", "15:30", "às 9".
  if (!take(/\s(?:[àa]s?\s+)?([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))(?=\s)/, (match) => { time = `${pad(Number(match[1]))}:${match[2] ?? match[3] ?? "00"}`; })) {
    take(/\s[àa]s\s+([01]?\d|2[0-3])(?=\s)/, (match) => { time = `${pad(Number(match[1]))}:00`; });
  }

  if (take(/\sdepois de amanh[ãa](?=\s)/, () => { date = shift(today, 2); })) { /* done */ }
  else if (take(/\samanh[ãa](?=\s)/, () => { date = shift(today, 1); })) { /* done */ }
  else if (take(/\shoje(?=\s)/, () => { date = today; })) { /* done */ }
  else if (take(/\s(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (match) => {
    const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : today.slice(0, 4);
    let candidate = `${year}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`;
    if (!match[3] && candidate < today) candidate = `${Number(year) + 1}${candidate.slice(4)}`;
    date = candidate;
  })) { /* done */ }
  else if (take(/\sdia\s+(\d{1,2})(?=\s)/, (match) => {
    const day = Number(match[1]);
    let candidate = `${today.slice(0, 8)}${pad(day)}`;
    if (candidate < today) { const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), day, 12)); candidate = next.toISOString().slice(0, 10); }
    date = candidate;
  })) { /* done */ }
  else {
    for (const [pattern, weekday] of WEEKDAYS) {
      const found = take(new RegExp(`\\s(?:(?:n[ao]|nesta|neste|próxima|proxima|próximo|proximo)\\s+)*${pattern.source}(?=\\s)`), () => {
        const current = new Date(`${today}T12:00:00Z`).getUTCDay();
        date = shift(today, ((weekday - current + 7) % 7) || 7);
      });
      if (found) break;
    }
  }

  const title = text.replace(/\s+/g, " ").trim().replace(/\s+(?:para|pra|na|no|em|às|as|de)$/i, "").trim();
  return { title: title ? title[0].toLocaleUpperCase("pt-BR") + title.slice(1) : "", date, time };
}
