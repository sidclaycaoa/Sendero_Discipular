import { calculateCycleDay, getSaoPauloDateKey, getSaoPauloDayOfMonth, isSameWeek } from "@/lib/date";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";

const ACTIVE_USER_EMAIL = "sidclay@example.com";

// Every page needs the user and some fixed catalog rows. Each D1 round trip
// crosses the network, so these are loaded or seeded once per Worker isolate
// instead of on every request.
const ACTIVE_USER_TTL_MS = 5 * 60 * 1000;
let activeUserCache: { promise: ReturnType<typeof loadActiveUser>; expiresAt: number } | null = null;
const isolateOnce = new Map<string, Promise<unknown>>();

function oncePerIsolate<T>(key: string, run: () => Promise<T>): Promise<T> {
  let promise = isolateOnce.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = run().catch((error) => {
      isolateOnce.delete(key);
      throw error;
    });
    isolateOnce.set(key, promise);
  }
  return promise;
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  birthDate: string | null;
  mortemTargetAge: number;
  cycleAnchorDate: string;
  createdAt: string;
  updatedAt: string;
};

type TemplateRow = {
  id: string;
  userId: string;
  topic: string;
  subtopic: string | null;
  description: string;
  orientation: string | null;
  categoryId: string;
  categoryName?: string;
  cycleDays: string;
  period: "MORNING" | "AFTERNOON" | "NIGHT";
  isActive: number;
  isTemporary: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReflectionEntryRow = {
  id: string;
  userId: string;
  templateId: string;
  date: string;
  cycleDay: number;
  contentText: string;
  reflectionTimeSeconds: number;
  status: string;
  updatedAt: string;
};

export type DbReflectionTopic = {
  id: string;
  topic: string;
  subtopic: string;
  orientation: string;
  category: string;
  period: string;
  status: string;
  templateId: string;
  entryDate?: string;
};

export type ReflectionCycleWindow = {
  cycleDay: number;
  days: number[];
  dateKeys: string[];
};

export type ReflectionCycleSummary = {
  day: number;
  days: number[];
  dateKeys: string[];
  done: number;
  pending: number;
  total: number;
};

export type OverdueReflectionTopic = DbReflectionTopic & {
  dueDate: string;
  cycleDay: number;
};

export type NextPendingReflection = {
  id: string;
  href: string;
  topic: string;
  subtopic: string;
  dateKey: string;
  isOverdue: boolean;
};

export type OpenTask = {
  id: string;
  title: string;
  priority: string;
  origin: string;
  date: string;
  proximity: string;
  category: string;
};

export type DbHabit = {
  id: string;
  title: string;
  description: string;
  category: string;
  cadence: "DAILY" | "WEEKLY" | "TIME_BASED";
  targetCount: number;
  progress: number;
  todayCount: number;
  note: string;
  practiceGroup: "ED" | "PSYCHOLOGY" | "HABIT";
};

export type HabitDashboard = {
  dateKey: string;
  waterMl: number;
  waterGoalMl: number;
  habits: DbHabit[];
};

type PracticeGroupCode = "ED" | "PSYCHOLOGY" | "HABIT";

export type DiscipleshipTopic = { id: string; sequence: number; code: string; title: string; synthesis: string };
export type DiscipleshipPhase = { id: string; sequence: number; title: string; objective: string; topics: DiscipleshipTopic[] };
export type DailyDiscipleshipTonic = DiscipleshipTopic & { date: string; phase: Omit<DiscipleshipPhase, "topics"> };

const discipleshipPhases = [
  { title: "O que é ser discípulo?", objective: "Ser discípulo", topics: [
    "Viver ativamente a disciplina discipular: conhecer-se e dominar-se.", "Reconhecer as provas e superá-las.", "O discípulo eleva seu estado de consciência.", "O discípulo segue o mestre pelo caminho indicado.",
  ] },
  { title: "As provas", objective: "Tornar-se discípulo em provação", topics: [
    "Reconhecer amigos e inimigos.", "Há que querer as provas.", "O fácil e o difícil.", "Limitações.", "Não há prova superior às nossas possibilidades.",
  ] },
  { title: "A estrutura septenária", objective: "A construção do próprio edifício", topics: [
    "Devoção.", "Investigação.", "Serviço.", "Identidade.", "Generosidade.", "Pureza.", "Mística.",
  ] },
  { title: "Os três princípios da ação", objective: "Posse e utilização das três chaves para a superação de todas as provas", topics: [
    "Disciplina.", "Obediência.", "Militância.",
  ] },
  { title: "Os exercícios", objective: "Dispor de um método prático para ascensão na via discipular", topics: [
    "Exercícios de ED.", "Exercícios de psicologia.", "Hatha-Yoga.",
  ] },
  { title: "A vida do discípulo", objective: "Ser discípulo integral", topics: [
    "Ser discípulo sempre.", "Vencer o dragão do cotidiano.", "Saber estar no mundo.",
  ] },
  { title: "O sagrado", objective: "Florescer místico e o despertar do homem mago", topics: [
    "Vida interior.", "Templo interior e câmara de purificação.", "Mística cerimonial.", "Ver Deus em todas as coisas.",
  ] },
] as const;

// Sínteses construídas somente a partir do histórico pessoal de reflexões já registrado.
const discipleshipGuidance: Record<string, string> = {
  "1.1": "A vida discipular se confirma nas pequenas escolhas, sobretudo quando ninguém está olhando. Observe-se com sinceridade e responda ao que reconhece como necessário.",
  "1.2": "A prova mostra onde ainda há fuga, resistência ou falta de centro. Em vez de procurar desculpas, escolha um passo concreto para atravessá-la.",
  "1.3": "Elevar a consciência é voltar ao presente quando a pressa, a ansiedade ou a dispersão assumem o dia. Que ação simples pede mais presença agora?",
  "1.4": "O vínculo se fortalece quando as ideias recebidas se tornam vivência, pergunta e serviço. Retome hoje um ensinamento que você pode tornar mais real.",
  "2.1": "Reconheça o que fortalece seu centro e o que alimenta a fuga. Amigos e inimigos também se revelam nos hábitos, pensamentos e escolhas repetidas.",
  "2.2": "Querer a prova é aceitar que o desconforto pode revelar uma capacidade ainda não exercitada. Não espere facilidade para começar.",
  "2.3": "O fácil pode adormecer a vontade; o difícil costuma pedir presença, estratégia e constância. Qual deles você tem evitado por hábito?",
  "2.4": "Limites pedem lucidez, não rendição. Reconheça as condições reais de hoje e faça bem o que está ao seu alcance, sem se diminuir.",
  "2.5": "Quando a capacidade parece pequena, volte ao próximo passo possível. Você já percebeu que a resistência perde força depois que a ação começa.",
  "3.1": "Aquilo a que você dá tempo, atenção e constância ganha vida em você. O que merece hoje uma devoção mais consciente?",
  "3.2": "Boas ideias precisam de alimento contínuo para não se perderem na pressão do cotidiano. Reserve alguns minutos para estudar, recordar ou refletir com profundidade.",
  "3.3": "Serviço é tornar-se útil com presença: na família, no trabalho e na Escola. Onde sua ação pode ajudar sem buscar reconhecimento?",
  "3.4": "Identidade não é imagem: ela aparece quando você age de acordo com o que reconhece como seu dever. Que escolha de hoje confirma quem você quer ser?",
  "3.5": "Generosidade também é acompanhar, formar e estar disponível com verdade. Procure uma forma concreta de contribuir para o crescimento de alguém.",
  "3.6": "Purificar é retirar o excesso que pesa: distrações, acúmulos, impulsos e justificativas. O que pode ser simplificado agora para devolver clareza ao dia?",
  "3.7": "A dimensão mística pode ser encontrada na atenção colocada no simples. Viva a tarefa presente de modo inteiro, sem fazê-la apenas para cumprir tabela.",
  "4.1": "Disciplina é decidir e realizar mesmo quando o desejo aponta para a fuga. Qual pequena ação de hoje pode fortalecer sua vontade?",
  "4.2": "Obediência pede escuta, humildade e coerência com uma direção escolhida. Antes de agir, pergunte-se se está respondendo ao essencial ou ao impulso do momento.",
  "4.3": "Militância é colocar energia no lugar certo, no tempo certo, sem ativismo ou omissão. O que realmente depende de você agora?",
  "5.1": "O exercício torna a intenção verificável e cria raízes no cotidiano. Escolha praticar com constância, mesmo que em poucos minutos e sem esperar motivação.",
  "5.2": "Os exercícios de psicologia ajudam a perceber a ansiedade, os nós e as reações antes que eles conduzam o dia. Observe a causa, não apenas o efeito.",
  "5.3": "O cuidado com o corpo sustenta presença, energia e continuidade. Faça o exercício de hoje com respeito aos seus limites, mas sem negociar com a inércia.",
  "6.1": "Ser discípulo sempre é levar a direção interior para a rotina, não reservá-la para momentos ideais. Como ela pode aparecer na próxima tarefa comum?",
  "6.2": "O dragão cotidiano surge nas fugas pequenas: excesso, distração, adiamento e desordem. Nomeie uma delas e interrompa o ciclo com um gesto simples.",
  "6.3": "Saber estar no mundo é cumprir seu papel sem se perder nas demandas. Trabalhe, cuide e sirva com presença, lembrando que resultados não esgotam o sentido da ação.",
  "7.1": "A vida interior cresce quando você cria espaço para observar, silenciar e recordar o que é essencial. Que ruído pode diminuir hoje para escutar melhor?",
  "7.2": "O templo interior se constrói limpando o que obscurece a consciência e fortalecendo o que dá direção. Faça um exame honesto, seguido de uma ação reparadora.",
  "7.3": "A mística cerimonial pede forma, intenção e presença nas práticas escolhidas. Não é quantidade: é entrar inteiro no momento que você reservou.",
  "7.4": "Ver Deus em todas as coisas começa por reconhecer dignidade e aprendizado no que está diante de você. Hoje, trate uma pessoa ou tarefa comum com mais reverência.",
};

type ReflectionMonthData = {
  templates: TemplateRow[];
  entries: Array<{ templateId: string; date: string }>;
  postponements: Array<{ templateId: string; originalDate: string }>;
};

export type ReflectionTemplateSettings = {
  id: string;
  topic: string;
  subtopic: string;
  orientation: string;
  period: "MORNING" | "AFTERNOON" | "NIGHT";
  cycleDays: number[];
  startDate: string | null;
  endDate: string | null;
  isTemporary: boolean;
};

export function getActiveUser() {
  const now = Date.now();
  if (!activeUserCache || activeUserCache.expiresAt < now) {
    const promise = loadActiveUser().catch((error) => {
      if (activeUserCache?.promise === promise) activeUserCache = null;
      throw error;
    });
    activeUserCache = { promise, expiresAt: now + ACTIVE_USER_TTL_MS };
  }
  return activeUserCache.promise;
}

async function loadActiveUser() {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  let row = await db.prepare('SELECT * FROM "User" WHERE email = ? LIMIT 1').bind(ACTIVE_USER_EMAIL).first<UserRow>();
  row ??= await db.prepare('SELECT * FROM "User" ORDER BY createdAt ASC LIMIT 1').first<UserRow>();

  if (!row) {
    const now = new Date().toISOString();
    const id = newId("user");
    await db.prepare(
      'INSERT INTO "User" (id, email, name, birthDate, mortemTargetAge, cycleAnchorDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, ACTIVE_USER_EMAIL, "Sidclay", "1994-01-21T00:00:00.000Z", 60, "2026-06-01T00:00:00.000Z", now, now).run();
    row = await db.prepare('SELECT * FROM "User" WHERE id = ?').bind(id).first<UserRow>();
  }

  if (!row) return null;
  return {
    ...row,
    birthDate: row.birthDate ? new Date(row.birthDate) : null,
    cycleAnchorDate: new Date(row.cycleAnchorDate),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export async function getDiscipleshipCatalog(userId: string): Promise<DiscipleshipPhase[]> {
  await ensureSenderoSeeded();
  await ensureDiscipleshipCatalog(userId);
  const result = await getSenderoDb().prepare(`
    SELECT p.id AS phaseId, p.sequence AS phaseSequence, p.title AS phaseTitle, p.objective,
      t.id AS topicId, t.sequence AS topicSequence, t.title AS topicTitle, g.synthesis
    FROM "DiscipleshipPhase" p
    JOIN "DiscipleshipTopic" t ON t.phaseId = p.id
    LEFT JOIN "DiscipleshipTopicGuidance" g ON g.topicId = t.id
    WHERE p.userId = ?
    ORDER BY p.sequence ASC, t.sequence ASC
  `).bind(userId).all<{ phaseId: string; phaseSequence: number; phaseTitle: string; objective: string; topicId: string; topicSequence: number; topicTitle: string; synthesis: string | null }>();

  const phases = new Map<string, DiscipleshipPhase>();
  for (const row of result.results) {
    let phase = phases.get(row.phaseId);
    if (!phase) {
      phase = { id: row.phaseId, sequence: Number(row.phaseSequence), title: row.phaseTitle, objective: row.objective, topics: [] };
      phases.set(row.phaseId, phase);
    }
    phase.topics.push({ id: row.topicId, sequence: Number(row.topicSequence), code: `${row.phaseSequence}.${row.topicSequence}`, title: row.topicTitle, synthesis: row.synthesis ?? "" });
  }
  return [...phases.values()];
}

export async function getDailyDiscipleshipTonic(userId: string, dateKey = getSaoPauloDateKey()): Promise<DailyDiscipleshipTonic> {
  await ensureSenderoSeeded();
  await ensureDiscipleshipCatalog(userId);
  const db = getSenderoDb();
  const date = dateKey.slice(0, 10);
  let tonic = await selectDailyTonic(userId, date);
  if (tonic) return tonic;

  const [cycle, catalog] = await Promise.all([
    db.prepare('SELECT startedOn, startTopicId FROM "DiscipleshipCycle" WHERE userId = ? LIMIT 1').bind(userId).first<{ startedOn: string; startTopicId: string }>(),
    getDiscipleshipCatalog(userId),
  ]);
  const topics = catalog.flatMap((phase) => phase.topics.map((topic) => ({ topic, phase })));
  const startIndex = Math.max(0, topics.findIndex(({ topic }) => topic.id === cycle?.startTopicId));
  const elapsedDays = Math.max(0, daysBetweenDateKeys(cycle?.startedOn ?? date, date));
  const selected = topics[(startIndex + elapsedDays) % topics.length];
  const now = new Date().toISOString();
  await db.prepare('INSERT OR IGNORE INTO "DailyTonic" (id, userId, date, topicId, createdAt) VALUES (?, ?, ?, ?, ?)')
    .bind(newId("tonic"), userId, date, selected.topic.id, now).run();
  tonic = await selectDailyTonic(userId, date);
  if (!tonic) throw new Error("Não foi possível preparar a tônica diária.");
  return tonic;
}

async function selectDailyTonic(userId: string, dateKey: string): Promise<DailyDiscipleshipTonic | null> {
  const row = await getSenderoDb().prepare(`
    SELECT dt.date, t.id AS topicId, t.sequence AS topicSequence, t.title AS topicTitle,
      p.id AS phaseId, p.sequence AS phaseSequence, p.title AS phaseTitle, p.objective AS phaseObjective, g.synthesis
    FROM "DailyTonic" dt
    JOIN "DiscipleshipTopic" t ON t.id = dt.topicId
    JOIN "DiscipleshipPhase" p ON p.id = t.phaseId
    LEFT JOIN "DiscipleshipTopicGuidance" g ON g.topicId = t.id
    WHERE dt.userId = ? AND dt.date = ? LIMIT 1
  `).bind(userId, dateKey).first<{ date: string; topicId: string; topicSequence: number; topicTitle: string; phaseId: string; phaseSequence: number; phaseTitle: string; phaseObjective: string; synthesis: string | null }>();
  if (!row) return null;
  return {
    id: row.topicId, sequence: Number(row.topicSequence), code: `${row.phaseSequence}.${row.topicSequence}`, title: row.topicTitle, synthesis: row.synthesis ?? "", date: row.date.slice(0, 10),
    phase: { id: row.phaseId, sequence: Number(row.phaseSequence), title: row.phaseTitle, objective: row.phaseObjective },
  };
}

function ensureDiscipleshipCatalog(userId: string) {
  return oncePerIsolate(`ensureDiscipleshipCatalog:${userId}`, () => seedDiscipleshipCatalog(userId));
}

async function seedDiscipleshipCatalog(userId: string) {
  const db = getSenderoDb();
  if (await isDiscipleshipCatalogCurrent(userId)) return;
  const now = new Date().toISOString();
  const statements = discipleshipPhases.flatMap((phase, phaseIndex) => {
    const phaseId = `ed_phase_${userId}_${phaseIndex + 1}`;
    return [
      db.prepare('INSERT INTO "DiscipleshipPhase" (id, userId, sequence, title, objective, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, objective = excluded.objective, updatedAt = excluded.updatedAt')
        .bind(phaseId, userId, phaseIndex + 1, phase.title, phase.objective, now, now),
      ...phase.topics.map((title, topicIndex) => db.prepare('INSERT INTO "DiscipleshipTopic" (id, phaseId, sequence, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, updatedAt = excluded.updatedAt')
        .bind(`ed_topic_${userId}_${phaseIndex + 1}_${topicIndex + 1}`, phaseId, topicIndex + 1, title, now, now)),
    ];
  });
  await db.batch(statements);
  const guidanceStatements = discipleshipPhases.flatMap((phase, phaseIndex) => phase.topics.map((_, topicIndex) => {
    const topicId = `ed_topic_${userId}_${phaseIndex + 1}_${topicIndex + 1}`;
    const synthesis = discipleshipGuidance[`${phaseIndex + 1}.${topicIndex + 1}`];
    return db.prepare(`
      INSERT INTO "DiscipleshipTopicGuidance" (id, topicId, synthesis, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(topicId) DO UPDATE SET synthesis = excluded.synthesis, updatedAt = excluded.updatedAt
    `).bind(`ed_guidance_${userId}_${phaseIndex + 1}_${topicIndex + 1}`, topicId, synthesis, now, now);
  }));
  await db.batch(guidanceStatements);
  await db.prepare('INSERT OR IGNORE INTO "DiscipleshipCycle" (userId, startedOn, startTopicId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
    .bind(userId, getSaoPauloDateKey(), `ed_topic_${userId}_1_1`, now, now).run();
}

/** One read instead of three batched writes when the stored catalog already matches the code. */
async function isDiscipleshipCatalogCurrent(userId: string) {
  const result = await getSenderoDb().prepare(`
    SELECT p.sequence AS phaseSequence, p.title AS phaseTitle, p.objective, t.sequence AS topicSequence, t.title AS topicTitle, g.synthesis,
      (SELECT COUNT(*) FROM "DiscipleshipCycle" c WHERE c.userId = p.userId) AS hasCycle
    FROM "DiscipleshipPhase" p
    JOIN "DiscipleshipTopic" t ON t.phaseId = p.id
    LEFT JOIN "DiscipleshipTopicGuidance" g ON g.topicId = t.id
    WHERE p.userId = ?
    ORDER BY p.sequence ASC, t.sequence ASC
  `).bind(userId).all<{ phaseSequence: number; phaseTitle: string; objective: string; topicSequence: number; topicTitle: string; synthesis: string | null; hasCycle: number }>();
  const expected = discipleshipPhases.flatMap((phase, phaseIndex) => phase.topics.map((title, topicIndex) => ({
    phaseSequence: phaseIndex + 1, phaseTitle: phase.title, objective: phase.objective, topicSequence: topicIndex + 1, topicTitle: title,
    synthesis: discipleshipGuidance[`${phaseIndex + 1}.${topicIndex + 1}`],
  })));
  const rows = result.results;
  return rows.length === expected.length && Number(rows[0]?.hasCycle) > 0 && expected.every((item, index) => {
    const row = rows[index];
    return Number(row.phaseSequence) === item.phaseSequence && row.phaseTitle === item.phaseTitle && row.objective === item.objective
      && Number(row.topicSequence) === item.topicSequence && row.topicTitle === item.topicTitle && row.synthesis === item.synthesis;
  });
}

export async function getReflectionStats(userId: string) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const [entryCount, topicCount, adCount] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM "ReflectionEntry" WHERE userId = ?').bind(userId).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM "ReflectionTemplate" WHERE userId = ? AND isActive = 1').bind(userId).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM "ADReflection" WHERE userId = ?').bind(userId).first<{ count: number }>(),
  ]);
  return { totalReflections: Number(entryCount?.count ?? 0) + Number(adCount?.count ?? 0), topics: Number(topicCount?.count ?? 0) };
}

export async function getReflectionTopics(userId: string, limit?: number): Promise<DbReflectionTopic[]> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const query = `
    SELECT rt.*, c.name AS categoryName
    FROM "ReflectionTemplate" rt
    JOIN "Category" c ON c.id = rt.categoryId
    WHERE rt.userId = ? AND rt.isActive = 1
    ORDER BY rt.topic ASC, rt.subtopic ASC
    ${limit ? "LIMIT ?" : ""}`;
  const statement = db.prepare(query);
  const result = limit ? await statement.bind(userId, limit).all<TemplateRow>() : await statement.bind(userId).all<TemplateRow>();
  return result.results.map(toTopic);
}

