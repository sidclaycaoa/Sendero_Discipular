-- When in the day a habit happens, so Hábitos can order the day, flag what is late and remind at the hour.
ALTER TABLE "HabitTemplate" ADD COLUMN dayPeriod TEXT;          -- MANHA | TARDE | NOITE; NULL = ao longo do dia
ALTER TABLE "HabitTemplate" ADD COLUMN scheduledTime TEXT;      -- HH:MM (America/Sao_Paulo), optional
ALTER TABLE "HabitTemplate" ADD COLUMN remind INTEGER NOT NULL DEFAULT 0;  -- 1 = phone reminder at scheduledTime
ALTER TABLE "HabitTemplate" ADD COLUMN lastRemindedDate TEXT;   -- YYYY-MM-DD of the last reminder sent
