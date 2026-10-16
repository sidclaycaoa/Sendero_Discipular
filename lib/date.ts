const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getSaoPauloDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getSaoPauloDayOfMonth(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "numeric"
    }).format(date)
  );
}

export function calculateCycleDay(dateKey: string, anchorDateKey: string, cycleLength = 30): number {
  const date = Date.parse(`${dateKey}T00:00:00.000Z`);
  const anchor = Date.parse(`${anchorDateKey}T00:00:00.000Z`);
  const diff = Math.floor((date - anchor) / DAY_MS);
  return ((diff % cycleLength) + cycleLength) % cycleLength + 1;
}

export function isSameWeek(dateKey: string, referenceDateKey: string): boolean {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const reference = new Date(`${referenceDateKey}T00:00:00.000Z`);
  return startOfWeek(date).getTime() === startOfWeek(reference).getTime();
}

export function isSunday(dateKey: string): boolean {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay() === 0;
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const result = new Date(date);
  result.setUTCDate(date.getUTCDate() - day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