export async function getReflectionTemplateSettings(userId: string): Promise<ReflectionTemplateSettings[]> {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare(
    'SELECT * FROM "ReflectionTemplate" WHERE userId = ? AND isActive = 1 ORDER BY topic ASC, subtopic ASC'
  ).bind(userId).all<TemplateRow>();

  return result.results.map((template) => ({
    id: template.id,
    topic: template.topic,
    subtopic: template.subtopic ?? "",
    orientation: template.orientation ?? template.description,
    period: template.period,
    cycleDays: parseNumberArray(template.cycleDays),
    startDate: toDateKeyOrNull(template.startDate),
    endDate: toDateKeyOrNull(template.endDate),
    isTemporary: Boolean(template.isTemporary),
  }));
}

export async function getTodayReflectionTopics(
  userId: string,
  cycleAnchorDate: Date,
  selectedCycleDay?: number,
  limit?: number,
  monthKey?: string,
): Promise<DbReflectionTopic[]> {
  return getReflectionTopicsForWindow(userId, getReflectionCycleWindow(cycleAnchorDate, selectedCycleDay, monthKey), limit);
}

export async function getReflectionCycleSummaries(userId: string, cycleAnchorDate: Date, monthKey?: string): Promise<ReflectionCycleSummary[]> {
  const normalizedMonth = normalizeReflectionMonthKey(monthKey);
  const monthData = await loadReflectionMonthData(userId, normalizedMonth);

  return Array.from({ length: 15 }).map((_, index) => {
    const day = index * 2 + 1;
    const window = getReflectionCycleWindow(cycleAnchorDate, day, normalizedMonth);
    const topics = buildTopicsForWindow(monthData, window);
    const done = topics.filter((topic) => topic.status === "feita").length;
    return { day, days: window.days, dateKeys: window.dateKeys, done, pending: topics.length - done, total: topics.length };
  });
}

