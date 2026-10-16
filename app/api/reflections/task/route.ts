import { NextResponse } from "next/server";
import { createTaskFromReflection, getActiveUser } from "@/lib/db/sendero";

export async function POST(request: Request) {
  const user = await getActiveUser();
  const { templateId } = (await request.json()) as { templateId?: string };
  if (!user || !templateId) return NextResponse.json({ error: "Missing data." }, { status: 400 });
  const task = await createTaskFromReflection(user.id, templateId);
  if (!task) return NextResponse.json({ error: "Reflection not found." }, { status: 404 });
  return NextResponse.json({ saved: true, id: task.id });
}
