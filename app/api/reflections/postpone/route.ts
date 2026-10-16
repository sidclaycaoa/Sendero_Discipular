import { NextResponse } from "next/server";
import { getActiveUser, postponeReflection } from "@/lib/db/sendero";

type PostponeReflectionRequest = {
  templateId?: string;
  date?: string;
};

export async function POST(request: Request) {
  const user = await getActiveUser().catch((error) => {
    console.error("Failed to load active user while postponing reflection", error);
    return null;
  });

  if (!user) {
    return NextResponse.json({ error: "Active user not found." }, { status: 404 });
  }

  const body = (await request.json()) as PostponeReflectionRequest;

  if (!body.templateId || !body.date) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const postponement = await postponeReflection({
    userId: user.id,
    templateId: body.templateId,
    originalDateKey: body.date
  }).catch((error) => {
    console.error("Failed to postpone reflection", error);
    return null;
  });

  if (!postponement) {
    return NextResponse.json({ error: "Could not postpone reflection." }, { status: 500 });
  }

  return NextResponse.json({
    postponed: true,
    ...postponement
  });
}
