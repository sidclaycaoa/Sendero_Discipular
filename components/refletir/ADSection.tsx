import { ADPanel } from "./ADPanel";
import { ensureReferenceLibrary, getSenderoDb } from "@/lib/db/d1";
import { listPassages, listProposals, unifiedHistory } from "@/lib/ad";

export async function ADSection({ userId, selectedId }: { userId: string; selectedId?: string }) {
  await ensureReferenceLibrary();
  const db = getSenderoDb();
  const selected = selectedId ? await db.prepare('SELECT date FROM "ADReflection" WHERE id = ? AND userId = ?').bind(selectedId, userId).first<{ date: string }>() : null;
  const initialFilters = { from: selected?.date || "", to: selected?.date || "", kind: selected ? "AD" : "", theme: "" };
  const [history, proposals, passages] = await Promise.all([unifiedHistory(db, userId, initialFilters), listProposals(db, userId), listPassages(db, userId)]);
  return <ADPanel initialHistory={history} initialProposals={proposals} initialPassages={passages} initialFilters={initialFilters} selectedId={selectedId} />;
}
