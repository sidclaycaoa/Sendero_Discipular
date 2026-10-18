import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/db/sendero";
import { sendTestReminder, updateReminder } from "@/lib/db/lembretes";

export async function PATCH(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { id?: string; time?: unknown; enabled?: unknown };
  if (!body.id) return NextResponse.json({ error: "Lembrete não informado." }, { status: 400 });
  try {
    await updateReminder(user.id, body.id, { time: body.time, enabled: body.enabled });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 });
  }
}

/** Sends a test notification to every phone signed up. */
export async function POST() {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const sent = await sendTestReminder(user.id);
  return NextResponse.json({ sent });
}