export async function getReflectionPageData(
  userId: string,
  cycleAnchorDate: Date,
  selectedCycleDay?: number,
  monthKey?: string,
  overdueLimit = 8,
) {
  const normalizedMonth = normalizeReflectionMonthKey(monthKey);
  const cycleWindow = getReflectionCycleWindow(cycleAnchorDate, selectedCycleDay, normalizedMonth);
  const monthData = await loadReflectionMonthData(userId, normalizedMonth);
  const topics = buildTopicsForWindow(monthData, cycleWindow);
  const cycleSummaries = Array.from({ length: 15 }).map((_, index) => {
    const day = index * 2 + 1;
    const window = getReflectionCycleWindow(cycleAnchorDate, day, normalizedMonth);
    const cycleTopics = buildTopicsForWindow(monthData, window);
    const done = cycleTopics.filter((topic) => topic.status === "feita").length;
    return { day, days: window.days, dateKeys: window.dateKeys, done, pending: cycleTopics.length - done, total: cycleTopics.length };
  });
  const overdue = buildOverdueTopics(monthData, cycleAnchorDate, normalizedMonth, cycleWindow.days[0]).slice(0, overdueLimit);
  return { topics, cycleSummaries, overdue };
}

export async function getReflectionTopicsForWindow(
  userId: string,
  window: ReflectionCycleWindow,
  limit?: number,
): Promise<DbReflectionTopic[]> {
  const monthData = await loadReflectionMonthData(userId, window.dateKeys[0].slice(0, 7));
  const topics = buildTopicsForWindow(monthData, window);

  return limit ? topics.slice(0, limit) : topics;
}

export async function getOverdueReflectionTopics(
  userId: string,
  cycleAnchorDate: Date,
  monthKey = getCurrentReflectionMonthKey(),
  beforeCycleDay = getCurrentReflectionCycleDay(),
  limit = 8,
): Promise<OverdueReflectionTopic[]> {
  const normalizedMonth = normalizeReflectionMonthKey(monthKey);
  const monthData = await loadReflectionMonthData(userId, normalizedMonth);
  return buildOverdueTopics(monthData, cycleAnchorDate, normalizedMonth, beforeCycleDay).slice(0, limit);
}

export async function getNextPendingReflection(
  userId: string,
  cycleAnchorDate: Date,
  exclude?: { templateId: string; dateKey: string },
): Promise<NextPendingReflection | null> {
  const monthKey = getCurrentReflectionMonthKey();
  const cycleDay = getCurrentReflectionCycleDay();
  const currentWindow = getReflectionCycleWindow(cycleAnchorDate, cycleDay, monthKey);
  const monthData = await loadReflectionMonthData(userId, monthKey);
  const candidates: Array<{ topic: DbReflectionTopic; dateKey: string; cycleDay: number; isOverdue: boolean }> = [
    ...buildTopicsForWindow(monthData, currentWindow)
      .filter((topic) => topic.status !== "feita")
      .map((topic) => ({ topic, dateKey: currentWindow.dateKeys[0], cycleDay: currentWindow.days[0], isOverdue: false })),
    ...buildOverdueTopics(monthData, cycleAnchorDate, monthKey, currentWindow.days[0])
      .map((topic) => ({ topic, dateKey: topic.dueDate, cycleDay: topic.cycleDay, isOverdue: true })),
  ];
  const next = candidates.find(({ topic, dateKey }) => !(exclude && topic.templateId === exclude.templateId && dateKey === exclude.dateKey));
  if (!next) return null;
  return {
    id: next.topic.id,
    href: `/refletir/${next.topic.id}?date=${next.dateKey}&dia=${next.cycleDay}&mes=${monthKey}`,
    topic: next.topic.topic,
    subtopic: next.topic.subtopic,
    dateKey: next.dateKey,
    isOverdue: next.isOverdue,
  };
}

export async function postponeReflection({ userId, templateId, originalDateKey }: { userId: string; templateId: string; originalDateKey: string }) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const template = await db.prepare(
    'SELECT * FROM "ReflectionTemplate" WHERE id = ? AND userId = ? AND isActive = 1 LIMIT 1'
  ).bind(templateId, userId).first<TemplateRow>();
  if (!template) return null;

  const postponedToDate = addDateKeyDays(originalDateKey, 1);
  const nextCycleDay = Math.min(30, Math.max(1, Number(postponedToDate.slice(-2))));
  const cycleDays = parseNumberArray(template.cycleDays);
  const nextCycleDays = cycleDays.includes(nextCycleDay) ? cycleDays : [...cycleDays, nextCycleDay].sort((a, b) => a - b);
  const id = newId("postpone");
  const now = new Date().toISOString();

  await db.batch([
    db.prepare('INSERT INTO "ReflectionPostponement" (id, userId, templateId, originalDate, postponedToDate, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, userId, templateId, toIsoDate(originalDateKey), toIsoDate(postponedToDate), null, now),
    db.prepare('UPDATE "ReflectionTemplate" SET cycleDays = ?, updatedAt = ? WHERE id = ?').bind(JSON.stringify(nextCycleDays), now, templateId),
  ]);

  return { id, postponedToDate, nextCycleDay };
}

export function getReflectionCycleWindow(_cycleAnchorDate: Date, selectedCycleDay?: number, monthKey?: string): ReflectionCycleWindow {
  const cycleDay = normalizeCycleDay(selectedCycleDay ?? getLocalCycleDay());
  const days = getTwoDayCycleWindow(cycleDay);
  const currentCycleStart = getMonthStartDate(normalizeReflectionMonthKey(monthKey));
  return { cycleDay, days, dateKeys: days.map((day) => addDays(currentCycleStart, day - 1)) };
}

export function getCurrentReflectionCycleDay() {
  return getLocalCycleDay();
}

export function getCurrentReflectionMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function normalizeReflectionMonthKey(monthKey?: string) {
  return monthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) ? monthKey : getCurrentReflectionMonthKey();
}

