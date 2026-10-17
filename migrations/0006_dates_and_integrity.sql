-- Date-only columns keep a plain YYYY-MM-DD key (older rows held "YYYY-MM-DDT00:00:00.000Z").
UPDATE "ReflectionEntry" SET date = substr(date, 1, 10) WHERE length(date) > 10;
UPDATE "DiaryEntry" SET date = substr(date, 1, 10) WHERE length(date) > 10;
UPDATE "ReflectionPostponement" SET originalDate = substr(originalDate, 1, 10), postponedToDate = substr(postponedToDate, 1, 10)
  WHERE length(originalDate) > 10 OR length(postponedToDate) > 10;
UPDATE "TaskOccurrence" SET dueDate = substr(dueDate, 1, 10) WHERE length(dueDate) > 10;
UPDATE "ShoppingItem" SET dueDate = substr(dueDate, 1, 10) WHERE length(dueDate) > 10;
UPDATE "ReflectionTemplate" SET startDate = substr(startDate, 1, 10) WHERE length(startDate) > 10;
UPDATE "ReflectionTemplate" SET endDate = substr(endDate, 1, 10) WHERE length(endDate) > 10;

-- One record per practice and day (the app already replaces the day's value in one transaction).
CREATE UNIQUE INDEX IF NOT EXISTS "HabitLog_userId_habitId_date_key" ON "HabitLog" (userId, habitId, date);
