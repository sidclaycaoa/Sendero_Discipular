-- Daily water goal from body weight (ml per kg), or a fixed goal typed by hand.
ALTER TABLE "User" ADD COLUMN weightKg REAL;
ALTER TABLE "User" ADD COLUMN waterMlPerKg INTEGER;   -- NULL = 35 ml/kg
ALTER TABLE "User" ADD COLUMN waterGoalMl INTEGER;    -- set = fixed goal, ignores weight
