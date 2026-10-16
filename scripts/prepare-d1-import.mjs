import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [input, output = "private-data/d1-import"] = process.argv.slice(2);
if (!input || !input.includes("private-data/")) {
  throw new Error("Use um backup em private-data/; nunca gere SQL pessoal no repositório.");
}
const { tables } = JSON.parse(await readFile(input, "utf8"));
if (!tables || typeof tables !== "object" || !Array.isArray(tables.User)) {
  throw new Error("Exportação inválida: falta tables.User.");
}
const skip = /^(?:sqlite_|_cf_|(?:IndexedPassageSearch|ReferencePassageSearch)(?:$|_))/;
const identifier = value => {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) throw new Error("Identificador SQL inválido.");
  return `"${value}"`;
};
const literal = value => {
  if (value == null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Número inválido no backup.");
    return String(value);
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'`;
};

await mkdir(output, { recursive: true });
let part = 1, sql = "", statements = 0;
async function flush() {
  if (!sql) return;
  await writeFile(path.join(output, `import-${String(part++).padStart(3, "0")}.sql`), sql);
  sql = "";
}
for (const [table, rows] of Object.entries(tables)) {
  if (skip.test(table)) continue;
  identifier(table);
  if (!Array.isArray(rows)) throw new Error(`Tabela inválida: ${table}`);
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Linha inválida: ${table}`);
    const keys = Object.keys(row);
    if (!keys.length) continue;
    const statement = `INSERT OR REPLACE INTO ${identifier(table)} (${keys.map(identifier).join(",")}) VALUES (${keys.map(key => literal(row[key])).join(",")});\n`;
    if (sql.length + statement.length > 120_000) await flush();
    sql += statement;
    statements++;
  }
}
await flush();
await writeFile(path.join(output, `import-${String(part++).padStart(3, "0")}.sql`),
  'INSERT INTO "IndexedPassageSearch" (passageId,text) SELECT id,text FROM "IndexedPassage";\n' +
  'INSERT INTO "ReferencePassageSearch" (id,workId,contentText) SELECT id,workId,contentText FROM "ReferencePassage";\n');
console.log(JSON.stringify({ files: part - 1, rows: statements, userRows: tables.User.length }));
