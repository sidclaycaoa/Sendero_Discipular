// Shared by the MCP and the Site. All AD writes use these same D1 operations.
import { indexedPassage, listIndexedPassages, type Passage } from "./book-index";
export type { Passage } from "./book-index";
export type ADInput = { date?: string; theme: string; summary: string; context: string; openQuestion: string; practice?: string; passageIds?: string[]; citations?: { passageId: string; start: number; end: number }[] };
export type ADRecord = ADInput & { id: string; date: string; practice: string; references: Passage[]; sourceStatus: string; origin?: string; createdAt?: string; confirmedAt?: string };
export type HistoryRecord = { id: string; date: string; kind: string; theme: string; summary: string; context: string; openQuestion: string; practice: string; references: Passage[]; origin: string; recordedAt: string };
type Raw = Omit<ADRecord, "references"> & { references: string };
const parse = (r: Raw): ADRecord => ({ ...r, references: JSON.parse(r.references) });
const noSource = "Não há base suficiente no índice das obras aprovadas para fundamentar esta reflexão. Sem citação filosófica; a síntese é uma aplicação pessoal.";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function required(value: unknown, label: string, max = 6000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label}: informe um texto entre 1 e ${max} caracteres.`);
  return value.trim();
}
export function dateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Data inválida.");
  return value;
}
function consent(value: unknown) {
  const text = required(value, "Confirmação explícita", 100);
  const normalized = text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.!]$/g, "").trim();
  const allowed = ["registre", "confirmo", "pode salvar", "pode registrar", "confirmo o registro", "confirmo registrar"];
  if (!allowed.includes(normalized)) throw new Error("Registro bloqueado: aguarde o usuário dizer registre ou confirmo após revisar a proposta.");
  return text;
}

export async function listPassages(db: D1Database, _userId: string, query = "", limit = 25, workId = "", offset = 0) {
  return listIndexedPassages(db, query, limit, workId, offset);
}

export async function proposeAD(db: D1Database, userId: string, input: ADInput) {
  const date = dateKey(input.date || today());
  const theme = required(input.theme, "Tema", 240);
  const summary = required(input.summary, "Síntese");
  const context = required(input.context, "Contexto");
  const openQuestion = required(input.openQuestion, "Pergunta em aberto", 2000);
  const practice = input.practice?.trim() || "";
  if (practice.length > 2000) throw new Error("Prática: máximo de 2000 caracteres.");
  const selected: { passageId: string; start?: number; end?: number }[] = input.citations?.length ? input.citations : [...new Set(input.passageIds || [])].map(passageId => ({ passageId }));
  if (selected.length > 2) throw new Error("Escolha no máximo dois trechos recuperados do índice.");
  const references: Passage[] = [];
  for (const citation of selected) {
    if ((citation.start === undefined) !== (citation.end === undefined)) throw new Error("Informe start e end juntos para uma citação literal.");
    const span = citation.start === undefined ? undefined : { start: citation.start, end: citation.end! };
    references.push(await indexedPassage(db, citation.passageId, span));
  }
  const proposalId = id("proposta_ad");
  const sourceStatus = references.length ? "Fundamentada em trechos literais indexados das obras integralmente aprovadas. Separe o trecho da obra da possível aplicação pessoal." : noSource;
  await db.prepare('INSERT INTO "ADProposal" (id, userId, date, theme, summary, context, openQuestion, practice, "references", sourceStatus, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(proposalId, userId, date, theme, summary, context, openQuestion, practice, JSON.stringify(references), sourceStatus, new Date().toISOString()).run();
  return { id: proposalId, date, theme, summary, context, openQuestion, practice, references, sourceStatus, status: "aguardando confirmação", saved: false, instruction: "Apresente esta síntese e as fontes ao usuário. Somente após registre ou confirmo chame registrar_reflexao_ad com este proposalId. A confirmação aprova exatamente esta síntese; mudanças exigem uma nova proposta." };
}

export async function listProposals(db: D1Database, userId: string) {
  const r = await db.prepare('SELECT p.* FROM "ADProposal" p WHERE p.userId = ? AND p.dismissedAt IS NULL AND NOT EXISTS (SELECT 1 FROM "ADReflection" r WHERE r.proposalId = p.id) ORDER BY p.createdAt DESC LIMIT 50').bind(userId).all<Raw>();
  return r.results.map(parse);
}
export async function confirmAD(db: D1Database, userId: string, proposalId: string, confirmationText: string) {
  const confirmation = consent(confirmationText);
  const p = await db.prepare('SELECT * FROM "ADProposal" WHERE id = ? AND userId = ? AND dismissedAt IS NULL').bind(proposalId, userId).first<Raw>();
  if (!p) throw new Error("Proposta não encontrada. Proponha e revise a síntese antes de registrar.");
  const recordId = id("reflexao_ad");
  await db.prepare(`INSERT INTO "ADReflection" (id, userId, proposalId, date, theme, summary, context, openQuestion, practice, "references", sourceStatus, origin, confirmedAt, confirmation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AD / conversa', ?, ?) ON CONFLICT(proposalId) DO NOTHING`).bind(recordId, userId, proposalId, p.date, p.theme, p.summary, p.context, p.openQuestion, p.practice, p.references, p.sourceStatus, new Date().toISOString(), confirmation).run();
  const saved = await db.prepare('SELECT * FROM "ADReflection" WHERE proposalId = ? AND userId = ?').bind(proposalId, userId).first<Raw>();
  if (!saved) throw new Error("Não foi possível confirmar a persistência do registro.");
  return { saved: true, alreadyRegistered: saved.id !== recordId, record: parse(saved), url: `/refletir?registroAD=${saved.id}#historico-ad` };
}

