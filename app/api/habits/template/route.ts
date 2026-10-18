import { NextResponse } from "next/server";
import { practiceToolKey } from "@/lib/practice";
import { cleanHabitSchedule, createHabitTemplate, getActiveUser } from "@/lib/db/sendero";

export async function POST(request: Request) {
  const user = await getActiveUser();
  const body = (await request.json()) as { title?: string; cadence?: "DAILY" | "WEEKLY" | "MONTHLY" | "TIME_BASED"; targetCount?: number; description?: string; practiceGroup?: "ED" | "PSYCHOLOGY" | "HABIT"; practiceTool?: string | null; dayPeriod?: unknown; scheduledTime?: unknown; remind?: unknown };
  if (!user || !body.title?.trim()) return NextResponse.json({ error: "Missing data." }, { status: 400 });
  const habit = await createHabitTemplate({
    userId: user.id,
    title: body.title.trim(),
    cadence: body.cadence ?? "DAILY",
    targetCount: Math.max(1, Number(body.targetCount) || 1),
    description: body.description,
    practiceGroup: body.practiceGroup === "ED" || body.practiceGroup === "PSYCHOLOGY" ? body.practiceGroup : "HABIT",
    practiceTool: practiceToolKey(body.practiceTool),
    schedule: cleanHabitSchedule(body),
  });
  return NextResponse.json({ saved: true, id: habit.id });
}
