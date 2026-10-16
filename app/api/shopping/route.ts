import { NextResponse } from "next/server";
import { createShoppingItem, getActiveUser } from "@/lib/db/sendero";

export async function POST(request: Request) {
  const user = await getActiveUser();
  const body = await request.json() as { title?: string; dueDate?: string };
  if (!user || !body.title?.trim()) return NextResponse.json({ error: "Informe um item para a lista." }, { status: 400 });
  const item = await createShoppingItem(user.id, body.title, body.dueDate);
  return NextResponse.json({ saved: true, id: item.id });
}
