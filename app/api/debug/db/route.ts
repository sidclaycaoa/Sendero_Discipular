import { NextResponse } from "next/server";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { getActiveUser } from "@/lib/db/sendero";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSenderoSeeded();
    const db = getSenderoDb();
    const user = await getActiveUser();
    const [templates, entries, diary] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM "ReflectionTemplate"').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) AS count FROM "ReflectionEntry"').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) AS count FROM "DiaryEntry"').first<{ count: number }>(),
    ]);
    return NextResponse.json({ ok: true, user: user ? { name: user.name } : null, counts: {
      reflectionTemplates: Number(templates?.count ?? 0), reflectionEntries: Number(entries?.count ?? 0), diaryEntries: Number(diary?.count ?? 0),
    } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
