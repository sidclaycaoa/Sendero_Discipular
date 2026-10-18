-- The daily Asana Yoga gets its practice tool: one pose image per day, 1 minute (see lib/practice.ts).
UPDATE "HabitTemplate" SET practiceTool = 'ASANA' WHERE replace(lower(trim(title)), ' ', '') = 'asanayoga';
