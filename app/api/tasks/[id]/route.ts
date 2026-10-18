import { NextResponse } from "next/server";
import { deleteCalendarEvent, deleteTask, getActiveUser, updateCalendarEvent, updateTaskState } from "@/lib/db/sendero";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getActiveUser(); const { id } = await params;
  const body = await request.json() as { kind?: "event"; completed?: boolean; title?: string; dueDate?: string; dueTime?: string | null; priority?: number; description?: string; startsAt?: string; endsAt?: string; location?: string; recurrence?: { frequency?: "daily" | "weekly" | "monthly"; weekdays?: number[] } };
  if (!user) return NextResponse.json({ error: "Usuário indisponível." }, { status: 400 });
  if (body.kind === "event") {
    if (!body.title?.trim() || !body.startsAt) return NextResponse.json({ error: "Informe título, data e horário." }, { status: 400 });
    const event = await updateCalendarEvent({ userId: user.id, eventId: id, title: body.title, startsAt: body.startsAt, endsAt: body.endsAt, location: body.location, description: body.description });
    return event ? NextResponse.json({ saved: true, id: event.id }) : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }
  await updateTaskState({ userId: user.id, taskId: id, ...body });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getActiveUser(); const { id } = await params;
  const kind = new URL(request.url).searchParams.get("kind");
  if (!user) return NextResponse.json({ error: "Usuário indisponível." }, { status: 400 });
  if (kind === "event") await deleteCalendarEvent(user.id, id); else await deleteTask(user.id, id);
  return NextResponse.json({ saved: true });
}
