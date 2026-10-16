import { NextResponse } from "next/server";
import { createCalendarEvent, createManualTask, getActiveUser } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export async function POST(request: Request) {
  const user = await getActiveUser();
  const body = await request.json() as { kind?: "task" | "event"; title?: string; dueDate?: string; priority?: number; description?: string; startsAt?: string; endsAt?: string; location?: string; recurrence?: { frequency?: "daily" | "weekly" | "monthly"; weekdays?: number[] } };
  if (!user || !body.title?.trim()) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  if (body.kind === "event") {
    if (!body.startsAt) return NextResponse.json({ error: "Informe data e hora." }, { status: 400 });
    const event = await createCalendarEvent({ userId: user.id, title: body.title, startsAt: body.startsAt, endsAt: body.endsAt, location: body.location, description: body.description, recurrence: body.recurrence });
    return NextResponse.json({ saved: true, id: event.id });
  }
  const task = await createManualTask({ userId: user.id, title: body.title, dueDate: body.dueDate ?? getSaoPauloDateKey(), priority: body.priority, description: body.description, recurrence: body.recurrence });
  return NextResponse.json({ saved: true, id: task.id });
}
