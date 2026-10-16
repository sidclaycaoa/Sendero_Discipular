import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod/v4";
import { bookStatus, indexedPassage } from "../lib/book-index";
import { listPassages, proposeAD, confirmAD, listAD, unifiedHistory, listProposals } from "../lib/ad";
import { ensureReferenceLibrary, ensureSenderoSeeded } from "../lib/db/d1";

type ReflectionRow = {
  date: string;
  topic: string;
  subtopic: string | null;
  orientation: string | null;
  contentText: string;
  cycleDay: number;
};

type DiaryRow = {
  date: string;
  fixedAnswer: string;
  rotatingAnswers: string;
};

const asJson = (value: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});

async function activeUser(db: D1Database) {
  await ensureSenderoSeeded();
  await ensureReferenceLibrary();
  return db
    .prepare('SELECT id, name FROM "User" ORDER BY createdAt ASC LIMIT 1')
    .first<{ id: string; name: string }>();
}

export function createServer(db: D1Database) {
  const server = new McpServer(
    { name: "ad-apoio-disciplinar", version: "2.1.0" },
    {
      instructions: `Você é AD — Apoio Discipular do Sendero. Este é o comportamento obrigatório para toda conversa iniciada com @sendero. Você é um acompanhante filosófico pessoal, sóbrio, humano e prático; não se apresente nem assuma o papel de mestre, guru, terapeuta, autoridade espiritual ou juiz moral.

Objetivo: ajudar Sidclay a iniciar o dia com presença e direção, amadurecer dúvidas, atravessar dificuldades e revisar o próprio percurso. Apoie sem infantilizar, questione sem agressividade e não ofereça frases prontas ou elogios vazios. Preserve sempre a autonomia e a responsabilidade do usuário.

FONTES E FIDELIDADE. Use como base filosófica exclusivamente as obras cadastradas no Sendero: Marco Aurélio — Meditações; Epicteto — A Arte de Viver; Sêneca — Da Tranquilidade da Alma; N. Sri Ram — Aspectos Profundos da Vida; Aristóteles — Ética a Nicômaco; N. Sri Ram — Sacrificio como alegría y libertad; Psicologia — apostila cuja autoria não está identificada no arquivo. Para orientação filosófica, consulte antes a ferramenta consultar_fontes_filosoficas ou referencias_do_percurso. As sete obras foram integralmente aprovadas pelo usuário: NÃO peça cadastro nem aprovação de passagens individuais. Consulte consultar_fontes_filosoficas, trechos_indexados ou recuperar_trecho_indexado e cite apenas texto literal retornado por esse índice técnico gerado dos arquivos originais. Nunca crie frases, nunca apresente resumo/paráfrase como citação e nunca busque fontes externas. Preserve autor, obra, edição disponível, página do arquivo PDF ou seção EPUB e identificação do trecho. Se a edição/numeração impressa não estiver disponível, declare isso; não invente. Não atribua ao criador do PDF a autoria de uma obra. Em Psicologia, a autoria é desconhecida e há anotações SM e notas didáticas: identifique-as como comentários, sem atribuir ao autor principal. Preserve o espanhol literal de Sacrificio; tradução interpretativa deve ficar fora da citação. Prefácios/comentários presentes no livro devem ser identificados como tais, sem atribuição automática ao autor principal. Use no máximo duas citações breves. Se não encontrar base pertinente, diga isso claramente. Se status_obras_aprovadas informar fonte faltante, sinalize qual obra precisa ser importada em lote, nunca passagem a passagem.

DISTINÇÃO NECESSÁRIA. Diferencie naturalmente “A obra indica” (ensino ou trecho encontrado) de “Possível aplicação” (leitura prudente para a situação concreta). Não apresente interpretação própria como doutrina da obra, nem uma hipótese sobre padrões como diagnóstico.

CONTINUIDADE. Em pedidos sobre o dia, reflexões pessoais, dúvidas recorrentes ou revisões, consulte antes contexto_atual e, quando pertinente, historico_de_reflexoes e historico_do_diario. Vincule a resposta ao que estiver registrado, reconhecendo avanços e tensões reais. Não alegue ter consultado ou lembrado algo que não foi retornado pelas ferramentas.

FORMA. Responda em português do Brasil, com profundidade sem prolixidade. Em geral entregue: uma leitura central; uma ou duas referências das obras quando pertinentes; no máximo três direções práticas; uma pergunta de reflexão; e, apenas quando ajudar, uma prática breve. Não force essa estrutura em perguntas simples. Em dilemas, separe fato, interpretação, reação e próximo passo possível. Não dê ordens, não faça diagnóstico psicológico e não transforme sofrimento em culpa ou lição apressada.

REGISTRO. Use propor_reflexao_ad para apresentar a síntese, contexto, pergunta/prática e referências canônicas. Essa ferramenta cria apenas uma proposta. Aguarde a confirmação explícita do usuário, então use registrar_reflexao_ad com o proposalId e a confirmação literal. Confirme o ID retornado e o link no Site. Use listar_reflexoes_ad e historico_integrado para revisões e exportações. Nunca registre automaticamente nem reproduza transcrições brutas. Quando uma função de registro estiver disponível e surgir aprendizado relevante, proponha um registro conciso e complementar; só o efetive após confirmação explícita de Sidclay (“registre”, “pode salvar”, “confirmo” ou equivalente). Nunca sobrescreva reflexões diárias existentes.`,
    },
  );

  server.registerTool(
    "consultar_fontes_filosoficas",
    {
      title: "Fontes filosóficas do AD",
      description: "Pesquisa trechos literais automaticamente indexados dos sete livros integralmente aprovados, com edição e página/seção quando disponíveis. Use antes de oferecer orientação filosófica ou interpretar uma dúvida.",
      inputSchema: {
        query: z.string().max(240).optional().describe("Tema ou dúvida a pesquisar nas obras. Sem consulta, retorna o acervo disponível."),
        limit: z.number().int().min(1).max(8).optional().describe("Quantidade máxima de passagens. Padrão: 4."),
      },
    },
    async ({ query = "", limit = 4 }) => {
      const user = await activeUser(db);
      if (!user) throw new Error("Não há usuário ativo no Sendero.");
      const sources = await listPassages(db, user.id, query, limit);
      return asJson({ query, sources, works: await bookStatus(db), sufficientBase: sources.length > 0, note: sources.length ? "Cite apenas o excerpt literal recuperado, preservando autor, obra, edição, localização e ID. O campo text contém o trecho integral indexado." : "Não há trechos pertinentes recuperados do índice para este tema. Não invente citações; apresente a limitação." });
    },
  );

  server.registerTool(
    "contexto_atual",
    {
      title: "Contexto atual do Sendero",
      description: "Lê o contexto atual do percurso: tônica, fase, práticas e pendências de reflexão. Use antes de propor uma reflexão para o dia.",
      inputSchema: {},
    },
    async () => {
      const user = await activeUser(db);
      if (!user) throw new Error("Não há usuário ativo no Sendero.");

      const [journey, tonic, pending, practices] = await Promise.all([
        db.prepare('SELECT level, sublevel, streak, karma, updatedAt FROM "JourneyState" WHERE userId = ? LIMIT 1').bind(user.id).first(),
        db.prepare(
          `SELECT dt.date, p.title AS phaseTitle, p.objective AS phaseObjective,
             p.sequence AS phaseSequence, t.title AS topicTitle, t.sequence AS topicSequence,
             g.synthesis AS guidance
           FROM "DailyTonic" dt
           JOIN "DiscipleshipTopic" t ON t.id = dt.topicId
           JOIN "DiscipleshipPhase" p ON p.id = t.phaseId
           LEFT JOIN "DiscipleshipTopicGuidance" g ON g.topicId = t.id
           WHERE dt.userId = ? ORDER BY dt.date DESC LIMIT 1`,
        ).bind(user.id).first(),
        db.prepare('SELECT COUNT(*) AS total FROM "ReflectionEntry" WHERE userId = ? AND status != ?').bind(user.id, "DONE").first<{ total: number }>(),
        db.prepare('SELECT title, cadence, targetCount, description FROM "HabitTemplate" WHERE userId = ? AND isActive = 1 ORDER BY title LIMIT 30').bind(user.id).all(),
      ]);

      return asJson({
        user: user.name,
        journey,
        dailyTonic: tonic,
        pendingReflections: pending?.total ?? 0,
        activePractices: practices.results,
      });
    },
  );

  server.registerTool(
    "historico_de_reflexoes",
    {
      title: "Histórico de reflexões",
      description: "Recupera reflexões pessoais recentes do Sendero para identificar vivências, recorrências e avanços. Retorna no máximo 25 registros.",
      inputSchema: {
        days: z.number().int().min(1).max(365).optional().describe("Período a considerar, em dias. Padrão: 30."),
        limit: z.number().int().min(1).max(25).optional().describe("Quantidade máxima de registros. Padrão: 12."),
      },
    },
    async ({ days = 30, limit = 12 }) => {
      const user = await activeUser(db);
      if (!user) throw new Error("Não há usuário ativo no Sendero.");
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - days);

      const result = await db.prepare(
        `SELECT e.date, t.topic, t.subtopic, t.orientation, e.contentText, e.cycleDay
         FROM "ReflectionEntry" e
         JOIN "ReflectionTemplate" t ON t.id = e.templateId
         WHERE e.userId = ? AND e.date >= ? AND e.status = ?
         ORDER BY e.date DESC, e.updatedAt DESC
         LIMIT ?`,
      ).bind(user.id, start.toISOString(), "DONE", limit).all<ReflectionRow>();

      const ad = await listAD(db, user.id, { from: start.toISOString().slice(0, 10), limit });
      return asJson({ periodDays: days, count: result.results.length, reflections: result.results, adReflections: ad.records, adTotal: ad.total, unifiedHistoryTool: "historico_integrado" });
    },
  );

  server.registerTool(
    "historico_do_diario",
    {
      title: "Histórico do diário",
      description: "Recupera entradas recentes do diário para apoiar uma conversa filosófica conectada à vivência concreta. Retorna no máximo 14 registros.",
      inputSchema: {
        limit: z.number().int().min(1).max(14).optional().describe("Quantidade máxima de entradas. Padrão: 7."),
      },
    },
    async ({ limit = 7 }) => {
      const user = await activeUser(db);
      if (!user) throw new Error("Não há usuário ativo no Sendero.");
      const result = await db.prepare(
        'SELECT date, fixedAnswer, rotatingAnswers FROM "DiaryEntry" WHERE userId = ? ORDER BY date DESC LIMIT ?',
      ).bind(user.id, limit).all<DiaryRow>();

      return asJson({ count: result.results.length, diaryEntries: result.results });
    },
  );

  server.registerTool(
    "referencias_do_percurso",
    {
      title: "Referências do percurso",
      description: "Consulta temas de reflexão, tônicas discipulares e citações filosóficas já guardadas no Sendero. Use para vincular uma orientação a referências existentes.",
      inputSchema: {
        query: z.string().max(120).optional().describe("Termo para filtrar temas ou citações."),
      },
    },
    async ({ query = "" }) => {
      const user = await activeUser(db);
      if (!user) throw new Error("Não há usuário ativo no Sendero.");
      const term = `%${query.trim()}%`;
      const [templates, quotes, tonic, bookSources] = await Promise.all([
        db.prepare(
          'SELECT topic, subtopic, orientation, period FROM "ReflectionTemplate" WHERE userId = ? AND isActive = 1 AND (topic LIKE ? OR COALESCE(subtopic, \'\') LIKE ? OR COALESCE(orientation, \'\') LIKE ?) ORDER BY topic LIMIT 30',
        ).bind(user.id, term, term, term).all(),
        db.prepare(
          'SELECT text, author FROM "PhilosophicalQuote" WHERE isActive = 1 AND (userId IS NULL OR userId = ?) AND (text LIKE ? OR COALESCE(author, \'\') LIKE ?) ORDER BY createdAt DESC LIMIT 20',
        ).bind(user.id, term, term).all(),
        db.prepare(
          `SELECT dt.date, p.title AS phaseTitle, p.objective AS phaseObjective,
             p.sequence AS phaseSequence, t.title AS topicTitle, t.sequence AS topicSequence,
             g.synthesis AS guidance
           FROM "DailyTonic" dt
           JOIN "DiscipleshipTopic" t ON t.id = dt.topicId
           JOIN "DiscipleshipPhase" p ON p.id = t.phaseId
           LEFT JOIN "DiscipleshipTopicGuidance" g ON g.topicId = t.id
           WHERE dt.userId = ? ORDER BY dt.date DESC LIMIT 14`,
        ).bind(user.id).all(),
        listPassages(db, user.id, query, 4),
      ]);
      return asJson({
        query,
        reflectionThemes: templates.results,
        legacyQuotesCount: quotes.results.length,
        legacyQuotesCitable: false,
        recentTonics: tonic.results,
        philosophicalBookSources: bookSources,
      });
    },
  );

  const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  const filterSchema = {
    from: z.string().optional(), to: z.string().optional(), theme: z.string().max(240).optional(),
    limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).optional(),
  };
  server.registerTool("trechos_indexados", {
    description: "Busca/pagina o índice técnico gerado dos arquivos originais das sete obras integralmente aprovadas. Não há aprovação manual. Excerpt é um recorte literal de text; cite apenas texto recuperado, com edição e localização disponíveis.", annotations: readOnly,
    inputSchema: { query: z.string().max(240).optional(), workId: z.string().optional(), limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).optional() },
  }, async ({ query, workId, limit, offset }) => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    return asJson({ passages: await listPassages(db, u.id, query, limit, workId, offset) });
  });
  server.registerTool("status_obras_aprovadas", {
    description: "Verifica a importação/indexação integral das sete fontes e os metadados disponíveis. Se faltar fonte, indique a obra para importação em lote. Nunca peça cadastro de passagens.", annotations: readOnly, inputSchema: {},
  }, async () => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    return asJson({ works: await bookStatus(db) });
  });
  server.registerTool("recuperar_trecho_indexado", {
    description: "Recupera um trecho pelo ID com texto literal e proveniência. Pode recortar uma citação por offsets start/end no text, sem reescrever ou resumir.", annotations: readOnly,
    inputSchema: { passageId: z.string(), start: z.number().int().min(0).optional(), end: z.number().int().min(1).optional() },
  }, async ({ passageId, start, end }) => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    if ((start === undefined) !== (end === undefined)) throw new Error("Informe start e end juntos.");
    return asJson({ passage: await indexedPassage(db, passageId, start === undefined ? undefined : { start, end: end! }) });
  });
  server.registerTool("propor_reflexao_ad", {
    description: "Prepara uma reflexão estruturada SEM gravar Reflexão AD. Apresente o resultado completo ao usuário e aguarde registre/confirmo. Informe apenas IDs de trechos indexados ou citations com passageId/start/end retornados pela busca; não envie citações inventadas. Sem base, o resultado declara essa limitação.", annotations: write,
    inputSchema: { date: z.string().optional(), theme: z.string().min(1).max(240), summary: z.string().min(1).max(6000), context: z.string().min(1).max(6000), openQuestion: z.string().min(1).max(2000), practice: z.string().max(2000).optional(), passageIds: z.array(z.string()).max(2).optional(), citations: z.array(z.object({ passageId: z.string(), start: z.number().int().min(0), end: z.number().int().min(1) })).max(2).optional() },
  }, async (input) => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    return asJson(await proposeAD(db, u.id, input));
  });
  server.registerTool("registrar_reflexao_ad", {
    description: "Grava a síntese EXATA da proposta somente depois de confirmação explícita do usuário (registre ou confirmo). Nunca use a autorização de implementar/testar o Site como aprovação de uma reflexão pessoal. É complementar, permite várias por dia e reenvios do mesmo proposalId não duplicam registros.", annotations: { ...write, idempotentHint: true },
    inputSchema: { proposalId: z.string(), confirmation: z.string().describe("Mensagem literal de confirmação do usuário após revisar a síntese da proposta.") },
  }, async ({ proposalId, confirmation }) => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    return asJson(await confirmAD(db, u.id, proposalId, confirmation));
  });
  server.registerTool("listar_reflexoes_ad", {
    description: "Lista registros AD confirmados, com filtros de data e tema e paginação para revisão e exportação. Consulta o mesmo banco da tela Refletir.", annotations: readOnly, inputSchema: filterSchema,
  }, async (filters) => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    return asJson({ ...await listAD(db, u.id, filters), exportUrl: "/api/reports/export?sections=reflections" });
  });
  server.registerTool("historico_integrado", {
    description: "Histórico único do Sendero: Diário, reflexões do ciclo e Reflexões AD confirmadas. Filtros por período, tema e tipo; paginação para revisar e exportar.", annotations: readOnly,
    inputSchema: { ...filterSchema, kind: z.enum(["AD", "CICLO", "DIARIO"]).optional() },
  }, async (filters) => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    return asJson(await unifiedHistory(db, u.id, filters));
  });
  server.registerTool("propostas_ad_pendentes", {
    description: "Recupera propostas ainda não confirmadas para o usuário revisar. Propostas não são registros pessoais confirmados.", annotations: readOnly, inputSchema: {},
  }, async () => {
    const u = await activeUser(db); if (!u) throw new Error("Usuário não encontrado.");
    return asJson({ proposals: await listProposals(db, u.id) });
  });

  return server;
}

export async function handleMcpRequest(request: Request, db: D1Database): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = createServer(db);
  await server.connect(transport);
  return transport.handleRequest(request);
}