export function shiftReflectionMonthKey(monthKey: string, delta: number) {
  const date = getMonthStartDate(normalizeReflectionMonthKey(monthKey));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

export async function getReflectionTopicById(userId: string, id: string): Promise<DbReflectionTopic | null> {
  await ensureSenderoSeeded();
  const template = await getSenderoDb().prepare(`
    SELECT rt.*, c.name AS categoryName FROM "ReflectionTemplate" rt
    JOIN "Category" c ON c.id = rt.categoryId
    WHERE rt.id = ? AND rt.userId = ? AND rt.isActive = 1 LIMIT 1
  `).bind(id, userId).first<TemplateRow>();
  return template ? toTopic(template) : null;
}

export async function getRecentReflectionHistory(userId: string, templateId: string) {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare(`
    SELECT re.date, re.contentText, rt.topic FROM "ReflectionEntry" re
    JOIN "ReflectionTemplate" rt ON rt.id = re.templateId
    WHERE re.userId = ? AND re.templateId = ? ORDER BY re.date DESC LIMIT 5
  `).bind(userId, templateId).all<{ date: string; contentText: string; topic: string }>();
  return result.results.map((entry) => ({ date: entry.date.slice(0, 10), topic: entry.topic, excerpt: entry.contentText.slice(0, 420) }));
}

export async function getTodayReflectionEntry(userId: string, templateId: string, dateKey: string) {
  await ensureSenderoSeeded();
  return getSenderoDb().prepare(
    'SELECT * FROM "ReflectionEntry" WHERE userId = ? AND templateId = ? AND substr(date, 1, 10) = ? LIMIT 1'
  ).bind(userId, templateId, dateKey).first<ReflectionEntryRow>();
}

export async function getReflectionEntryForWindow(userId: string, templateId: string, dateKeys: string[]) {
  await ensureSenderoSeeded();
  const placeholders = dateKeys.map(() => "?").join(", ");
  const row = await getSenderoDb().prepare(`
    SELECT * FROM "ReflectionEntry" WHERE userId = ? AND templateId = ? AND substr(date, 1, 10) IN (${placeholders})
    ORDER BY updatedAt DESC LIMIT 1
  `).bind(userId, templateId, ...dateKeys).first<ReflectionEntryRow>();
  return row ? { ...row, date: new Date(row.date), updatedAt: new Date(row.updatedAt) } : null;
}

export async function saveTodayReflection({ userId, templateId, dateKey, contentText, reflectionTimeSeconds, cycleAnchorDate }: {
  userId: string; templateId: string; dateKey: string; contentText: string; reflectionTimeSeconds: number; cycleAnchorDate: Date;
}) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const date = toIsoDate(dateKey);
  const cycleDay = calculateCycleDay(dateKey, cycleAnchorDate.toISOString().slice(0, 10));
  const now = new Date().toISOString();
  const id = newId("reflection");
  await db.prepare(`
    INSERT INTO "ReflectionEntry" (id, userId, templateId, date, cycleNumber, cycleDay, contentText, reflectionTimeSeconds, status, originType, originTaskId, linkedEntryId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DONE', 'MANUAL', NULL, NULL, ?, ?)
    ON CONFLICT(userId, templateId, date) DO UPDATE SET contentText = excluded.contentText, cycleDay = excluded.cycleDay, reflectionTimeSeconds = excluded.reflectionTimeSeconds, status = 'DONE', updatedAt = excluded.updatedAt
  `).bind(id, userId, templateId, date, null, cycleDay, contentText, Math.max(0, Math.round(reflectionTimeSeconds)), now, now).run();
  const saved = await db.prepare('SELECT id FROM "ReflectionEntry" WHERE userId = ? AND templateId = ? AND date = ?').bind(userId, templateId, date).first<{ id: string }>();
  return { id: saved?.id ?? id };
}

export async function createTaskFromReflection(userId: string, templateId: string) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const template = await db.prepare(
    'SELECT * FROM "ReflectionTemplate" WHERE id = ? AND userId = ? LIMIT 1'
  ).bind(templateId, userId).first<TemplateRow>();
  if (!template) return null;
  const id = newId("task");
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO "TaskOccurrence" (id, userId, seriesId, title, description, dueDate, priority, categoryId, status, completedAt, originType, originReflectionTemplateId, createdAt, updatedAt)
    VALUES (?, ?, NULL, ?, ?, ?, 2, ?, 'PLANNED', NULL, 'REFLECTION', ?, ?, ?)
  `).bind(id, userId, `Praticar: ${template.topic}`, template.orientation ?? template.description, now, template.categoryId, template.id, now, now).run();
  return { id };
}

export async function getOpenTasks(userId: string): Promise<OpenTask[]> {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare(`
    SELECT t.*, c.name AS categoryName FROM "TaskOccurrence" t
    JOIN "Category" c ON c.id = t.categoryId
    WHERE t.userId = ? AND t.completedAt IS NULL AND t.status != 'CANCELED'
    ORDER BY t.dueDate ASC
  `).bind(userId).all<{ id: string; title: string; priority: number; originType: string; dueDate: string; categoryName: string }>();
  const today = new Date(new Date().toISOString().slice(0, 10));
  return result.results.map((task) => ({
    id: task.id,
    title: task.title,
    priority: task.priority >= 3 ? "Muito importante" : task.priority === 2 ? "Importante" : "Normal",
    origin: task.originType === "REFLECTION" ? "Reflexão" : "Tarefa",
    date: task.dueDate.slice(0, 10),
    proximity: new Date(task.dueDate) < today ? "late" : "today",
    category: task.categoryName,
  }));
}

export type TaskBoardItem = OpenTask & { description: string; completed: boolean; isRecurring: boolean };
export type CalendarEvent = { id: string; title: string; date: string; time: string; endTime: string; location: string; description: string; isRecurring?: boolean };
export type ShoppingItem = { id: string; title: string; dueDate: string | null; checked: boolean };
export type PlannerData = { tasks: TaskBoardItem[]; events: CalendarEvent[]; shopping: ShoppingItem[]; rangeStart: string; rangeEnd: string };

export async function getTaskBoard(userId: string, includeCompleted = false): Promise<TaskBoardItem[]> {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare(`
    SELECT t.*, c.name AS categoryName FROM "TaskOccurrence" t
    JOIN "Category" c ON c.id = t.categoryId
    WHERE t.userId = ? AND t.status != 'CANCELED' ${includeCompleted ? "" : "AND t.completedAt IS NULL"}
    ORDER BY CASE WHEN t.completedAt IS NULL THEN 0 ELSE 1 END, t.dueDate ASC
  `).bind(userId).all<{ id: string; title: string; description: string | null; dueDate: string; priority: number; originType: string; categoryName: string; completedAt: string | null; seriesId: string | null }>();
  const today = getSaoPauloDateKey();
  return result.results.map((task) => ({
    id: task.id, title: task.title, description: task.description ?? "", date: task.dueDate.slice(0, 10),
    priority: task.priority >= 3 ? "Muito importante" : task.priority === 2 ? "Importante" : "Normal",
    origin: task.originType === "REFLECTION" ? "Reflexão" : task.originType === "DIARY" ? "Diário" : "Manual",
    proximity: task.completedAt ? "done" : task.dueDate.slice(0, 10) < today ? "late" : task.dueDate.slice(0, 10) === today ? "today" : "future",
    category: task.categoryName, completed: Boolean(task.completedAt), isRecurring: Boolean(task.seriesId),
  }));
}

export async function createManualTask({ userId, title, dueDate, priority, description, recurrence }: { userId: string; title: string; dueDate: string; priority?: number; description?: string; recurrence?: { frequency?: "daily" | "weekly" | "monthly"; weekdays?: number[] } }) {
  await ensureSenderoSeeded();
  const categoryId = await ensureCategory(userId);
  const now = new Date().toISOString();
  const id = newId("task");
  const db = getSenderoDb();
  const seriesId = recurrence?.frequency ? newId("taskseries") : null;
  if (seriesId) await db.prepare('INSERT INTO "TaskSeries" (id, userId, title, recurrence, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').bind(seriesId, userId, title.trim(), JSON.stringify(recurrence), now, now).run();
  await db.prepare(`
    INSERT INTO "TaskOccurrence" (id, userId, seriesId, title, description, dueDate, priority, categoryId, status, completedAt, originType, originReflectionTemplateId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', NULL, 'MANUAL', NULL, ?, ?)
  `).bind(id, userId, seriesId, title.trim(), description?.trim() || null, toIsoDate(dueDate), Math.min(3, Math.max(1, Number(priority) || 2)), categoryId, now, now).run();
  if (seriesId) {
    const dates = recurrenceDates(dueDate, recurrence!);
    await db.batch(dates.slice(1).map((date) => db.prepare(`INSERT INTO "TaskOccurrence" (id, userId, seriesId, title, description, dueDate, priority, categoryId, status, completedAt, originType, originReflectionTemplateId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', NULL, 'MANUAL', NULL, ?, ?)`)
      .bind(newId("task"), userId, seriesId, title.trim(), description?.trim() || null, toIsoDate(date), Math.min(3, Math.max(1, Number(priority) || 2)), categoryId, now, now)));
  }
  return { id };
}

export async function updateTaskState({ userId, taskId, completed, title, dueDate, priority, description }: { userId: string; taskId: string; completed?: boolean; title?: string; dueDate?: string; priority?: number; description?: string }) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const existing = await db.prepare('SELECT * FROM "TaskOccurrence" WHERE id = ? AND userId = ? LIMIT 1').bind(taskId, userId).first<{ id: string }>();
  if (!existing) return null;
  if (completed !== undefined) await db.prepare('UPDATE "TaskOccurrence" SET completedAt = ?, status = ?, updatedAt = ? WHERE id = ? AND userId = ?')
    .bind(completed ? new Date().toISOString() : null, completed ? "DONE" : "PLANNED", new Date().toISOString(), taskId, userId).run();
  if (title?.trim() && dueDate) await db.prepare('UPDATE "TaskOccurrence" SET title = ?, description = ?, dueDate = ?, priority = ?, updatedAt = ? WHERE id = ? AND userId = ?')
    .bind(title.trim(), description?.trim() || null, toIsoDate(dueDate), Math.min(3, Math.max(1, Number(priority) || 2)), new Date().toISOString(), taskId, userId).run();
  return { id: taskId };
}

