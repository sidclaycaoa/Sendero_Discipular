import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("User", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  birthDate: text("birthDate"),
  mortemTargetAge: integer("mortemTargetAge").notNull().default(60),
  cycleAnchorDate: text("cycleAnchorDate").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [uniqueIndex("User_email_key").on(table.email)]);

export const categories = sqliteTable("Category", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [
  uniqueIndex("Category_userId_name_key").on(table.userId, table.name),
  index("Category_userId_idx").on(table.userId),
]);

export const reflectionTemplates = sqliteTable("ReflectionTemplate", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  topic: text("topic").notNull(),
  subtopic: text("subtopic"),
  description: text("description").notNull(),
  insights: text("insights"),
  orientation: text("orientation"),
  categoryId: text("categoryId").notNull(),
  cycleDays: text("cycleDays").notNull(),
  period: text("period").notNull(),
  isActive: integer("isActive").notNull().default(1),
  isTemporary: integer("isTemporary").notNull().default(0),
  startDate: text("startDate"),
  endDate: text("endDate"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [index("ReflectionTemplate_userId_categoryId_idx").on(table.userId, table.categoryId)]);

export const reflectionEntries = sqliteTable("ReflectionEntry", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  templateId: text("templateId").notNull(),
  date: text("date").notNull(),
  cycleNumber: integer("cycleNumber"),
  cycleDay: integer("cycleDay").notNull(),
  contentText: text("contentText").notNull(),
  reflectionTimeSeconds: integer("reflectionTimeSeconds").notNull().default(0),
  status: text("status").notNull().default("DONE"),
  originType: text("originType").notNull().default("MANUAL"),
  originTaskId: text("originTaskId"),
  linkedEntryId: text("linkedEntryId"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [
  uniqueIndex("ReflectionEntry_userId_templateId_date_key").on(table.userId, table.templateId, table.date),
  index("ReflectionEntry_userId_date_idx").on(table.userId, table.date),
]);

export const reflectionPostponements = sqliteTable("ReflectionPostponement", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  templateId: text("templateId").notNull(),
  originalDate: text("originalDate").notNull(),
  postponedToDate: text("postponedToDate").notNull(),
  reason: text("reason"),
  createdAt: text("createdAt").notNull(),
}, (table) => [
  index("ReflectionPostponement_userId_originalDate_idx").on(table.userId, table.originalDate),
  index("ReflectionPostponement_userId_postponedToDate_idx").on(table.userId, table.postponedToDate),
]);

export const diaryEntries = sqliteTable("DiaryEntry", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  date: text("date").notNull(),
  fixedAnswer: text("fixedAnswer").notNull(),
  rotatingAnswers: text("rotatingAnswers").notNull(),
  createdTaskIds: text("createdTaskIds").notNull().default("[]"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [uniqueIndex("DiaryEntry_userId_date_key").on(table.userId, table.date)]);

export const diaryQuestions = sqliteTable("DiaryQuestion", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), prompt: text("prompt").notNull(),
  isActive: integer("isActive").notNull().default(1), createdAt: text("createdAt").notNull(),
});

export const habitTemplates = sqliteTable("HabitTemplate", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), title: text("title").notNull(),
  description: text("description"), categoryId: text("categoryId").notNull(), cadence: text("cadence").notNull(),
  targetCount: integer("targetCount").notNull().default(1), targetValue: integer("targetValue"),
  isActive: integer("isActive").notNull().default(1), createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
}, (table) => [index("HabitTemplate_userId_categoryId_idx").on(table.userId, table.categoryId)]);

export const habitLogs = sqliteTable("HabitLog", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), habitId: text("habitId").notNull(),
  date: text("date").notNull(), count: integer("count").notNull().default(1), minutes: integer("minutes"),
  note: text("note"), createdAt: text("createdAt").notNull(),
}, (table) => [index("HabitLog_userId_date_idx").on(table.userId, table.date), index("HabitLog_habitId_date_idx").on(table.habitId, table.date)]);

export const taskSeries = sqliteTable("TaskSeries", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), title: text("title").notNull(),
  recurrence: text("recurrence"), createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
});

export const taskOccurrences = sqliteTable("TaskOccurrence", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), seriesId: text("seriesId"), title: text("title").notNull(),
  description: text("description"), dueDate: text("dueDate").notNull(), priority: integer("priority").notNull().default(2),
  categoryId: text("categoryId").notNull(), status: text("status").notNull().default("PLANNED"), completedAt: text("completedAt"),
  originType: text("originType").notNull().default("MANUAL"), originReflectionTemplateId: text("originReflectionTemplateId"),
  createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
}, (table) => [index("TaskOccurrence_userId_dueDate_idx").on(table.userId, table.dueDate), index("TaskOccurrence_userId_status_idx").on(table.userId, table.status)]);

export const events = sqliteTable("Event", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), title: text("title").notNull(), startsAt: text("startsAt").notNull(),
  endsAt: text("endsAt"), location: text("location"), description: text("description"), categoryId: text("categoryId"),
  createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
}, (table) => [index("Event_userId_startsAt_idx").on(table.userId, table.startsAt)]);

export const waterLogs = sqliteTable("WaterLog", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), date: text("date").notNull(), amountMl: integer("amountMl").notNull(), createdAt: text("createdAt").notNull(),
}, (table) => [index("WaterLog_userId_date_idx").on(table.userId, table.date)]);

