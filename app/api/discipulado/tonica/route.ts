import { NextResponse } from "next/server";
import { getActiveUser, getDailyDiscipleshipTonic } from "@/lib/db/sendero";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getActiveUser();
    if (!user) return NextResponse.json({ error: "Usuário ativo não encontrado." }, { status: 404 });
    const tonic = await getDailyDiscipleshipTonic(user.id, getSaoPauloDateKey());
    return NextResponse.json({ tonic }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("Failed to load daily discipleship tonic", error);
    return NextResponse.json({ error: "Não foi possível carregar a tônica do dia." }, { status: 500 });
  }
}
