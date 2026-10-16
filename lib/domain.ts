export type PeriodOfDay = "morning" | "afternoon" | "night";
export type PlannedItemKind = "reflection" | "habit" | "task";
export type PlannedItemStatus = "planned" | "done" | "postponed" | "late";

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type ReflectionTemplate = {
  id: string;
  userId: string;
  topic: string;
  subtopic?: string;
  description: string;
  insight: string;
  orientation: string;
  categoryId: string;
  cycleDays: number[];
  period: PeriodOfDay;
  isActive: boolean;
};

export type ReflectionEntry = {
  id: string;
  userId: string;
  templateId: string;
  date: string;
  cycleDay: number;
  contentText: string;
  reflectionTimeSeconds: number;
  status: "done";
};

export type ReflectionPostponement = {
  id: string;
  userId: string;
  templateId: string;
  originalDate: string;
  postponedToDate: string;
};

export type HabitTemplate = {
  id: string;
  userId: string;
  title: string;
  categoryId: string;
  cadence: "daily" | "weekly";
  targetCount: number;
  isActive: boolean;
};

export type HabitLog = {
  id: string;
  userId: string;
  habitId: string;
  date: string;
  count: number;
};

export type TaskOccurrence = {
  id: string;
  userId: string;
  title: string;
  dueDate: string;
  categoryId: string;
  completedAt?: string;
  originReflectionTemplateId?: string;
};

export type PlannedItem = {
  id: string;
  sourceId: string;
  kind: PlannedItemKind;
  title: string;
  categoryId: string;
  status: PlannedItemStatus;
  denominatorScope: "daily" | "weekly";
};

export type DailyPlan = {
  date: string;
  cycleDay: number;
  items: PlannedItem[];
};

export type ProgressSummary = {
  planned: number;
  done: number;
  percentage: number | null;
};
