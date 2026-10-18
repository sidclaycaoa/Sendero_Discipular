-- Bugs and improvement ideas reported from inside the app, kept as pending items until resolved.
CREATE TABLE IF NOT EXISTS "AppFeedback" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  kind TEXT NOT NULL,              -- BUG | MELHORIA
  description TEXT NOT NULL,
  page TEXT,                        -- screen where it was reported
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | DONE
  resolution TEXT,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT
);
CREATE INDEX IF NOT EXISTS "AppFeedback_userId_status_idx" ON "AppFeedback" (userId, status, createdAt);

-- Questions to take to the master, with a snapshot of the context they came from.
CREATE TABLE IF NOT EXISTS "MasterQuestion" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  sourceType TEXT NOT NULL,         -- REFLEXAO | DIARIO | LIVRE
  sourceId TEXT,                    -- reflection template id, when it came from a reflection
  sourceDate TEXT,                  -- YYYY-MM-DD of the reflection or diary
  contextTitle TEXT,                -- theme / question being reflected on
  contextDetail TEXT,               -- subtopic or orientation
  contextText TEXT,                 -- what had been written at that moment
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | ANSWERED
  answer TEXT,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT
);
CREATE INDEX IF NOT EXISTS "MasterQuestion_userId_status_idx" ON "MasterQuestion" (userId, status, createdAt);
