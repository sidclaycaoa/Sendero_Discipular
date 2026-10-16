import { createClient } from '@libsql/client';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN fora do repositório.');
const client = createClient({ url, authToken });
const migrationDir = resolve('drizzle');
await client.execute('CREATE TABLE IF NOT EXISTS "SenderoMigration" (filename TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)');
for (const filename of (await readdir(migrationDir)).filter(name => /^\d{4}.*\.sql$/.test(name)).sort()) {
  const applied = await client.execute({ sql: 'SELECT filename FROM "SenderoMigration" WHERE filename=?', args: [filename] });
  if (applied.rows.length) continue;
  const statements = (await readFile(resolve(migrationDir, filename), 'utf8')).split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const sql of statements) await client.execute(sql);
  await client.execute({ sql: 'INSERT INTO "SenderoMigration" VALUES (?,?)', args: [filename, new Date().toISOString()] });
  console.log(`Schema: ${filename}`);
}

const index = process.argv.indexOf('--data');
if (index < 0) {
  console.log('Schema preparado. Aguardando exportação atual e privada dos dados do Site.');
  client.close();
  process.exit(0);
}
const filename = process.argv[index + 1];
if (!filename) throw new Error('Uso: npm run db:setup -- --data private-data/export-atual.json');
const source = JSON.parse(await readFile(resolve(filename), 'utf8'));
const tables = source.tables;
if (!tables || typeof tables !== 'object') throw new Error('Exportação inválida: esperado {tables:{nome:[linhas]}}.');
const names = new Set((await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r => String(r.name)));
const expected = {};
for (const [table, rows] of Object.entries(tables)) {
  if (!names.has(table) || table.endsWith('Search') || table === 'SenderoMigration') continue;
  if (!Array.isArray(rows)) throw new Error(`Tabela ${table}: linhas inválidas.`);
  for (const row of rows) {
    const columns = Object.keys(row);
    if (!columns.length) continue;
    const quote = name => `"${name.replaceAll('"', '""')}"`;
    const sql = `INSERT OR REPLACE INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map(() => '?').join(',')})`;
    const args = columns.map(column => row[column]);
    await client.execute({ sql, args });
  }
  const count = (await client.execute(`SELECT COUNT(*) AS total FROM "${table}"`)).rows[0].total;
  if (Number(count) < rows.length) throw new Error(`Contagem divergente em ${table}: ${count} < ${rows.length}`);
  expected[table] = { exported: rows.length, imported: Number(count) };
}
console.log(JSON.stringify({ imported: expected }, null, 2));
client.close();
