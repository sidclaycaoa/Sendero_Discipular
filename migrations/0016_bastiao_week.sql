-- The Bastião is weekly (one official text per week); a class only sometimes assigns it.
ALTER TABLE "Bastiao" ADD COLUMN weekStart TEXT;   -- YYYY-MM-DD, Sunday of its week
UPDATE "Bastiao" SET weekStart = date(substr(createdAt, 1, 10), '-' || strftime('%w', substr(createdAt, 1, 10)) || ' days') WHERE weekStart IS NULL;
CREATE INDEX IF NOT EXISTS "Bastiao_userId_week_idx" ON "Bastiao" (userId, weekStart);
