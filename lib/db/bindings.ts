import { createClient, type Client, type InArgs, type InStatement } from "@libsql/client";

// Preserve the app's SQLite queries while moving to an independently owned database.
let client: Client | undefined;
function connection(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("Banco do Sendero não configurado.");
    client = createClient({ url, authToken });
  }
  return client;
}

type Value = string | number | null;
type Statement = InStatement & { sql: string; args: InArgs };
function prepared(sql: string, args: Value[] = []): D1PreparedStatement & { statement: Statement } {
  const statement: Statement = { sql, args };
  return {
    statement,
    bind(...values: Value[]) { return prepared(sql, values); },
    async all<T>() {
      const result = await connection().execute(statement);
      return { results: result.rows.map(row => ({ ...row }) as T), success: true, meta: { changes: result.rowsAffected } };
    },
    async first<T>(column?: string) {
      const row = (await connection().execute(statement)).rows[0];
      return row ? (column ? row[column] : { ...row }) as T : null;
    },
    async run<T>() {
      const result = await connection().execute(statement);
      return { results: result.rows.map(row => ({ ...row }) as T), success: true, meta: { changes: result.rowsAffected } };
    },
  };
}

const database: D1Database = {
  prepare: (sql: string) => prepared(sql),
  async batch<T>(statements: D1PreparedStatement[]) {
    const results = await connection().batch(statements.map(s => (s as ReturnType<typeof prepared>).statement), "write");
    return results.map(result => ({ results: result.rows.map(row => ({ ...row }) as T), success: true, meta: { changes: result.rowsAffected } }));
  },
};
export function getSenderoDb(): D1Database { return database; }
