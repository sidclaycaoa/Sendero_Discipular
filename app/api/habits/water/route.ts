import { NextResponse } from "next/server";
import { addWaterLog, getActiveUser } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export async function POST(request: Request) {
  const user = await getActiveUser();
  const body = await request.json() as { amountMl?: number; dateKey?: string };
  const amount = Math.round(Number(body.amountMl ?? 0));
  if (!user || !amount || Math.abs(amount) > 5000) return NextResponse.json({ error: "Informe um volume válido." }, { status: 400 });
  await addWaterLog(user.id, body.dateKey ?? getSaoPauloDateKey(), amount);
  return NextResponse.json({ saved: true });
}
