import { NextResponse } from "next/server";
import { addWaterLog, getActiveUser, saveWaterSettings } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export async function POST(request: Request) {
  const user = await getActiveUser();
  const body = await request.json() as { amountMl?: number; dateKey?: string };
  const amount = Math.round(Number(body.amountMl ?? 0));
  if (!user || !amount || Math.abs(amount) > 5000) return NextResponse.json({ error: "Informe um volume válido." }, { status: 400 });
  await addWaterLog(user.id, body.dateKey ?? getSaoPauloDateKey(), amount);
  return NextResponse.json({ saved: true });
}

/** Goal settings: weight and ml/kg, or a fixed goal. */
export async function PATCH(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { weightKg?: unknown; mlPerKg?: unknown; fixedGoalMl?: unknown };
  await saveWaterSettings(user.id, body);
  return NextResponse.json({ saved: true });
}
