-- Leitura: books, course handouts, texts and readings asked in class, with progress, sessions and marked passages.
CREATE TABLE IF NOT EXISTS "ReadingItem" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  kind TEXT NOT NULL,                -- LIVRO | APOSTILA | TEXTO | AULA
  title TEXT NOT NULL,
  author TEXT,
  totalPages INTEGER,                -- NULL = progress in percent (texts without pages)
  currentPage INTEGER NOT NULL DEFAULT 0,   -- page reached, or percent when totalPages is NULL
  status TEXT NOT NULL DEFAULT 'LENDO',     -- LENDO | QUERO | PAUSADO | LIDO
  dueDate TEXT,                      -- YYYY-MM-DD, readings asked in class
  note TEXT,
  startedAt TEXT,
  finishedAt TEXT,
  archivedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "ReadingItem_userId_status_idx" ON "ReadingItem" (userId, status, updatedAt);

-- One reading moment: minutes and where it stopped.
CREATE TABLE IF NOT EXISTS "ReadingSession" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  itemId TEXT NOT NULL,
  date TEXT NOT NULL,                -- YYYY-MM-DD
  minutes INTEGER NOT NULL DEFAULT 0,
  fromPage INTEGER,
  toPage INTEGER,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "ReadingSession_userId_date_idx" ON "ReadingSession" (userId, date);
CREATE INDEX IF NOT EXISTS "ReadingSession_itemId_idx" ON "ReadingSession" (itemId, date);

-- Passages marked while reading.
CREATE TABLE IF NOT EXISTS "ReadingQuote" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  itemId TEXT NOT NULL,
  text TEXT NOT NULL,
  page TEXT,                         -- page or location as written ("118", "cap. 3")
  note TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "ReadingQuote_itemId_idx" ON "ReadingQuote" (itemId, createdAt);

-- Bastião: the masters' official text of the week, read on its own site.
CREATE TABLE IF NOT EXISTS "BastiaoWeek" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  weekStart TEXT NOT NULL,           -- YYYY-MM-DD, Sunday
  title TEXT,
  readAt TEXT,
  notes TEXT,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "BastiaoWeek_userId_weekStart_key" ON "BastiaoWeek" (userId, weekStart);
ALTER TABLE "User" ADD COLUMN bastiaoUrl TEXT;

-- The weekly reading habit opens the module, and reading time counts towards it.
UPDATE "HabitTemplate" SET practiceTool = 'LEITURA' WHERE id = 'time_reading' OR (cadence = 'TIME_BASED' AND lower(trim(title)) LIKE 'leitura%');
