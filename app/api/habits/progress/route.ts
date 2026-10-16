import { NextResponse } from "next/server";
import { getActiveUser, saveHabitProgress } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export async function POST(request: Request) {
  const user = await getActiveUser();
  const body = await request.json() as { habitId?: string; count?: number; minutes?: number; note?: string; dateKey?: string };
  if (!user || !body.habitId) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  await saveHabitProgress({
    userId: user.id,
    habitId: body.habitId,
    dateKey: body.dateKey ?? getSaoPauloDateKey(),
    count: Number(body.count ?? 0),
    minutes: Number(body.minutes ?? 0),
    note: body.note,
  });
  return NextResponse.json({ saved: true });
}
