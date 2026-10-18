-- Memorização: a text is split into lines and learned one line at a time.
-- currentLine = how many lines are already known (0 = starting); totalLines follows the text.
ALTER TABLE "MemorizationItem" ADD COLUMN source TEXT;        -- where the text comes from (book, class, phase)
ALTER TABLE "MemorizationItem" ADD COLUMN archivedAt TEXT;    -- set when the text is removed from the list
CREATE INDEX IF NOT EXISTS "MemorizationItem_userId_idx" ON "MemorizationItem" (userId, updatedAt);
UPDATE "MemorizationItem" SET currentLine = 0 WHERE currentLine > totalLines;

-- The Memorização practice opens the module from Hábitos.
UPDATE "HabitTemplate" SET practiceTool = 'MEMORIZAR' WHERE id = 'ed_memorizacao' OR lower(trim(title)) IN ('memorização', 'memorizacao');
