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
