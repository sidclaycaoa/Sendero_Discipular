import { NextResponse } from "next/server";
import { getActiveUser, saveDiaryEntry } from "@/lib/db/sendero";

export async function POST(request: Request) {
  const user = await getActiveUser().catch((error) => {
    console.error("Failed to load active user while saving diary", error);
    return null;
  });
  const { date, answers } = (await request.json()) as { date?: string; answers?: string[] };
  if (!user || !date || !answers?.some((answer) => answer.trim())) {
    return NextResponse.json({ error: "Preencha ao menos uma resposta antes de salvar." }, { status: 400 });
  }
  const entry = await saveDiaryEntry(user.id, date, answers).catch((error) => {
    console.error("Failed to save diary", error);
    return null;
  });
  if (!entry) {
    return NextResponse.json({ error: "O diário não pôde ser gravado agora. Tente novamente." }, { status: 500 });
  }
  return NextResponse.json({ saved: true, id: entry.id });
}
