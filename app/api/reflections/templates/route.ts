import { NextResponse } from "next/server";
import { getActiveUser, getReflectionTemplateSettings } from "@/lib/db/sendero";

export async function GET() {
  const user = await getActiveUser();

  if (!user) {
    return NextResponse.json({ error: "Active user not found." }, { status: 404 });
  }

  const templates = await getReflectionTemplateSettings(user.id);
  return NextResponse.json({ templates });
}
