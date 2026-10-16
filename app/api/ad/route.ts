import { bookStatus } from "@/lib/book-index";
import { NextResponse } from "next/server";
import { ensureReferenceLibrary, getSenderoDb } from "@/lib/db/d1";
import { getActiveUser } from "@/lib/db/sendero";
import { confirmAD, listAD, listPassages, listProposals, proposeAD, unifiedHistory } from "@/lib/ad";

export const dynamic = "force-dynamic";
// Sendero is owner-private; Sites dispatch enforces the existing owner access policy.
export async function GET(request: Request) {
  try {
    const user = await getActiveUser();
    if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    await ensureReferenceLibrary();
    const db = getSenderoDb(); const p = new URL(request.url).searchParams;
    const action = p.get("action") || "history";
    let result: unknown;
    const filters = { from: p.get("from") || undefined, to: p.get("to") || undefined, theme: p.get("theme") || undefined, kind: p.get("kind") || undefined, limit: 25, offset: Math.max(0, Number(p.get("offset")) || 0) };
    if (action === "passages") result = { passages: await listPassages(db, user.id, p.get("query") || "", 25, p.get("workId") || "", Math.max(0, Number(p.get("offset")) || 0)) };
    else if (action === "proposals") result = { proposals: await listProposals(db, user.id) };
    else if (action === "ad") result = await listAD(db, user.id, filters);
    else if (action === "works") result = { works: await bookStatus(db) };
    else if (action === "history") result = await unifiedHistory(db, user.id, filters);
    else throw new Error("Ação indisponível. As obras são indexadas automaticamente, sem cadastro manual de passagens.");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível consultar AD." }, { status: 400 }); }
}

export async function POST(request: Request) {
  try {
    const user = await getActiveUser();
    if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    await ensureReferenceLibrary(); const db = getSenderoDb();
    const body = await request.json();
    let result: unknown;
    if (body.action === "propose") result = await proposeAD(db, user.id, body);
    else if (body.action === "confirm") result = await confirmAD(db, user.id, body.proposalId, body.confirmation);
    else if (body.action === "dismiss") {
      await db.prepare('UPDATE "ADProposal" SET dismissedAt = ? WHERE id = ? AND userId = ? AND NOT EXISTS (SELECT 1 FROM "ADReflection" WHERE proposalId = ?)').bind(new Date().toISOString(), body.proposalId, user.id, body.proposalId).run();
      result = { dismissed: true };
    } else throw new Error("Ação AD inválida.");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível salvar AD." }, { status: 400 }); }
}
