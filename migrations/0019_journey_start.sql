-- Jornada: the day the first labor begins. Before it, the Jornada is a prologue to read;
-- the user chose to begin with a whole month, on 1 November 2026. NULL = begin on the first visit.
ALTER TABLE "User" ADD COLUMN journeyStart TEXT;   -- YYYY-MM-DD
UPDATE "User" SET journeyStart = '2026-11-01' WHERE journeyStart IS NULL;
