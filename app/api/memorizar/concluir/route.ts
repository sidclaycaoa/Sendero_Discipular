import { NextResponse } from "next/server";
import { getActiveUser, getPracticeHabit, saveHabitProgress } from "@/lib/db/sendero";
import { getMemorizationHabit } from "@/lib/db/memorizacao";

/** Marks today's Memorização practice as done in Hábitos. */
export async function POST() {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const link = await getMemorizationHabit(user.id);
  const habit = link ? await getPracticeHabit(user.id, link.id) : null;
  if (!habit) return NextResponse.json({ error: "O hábito Memorização não foi encontrado em Hábitos." }, { status: 404 });
  const count = habit.cadence === "DAILY" ? Math.min(habit.targetCount, habit.todayCount + 1) : habit.todayCount + 1;
  await saveHabitProgress({ userId: user.id, habitId: habit.id, dateKey: habit.dateKey, count, minutes: 0, note: habit.note });
  return NextResponse.json({ saved: true });
}