export const shoppingItems = sqliteTable("ShoppingItem", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), title: text("title").notNull(),
  dueDate: text("dueDate"), isChecked: integer("isChecked").notNull().default(0), createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
}, (table) => [index("ShoppingItem_userId_checked_dueDate_idx").on(table.userId, table.isChecked, table.dueDate)]);

export const memorizationItems = sqliteTable("MemorizationItem", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), title: text("title").notNull(), contentText: text("contentText").notNull(),
  currentLine: integer("currentLine").notNull().default(1), totalLines: integer("totalLines").notNull().default(1),
  createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
});

export const memorizationProgressLogs = sqliteTable("MemorizationProgressLog", {
  id: text("id").primaryKey(), itemId: text("itemId").notNull(), date: text("date").notNull(), line: integer("line").notNull(),
  note: text("note"), createdAt: text("createdAt").notNull(),
}, (table) => [index("MemorizationProgressLog_itemId_date_idx").on(table.itemId, table.date)]);

export const journeyStates = sqliteTable("JourneyState", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), karma: integer("karma").notNull().default(0),
  level: integer("level").notNull().default(1), sublevel: integer("sublevel").notNull().default(1), streak: integer("streak").notNull().default(0),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [uniqueIndex("JourneyState_userId_key").on(table.userId)]);

export const philosophicalQuotes = sqliteTable("PhilosophicalQuote", {
  id: text("id").primaryKey(), userId: text("userId"), text: text("text").notNull(), author: text("author"),
  isActive: integer("isActive").notNull().default(1), createdAt: text("createdAt").notNull(),
});

export const exportLogs = sqliteTable("ExportLog", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), format: text("format").notNull(), scope: text("scope").notNull(), createdAt: text("createdAt").notNull(),
});

// Complementary AD records: never share the daily unique key of Diary/ReflectionEntry.
export const approvedPassages = sqliteTable("ApprovedPassage", {
  id: text("id").primaryKey(), userId: text("userId").notNull(),
  sourcePassageId: text("sourcePassageId"), workId: text("workId").notNull(),
  author: text("author").notNull(), work: text("work").notNull(),
  edition: text("edition").notNull(), location: text("location").notNull(),
  excerpt: text("excerpt").notNull(), themes: text("themes").notNull(),
  approvedAt: text("approvedAt").notNull(), confirmation: text("confirmation").notNull(),
}, (t) => [index("ApprovedPassage_userId_idx").on(t.userId)]);

export const adProposals = sqliteTable("ADProposal", {
  id: text("id").primaryKey(), userId: text("userId").notNull(),
  date: text("date").notNull(), theme: text("theme").notNull(), summary: text("summary").notNull(),
  context: text("context").notNull(), openQuestion: text("openQuestion").notNull(),
  practice: text("practice").notNull(), references: text("references").notNull(),
  sourceStatus: text("sourceStatus").notNull(), createdAt: text("createdAt").notNull(),
  dismissedAt: text("dismissedAt"),
}, (t) => [index("ADProposal_userId_idx").on(t.userId)]);

export const adReflections = sqliteTable("ADReflection", {
  id: text("id").primaryKey(), userId: text("userId").notNull(), proposalId: text("proposalId").notNull(),
  date: text("date").notNull(), theme: text("theme").notNull(), summary: text("summary").notNull(),
  context: text("context").notNull(), openQuestion: text("openQuestion").notNull(), practice: text("practice").notNull(),
  references: text("references").notNull(), sourceStatus: text("sourceStatus").notNull(),
  origin: text("origin").notNull().default("AD / conversa"),
  confirmedAt: text("confirmedAt").notNull(), confirmation: text("confirmation").notNull(),
}, (t) => [uniqueIndex("ADReflection_proposalId_key").on(t.proposalId), index("ADReflection_userId_date_idx").on(t.userId, t.date)]);

export const indexedWorks = sqliteTable("IndexedWork", {
  id: text("id").primaryKey(), title: text("title").notNull(), author: text("author").notNull(),
  edition: text("edition").notNull(), editionNote: text("editionNote").notNull(),
  sourceFile: text("sourceFile").notNull(), sourceUrl: text("sourceUrl").notNull(), sourceType: text("sourceType").notNull(),
  sourceHash: text("sourceHash").notNull(), revision: text("revision").notNull(), status: text("status").notNull(),
  unitCount: integer("unitCount").notNull(), passageCount: integer("passageCount").notNull(), characterCount: integer("characterCount").notNull(),
  indexedAt: text("indexedAt").notNull(),
});
export const indexedUnits = sqliteTable("IndexedUnit", {
  id: text("id").primaryKey(), workId: text("workId").notNull(), revision: text("revision").notNull(),
  number: integer("number").notNull(), page: integer("page"), section: text("section"), location: text("location").notNull(),
  text: text("text").notNull(), textHash: text("textHash").notNull(),
}, t => [index("IndexedUnit_workId_revision_idx").on(t.workId, t.revision)]);
export const indexedPassages = sqliteTable("IndexedPassage", {
  id: text("id").primaryKey(), workId: text("workId").notNull(), revision: text("revision").notNull(), unitId: text("unitId").notNull(),
  sequence: integer("sequence").notNull(), startOffset: integer("startOffset").notNull(), endOffset: integer("endOffset").notNull(),
  page: integer("page"), section: text("section"), location: text("location").notNull(),
  text: text("text").notNull(), textHash: text("textHash").notNull(),
}, t => [index("IndexedPassage_workId_revision_idx").on(t.workId, t.revision)]);
