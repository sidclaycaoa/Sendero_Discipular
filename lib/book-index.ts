import corpus from "./data/ad-book-index.json";

export type Passage = {
  id: string; workId: string; author: string; work: string; edition: string; editionNote: string;
  location: string; page: number | null; section: string | null; text: string; textHash: string;
  excerpt: string; quoteStart: number; quoteEnd: number; startOffset: number; endOffset: number;
  sourceFile: string; sourceUrl: string; sourceHash: string; revision: string; unitId: string;
};
const works = corpus.works;
const approvedIds = works.map(w => w.id);

export async function ensureBookIndex(db: D1Database) {
  const stored = await db.prepare('SELECT id, status, revision, passageCount FROM "IndexedWork"').all<{ id: string; status: string; revision: string; passageCount: number }>();
  for (const w of works) {
    const existing = stored.results.find(row => row.id === w.id);
    if (existing?.status === "INDEXED" && existing.revision === w.revision && existing.passageCount === w.passageCount) continue;
    if (w.status === "INDEXED") {
      const units = corpus.units.filter(u => u.workId === w.id);
      for (let n = 0; n < units.length; n += 40) await db.batch(units.slice(n, n+40).map(u => db.prepare('INSERT OR IGNORE INTO "IndexedUnit" (id, workId, revision, number, page, section, location, text, textHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(u.id, u.workId, u.revision, u.number, u.page, u.section, u.location, u.text, u.textHash)));
      const passages = corpus.passages.filter(p => p.workId === w.id);
      for (let n = 0; n < passages.length; n += 30) await db.batch(passages.slice(n, n+30).flatMap(p => [
        db.prepare('INSERT OR IGNORE INTO "IndexedPassage" (id, workId, revision, unitId, sequence, startOffset, endOffset, page, section, location, text, textHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(p.id, p.workId, p.revision, p.unitId, p.sequence, p.startOffset, p.endOffset, p.page, p.section, p.location, p.text, p.textHash),
        db.prepare('INSERT INTO "IndexedPassageSearch" (passageId, text) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM "IndexedPassageSearch" WHERE passageId = ?)').bind(p.id, p.text, p.id),
      ]));
      const count = await db.prepare('SELECT COUNT(*) AS n FROM "IndexedPassage" WHERE workId = ? AND revision = ?').bind(w.id, w.revision).first<{ n: number }>();
      if (count?.n !== w.passageCount) throw new Error(`Indexação incompleta: ${w.title}. A obra precisa ser importada em lote.`);
    }
    // Publish the active revision only after all literal text and search rows exist.
    await db.prepare(`INSERT INTO "IndexedWork" (id,title,author,edition,editionNote,sourceFile,sourceUrl,sourceType,sourceHash,revision,status,unitCount,passageCount,characterCount,indexedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, author=excluded.author, edition=excluded.edition, editionNote=excluded.editionNote, sourceFile=excluded.sourceFile, sourceUrl=excluded.sourceUrl, sourceType=excluded.sourceType, sourceHash=excluded.sourceHash, revision=excluded.revision, status=excluded.status, unitCount=excluded.unitCount, passageCount=excluded.passageCount, characterCount=excluded.characterCount, indexedAt=excluded.indexedAt`).bind(w.id,w.title,w.author,w.edition,w.editionNote,w.sourceFile,w.sourceUrl || "",w.sourceType,w.sourceHash,w.revision,w.status,w.unitCount,w.passageCount,w.characterCount,new Date().toISOString()).run();
  }
}

export async function bookStatus(db: D1Database) {
  const r = await db.prepare('SELECT * FROM "IndexedWork" ORDER BY title').all<Record<string, unknown>>();
  return works.map(expected => {
    const actual = r.results.find(w => w.id === expected.id && w.revision === expected.revision);
    return actual || { ...expected, status: "IMPORT_REQUIRED", note: "Fonte precisa ser importada em lote. Não cadastre passagens individualmente." };
  });
}

const select = `SELECT p.*, w.author, w.title AS work, w.edition, w.editionNote, w.sourceFile, w.sourceUrl, w.sourceHash FROM "IndexedPassage" p JOIN "IndexedWork" w ON w.id=p.workId AND w.revision=p.revision`;
const placeholders = approvedIds.map(() => '?').join(',');
type Row = Omit<Passage, "excerpt" | "quoteStart" | "quoteEnd">;
const stop = new Set('como para uma meu minha hoje sobre quero preciso mais que dos das com por sem aos nas nos tem ser nao seu sua esta este isso dia'.split(' '));
function terms(query: string) { return [...new Set(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').match(/[\p{L}]{3,}/gu) || [])].filter(t => !stop.has(t)).slice(0, 10); }

function quote(row: Row, query = "", span?: { start: number; end: number }): Passage {
  const searchText = row.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const hits = terms(query).map(t => searchText.indexOf(t)).filter(n => n >= 0);
  let start = span?.start ?? Math.max(0, (hits.length ? Math.min(...hits) : 0) - 120);
  let end = span?.end ?? Math.min(row.text.length, start + 700);
  if (!span) {
    if (start) { const boundary = row.text.indexOf(' ', start); if (boundary >= 0 && boundary < start+60) start = boundary+1; }
    if (end < row.text.length) { const boundary = row.text.lastIndexOf(' ', end); if (boundary > start) end = boundary; }
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > row.text.length || end <= start || end-start > 900) throw new Error('Citação inválida: use um intervalo literal de até 900 caracteres do trecho recuperado.');
  return { ...row, excerpt: row.text.slice(start,end), quoteStart: start, quoteEnd: end, sourceUrl: `${row.sourceUrl}${row.page ? `#page=${row.page}` : ""}` };
}

export async function indexedPassage(db: D1Database, passageId: string, span?: { start: number; end: number }) {
  const p = await db.prepare(`${select} WHERE p.id=? AND w.status='INDEXED' AND w.id IN (${placeholders})`).bind(passageId, ...approvedIds).first<Row>();
  if (!p) throw new Error('Trecho indisponível no índice das sete obras aprovadas. Nenhuma citação pode ser inventada ou cadastrada manualmente.');
  return quote(p, '', span);
}

export async function listIndexedPassages(db: D1Database, query = "", limit = 25, workId = "", offset = 0) {
  const ts = terms(query);
  if (query.trim() && !ts.length) return [];
  const filters = `w.status='INDEXED' AND w.id IN (${placeholders}) AND (?='' OR w.id=?)`;
  const bounded = Math.min(100, Math.max(1, limit));
  const ids = [...approvedIds, workId, workId];
  let rows: Row[];
  if (ts.length) {
    const q = ts.map(t => `"${t}"*`).join(' OR ');
    const r = await db.prepare(`${select} JOIN "IndexedPassageSearch" s ON s.passageId=p.id WHERE ${filters} AND "IndexedPassageSearch" MATCH ? ORDER BY bm25("IndexedPassageSearch"), w.title, p.unitId, p.sequence LIMIT ? OFFSET ?`).bind(...ids,q,bounded,Math.max(0,offset)).all<Row>();
    rows = r.results;
  } else {
    const r = await db.prepare(`${select} WHERE ${filters} AND length(trim(p.text)) > 0 ORDER BY w.title, p.unitId, p.sequence LIMIT ? OFFSET ?`).bind(...ids,bounded,Math.max(0,offset)).all<Row>();
    rows = r.results;
  }
  return rows.map(p => quote(p,query));
}
