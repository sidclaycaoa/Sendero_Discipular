import type { DailyPlan, PlannedItem, ProgressSummary } from "@/lib/domain";

export function calculateDailyProgress(plan: DailyPlan): ProgressSummary {
  return summarize(plan.items.filter((item) => item.denominatorScope === "daily"));
}

export function calculateWeeklyCompanions(plan: DailyPlan): ProgressSummary {
  return summarize(plan.items.filter((item) => item.denominatorScope === "weekly"));
}

export function calculateCategoryProgress(plan: DailyPlan): Record<string, ProgressSummary> {
  const grouped = plan.items
    .filter((item) => item.denominatorScope === "daily")
    .reduce<Record<string, PlannedItem[]>>((groups, item) => {
      groups[item.categoryId] = groups[item.categoryId] ?? [];
      groups[item.categoryId].push(item);
      return groups;
    }, {});

  return Object.fromEntries(
    Object.entries(grouped).map(([categoryId, items]) => [categoryId, summarize(items)])
  );
}

export function summarize(items: PlannedItem[]): ProgressSummary {
  const planned = items.length;
  const done = items.filter((item) => item.status === "done").length;

  return {
    planned,
    done,
    percentage: planned === 0 ? null : Math.round((done / planned) * 100)
  };
}