export async function deleteTask(userId: string, taskId: string) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('DELETE FROM "TaskOccurrence" WHERE id = ? AND userId = ?').bind(taskId, userId).run();
}

export async function getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  await ensureSenderoSeeded();
  const result = await getSenderoDb().prepare('SELECT * FROM "Event" WHERE userId = ? ORDER BY startsAt ASC').bind(userId).all<{ id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; description: string | null }>();
  return result.results.map(toCalendarEvent);
}

export async function getPlannerData(userId: string, selectedDate = getSaoPauloDateKey()): Promise<PlannerData> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const { rangeStart, rangeEnd } = getCalendarGridRange(selectedDate);
  const [taskResult, eventResult, shoppingResult] = await Promise.all([
    db.prepare(`
      SELECT t.*, c.name AS categoryName FROM "TaskOccurrence" t
      JOIN "Category" c ON c.id = t.categoryId
      WHERE t.userId = ? AND t.status != 'CANCELED' AND t.completedAt IS NULL
      ORDER BY t.priority DESC, t.dueDate ASC
    `).bind(userId).all<{ id: string; title: string; description: string | null; dueDate: string; priority: number; originType: string; categoryName: string; seriesId: string | null }>(),
    db.prepare(`
      SELECT * FROM "Event" WHERE userId = ?
        AND substr(startsAt, 1, 10) >= ? AND substr(startsAt, 1, 10) <= ?
      ORDER BY startsAt ASC
    `).bind(userId, rangeStart, rangeEnd).all<{ id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; description: string | null }>(),
    db.prepare('SELECT id, title, dueDate, isChecked FROM "ShoppingItem" WHERE userId = ? ORDER BY isChecked ASC, CASE WHEN dueDate IS NULL THEN 1 ELSE 0 END, dueDate ASC, createdAt ASC').bind(userId).all<{ id: string; title: string; dueDate: string | null; isChecked: number }>(),
  ]);
  const today = getSaoPauloDateKey();
  const taskRows = taskResult.results.map((task) => ({
    task: {
      id: task.id, title: task.title, description: task.description ?? "", date: task.dueDate.slice(0, 10),
      priority: task.priority >= 3 ? "Muito importante" : task.priority === 2 ? "Importante" : "Normal",
      origin: task.originType === "REFLECTION" ? "Reflexão" : task.originType === "DIARY" ? "Diário" : "Manual",
      proximity: task.dueDate.slice(0, 10) < today ? "late" : task.dueDate.slice(0, 10) === today ? "today" : "future",
      category: task.categoryName, completed: false, isRecurring: Boolean(task.seriesId),
    } satisfies TaskBoardItem,
    seriesId: task.seriesId,
  }));
  const tasks = nextTaskInEachSeries(taskRows);
  const events = nextEventInEachRecurringPattern(eventResult.results.map(toCalendarEvent), selectedDate);
  return { tasks, events, shopping: shoppingResult.results.map((item) => ({ id: item.id, title: item.title, dueDate: item.dueDate, checked: Boolean(item.isChecked) })), rangeStart, rangeEnd };
}

export async function createShoppingItem(userId: string, title: string, dueDate?: string) {
  await ensureSenderoSeeded();
  const now = new Date().toISOString();
  const id = newId("shopping");
  await getSenderoDb().prepare('INSERT INTO "ShoppingItem" (id, userId, title, dueDate, isChecked, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)')
    .bind(id, userId, title.trim(), dueDate ? toIsoDate(dueDate) : null, now, now).run();
  return { id };
}

export async function setShoppingItemChecked(userId: string, id: string, checked: boolean) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('UPDATE "ShoppingItem" SET isChecked = ?, updatedAt = ? WHERE id = ? AND userId = ?')
    .bind(checked ? 1 : 0, new Date().toISOString(), id, userId).run();
}

export async function updateShoppingItem(userId: string, id: string, { title, dueDate, checked }: { title?: string; dueDate?: string | null; checked?: boolean }) {
  await ensureSenderoSeeded();
  const now = new Date().toISOString();
  if (title !== undefined || dueDate !== undefined) {
    await getSenderoDb().prepare('UPDATE "ShoppingItem" SET title = CASE WHEN ? = 1 THEN ? ELSE title END, dueDate = CASE WHEN ? = 1 THEN ? ELSE dueDate END, updatedAt = ? WHERE id = ? AND userId = ?')
      .bind(title !== undefined ? 1 : 0, title?.trim() || null, dueDate !== undefined ? 1 : 0, dueDate ? toIsoDate(dueDate) : null, now, id, userId).run();
  }
  if (checked !== undefined) await setShoppingItemChecked(userId, id, checked);
}

export async function deleteShoppingItem(userId: string, id: string) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('DELETE FROM "ShoppingItem" WHERE id = ? AND userId = ?').bind(id, userId).run();
}

/** Keep a recurring task as one actionable item. Once it is completed, its next open occurrence becomes visible. */
function nextTaskInEachSeries(rows: Array<{ task: TaskBoardItem; seriesId: string | null }>) {
  const nextBySeries = new Map<string, TaskBoardItem>();
  const standalone: TaskBoardItem[] = [];
  for (const row of rows) {
    if (!row.seriesId) { standalone.push(row.task); continue; }
    const current = nextBySeries.get(row.seriesId);
    if (!current || row.task.date < current.date) nextBySeries.set(row.seriesId, row.task);
  }
  return [...standalone, ...nextBySeries.values()];
}

/**
 * Legacy recurring events are stored as individual Event rows. Group equal future
 * rows in the visible calendar range so the agenda shows only the next occurrence.
 */
function nextEventInEachRecurringPattern(events: CalendarEvent[], selectedDate: string) {
  const patterns = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const signature = [event.title, event.time, event.endTime, event.location, event.description].join("\u0001");
    const group = patterns.get(signature) ?? [];
    group.push(event); patterns.set(signature, group);
  }
  return [...patterns.values()].flatMap((group) => {
    const distinctDates = new Set(group.map((event) => event.date));
    if (distinctDates.size < 2) return group;
    const next = group.find((event) => event.date >= selectedDate) ?? group.at(-1);
    return next ? [{ ...next, isRecurring: true }] : [];
  }).sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
}

export async function createCalendarEvent({ userId, title, startsAt, endsAt, location, description, recurrence }: { userId: string; title: string; startsAt: string; endsAt?: string; location?: string; description?: string; recurrence?: { frequency?: "daily" | "weekly" | "monthly"; weekdays?: number[] } }) {
  await ensureSenderoSeeded();
  const now = new Date().toISOString(); const id = newId("event");
  const db = getSenderoDb();
  await db.prepare('INSERT INTO "Event" (id, userId, title, startsAt, endsAt, location, description, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)')
    .bind(id, userId, title.trim(), startsAt, endsAt || null, location?.trim() || null, description?.trim() || null, now, now).run();
  if (recurrence?.frequency) {
    const dateKey = startsAt.slice(0, 10); const time = startsAt.slice(10); const endTime = endsAt?.slice(10) ?? null;
    await db.batch(recurrenceDates(dateKey, recurrence).slice(1).map((date) => db.prepare('INSERT INTO "Event" (id, userId, title, startsAt, endsAt, location, description, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)')
      .bind(newId("event"), userId, title.trim(), `${date}${time}`, endTime ? `${date}${endTime}` : null, location?.trim() || null, description?.trim() || null, now, now)));
  }
  return { id };
}

export async function updateCalendarEvent({ userId, eventId, title, startsAt, endsAt, location, description }: { userId: string; eventId: string; title: string; startsAt: string; endsAt?: string; location?: string; description?: string }) {
  await ensureSenderoSeeded();
  const existing = await getSenderoDb().prepare('SELECT id FROM "Event" WHERE id = ? AND userId = ? LIMIT 1').bind(eventId, userId).first<{ id: string }>();
  if (!existing) return null;
  await getSenderoDb().prepare('UPDATE "Event" SET title = ?, startsAt = ?, endsAt = ?, location = ?, description = ?, updatedAt = ? WHERE id = ? AND userId = ?')
    .bind(title.trim(), startsAt, endsAt || null, location?.trim() || null, description?.trim() || null, new Date().toISOString(), eventId, userId).run();
  return { id: eventId };
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('DELETE FROM "Event" WHERE id = ? AND userId = ?').bind(eventId, userId).run();
}

function toCalendarEvent(event: { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; description: string | null }): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    date: event.startsAt.slice(0, 10),
    time: event.startsAt.slice(11, 16),
    endTime: event.endsAt?.slice(11, 16) ?? "",
    location: event.location ?? "",
    description: event.description ?? "",
  };
}

function getCalendarGridRange(selectedDate: string) {
  const selected = new Date(`${selectedDate}T12:00:00.000Z`);
  const monthStart = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
  const rangeStart = new Date(monthStart);
  rangeStart.setUTCDate(monthStart.getUTCDate() - monthStart.getUTCDay());
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeStart.getUTCDate() + 41);
  return { rangeStart: rangeStart.toISOString().slice(0, 10), rangeEnd: rangeEnd.toISOString().slice(0, 10) };
}

export type ReportDashboard = {
  weekLabel: string;
  reflectionDone: number;
  diaryDone: number;
  habitDailyDone: number;
  habitWeeklyProgress: number;
  waterAverageMl: number;
  activeDays: number;
  totalReflections: number;
  categories: Array<{ label: string; value: number; color: string }>;
};

export type HabitIndicator = { id: string; title: string; target: number; completedDays: number; previousCompletedDays: number; series: Array<{ date: string; value: number }> };

