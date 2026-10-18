import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/db/sendero";
import { recordMemorization } from "@/lib/db/memorizacao";

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { id?: string; event?: unknown; line?: unknown };
  if (!body.id) return NextResponse.json({ error: "Texto não informado." }, { status: 400 });
  try {
    return NextResponse.json({ saved: true, ...(await recordMemorization(user.id, body.id, body.event, body.line)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível registrar." }, { status: 400 });
  }
}
