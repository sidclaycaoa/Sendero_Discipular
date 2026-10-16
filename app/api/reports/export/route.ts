import { ensureReferenceLibrary } from "@/lib/db/d1";
import { NextResponse } from "next/server";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { getActiveUser } from "@/lib/db/sendero";

export const dynamic = "force-dynamic";

type CsvRow = Record<string, string | number | null | undefined>;

const sectionLabels: Record<string, string> = {
  reflections: "Reflexões · ciclo + AD",
  passages: "Trechos indexados das obras aprovadas",
  diary: "Diário",
  habits: "Hábitos",
  tasks: "Tarefas",
  water: "Água",
};

export async function GET(request: Request) {
  try {
    await ensureSenderoSeeded();
    const user = await getActiveUser();
    if (!user) return NextResponse.json({ error: "Usuário ativo não encontrado." }, { status: 404 });

    const url = new URL(request.url);
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const sections = normalizeSections(url.searchParams.get("sections"));
    const db = getSenderoDb();
    const chunks: string[] = [];

    if (sections.includes("reflections")) {
      const filter = dateFilter("re.date", from, to);
      const result = await db.prepare(`
        SELECT re.date, re.status, re.cycleDay, re.contentText, rt.topic, rt.subtopic, c.name AS category
        FROM "ReflectionEntry" re
        JOIN "ReflectionTemplate" rt ON rt.id = re.templateId
        JOIN "Category" c ON c.id = rt.categoryId
        WHERE re.userId = ? ${filter.sql}
        ORDER BY re.date DESC
      `).bind(user.id, ...filter.values).all<{ date: string; status: string; cycleDay: number; contentText: string; topic: string; subtopic: string | null; category: string }>();
      chunks.push(toCsvSection("Reflexões", result.results.map((entry) => ({
        data: entry.date.slice(0, 10), tema: entry.topic, subtitulo: entry.subtopic, categoria: entry.category,
        status: entry.status, ciclo_dia: entry.cycleDay, texto: entry.contentText,
      }))));
    }

    if (sections.includes("reflections")) {
      const filter = dateFilter("date", from, to);
      const result = await db.prepare(`SELECT * FROM "ADReflection" WHERE userId = ? ${filter.sql} ORDER BY date DESC, confirmedAt DESC`).bind(user.id, ...filter.values).all<{ id: string; date: string; theme: string; summary: string; context: string; openQuestion: string; practice: string; references: string; sourceStatus: string; origin: string; confirmedAt: string }>();
      chunks.push(toCsvSection("Reflexões AD", result.results.map(r => ({
        id: r.id, data: r.date, tema: r.theme, sintese_aprovada: r.summary, contexto: r.context,
        pergunta_em_aberto: r.openQuestion, pratica: r.practice, referencias: r.references,
        base_filosofica: r.sourceStatus, origem: r.origin, confirmado_em: r.confirmedAt,
      }))));
    }
    if (sections.includes("passages")) {
      await ensureReferenceLibrary();
      const r = await db.prepare(`SELECT p.id, w.author, w.title AS work, w.edition, p.location, p.text, p.textHash, w.sourceFile, w.sourceHash FROM "IndexedPassage" p JOIN "IndexedWork" w ON w.id=p.workId AND w.revision=p.revision WHERE w.status='INDEXED' ORDER BY w.title, p.unitId, p.sequence`).all<{ id: string; author: string; work: string; edition: string; location: string; text: string; textHash: string; sourceFile: string; sourceHash: string }>();
      chunks.push(toCsvSection("Trechos indexados das obras aprovadas", r.results.map(p => ({ id: p.id, autor: p.author, obra: p.work, edicao: p.edition, localizacao: p.location, texto_literal: p.text, arquivo_fonte: p.sourceFile, sha256_fonte: p.sourceHash, sha256_trecho: p.textHash }))));
    }

    if (sections.includes("diary")) {
      const filter = dateFilter("date", from, to);
      const result = await db.prepare(`SELECT date, fixedAnswer, rotatingAnswers FROM "DiaryEntry" WHERE userId = ? ${filter.sql} ORDER BY date DESC`)
        .bind(user.id, ...filter.values).all<{ date: string; fixedAnswer: string; rotatingAnswers: string }>();
      chunks.push(toCsvSection("Diário", result.results.map((entry) => {
        const rotating = parseDiaryAnswers(entry.rotatingAnswers);
        return {
          data: entry.date.slice(0, 10), respostas_fixas: entry.fixedAnswer, resposta_rotativa: rotating.thirdAnswer,
          tonica_codigo: rotating.tonic?.code, tonica_fase: rotating.tonic?.phaseTitle, tonica_item: rotating.tonic?.title,
          reflexao_tonica: rotating.tonicAnswer,
        };
      })));
    }

    if (sections.includes("habits")) {
      const filter = dateFilter("hl.date", from, to);
      const result = await db.prepare(`
        SELECT hl.date, hl.count, hl.minutes, hl.note, ht.title
        FROM "HabitLog" hl JOIN "HabitTemplate" ht ON ht.id = hl.habitId
        WHERE hl.userId = ? ${filter.sql} ORDER BY hl.date DESC
      `).bind(user.id, ...filter.values).all<{ date: string; count: number; minutes: number | null; note: string | null; title: string }>();
      chunks.push(toCsvSection("Hábitos", result.results.map((log) => ({
        data: log.date.slice(0, 10), habito: log.title, quantidade: log.count, minutos: log.minutes, nota: log.note,
      }))));
    }

    if (sections.includes("tasks")) {
      const filter = dateFilter("t.dueDate", from, to);
      const result = await db.prepare(`
        SELECT t.dueDate, t.title, t.priority, t.status, t.completedAt, t.originType, t.description, c.name AS category
        FROM "TaskOccurrence" t JOIN "Category" c ON c.id = t.categoryId
        WHERE t.userId = ? ${filter.sql} ORDER BY t.dueDate DESC
      `).bind(user.id, ...filter.values).all<{ dueDate: string; title: string; priority: number; status: string; completedAt: string | null; originType: string; description: string | null; category: string }>();
      chunks.push(toCsvSection("Tarefas", result.results.map((task) => ({
        data: task.dueDate.slice(0, 10), titulo: task.title, categoria: task.category, prioridade: task.priority,
        status: task.completedAt || task.status === "DONE" ? "feita" : "pendente", origem: task.originType, descricao: task.description,
      }))));
    }

    if (sections.includes("water")) {
      const filter = dateFilter("date", from, to);
      const result = await db.prepare(`SELECT date, amountMl FROM "WaterLog" WHERE userId = ? ${filter.sql} ORDER BY date DESC`)
        .bind(user.id, ...filter.values).all<{ date: string; amountMl: number }>();
      chunks.push(toCsvSection("Água", result.results.map((log) => ({ data: log.date.slice(0, 10), ml: log.amountMl }))));
    }

    const content = [
      "sep=;", "Sendero - Exportação", `Usuário;${escapeCsv(user.name)}`,
      `Período;${from ?? "início"} até ${to ?? "hoje"}`,
      `Seções;${sections.map((section) => sectionLabels[section] ?? section).join(", ")}`,
      "", chunks.join("\n\n"),
    ].join("\r\n");

    // Excel for Windows opens CSV files using the local ANSI code page by default.
    // Windows-1252 keeps Portuguese accents intact without the slow UTF-16 response.
    // Keep the established Excel format when it is lossless. Book text may
    // contain characters such as Ā/ā: use UTF-8 with BOM rather than replace them.
    const utf8 = [...content].some(char => char.codePointAt(0)! > 0xff && !windows1252Special.has(char.codePointAt(0)!));
    const csvBytes = utf8 ? new TextEncoder().encode("\ufeff" + content) : encodeWindows1252(content);

    return new NextResponse(csvBytes, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": `text/csv; charset=${utf8 ? "utf-8" : "windows-1252"}`,
        "Content-Transfer-Encoding": "binary",
        "Content-Disposition": `attachment; filename="${exportFilename(from, to)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to export report", error);
    return NextResponse.json({ error: "Não foi possível gerar a exportação agora." }, { status: 500 });
  }
}

function encodeWindows1252(content: string) {
  const bytes = new Uint8Array(content.length);
  let offset = 0;

  for (let index = 0; index < content.length; index += 1) {
    const codeUnit = content.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && index + 1 < content.length) {
      const next = content.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index += 1;
      bytes[offset++] = 0x3f;
      continue;
    }

    bytes[offset++] = codeUnit <= 0xff ? codeUnit : (windows1252Special.get(codeUnit) ?? 0x3f);
  }

  return bytes.slice(0, offset);
}

const windows1252Special = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function normalizeSections(value: string | null) {
  const sections = (value ?? "reflections,diary,habits,tasks,water").split(",").map((section) => section.trim()).filter((section) => section in sectionLabels);
  return sections.length ? sections : Object.keys(sectionLabels);
}

function parseDiaryAnswers(value: string) {
  try {
    return JSON.parse(value) as { thirdAnswer?: string; tonicAnswer?: string; tonic?: { code?: string; phaseTitle?: string; title?: string } };
  } catch { return {}; }
}

function parseDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function dateFilter(column: string, from: string | null, to: string | null) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (from) { clauses.push(`substr(${column}, 1, 10) >= ?`); values.push(from); }
  if (to) { clauses.push(`substr(${column}, 1, 10) <= ?`); values.push(to); }
  return { sql: clauses.length ? `AND ${clauses.join(" AND ")}` : "", values };
}

function toCsvSection(title: string, rows: CsvRow[]) {
  if (!rows.length) return `${title}\r\nsem registros`;
  const headers = Object.keys(rows[0]);
  return [title, headers.join(";"), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(";"))].join("\r\n");
}

function escapeCsv(value: CsvRow[string]) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return /[;"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportFilename(from: string | null, to: string | null) {
  return `sendero-export-${from ?? "inicio"}-a-${to ?? new Date().toISOString().slice(0, 10)}.csv`;
}
