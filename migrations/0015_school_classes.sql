-- Escola: each class brings one or two Bastiões to read and practices to live until the next class.
-- What is lived and noted comes back to the next class as points and reflections.
CREATE TABLE IF NOT EXISTS "SchoolClass" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  date TEXT NOT NULL,                -- YYYY-MM-DD of the class
  title TEXT,                        -- theme or number of the class
  notes TEXT,                        -- what was said in class
  closing TEXT,                      -- what to bring to the next class (free text)
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "SchoolClass_userId_date_idx" ON "SchoolClass" (userId, date);

-- A Bastião: the masters' official text, by number and name.
CREATE TABLE IF NOT EXISTS "Bastiao" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  classId TEXT,                      -- the class that assigned it
  number INTEGER,
  name TEXT NOT NULL,
  readAt TEXT,
  notes TEXT,                        -- reading notes
  reflection TEXT,                   -- what it changed, written at the end
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Bastiao_userId_idx" ON "Bastiao" (userId, number);
CREATE INDEX IF NOT EXISTS "Bastiao_classId_idx" ON "Bastiao" (classId);

-- Key ideas of a Bastião; up to three can be chosen to live every day until the next class.
CREATE TABLE IF NOT EXISTS "BastiaoIdea" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  bastiaoId TEXT NOT NULL,
  text TEXT NOT NULL,
  live INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "BastiaoIdea_bastiaoId_idx" ON "BastiaoIdea" (bastiaoId, position);

-- One row per day an idea was lived.
CREATE TABLE IF NOT EXISTS "IdeaLog" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  ideaId TEXT NOT NULL,
  date TEXT NOT NULL                 -- YYYY-MM-DD
);
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaLog_ideaId_date_key" ON "IdeaLog" (ideaId, date);

-- Practices a class asked for: an existing habit (Diário, Tratak…) or a new exercise, with the points to bring back.
CREATE TABLE IF NOT EXISTS "ClassPractice" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  classId TEXT NOT NULL,
  habitId TEXT,                      -- the habit in Hábitos, when it is one
  title TEXT NOT NULL,
  points TEXT,                       -- how it went: points and reflections
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "ClassPractice_classId_idx" ON "ClassPractice" (classId);
