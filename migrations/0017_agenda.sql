-- Agenda: a task may have an hour (it then sits on the day's timeline and can remind on the phone).
ALTER TABLE "TaskOccurrence" ADD COLUMN dueTime TEXT;   -- HH:MM, America/Sao_Paulo; NULL = any time that day

-- Tasks born from a reflection stored a full timestamp in dueDate; keep only the day.
UPDATE "TaskOccurrence" SET dueDate = substr(dueDate, 1, 10) WHERE length(dueDate) > 10;

-- Phone notices already sent for tasks and events, so each goes out once.
CREATE TABLE IF NOT EXISTS "AgendaNotice" (
  key TEXT PRIMARY KEY NOT NULL,      -- TASK:<id> or EVENT:<id>
  userId TEXT NOT NULL,
  sentAt TEXT NOT NULL
);
