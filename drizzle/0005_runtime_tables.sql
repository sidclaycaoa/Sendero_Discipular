CREATE TABLE IF NOT EXISTS "DiscipleshipPhase" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, sequence INTEGER NOT NULL, title TEXT NOT NULL,
    objective TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "DiscipleshipPhase_userId_sequence_key" ON "DiscipleshipPhase" (userId, sequence)--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DiscipleshipTopic" (
    id TEXT PRIMARY KEY NOT NULL, phaseId TEXT NOT NULL, sequence INTEGER NOT NULL, title TEXT NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "DiscipleshipTopic_phaseId_sequence_key" ON "DiscipleshipTopic" (phaseId, sequence)--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DiscipleshipCycle" (
    userId TEXT PRIMARY KEY NOT NULL, startedOn TEXT NOT NULL, startTopicId TEXT NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DailyTonic" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, date TEXT NOT NULL, topicId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "DailyTonic_userId_date_key" ON "DailyTonic" (userId, date)--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DailyTonic_userId_topicId_idx" ON "DailyTonic" (userId, topicId)--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DiscipleshipTopicGuidance" (
    id TEXT PRIMARY KEY NOT NULL, topicId TEXT NOT NULL, synthesis TEXT NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "DiscipleshipTopicGuidance_topicId_key" ON "DiscipleshipTopicGuidance" (topicId)--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PracticeGroup" (
    id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL,
    sequence INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PracticeGroup_userId_code_key" ON "PracticeGroup" (userId, code)--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "HabitPracticeGroup" (
    habitId TEXT PRIMARY KEY NOT NULL, groupId TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "HabitPracticeGroup_groupId_idx" ON "HabitPracticeGroup" (groupId)--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReferenceWork" (
    id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, tradition TEXT NOT NULL, importedAt TEXT NOT NULL
  )--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReferencePassage" (
    id TEXT PRIMARY KEY NOT NULL, workId TEXT NOT NULL, sequence INTEGER NOT NULL, location TEXT NOT NULL, contentText TEXT NOT NULL
  )--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReferencePassage_workId_sequence_idx" ON "ReferencePassage" (workId, sequence)--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReferencePassageSearch" (id TEXT PRIMARY KEY NOT NULL, workId TEXT NOT NULL, contentText TEXT NOT NULL)
