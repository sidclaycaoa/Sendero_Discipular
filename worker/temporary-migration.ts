// Temporary, token-protected D1 import route. Remove immediately after importing.
const KEY_SHA256 = "7b7f4d64be2e7a81ae5c408696a0395911c478a328ffb0e8124ff4a97fb4ebe3";
const tables = new Set([
  "User", "ADProposal", "ADReflection", "ApprovedPassage", "Category", "DailyTonic",
  "DiaryEntry", "DiaryQuestion", "DiscipleshipCycle", "DiscipleshipPhase",
  "DiscipleshipTopic", "DiscipleshipTopicGuidance", "Event", "ExportLog", "HabitLog",
  "HabitPracticeGroup", "HabitTemplate", "JourneyState", "MemorizationItem",
  "MemorizationProgressLog", "PhilosophicalQuote", "PracticeGroup", "ReferencePassage",
  "ReferenceWork", "ReflectionEntry", "ReflectionPostponement", "ReflectionTemplate",
  "ShoppingItem", "TaskOccurrence", "TaskSeries", "WaterLog",
]);
const identifier = (s: string) => {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(s)) throw new Error("Invalid identifier");
  return '"' + s + '"';
};
const response = (body: object, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function handleTemporaryMigration(request: Request, db: D1Database): Promise<Response> {
  const key = request.headers.get("X-Migration-Key") ?? "";
  if (!/^[a-f0-9]{64}$/.test(key)) return response({ ok: false }, 401);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  if (hash !== KEY_SHA256) return response({ ok: false }, 401);
  if (request.method === "GET") {
    const counts: Record<string, number> = {};
    for (const table of tables) {
      try {
        const result = await db.prepare(`SELECT COUNT(*) AS n FROM ${identifier(table)}`).first<{ n: number }>();
        counts[table] = Number(result?.n ?? 0);
      } catch { counts[table] = -1; }
    }
    return response({ ok: true, counts });
  }
  if (request.method !== "POST") return response({ ok: false }, 405);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 180_000) return response({ ok: false, error: "Payload too large" }, 413);
  try {
    const data = await request.json() as {
      mode: "schema" | "rows" | "shopping-column" | "search";
      statements?: string[];
      table?: string;
      rows?: Array<Record<string, unknown>>;
    };
    if (data.mode === "schema") {
      if (!Array.isArray(data.statements) || data.statements.length > 20) throw new Error("Invalid schema batch");
      for (const statement of data.statements) {
        if (!/^CREATE (?:VIRTUAL )?(?:TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS /i.test(statement)) throw new Error("Invalid schema statement");
        await db.prepare(statement).run();
      }
      return response({ ok: true, statements: data.statements.length });
    }
    if (data.mode === "shopping-column") {
      const columns = await db.prepare('PRAGMA table_info("ShoppingItem")').all<{ name: string }>();
      if (!columns.results.some(col => col.name === "dueDate")) {
        await db.prepare('ALTER TABLE "ShoppingItem" ADD COLUMN "dueDate" TEXT').run();
      }
      return response({ ok: true });
    }
    if (data.mode === "rows") {
      if (!data.table || !tables.has(data.table) || !Array.isArray(data.rows) || data.rows.length > 30) throw new Error("Invalid row batch");
      const columnRows = await db.prepare(`PRAGMA table_info(${identifier(data.table)})`).all<{ name: string }>();
      const columns = new Set(columnRows.results.map(col => col.name));
      const statements = data.rows.map(row => {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Invalid row");
        const keys = Object.keys(row);
        if (!keys.length || keys.some(key => !columns.has(key))) throw new Error("Invalid column");
        const sql = `INSERT OR REPLACE INTO ${identifier(data.table!)} (${keys.map(identifier).join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
        return db.prepare(sql).bind(...keys.map(key => row[key] as string | number | null));
      });
      if (statements.length) await db.batch(statements);
      return response({ ok: true, table: data.table, rows: data.rows.length });
    }
    if (data.mode === "search") {
      await db.prepare('DELETE FROM "IndexedPassageSearch"').run();
      await db.prepare('INSERT INTO "IndexedPassageSearch" (passageId,text) SELECT id,text FROM "IndexedPassage"').run();
      await db.prepare('DELETE FROM "ReferencePassageSearch"').run();
      await db.prepare('INSERT INTO "ReferencePassageSearch" (id,workId,contentText) SELECT id,workId,contentText FROM "ReferencePassage"').run();
      return response({ ok: true });
    }
    throw new Error("Invalid mode");
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : "Import failed" }, 500);
  }
}
