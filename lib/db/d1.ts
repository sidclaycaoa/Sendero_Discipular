import { ensureBookIndex } from "@/lib/book-index";
import { getSenderoDb } from "@/lib/db/bindings";

export { getSenderoDb };

let seedPromise: Promise<void> | null = null;
let referenceLibraryPromise: Promise<void> | null = null;

export async function ensureSenderoSeeded() {
  if (!seedPromise) {
    seedPromise = verifyImportedData().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export async function ensureReferenceLibrary() {
  if (!referenceLibraryPromise) {
    referenceLibraryPromise = ensureBookIndex(getSenderoDb()).catch((error) => {
      referenceLibraryPromise = null;
      throw error;
    });
  }
  return referenceLibraryPromise;
}

async function verifyImportedData() {
  const db = getSenderoDb();
  const existing = await db.prepare('SELECT COUNT(*) AS count FROM "User"').first<{ count: number }>();
  if (!Number(existing?.count ?? 0)) throw new Error("Dados do Sendero ainda não migrados. Importe o backup privado antes de usar o app.");
}
