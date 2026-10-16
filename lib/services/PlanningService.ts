import { calculateCycleDay, isSameWeek, isSunday } from "@/lib/date";
import type {
  DailyPlan,
  HabitLog,
  HabitTemplate,
  PlannedItem,
  ReflectionEntry,
  ReflectionPostponement,
  ReflectionTemplate,
  TaskOccurrence
} from "@/lib/domain";

export type BuildDailyPlanInput = {
  userId: string;
  date: string;
  cycleAnchorDate: string;
  reflectionTemplates: ReflectionTemplate[];
  reflectionEntries: ReflectionEntry[];
  reflectionPostponements: ReflectionPostponement[];
  habitTemplates: HabitTemplate[];
  habitLogs: HabitLog[];
  taskOccurrences: TaskOccurrence[];
};

export function buildDailyPlan(input: BuildDailyPlanInput): DailyPlan {
  const cycleDay = calculateCycleDay(input.date, input.cycleAnchorDate);
  const items: PlannedItem[] = [
    ...plannedReflections(input, cycleDay),
    ...plannedHabits(input),
    ...plannedTasks(input)
  ];

  return {
    date: input.date,
    cycleDay,
    items
  };
}

function plannedReflections(input: BuildDailyPlanInput, cycleDay: number): PlannedItem[] {
  const postponedOut = new Set(
    input.reflectionPostponements
      .filter((item) => item.userId === input.userId && item.originalDate === input.date)
      .map((item) => item.templateId)
  );

  const postponedIn = new Set(
    input.reflectionPostponements
      .filter((item) => item.userId === input.userId && item.postponedToDate === input.date)
      .map((item) => item.templateId)
  );

  return input.reflectionTemplates
    .filter((template) => template.userId === input.userId && template.isActive)
    .filter((template) => template.cycleDays.includes(cycleDay) || postponedIn.has(template.id))
    .filter((template) => !postponedOut.has(template.id))
    .map((template) => {
      const entry = input.reflectionEntries.find(
        (candidate) =>
          candidate.userId === input.userId &&
          candidate.templateId === template.id &&
          candidate.date === input.date
      );

      return {
        id: `reflection:${template.id}`,
        sourceId: template.id,
        kind: "reflection",
        title: template.topic,
        categoryId: template.categoryId,
        status: entry ? "done" : "planned",
        denominatorScope: "daily"
      };
    });
}

function plannedHabits(input: BuildDailyPlanInput): PlannedItem[] {
  return input.habitTemplates
    .filter((habit) => habit.userId === input.userId && habit.isActive)
    .flatMap<PlannedItem>((habit) => {
      const logs = input.habitLogs.filter(
        (log) =>
          log.userId === input.userId &&
          log.habitId === habit.id &&
          (habit.cadence === "daily" ? log.date === input.date : isSameWeek(log.date, input.date))
      );
      const doneCount = logs.reduce((sum, log) => sum + log.count, 0);

      if (habit.cadence === "weekly" && !isSunday(input.date)) {
        return [
          {
            id: `habit:${habit.id}`,
            sourceId: habit.id,
            kind: "habit",
            title: `${habit.title} (${doneCount}/${habit.targetCount} na semana)`,
            categoryId: habit.categoryId,
            status: doneCount >= habit.targetCount ? "done" : "planned",
            denominatorScope: "weekly"
          } satisfies PlannedItem
        ];
      }

      return [
        {
          id: `habit:${habit.id}`,
          sourceId: habit.id,
          kind: "habit",
          title: habit.title,
          categoryId: habit.categoryId,
          status: doneCount >= habit.targetCount ? "done" : "planned",
          denominatorScope: "daily"
        } satisfies PlannedItem
      ];
    });
}

function plannedTasks(input: BuildDailyPlanInput): PlannedItem[] {
  return input.taskOccurrences
    .filter((task) => task.userId === input.userId)
    .filter((task) => task.dueDate <= input.date && !task.completedAt)
    .map((task) => ({
      id: `task:${task.id}`,
      sourceId: task.id,
      kind: "task",
      title: task.title,
      categoryId: task.categoryId,
      status: task.dueDate < input.date ? "late" : "planned",
      denominatorScope: "daily"
    }));
}
