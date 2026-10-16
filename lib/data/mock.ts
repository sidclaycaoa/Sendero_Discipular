import type {
  Category,
  HabitLog,
  HabitTemplate,
  ReflectionEntry,
  ReflectionPostponement,
  ReflectionTemplate,
  TaskOccurrence
} from "@/lib/domain";

export const demoUser = {
  id: "user_demo",
  name: "Sidclay Mota",
  birthDate: "1994-01-21",
  mortemTargetAge: 60,
  cycleAnchorDate: "2026-06-01"
};

export const categories: Category[] = [
  { id: "cat_interior", name: "Interior", color: "#66704f" },
  { id: "cat_disciplina", name: "Disciplina", color: "#b85d3b" },
  { id: "cat_servico", name: "Serviço", color: "#4c6f7a" }
];

export const reflectionTemplates: ReflectionTemplate[] = [
  {
    id: "ref_observacao",
    userId: demoUser.id,
    topic: "Observação interior",
    subtopic: "Reatividade",
    description: "Perceber onde a pressa conduziu suas respostas.",
    insight: "Você não precisa obedecer toda urgência que aparece.",
    orientation: "Antes de responder hoje, respire e nomeie o impulso.",
    categoryId: "cat_interior",
    cycleDays: [7, 8, 9],
    period: "morning",
    isActive: true
  },
  {
    id: "ref_pratica",
    userId: demoUser.id,
    topic: "Ação consciente",
    subtopic: "Pequena fidelidade",
    description: "Transformar uma percepção em uma atitude concreta.",
    insight: "O caminho aprofunda quando uma ideia vira gesto.",
    orientation: "Escolha uma ação pequena, visível e possível para hoje.",
    categoryId: "cat_disciplina",
    cycleDays: [7, 9],
    period: "afternoon",
    isActive: true
  },
  {
    id: "ref_servico",
    userId: demoUser.id,
    topic: "Servico silencioso",
    subtopic: "Bem possível",
    description: "Enxergar uma oportunidade simples de servir.",
    insight: "Nem todo bem precisa ser anunciado para ser real.",
    orientation: "Procure uma ajuda discreta que você pode oferecer.",
    categoryId: "cat_servico",
    cycleDays: [7, 9],
    period: "night",
    isActive: true
  }
];

export const reflectionEntries: ReflectionEntry[] = [];

export const reflectionPostponements: ReflectionPostponement[] = [];

export const habitTemplates: HabitTemplate[] = [
  {
    id: "habit_agua",
    userId: demoUser.id,
    title: "Beber água com atenção",
    categoryId: "cat_disciplina",
    cadence: "daily",
    targetCount: 1,
    isActive: true
  },
  {
    id: "habit_estudo",
    userId: demoUser.id,
    title: "Estudo discipular profundo",
    categoryId: "cat_interior",
    cadence: "weekly",
    targetCount: 3,
    isActive: true
  }
];

export const habitLogs: HabitLog[] = [];

export const taskOccurrences: TaskOccurrence[] = [
  {
    id: "task_1",
    userId: demoUser.id,
    title: "Enviar mensagem de reconciliação",
    dueDate: "2026-06-07",
    categoryId: "cat_servico",
    originReflectionTemplateId: "ref_servico"
  },
  {
    id: "task_2",
    userId: demoUser.id,
    title: "Revisar compromisso da semana",
    dueDate: "2026-06-06",
    categoryId: "cat_disciplina"
  }
];
