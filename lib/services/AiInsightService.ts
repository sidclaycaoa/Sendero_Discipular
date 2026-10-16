export type ReflectionInsightRequest = {
  userId: string;
  periodStart: string;
  periodEnd: string;
  reflectionTexts: string[];
};

export type ReflectionInsight = {
  synthesis: string;
  recurringThemes: string[];
  deepeningQuestions: string[];
  nextCycleDirection?: string;
};

export async function generateReflectionInsight(_request: ReflectionInsightRequest): Promise<ReflectionInsight> {
  throw new Error("AI insights are planned for a later phase and are intentionally disabled in V1.");
}
