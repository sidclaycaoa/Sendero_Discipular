import { NextResponse } from "next/server";
import { practiceToolKey } from "@/lib/practice";
import { archiveHabitTemplate, cleanHabitSchedule, getActiveUser, updateHabitTemplate } from "@/lib/db/sendero";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getActiveUser();
  const { id } = await params;
  const body = await request.json() as { title?: string; description?: string; cadence?: "DAILY" | "WEEKLY" | "TIME_BASED"; targetCount?: number; practiceGroup?: "ED" | "PSYCHOLOGY" | "HABIT"; practiceTool?: string | null; dayPeriod?: unknown; scheduledTime?: unknown; remind?: unknown };
  if (!user || !body.title?.trim()) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  await updateHabitTemplate({
    userId: user.id, habitId: id, title: body.title, description: body.description,
    cadence: body.cadence ?? "DAILY", targetCount: Number(body.targetCount ?? 1),
    practiceGroup: body.practiceGroup === "ED" || body.practiceGroup === "PSYCHOLOGY" ? body.practiceGroup : "HABIT",
    practiceTool: practiceToolKey(body.practiceTool),
    schedule: cleanHabitSchedule(body),
  });
  return NextResponse.json({ saved: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getActiveUser();
  const { id } = await params;
  if (!user) return NextResponse.json({ error: "Usuário indisponível." }, { status: 400 });
  await archiveHabitTemplate(user.id, id);
  return NextResponse.json({ saved: true });
}
