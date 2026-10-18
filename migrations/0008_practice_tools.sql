-- A practice tool attached to a habit: TRATAK | INTERVALOS | TEMPLO | CAMARA (see lib/practice.ts).
ALTER TABLE "HabitTemplate" ADD COLUMN practiceTool TEXT;

-- Exercises that already exist get their tool.
UPDATE "HabitTemplate" SET practiceTool = 'TRATAK' WHERE lower(trim(title)) = 'tratak';
UPDATE "HabitTemplate" SET practiceTool = 'TEMPLO' WHERE lower(trim(title)) = 'templo interior';
UPDATE "HabitTemplate" SET practiceTool = 'CAMARA' WHERE lower(trim(title)) LIKE 'câmara de purifica%' OR lower(trim(title)) LIKE 'camara de purifica%';
UPDATE "HabitTemplate" SET practiceTool = 'INTERVALOS' WHERE lower(trim(title)) LIKE '%formas geom%';
