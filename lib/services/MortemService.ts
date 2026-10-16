const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;

export function calculateMortem(birthDateKey: string, targetAge: number, today = new Date()) {
  const birth = new Date(`${birthDateKey}T00:00:00.000Z`);
  const livedMs = today.getTime() - birth.getTime();
  const totalMs = targetAge * YEAR_MS;
  const remainingMs = Math.max(totalMs - livedMs, 0);

  return {
    livedPercentage: Math.min(100, Math.max(0, Math.round((livedMs / totalMs) * 10000) / 100)),
    remainingHours: Math.floor(remainingMs / (60 * 60 * 1000)),
    remainingDays: Math.floor(remainingMs / (24 * 60 * 60 * 1000)),
    remainingWeeks: Math.floor(remainingMs / (7 * 24 * 60 * 60 * 1000)),
    remainingMonths: Math.floor(remainingMs / (30.436875 * 24 * 60 * 60 * 1000)),
    remainingYears: Math.floor(remainingMs / YEAR_MS)
  };
}
