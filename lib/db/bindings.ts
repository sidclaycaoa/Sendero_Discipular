const SENDERO_DB_KEY = "__senderoD1Binding";

type SenderoRuntime = typeof globalThis & {
  [SENDERO_DB_KEY]?: D1Database;
};

/**
 * Makes the request-scoped Sites D1 binding available to the app router.
 *
 * The worker entry receives bindings directly from Cloudflare. Keeping the
 * binding on the isolate global avoids a `cloudflare:workers` module import,
 * which also lets the Sites artifact validator load the compiled worker.
 */
export function setSenderoDb(db: D1Database) {
  (globalThis as SenderoRuntime)[SENDERO_DB_KEY] = db;
}

export function getSenderoDb(): D1Database {
  const db = (globalThis as SenderoRuntime)[SENDERO_DB_KEY];
  if (!db) {
    throw new Error("O banco persistente do Sendero não está disponível.");
  }
  return db;
}
