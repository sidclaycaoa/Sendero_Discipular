import { ensureBookIndex } from "@/lib/book-index";
import { getSenderoDb } from "@/lib/db/bindings";

export { getSenderoDb };

let seedPromise: Promise<void> | null = null;
let schemaPromise: Promise<void> | null = null;
let referenceLibraryPromise: Promise<void> | null = null;

const runtimeSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, birthDate TEXT,
    mortemTargetAge INTEGER NOT NULL DEFAULT 60, cycleAnchorDate TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" (email)`,
  `CREATE TABLE IF NOT EXISTS "Category" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_name_key" ON "Category" (userId, name)`,
  `CREATE TABLE IF NOT EXISTS "ReflectionTemplate" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, topic TEXT NOT NULL, subtopic TEXT, description TEXT NOT NULL,
    insights TEXT, orientation TEXT, categoryId TEXT NOT NULL, cycleDays TEXT NOT NULL, period TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1, isTemporary INTEGER NOT NULL DEFAULT 0, startDate TEXT, endDate TEXT,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ReflectionEntry" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, templateId TEXT NOT NULL, date TEXT NOT NULL, cycleNumber INTEGER,
    cycleDay INTEGER NOT NULL, contentText TEXT NOT NULL, reflectionTimeSeconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DONE', originType TEXT NOT NULL DEFAULT 'MANUAL', originTaskId TEXT, linkedEntryId TEXT,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReflectionEntry_userId_templateId_date_key" ON "ReflectionEntry" (userId, templateId, date)`,
  `CREATE TABLE IF NOT EXISTS "ReflectionPostponement" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, templateId TEXT NOT NULL, originalDate TEXT NOT NULL,
    postponedToDate TEXT NOT NULL, reason TEXT, createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "DiaryEntry" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, date TEXT NOT NULL, fixedAnswer TEXT NOT NULL,
    rotatingAnswers TEXT NOT NULL, createdTaskIds TEXT NOT NULL DEFAULT '[]', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DiaryEntry_userId_date_key" ON "DiaryEntry" (userId, date)`,
  `CREATE TABLE IF NOT EXISTS "DiscipleshipPhase" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, sequence INTEGER NOT NULL, title TEXT NOT NULL,
    objective TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DiscipleshipPhase_userId_sequence_key" ON "DiscipleshipPhase" (userId, sequence)`,
  `CREATE TABLE IF NOT EXISTS "DiscipleshipTopic" (
    id TEXT PRIMARY KEY NOT NULL, phaseId TEXT NOT NULL, sequence INTEGER NOT NULL, title TEXT NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DiscipleshipTopic_phaseId_sequence_key" ON "DiscipleshipTopic" (phaseId, sequence)`,
  `CREATE TABLE IF NOT EXISTS "DiscipleshipCycle" (
    userId TEXT PRIMARY KEY NOT NULL, startedOn TEXT NOT NULL, startTopicId TEXT NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "DailyTonic" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, date TEXT NOT NULL, topicId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyTonic_userId_date_key" ON "DailyTonic" (userId, date)`,
  `CREATE INDEX IF NOT EXISTS "DailyTonic_userId_topicId_idx" ON "DailyTonic" (userId, topicId)`,
  `CREATE TABLE IF NOT EXISTS "DiscipleshipTopicGuidance" (
    id TEXT PRIMARY KEY NOT NULL, topicId TEXT NOT NULL, synthesis TEXT NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DiscipleshipTopicGuidance_topicId_key" ON "DiscipleshipTopicGuidance" (topicId)`,
  `CREATE TABLE IF NOT EXISTS "HabitTemplate" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, title TEXT NOT NULL, description TEXT, categoryId TEXT NOT NULL,
    cadence TEXT NOT NULL, targetCount INTEGER NOT NULL DEFAULT 1, targetValue INTEGER, isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "HabitLog" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, habitId TEXT NOT NULL, date TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1,
    minutes INTEGER, note TEXT, createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "PracticeGroup" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL,
    sequence INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PracticeGroup_userId_code_key" ON "PracticeGroup" (userId, code)`,
  `CREATE TABLE IF NOT EXISTS "HabitPracticeGroup" (
    habitId TEXT PRIMARY KEY NOT NULL, groupId TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "HabitPracticeGroup_groupId_idx" ON "HabitPracticeGroup" (groupId)`,
  `CREATE TABLE IF NOT EXISTS "TaskOccurrence" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, seriesId TEXT, title TEXT NOT NULL, description TEXT, dueDate TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 2, categoryId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PLANNED', completedAt TEXT,
    originType TEXT NOT NULL DEFAULT 'MANUAL', originReflectionTemplateId TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Event" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, title TEXT NOT NULL, startsAt TEXT NOT NULL,
    endsAt TEXT, location TEXT, description TEXT, categoryId TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "Event_userId_startsAt_idx" ON "Event" (userId, startsAt)`,
  `CREATE TABLE IF NOT EXISTS "WaterLog" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, date TEXT NOT NULL, amountMl INTEGER NOT NULL, createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ShoppingItem" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, title TEXT NOT NULL, isChecked INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "ShoppingItem_userId_checked_idx" ON "ShoppingItem" (userId, isChecked, createdAt)`,
  `CREATE TABLE IF NOT EXISTS "ReferenceWork" (
    id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, tradition TEXT NOT NULL, importedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ReferencePassage" (
    id TEXT PRIMARY KEY NOT NULL, workId TEXT NOT NULL, sequence INTEGER NOT NULL, location TEXT NOT NULL, contentText TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "ReferencePassage_workId_sequence_idx" ON "ReferencePassage" (workId, sequence)`,
  `CREATE TABLE IF NOT EXISTS "ReferencePassageSearch" (id TEXT PRIMARY KEY NOT NULL, workId TEXT NOT NULL, contentText TEXT NOT NULL)`,
];

export async function ensureSenderoSeeded() {
  if (!seedPromise) {
    seedPromise = seedFromBackup().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export async function ensureReferenceLibrary() {
  if (!referenceLibraryPromise) {
    referenceLibraryPromise = ensureBookIndex(getSenderoDb()).catch((error) => {
      referenceLibraryPromise = null;
      throw error;
    });
  }
  return referenceLibraryPromise;
}

async function seedFromBackup() {
  await ensureRuntimeSchema();
  const existing = await getSenderoDb().prepare('SELECT COUNT(*) AS count FROM "User"').first<{ count: number }>();
  if (!Number(existing?.count ?? 0)) throw new Error("Dados do Sendero ainda não migrados. Execute a importação privada antes de publicar.");
}

async function ensureRuntimeSchema() {
  if (!schemaPromise) {
    const db = getSenderoDb();
    schemaPromise = db.batch(runtimeSchemaStatements.map((statement) => db.prepare(statement))).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}


