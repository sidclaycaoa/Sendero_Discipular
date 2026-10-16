import { NextResponse } from "next/server";
import { getActiveUser, updateReflectionTemplateSettings } from "@/lib/db/sendero";

type UpdateReflectionTemplateRequest = {
  cycleDays?: number[];
  period?: "MORNING" | "AFTERNOON" | "NIGHT";
  endDate?: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getActiveUser();

  if (!user) {
    return NextResponse.json({ error: "Active user not found." }, { status: 404 });
  }

  const { id } = await params;
  const body = (await request.json()) as UpdateReflectionTemplateRequest;
  const cycleDays = normalizeCycleDays(body.cycleDays);

  const template = await updateReflectionTemplateSettings({
    userId: user.id,
    templateId: id,
    cycleDays,
    period: body.period,
    endDate: body.endDate ?? null
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ saved: true });
}

function normalizeCycleDays(cycleDays?: number[]) {
  const values = (cycleDays?.length ? cycleDays : [1, 2])
    .map((day) => Math.min(30, Math.max(1, Math.round(day))))
    .filter((day, index, all) => all.indexOf(day) === index)
    .sort((a, b) => a - b);

  return values.length ? values : [1, 2];
}
