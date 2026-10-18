/**
 * Streaks that forgive a single miss: a run only ends after two misses in a
 * row ("never miss twice"). Today, or the current week, never counts as a
 * miss while it is still going on.
 */

export const DEFAULT_ML_PER_KG = 35;
const DAY_MS = 86_400_000;

export const addDays = (dateKey: string, days: number) => new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
export const weekStart = (dateKey: string) => addDays(dateKey, -new Date(`${dateKey}T12:00:00Z`).getUTCDay());

/** Periods (days or weeks), oldest first; `done[i]` for each; the last one is the current period. */
export function streaks(done: boolean[]) {
  let best = 0;
  let run = 0;
  let misses = 0;
  done.forEach((ok, index) => {
    const current = index === done.length - 1;
    if (ok) { run += 1; misses = 0; }
    else if (!current) { misses += 1; if (misses >= 2) run = 0; }
    best = Math.max(best, run);
  });
  return { current: run, best };
}

/** Water goal: a fixed goal when set, otherwise weight × ml/kg rounded to 50 ml, otherwise 2.5 L. */
export function waterGoal(user: { weightKg?: number | null; waterMlPerKg?: number | null; waterGoalMl?: number | null }) {
  if (user.waterGoalMl && user.waterGoalMl > 0) return user.waterGoalMl;
  if (user.weightKg && user.weightKg > 0) return Math.round((user.weightKg * (user.waterMlPerKg || DEFAULT_ML_PER_KG)) / 50) * 50;
  return 2500;
}

/** The flame changes with the run: from yellow in the first week up to diamond after a year. */
export const FLAME_TIERS = [
  { weeks: 0, name: "Amarela", fill: "#f2c230", stroke: "#b88a00" },
  { weeks: 1, name: "Laranja", fill: "#f28c28", stroke: "#b85d0f" },
  { weeks: 2, name: "Vermelha", fill: "#e0442e", stroke: "#9e2416" },
  { weeks: 4, name: "Roxa", fill: "#8b45e6", stroke: "#5a2299" },
  { weeks: 8, name: "Preta", fill: "#2b2f33", stroke: "#000000" },
  { weeks: 13, name: "Prata", fill: "#c4cad0", stroke: "#7d868e" },
  { weeks: 26, name: "Dourada", fill: "#f0bf3c", stroke: "#a87808" },
  { weeks: 52, name: "Diamante", fill: "#8fe3ff", stroke: "#3a8fd6" },
] as const;

/** Tier for a run (days for daily habits, weeks otherwise), and how far the next one is in the same unit. */
export function flameTier(streak: number, daily: boolean) {
  const weeks = daily ? Math.floor(streak / 7) : streak;
  const index = FLAME_TIERS.reduce((found, tier, position) => (weeks >= tier.weeks ? position : found), 0);
  const next = FLAME_TIERS[index + 1];
  return { ...FLAME_TIERS[index], index, next: next ? { name: next.name, left: daily ? next.weeks * 7 - streak : next.weeks - streak } : null };
}
