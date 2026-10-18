import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/db/sendero";

/** Runs an action for the signed-in user and answers with JSON. */
export async function respond(request: Request, run: (userId: string, body: Record<string, unknown>) => Promise<unknown>) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    return NextResponse.json({ saved: true, ...((await run(user.id, body)) as object | undefined) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 });
  }
}

export const requireId = (body: Record<string, unknown>) => {
  if (typeof body.id !== "string" || !body.id) throw new Error("Item não informado.");
  return body.id;
};
