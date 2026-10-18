import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/db/sendero";
import { archiveMemorizationText, createMemorizationText, updateMemorizationText } from "@/lib/db/memorizacao";

type Body = { id?: string; title?: unknown; source?: unknown; text?: unknown };

async function handle(run: (userId: string, body: Body) => Promise<unknown>, request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as Body;
  try {
    return NextResponse.json({ saved: true, ...(await run(user.id, body) as object | undefined) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 });
  }
}

export const POST = (request: Request) => handle((userId, body) => createMemorizationText(userId, body), request);
export const PATCH = (request: Request) => handle(async (userId, body) => {
  if (!body.id) throw new Error("Texto não informado.");
  await updateMemorizationText(userId, body.id, body);
}, request);
export const DELETE = (request: Request) => handle(async (userId, body) => {
  if (!body.id) throw new Error("Texto não informado.");
  await archiveMemorizationText(userId, body.id);
}, request);