export async function getHabitIndicators(userId: string, todayKey = getSaoPauloDateKey()): Promise<HabitIndicator[]> {
  await ensureSenderoSeeded();
  const db = getSenderoDb(); const start = addDateKeyDays(todayKey, -29); const previousStart = addDateKeyDays(todayKey, -59);
  const [templates, logs] = await Promise.all([
    db.prepare('SELECT id, title, targetCount FROM "HabitTemplate" WHERE userId = ? AND isActive = 1 ORDER BY createdAt ASC').bind(userId).all<{ id: string; title: string; targetCount: number }>(),
    db.prepare('SELECT habitId, substr(date, 1, 10) AS date, count, minutes FROM "HabitLog" WHERE userId = ? AND substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?').bind(userId, previousStart, todayKey).all<{ habitId: string; date: string; count: number; minutes: number | null }>(),
  ]);
  return templates.results.map((template) => { const target = Math.max(1, Number(template.targetCount)); const byDate = new Map<string, number>(); logs.results.filter(log => log.habitId === template.id).forEach(log => byDate.set(log.date, (byDate.get(log.date) ?? 0) + Number(log.minutes ?? log.count ?? 0)));
    const dates = Array.from({ length: 30 }, (_, index) => addDateKeyDays(start, index)); const series = dates.map(date => ({ date, value: byDate.get(date) ?? 0 }));
    return { id: template.id, title: template.title, target, series, completedDays: series.filter(point => point.value >= target).length, previousCompletedDays: Array.from({ length: 30 }, (_, index) => addDateKeyDays(previousStart, index)).filter(date => (byDate.get(date) ?? 0) >= target).length };
  });
}

export async function getReportDashboard(userId: string, todayKey = getSaoPauloDateKey()): Promise<ReportDashboard> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const weekDates = weekDateKeys(todayKey);
  const start = weekDates[0];
  const [reflectionRows, diaryRows, habitRows, waterRows, templates, categoryRows, totalReflections, adRows, adTotal] = await Promise.all([
    db.prepare('SELECT substr(date, 1, 10) AS date FROM "ReflectionEntry" WHERE userId = ? AND substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?').bind(userId, start, todayKey).all<{ date: string }>(),
    db.prepare('SELECT substr(date, 1, 10) AS date FROM "DiaryEntry" WHERE userId = ? AND substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?').bind(userId, start, todayKey).all<{ date: string }>(),
    db.prepare('SELECT hl.*, ht.cadence, ht.targetCount FROM "HabitLog" hl JOIN "HabitTemplate" ht ON ht.id = hl.habitId WHERE hl.userId = ? AND hl.date >= ? AND hl.date <= ? AND ht.isActive = 1').bind(userId, start, todayKey).all<{ habitId: string; date: string; count: number; minutes: number | null; cadence: string; targetCount: number }>(),
    db.prepare('SELECT date, amountMl FROM "WaterLog" WHERE userId = ? AND date >= ? AND date <= ?').bind(userId, start, todayKey).all<{ date: string; amountMl: number }>(),
    db.prepare('SELECT id, cadence, targetCount FROM "HabitTemplate" WHERE userId = ? AND isActive = 1').bind(userId).all<{ id: string; cadence: string; targetCount: number }>(),
    db.prepare('SELECT c.name, c.color, COUNT(re.id) AS total FROM "Category" c LEFT JOIN "ReflectionTemplate" rt ON rt.categoryId = c.id LEFT JOIN "ReflectionEntry" re ON re.templateId = rt.id WHERE c.userId = ? GROUP BY c.id ORDER BY total DESC').bind(userId).all<{ name: string; color: string; total: number }>(),
    db.prepare('SELECT COUNT(*) AS total FROM "ReflectionEntry" WHERE userId = ?').bind(userId).first<{ total: number }>(),
    db.prepare('SELECT date FROM "ADReflection" WHERE userId = ? AND date >= ? AND date <= ?').bind(userId, start, todayKey).all<{ date: string }>(),
    db.prepare('SELECT COUNT(*) AS total FROM "ADReflection" WHERE userId = ?').bind(userId).first<{ total: number }>(),
  ]);
  const dailyTemplates = templates.results.filter((item) => normalizeHabitCadence(item.cadence) === "DAILY");
  const weeklyTemplates = templates.results.filter((item) => normalizeHabitCadence(item.cadence) === "WEEKLY");
  const habitDailyDone = weekDates.reduce((sum, date) => sum + dailyTemplates.filter((template) => habitRows.results.filter((log) => log.habitId === template.id && log.date.slice(0, 10) === date).reduce((count, log) => count + Number(log.count), 0) >= template.targetCount).length, 0);
  const habitWeeklyProgress = weeklyTemplates.reduce((sum, template) => sum + Math.min(template.targetCount, habitRows.results.filter((log) => log.habitId === template.id).reduce((count, log) => count + Number(log.count), 0)), 0);
  const waterByDate = new Map<string, number>(); waterRows.results.forEach((row) => waterByDate.set(row.date.slice(0, 10), (waterByDate.get(row.date.slice(0, 10)) ?? 0) + Number(row.amountMl)));
  const reflectionDates = new Set([...reflectionRows.results, ...adRows.results].map((row) => row.date)); const diaryDates = new Set(diaryRows.results.map((row) => row.date));
  return {
    weekLabel: `${formatShortDate(start)}–${formatShortDate(todayKey)}`,
    reflectionDone: reflectionRows.results.length + adRows.results.length, diaryDone: diaryRows.results.length, habitDailyDone, habitWeeklyProgress,
    waterAverageMl: waterByDate.size ? Math.round(Array.from(waterByDate.values()).reduce((sum, value) => sum + value, 0) / waterByDate.size) : 0,
    activeDays: new Set([...reflectionDates, ...diaryDates, ...waterByDate.keys()]).size,
    totalReflections: Number(totalReflections?.total ?? 0) + Number(adTotal?.total ?? 0),
    categories: [...categoryRows.results.map((item) => ({ label: item.name, value: Number(item.total), color: item.color })), { label: "Reflexões AD", value: Number(adTotal?.total ?? 0), color: "#66704f" }],
  };
}

function weekDateKeys(todayKey: string) {
  const today = new Date(`${todayKey}T00:00:00.000Z`); const start = new Date(today); start.setUTCDate(today.getUTCDate() - today.getUTCDay());
  const keys: string[] = []; for (let date = new Date(start); date <= today; date.setUTCDate(date.getUTCDate() + 1)) keys.push(date.toISOString().slice(0, 10));
  return keys;
}

function formatShortDate(dateKey: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00.000Z`)); }

export async function saveDiaryEntry(userId: string, dateKey: string, answers: string[]) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const date = toIsoDate(dateKey);
  const tonic = await getDailyDiscipleshipTonic(userId, dateKey);
  const now = new Date().toISOString();
  const id = newId("diary");
  const fixedAnswer = answers.slice(0, 2).join("\n\n");
  const rotatingAnswers = JSON.stringify({
    thirdAnswer: answers[2] ?? "",
    tonicAnswer: answers[3] ?? "",
    tonic: { id: tonic.id, code: tonic.code, title: tonic.title, phaseTitle: tonic.phase.title, phaseObjective: tonic.phase.objective },
  });
  await db.prepare(`
    INSERT INTO "DiaryEntry" (id, userId, date, fixedAnswer, rotatingAnswers, createdTaskIds, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, '[]', ?, ?)
    ON CONFLICT(userId, date) DO UPDATE SET fixedAnswer = excluded.fixedAnswer, rotatingAnswers = excluded.rotatingAnswers, updatedAt = excluded.updatedAt
  `).bind(id, userId, date, fixedAnswer, rotatingAnswers, now, now).run();
  await ensureDefaultHabitTemplates(userId);
  const diaryHabit = await db.prepare('SELECT id, targetCount FROM "HabitTemplate" WHERE userId = ? AND title = ? AND isActive = 1 LIMIT 1')
    .bind(userId, "Escrever o Diário").first<{ id: string; targetCount: number }>();
  if (diaryHabit) {
    const existingLog = await db.prepare('SELECT id FROM "HabitLog" WHERE userId = ? AND habitId = ? AND date = ? LIMIT 1')
      .bind(userId, diaryHabit.id, dateKey).first<{ id: string }>();
    if (existingLog) {
      await db.prepare('UPDATE "HabitLog" SET count = ? WHERE id = ?').bind(Math.max(1, Number(diaryHabit.targetCount)), existingLog.id).run();
    } else {
      await db.prepare('INSERT INTO "HabitLog" (id, userId, habitId, date, count, minutes, note, createdAt) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)')
        .bind(newId("habitlog"), userId, diaryHabit.id, dateKey, Math.max(1, Number(diaryHabit.targetCount)), now).run();
    }
  }
  const saved = await db.prepare('SELECT id FROM "DiaryEntry" WHERE userId = ? AND date = ?').bind(userId, date).first<{ id: string }>();
  return { id: saved?.id ?? id };
}

export async function getDiaryEntry(userId: string, dateKey: string) {
  await ensureSenderoSeeded();
  const entry = await getSenderoDb().prepare(
    'SELECT * FROM "DiaryEntry" WHERE userId = ? AND substr(date, 1, 10) = ? LIMIT 1'
  ).bind(userId, dateKey).first<{ id: string; fixedAnswer: string; rotatingAnswers: string }>();
  if (!entry) return null;
  const rotating = parseJson<{ thirdAnswer?: string; tonicAnswer?: string }>(entry.rotatingAnswers, {});
  const fixed = entry.fixedAnswer.split("\n\n");
  return { id: entry.id, answers: [fixed[0] ?? "", fixed[1] ?? "", rotating.thirdAnswer ?? "", rotating.tonicAnswer ?? ""] };
}

export async function createHabitTemplate({ userId, title, cadence, targetCount, description, practiceGroup = "HABIT" }: {
  userId: string; title: string; cadence: "DAILY" | "WEEKLY" | "MONTHLY" | "TIME_BASED"; targetCount: number; description?: string; practiceGroup?: PracticeGroupCode;
}) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const categoryId = await ensureCategory(userId);
  await ensurePracticeGroups(userId);
  const id = newId("habit");
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO "HabitTemplate" (id, userId, title, description, categoryId, cadence, targetCount, targetValue, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)
  `).bind(id, userId, title, description || null, categoryId, cadence, targetCount, now, now).run();
  await db.prepare('INSERT INTO "HabitPracticeGroup" (habitId, groupId, createdAt, updatedAt) VALUES (?, ?, ?, ?)')
    .bind(id, practiceGroupId(userId, practiceGroup), now, now).run();
  return { id };
}

