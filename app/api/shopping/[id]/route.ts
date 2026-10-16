import { NextResponse } from "next/server";
import { deleteShoppingItem, getActiveUser, updateShoppingItem } from "@/lib/db/sendero";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getActiveUser();
  const { id } = await params;
  const body = await request.json() as { title?: string; dueDate?: string | null; checked?: boolean };
  if (!user || (typeof body.checked !== "boolean" && typeof body.title !== "string" && body.dueDate === undefined)) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  await updateShoppingItem(user.id, id, body);
  return NextResponse.json({ saved: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getActiveUser();
  const { id } = await params;
  if (!user) return NextResponse.json({ error: "Usuário indisponível." }, { status: 400 });
  await deleteShoppingItem(user.id, id);
  return NextResponse.json({ saved: true });
}
