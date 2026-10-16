import { NextResponse } from "next/server";
import { createReflectionTemplate, getActiveUser } from "@/lib/db/sendero";

type CreateReflectionTemplateRequest = {
  topic: string;
  subtopic?: string;
  orientation?: string;
  period?: "MORNING" | "AFTERNOON" | "NIGHT";
  cycleDays?: number[];
  endDate?: string | null;
};

export async function POST(request: Request) {
  const user = await getActiveUser();

  if (!user) {
    return NextResponse.json({ error: "Active user not found." }, { status: 404 });
  }

  const body = (await request.json()) as CreateReflectionTemplateRequest;
  const topic = body.topic?.trim();

  if (!topic) {
    return NextResponse.json({ error: "Topic is required." }, { status: 400 });
  }

  const cycleDays = normalizeCycleDays(body.cycleDays);
  const period = body.period ?? "NIGHT";

  const template = await createReflectionTemplate({
    userId: user.id,
    topic,
    subtopic: body.subtopic?.trim(),
    orientation: body.orientation?.trim(),
    period,
    cycleDays,
    endDate: body.endDate ?? undefined
  });

  return NextResponse.json({
    id: template.id,
    saved: true
  });
}

function normalizeCycleDays(cycleDays?: number[]) {
  const values = (cycleDays?.length ? cycleDays : [1, 2])
    .map((day) => Math.min(30, Math.max(1, Math.round(day))))
    .filter((day, index, all) => all.indexOf(day) === index);

  return values.length ? values : [1, 2];
}