export async function getHabitDashboard(userId: string, dateKey = getSaoPauloDateKey()): Promise<HabitDashboard> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  await ensureDefaultHabitTemplates(userId);
  await ensurePracticeGroups(userId);

  const [templateResult, logResult, waterResult] = await Promise.all([
    db.prepare(`
      SELECT ht.*, c.name AS categoryName, pg.code AS practiceGroup
      FROM "HabitTemplate" ht
      JOIN "Category" c ON c.id = ht.categoryId
      LEFT JOIN "HabitPracticeGroup" hpg ON hpg.habitId = ht.id
      LEFT JOIN "PracticeGroup" pg ON pg.id = hpg.groupId
      WHERE ht.userId = ? AND ht.isActive = 1
      ORDER BY pg.sequence ASC, CASE ht.cadence WHEN 'DAILY' THEN 1 WHEN 'WEEKLY' THEN 2 ELSE 3 END, ht.createdAt ASC
    `).bind(userId).all<{ id: string; title: string; description: string | null; cadence: string; targetCount: number; categoryName: string; practiceGroup: PracticeGroupCode | null }>(),
    db.prepare('SELECT habitId, date, count, minutes, note FROM "HabitLog" WHERE userId = ? AND date <= ?')
      .bind(userId, dateKey).all<{ habitId: string; date: string; count: number; minutes: number | null; note: string | null }>(),
    db.prepare('SELECT COALESCE(SUM(amountMl), 0) AS total FROM "WaterLog" WHERE userId = ? AND date = ?')
      .bind(userId, dateKey).first<{ total: number }>(),
  ]);

  const habits = templateResult.results.map((template) => {
    const cadence = normalizeHabitCadence(template.cadence);
    const relevant = logResult.results.filter((log) =>
      log.habitId === template.id &&
      (cadence === "WEEKLY" ? isSameWeek(log.date.slice(0, 10), dateKey) : log.date.slice(0, 10) === dateKey)
    );
    const progress = cadence === "TIME_BASED"
      ? relevant.reduce((sum, log) => sum + Number(log.minutes ?? 0), 0)
      : relevant.reduce((sum, log) => sum + Number(log.count ?? 0), 0);
    const todayLog = logResult.results.find((log) => log.habitId === template.id && log.date.slice(0, 10) === dateKey);
    return {
      id: template.id,
      title: template.title,
      description: template.description ?? "",
      category: template.categoryName,
      cadence,
      targetCount: Math.max(1, Number(template.targetCount ?? 1)),
      progress,
      todayCount: Number(todayLog?.count ?? 0),
      note: todayLog?.note ?? "",
      practiceGroup: template.practiceGroup ?? "HABIT",
    };
  });

  return { dateKey, waterMl: Number(waterResult?.total ?? 0), waterGoalMl: 2500, habits };
}

export async function saveHabitProgress({ userId, habitId, dateKey, count, minutes, note }: {
  userId: string; habitId: string; dateKey: string; count: number; minutes?: number; note?: string;
}) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const existing = await db.prepare('SELECT id, note FROM "HabitLog" WHERE userId = ? AND habitId = ? AND date = ? LIMIT 1')
    .bind(userId, habitId, dateKey).first<{ id: string; note: string | null }>();
  const safeCount = Math.max(0, Math.round(count));
  const safeMinutes = Math.max(0, Math.round(minutes ?? 0));
  const savedNote = note?.trim() ?? existing?.note ?? "";

  if (existing && safeCount === 0 && safeMinutes === 0 && !savedNote) {
    await db.prepare('DELETE FROM "HabitLog" WHERE id = ?').bind(existing.id).run();
    return;
  }
  if (existing) {
    await db.prepare('UPDATE "HabitLog" SET count = ?, minutes = ?, note = ? WHERE id = ?')
      .bind(safeCount, safeMinutes || null, savedNote || null, existing.id).run();
    return;
  }
  if (safeCount === 0 && safeMinutes === 0 && !savedNote) return;
  await db.prepare('INSERT INTO "HabitLog" (id, userId, habitId, date, count, minutes, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId("habitlog"), userId, habitId, dateKey, safeCount, safeMinutes || null, savedNote || null, new Date().toISOString()).run();
}

export async function addWaterLog(userId: string, dateKey: string, amountMl: number) {
  await ensureSenderoSeeded();
  const amount = Math.max(0, Math.round(amountMl));
  if (!amount) return;
  await getSenderoDb().prepare('INSERT INTO "WaterLog" (id, userId, date, amountMl, createdAt) VALUES (?, ?, ?, ?, ?)')
    .bind(newId("water"), userId, dateKey, amount, new Date().toISOString()).run();
}

export async function updateHabitTemplate({ userId, habitId, title, description, cadence, targetCount, practiceGroup }: {
  userId: string; habitId: string; title: string; description?: string; cadence: "DAILY" | "WEEKLY" | "TIME_BASED"; targetCount: number; practiceGroup?: PracticeGroupCode;
}) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  await ensurePracticeGroups(userId);
  await db.prepare(`
    UPDATE "HabitTemplate" SET title = ?, description = ?, cadence = ?, targetCount = ?, updatedAt = ?
    WHERE id = ? AND userId = ? AND isActive = 1
  `).bind(title.trim(), description?.trim() || null, cadence, Math.max(1, Math.round(targetCount)), new Date().toISOString(), habitId, userId).run();
  if (practiceGroup) await db.prepare(`
    INSERT INTO "HabitPracticeGroup" (habitId, groupId, createdAt, updatedAt) VALUES (?, ?, ?, ?)
    ON CONFLICT(habitId) DO UPDATE SET groupId = excluded.groupId, updatedAt = excluded.updatedAt
  `).bind(habitId, practiceGroupId(userId, practiceGroup), new Date().toISOString(), new Date().toISOString()).run();
}

export async function archiveHabitTemplate(userId: string, habitId: string) {
  await ensureSenderoSeeded();
  await getSenderoDb().prepare('UPDATE "HabitTemplate" SET isActive = 0, updatedAt = ? WHERE id = ? AND userId = ?')
    .bind(new Date().toISOString(), habitId, userId).run();
}

function ensureDefaultHabitTemplates(userId: string) {
  return oncePerIsolate(`ensureDefaultHabitTemplates:${userId}`, () => seedDefaultHabitTemplates(userId));
}

async function seedDefaultHabitTemplates(userId: string) {
  const db = getSenderoDb();
  const categoryId = await ensureCategory(userId);
  const now = new Date().toISOString();
  const defaults = [
    ["hab_varrer", "Varrer por dentro", "Observar nós internos, impulsos e reações antes de agir.", "DAILY", 1],
    ["hab_ordenar", "Ordenar o ambiente", "Organizar pequenos pontos de desordem com atenção.", "DAILY", 1],
    ["hab_desejo", "Superar o desejo", "Perceber o impulso e escolher com consciência.", "DAILY", 1],
    ["hab_diario", "Escrever o Diário", "Registrar o dia com sinceridade e direção prática.", "DAILY", 1],
    ["hab_disc3x", "Eu Sou Discípulo", "Recordar conscientemente a direção interior ao longo do dia.", "DAILY", 3],
    ["week_templo", "Templo Interior", "Reservar um momento de aprofundamento interior.", "WEEKLY", 2],
    ["week_servico", "Serviço silencioso", "Oferecer algo útil sem buscar reconhecimento.", "WEEKLY", 3],
    ["time_reading", "Leitura e estudo", "Estudo atento ao longo da semana.", "TIME_BASED", 240],
    ["ed_memorizacao", "Memorização", "Exercício de memorização da Escola do Discipulado.", "DAILY", 1],
  ] as const;
  await db.batch(defaults.map(([id, title, description, cadence, targetCount]) => db.prepare(`
    INSERT OR IGNORE INTO "HabitTemplate" (id, userId, title, description, categoryId, cadence, targetCount, targetValue, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)
  `).bind(id, userId, title, description, categoryId, cadence, targetCount, now, now)));
}

function practiceGroupId(userId: string, code: PracticeGroupCode) {
  return `practice_group_${userId}_${code.toLowerCase()}`;
}

function ensurePracticeGroups(userId: string) {
  return oncePerIsolate(`ensurePracticeGroups:${userId}`, () => seedPracticeGroups(userId));
}

