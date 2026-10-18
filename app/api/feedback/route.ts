import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/db/sendero";
import { createFeedback, setFeedbackStatus } from "@/lib/db/pendencias";

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const saved = await createFeedback(user.id, { kind: body.kind, description: body.description, page: body.page });
    return NextResponse.json({ saved: true, id: saved.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível registrar agora." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { id?: string; done?: boolean; resolution?: string };
  if (!body.id) return NextResponse.json({ error: "Item não informado." }, { status: 400 });
  await setFeedbackStatus(user.id, body.id, Boolean(body.done), body.resolution);
  return NextResponse.json({ saved: true });
}
