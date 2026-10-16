import { NextResponse } from "next/server";
import { getActiveUser, getNextPendingReflection, saveTodayReflection } from "@/lib/db/sendero";

type SaveReflectionRequest = {
  templateId: string;
  date: string;
  contentText: string;
  reflectionTimeSeconds?: number;
};

export async function POST(request: Request) {
  const user = await getActiveUser().catch((error) => {
    console.error("Failed to load active user while saving reflection", error);
    return null;
  });

  if (!user) {
    return NextResponse.json({ error: "Active user not found." }, { status: 404 });
  }

  const body = (await request.json()) as SaveReflectionRequest;

  if (!body.templateId || !body.date || !body.contentText?.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const entry = await saveTodayReflection({
    userId: user.id,
    templateId: body.templateId,
    dateKey: body.date,
    contentText: body.contentText,
    reflectionTimeSeconds: Number.isFinite(body.reflectionTimeSeconds) ? Number(body.reflectionTimeSeconds) : 0,
    cycleAnchorDate: user.cycleAnchorDate
  }).catch((error) => {
    console.error("Failed to save reflection", error);
    return null;
  });

  if (!entry) {
    return NextResponse.json({ error: "Could not save reflection." }, { status: 500 });
  }

  const next = await getNextPendingReflection(user.id, user.cycleAnchorDate, {
    templateId: body.templateId,
    dateKey: body.date,
  }).catch((error) => {
    console.error("Failed to find next pending reflection", error);
    return null;
  });

  return NextResponse.json({
    id: entry.id,
    saved: true,
    next,
  });
}
