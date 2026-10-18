import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/db/sendero";
import { createMasterQuestion, setMasterQuestionStatus } from "@/lib/db/pendencias";

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    const saved = await createMasterQuestion(user.id, body);
    return NextResponse.json({ saved: true, id: saved.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível guardar agora." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { id?: string; answered?: boolean; answer?: string };
  if (!body.id) return NextResponse.json({ error: "Dúvida não informada." }, { status: 400 });
  await setMasterQuestionStatus(user.id, body.id, Boolean(body.answered), body.answer);
  return NextResponse.json({ saved: true });
}