async function seedPracticeGroups(userId: string) {
  const db = getSenderoDb();
  const now = new Date().toISOString();
  const groups: Array<[PracticeGroupCode, string, number]> = [
    ["ED", "Práticas da ED", 1],
    ["PSYCHOLOGY", "Exercícios de psicologia", 2],
    ["HABIT", "Hábitos gerais", 3],
  ];
  await db.batch(groups.map(([code, label, sequence]) => db.prepare(`
    INSERT INTO "PracticeGroup" (id, userId, code, label, sequence, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(userId, code) DO UPDATE SET label = excluded.label, sequence = excluded.sequence, updatedAt = excluded.updatedAt
  `).bind(practiceGroupId(userId, code), userId, code, label, sequence, now, now)));

  const templates = await db.prepare('SELECT id, title FROM "HabitTemplate" WHERE userId = ?').bind(userId).all<{ id: string; title: string }>();
  const ed = new Set(["eu sou discípulo", "asanayoga", "tratak", "hathayoga", "hatha-yoga", "templo interior", "serviço silencioso", "memorização", "escrever o diário"]);
  const psychology = new Set(["varrer por dentro", "superar o desejo"]);
  const assignments = templates.results.map((template) => {
    const title = template.title.trim().toLocaleLowerCase("pt-BR");
    const code: PracticeGroupCode = ed.has(title) ? "ED" : psychology.has(title) ? "PSYCHOLOGY" : "HABIT";
    const isCanonical = ed.has(title) || psychology.has(title);
    return db.prepare(isCanonical
      ? 'INSERT INTO "HabitPracticeGroup" (habitId, groupId, createdAt, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(habitId) DO UPDATE SET groupId = excluded.groupId, updatedAt = excluded.updatedAt'
      : 'INSERT OR IGNORE INTO "HabitPracticeGroup" (habitId, groupId, createdAt, updatedAt) VALUES (?, ?, ?, ?)')
      .bind(template.id, practiceGroupId(userId, code), now, now);
  });
  if (assignments.length) await db.batch(assignments);
}

function normalizeHabitCadence(value: string): "DAILY" | "WEEKLY" | "TIME_BASED" {
  return value === "WEEKLY" ? "WEEKLY" : value === "TIME_BASED" ? "TIME_BASED" : "DAILY";
}

export async function createReflectionTemplate({ userId, topic, subtopic, orientation, period, cycleDays, startDate, endDate }: {
  userId: string; topic: string; subtopic?: string; orientation?: string; period: "MORNING" | "AFTERNOON" | "NIGHT";
  cycleDays: number[]; startDate?: string; endDate?: string;
}) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const categoryId = await ensureCategory(userId);
  const id = newId("template");
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO "ReflectionTemplate" (id, userId, topic, subtopic, description, insights, orientation, categoryId, cycleDays, period, isActive, isTemporary, startDate, endDate, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `).bind(
    id, userId, topic, subtopic || null, orientation || subtopic || topic, orientation || null, categoryId,
    JSON.stringify(cycleDays), period, endDate ? 1 : 0, startDate ? toIsoDate(startDate) : null,
    endDate ? toIsoDate(endDate) : null, now, now,
  ).run();
  return { id };
}

export async function updateReflectionTemplateSettings({ userId, templateId, cycleDays, period, endDate }: {
  userId: string; templateId: string; cycleDays: number[]; period?: "MORNING" | "AFTERNOON" | "NIGHT"; endDate?: string | null;
}) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const existing = await db.prepare('SELECT id, period FROM "ReflectionTemplate" WHERE id = ? AND userId = ? LIMIT 1')
    .bind(templateId, userId).first<{ id: string; period: string }>();
  if (!existing) return null;
  await db.prepare(`
    UPDATE "ReflectionTemplate" SET cycleDays = ?, period = ?, endDate = ?, isTemporary = ?, updatedAt = ? WHERE id = ? AND userId = ?
  `).bind(JSON.stringify(cycleDays), period ?? existing.period, endDate ? toIsoDate(endDate) : null, endDate ? 1 : 0, new Date().toISOString(), templateId, userId).run();
  return { id: templateId };
}

function ensureCategory(userId: string) {
  return oncePerIsolate(`ensureCategory:${userId}`, () => seedCategory(userId));
}

async function seedCategory(userId: string) {
  const db = getSenderoDb();
  const existing = await db.prepare('SELECT id FROM "Category" WHERE userId = ? AND name = ? LIMIT 1')
    .bind(userId, "Discipular").first<{ id: string }>();
  if (existing) return existing.id;
  const id = newId("category");
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO "Category" (id, userId, name, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, "Discipular", "#66704f", now, now).run();
  return id;
}

function toTopic(template: TemplateRow): DbReflectionTopic {
  return {
    id: template.id,
    templateId: template.id,
    topic: template.topic,
    subtopic: template.subtopic ?? "",
    orientation: template.orientation ?? template.description,
    category: template.categoryName ?? "Discipular",
    period: periodLabel(template.period),
    status: "pendente",
  };
}

async function loadReflectionMonthData(userId: string, monthKey: string): Promise<ReflectionMonthData> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const [templateResult, entryResult, postponementResult] = await Promise.all([
    db.prepare(`
      SELECT rt.*, c.name AS categoryName
      FROM "ReflectionTemplate" rt
      JOIN "Category" c ON c.id = rt.categoryId
      WHERE rt.userId = ? AND rt.isActive = 1
      ORDER BY CASE rt.period WHEN 'MORNING' THEN 1 WHEN 'AFTERNOON' THEN 2 ELSE 3 END, rt.topic ASC, rt.subtopic ASC
    `).bind(userId).all<TemplateRow>(),
    db.prepare('SELECT templateId, date FROM "ReflectionEntry" WHERE userId = ? AND substr(date, 1, 7) = ?')
      .bind(userId, monthKey).all<{ templateId: string; date: string }>(),
    db.prepare('SELECT templateId, originalDate FROM "ReflectionPostponement" WHERE userId = ? AND substr(originalDate, 1, 7) = ?')
      .bind(userId, monthKey).all<{ templateId: string; originalDate: string }>(),
  ]);

  return {
    templates: templateResult.results,
    entries: entryResult.results,
    postponements: postponementResult.results,
  };
}

function buildTopicsForWindow(monthData: ReflectionMonthData, window: ReflectionCycleWindow): DbReflectionTopic[] {
  const dateKeys = new Set(window.dateKeys);
  const entryByTemplate = new Map(
    monthData.entries
      .filter((entry) => dateKeys.has(entry.date.slice(0, 10)))
      .map((entry) => [entry.templateId, entry.date.slice(0, 10)]),
  );
  const postponedTemplates = new Set(
    monthData.postponements
      .filter((item) => dateKeys.has(item.originalDate.slice(0, 10)))
      .map((item) => item.templateId),
  );
  const firstDate = window.dateKeys[0];
  const lastDate = window.dateKeys.at(-1) ?? firstDate;

  return monthData.templates
    .filter((template) => !template.startDate || template.startDate.slice(0, 10) <= lastDate)
    .filter((template) => !template.endDate || template.endDate.slice(0, 10) >= firstDate)
    .filter((template) => parseNumberArray(template.cycleDays).some((day) => window.days.includes(day)))
    .filter((template) => !postponedTemplates.has(template.id))
    .map((template) => {
      const entryDate = entryByTemplate.get(template.id);
      return { ...toTopic(template), status: entryDate ? "feita" : "pendente", entryDate };
    });
}

function buildOverdueTopics(
  monthData: ReflectionMonthData,
  cycleAnchorDate: Date,
  monthKey: string,
  beforeCycleDay: number,
): OverdueReflectionTopic[] {
  const currentWindowStart = getTwoDayCycleWindow(beforeCycleDay)[0];
  const overdue: OverdueReflectionTopic[] = [];

  for (let day = 1; day < currentWindowStart; day += 2) {
    const window = getReflectionCycleWindow(cycleAnchorDate, day, monthKey);
    for (const topic of buildTopicsForWindow(monthData, window)) {
      if (topic.status !== "feita") {
        overdue.push({ ...topic, dueDate: window.dateKeys.at(-1) ?? window.dateKeys[0], cycleDay: day });
      }
    }
  }

  return overdue;
}

function getLocalCycleDay() {
  return normalizeCycleDay(getSaoPauloDayOfMonth());
}

function getMonthStartDate(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

function getTwoDayCycleWindow(cycleDay: number) {
  return cycleDay % 2 === 0 ? [cycleDay - 1, cycleDay] : [cycleDay, Math.min(30, cycleDay + 1)];
}

function normalizeCycleDay(cycleDay: number) {
  if (!Number.isFinite(cycleDay)) return 1;
  return Math.min(30, Math.max(1, Math.round(cycleDay)));
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(date.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function addDateKeyDays(dateKey: string, days: number) {
  const date = new Date(toIsoDate(dateKey));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetweenDateKeys(startDate: string, endDate: string) {
  const start = new Date(toIsoDate(startDate)).getTime();
  const end = new Date(toIsoDate(endDate)).getTime();
  return Math.round((end - start) / 86400000);
}

function recurrenceDates(startDate: string, recurrence: { frequency?: "daily" | "weekly" | "monthly"; weekdays?: number[] }) {
  if (!recurrence.frequency) return [startDate];
  const result = [startDate]; const cursor = new Date(`${startDate}T12:00:00.000Z`);
  const limit = new Date(cursor); limit.setUTCDate(limit.getUTCDate() + 180);
  while (cursor < limit) { cursor.setUTCDate(cursor.getUTCDate() + 1); const date = cursor.toISOString().slice(0, 10); const weekday = cursor.getUTCDay();
    if (recurrence.frequency === "daily" || (recurrence.frequency === "weekly" && (recurrence.weekdays?.length ? recurrence.weekdays.includes(weekday) : weekday === new Date(`${startDate}T12:00:00.000Z`).getUTCDay())) || (recurrence.frequency === "monthly" && cursor.getUTCDate() === Number(startDate.slice(-2)))) result.push(date);
  }
  return result;
}

function toIsoDate(dateKey: string) {
  return `${dateKey}T00:00:00.000Z`;
}

function toDateKeyOrNull(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function parseNumberArray(value: string | number[]) {
  if (Array.isArray(value)) return value;
  return parseJson<number[]>(value, []);
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function periodLabel(period: "MORNING" | "AFTERNOON" | "NIGHT") {
  return { MORNING: "Manhã", AFTERNOON: "Tarde", NIGHT: "Noite" }[period];
}