export type Filters = { from?: string; to?: string; theme?: string; limit?: number; offset?: number; kind?: string };
export async function listAD(db: D1Database, userId: string, filters: Filters = {}) {
  const { sql, values } = filterSQL(filters);
  const r = await db.prepare(`SELECT * FROM "ADReflection" WHERE userId = ? ${sql} ORDER BY date DESC, confirmedAt DESC, id LIMIT ? OFFSET ?`).bind(userId, ...values, Math.min(100, Math.max(1, filters.limit || 25)), Math.max(0, filters.offset || 0)).all<Raw>();
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM "ADReflection" WHERE userId = ? ${sql}`).bind(userId, ...values).first<{ total: number }>();
  return { total: count?.total || 0, records: r.results.map(parse) };
}
function filterSQL(f: Filters) {
  const clauses: string[] = []; const values: string[] = [];
  if (f.from) { clauses.push('substr(date, 1, 10) >= ?'); values.push(dateKey(f.from)); }
  if (f.to) { clauses.push('substr(date, 1, 10) <= ?'); values.push(dateKey(f.to)); }
  if (f.from && f.to && f.from > f.to) throw new Error("A data inicial deve preceder a final.");
  if (f.theme) { clauses.push('(theme LIKE ? OR summary LIKE ?)'); values.push(`%${f.theme}%`, `%${f.theme}%`); }
  return { sql: clauses.length ? `AND ${clauses.join(" AND ")}` : "", values };
}
export async function unifiedHistory(db: D1Database, userId: string, f: Filters = {}) {
  const { sql, values } = filterSQL(f);
  const union = `SELECT id, date, 'AD' AS kind, theme, summary, context, openQuestion, practice, "references", origin, confirmedAt AS recordedAt FROM "ADReflection" WHERE userId = ?
    UNION ALL SELECT e.id, substr(e.date,1,10), 'CICLO', t.topic, e.contentText, '', '', '', '[]', e.originType, e.updatedAt FROM "ReflectionEntry" e JOIN "ReflectionTemplate" t ON t.id=e.templateId WHERE e.userId=? AND e.status='DONE'
    UNION ALL SELECT id, substr(date,1,10), 'DIARIO', 'Diário', fixedAnswer, rotatingAnswers, '', '', '[]', 'Diário', updatedAt FROM "DiaryEntry" WHERE userId=?`;
  const kindSql = f.kind && ["AD", "CICLO", "DIARIO"].includes(f.kind) ? 'AND kind = ?' : '';
  const args = [userId, userId, userId, ...values, ...(kindSql ? [f.kind!] : [])];
  const rows = await db.prepare(`SELECT * FROM (${union}) WHERE 1=1 ${sql} ${kindSql} ORDER BY date DESC, recordedAt DESC, id LIMIT ? OFFSET ?`).bind(...args, Math.min(100, Math.max(1, f.limit || 25)), Math.max(0, f.offset || 0)).all<Omit<HistoryRecord, "references"> & { references: string }>();
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM (${union}) WHERE 1=1 ${sql} ${kindSql}`).bind(...args).first<{ total: number }>();
  return { total: count?.total || 0, records: rows.results.map(r => ({ ...r, references: JSON.parse(r.references) as Passage[] })) };
}
