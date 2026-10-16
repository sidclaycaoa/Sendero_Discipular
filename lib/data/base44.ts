export const base44Stats = {
  totalReflections: 249,
  topics: 13,
  latestDate: "2026-05-29",
  firstImportedDate: "2026-04-13",
  latestCycle: 2,
  latestCycleDay: 14
};

export const currentReflectionTopics = [
  {
    id: "topic_varrer",
    topic: "1 - VARRER POR DENTRO",
    subtopic: "Trabalhar os Nos",
    orientation: "Exame da personalidade; descobrir os nos; buscar causas e formulas de limpeza.",
    category: "Interior",
    period: "Manha",
    status: "pendente"
  },
  {
    id: "topic_trabalho",
    topic: "3/4 - TRABALHO ORDENADO E EFICAZ",
    subtopic: "Ordem e eficacia",
    orientation: "Ordene objetos de uso pessoal, ambiente, gavetas, roupas e compromissos.",
    category: "Disciplina",
    period: "Tarde",
    status: "pendente"
  },
  {
    id: "topic_energia",
    topic: "5 - ECONOMIA DE ENERGIA",
    subtopic: "Uso consciente da força",
    orientation: "Preservar energia, evitar dispersão e oferecer algo útil todos os meses.",
    category: "Disciplina",
    period: "Noite",
    status: "pendente"
  },
  {
    id: "topic_gula",
    topic: "6 - OS VÍCIOS: A GULA",
    subtopic: "Superação dos excessos",
    orientation: "Não comer até sentir-se cheio demais; decidir antes da compensação emocional.",
    category: "Temperanca",
    period: "Noite",
    status: "pendente"
  },
  {
    id: "topic_luxuria",
    topic: "6 - OS VÍCIOS: A LUXÚRIA",
    subtopic: "Olhar seres humanos, não corpos",
    orientation: "Controlar com a mente os impulsos instintivos e trabalhar o olhar consciente.",
    category: "Temperanca",
    period: "Tarde",
    status: "pendente"
  },
  {
    id: "topic_constancia",
    topic: "7 - PERSEVERANÇA E CONSTÂNCIA",
    subtopic: "Alimentar-se das dificuldades",
    orientation: "Transformar obstáculos em campo de desenvolvimento real.",
    category: "Virtudes",
    period: "Manhã",
    status: "pendente"
  }
];

export const recentReflectionEntries = [
  {
    date: "2026-05-29",
    topic: "6 - OS VÍCIOS: A GULA - DEVE SER SUPERADA",
    time: "1min 15s",
    excerpt: "A mentalidade na hora de comer tem que começar antes mesmo de servir a comida."
  },
  {
    date: "2026-05-28",
    topic: "3/4 - TRABALHO ORDENADO E EFICAZ",
    time: "0min 43s",
    excerpt: "Tenho buscado manter ordem e organização; isso tem feito pequena diferença."
  },
  {
    date: "2026-05-25",
    topic: "7 - DESENVOLVIMENTO DAS VIRTUDES: PERSEVERANÇA E CONSTÂNCIA",
    time: "2min 41s",
    excerpt: "Dificuldades são oportunidade de desenvolver o que preciso desenvolver."
  }
];

export const waterTracker = {
  title: "Água",
  currentMl: 0,
  goalMl: 2500,
  presets: [100, 200, 300, 500]
};

export const habitPeriods = [
  {
    id: "manha",
    label: "Manhã",
    icon: "☀",
    habits: [
      {
        id: "hab_varrer",
        title: "Varrer por dentro",
        description: "Observar nós internos, impulsos e reações antes de agir.",
        category: "Discipular",
        type: "single",
        done: false
      },
      {
        id: "hab_ordenar",
        title: "Ordenar o ambiente",
        description: "Organizar objetos de uso pessoal, gavetas, roupas, compromissos e pequenos pontos de desordem.",
        category: "Disciplina",
        type: "single",
        done: false
      }
    ]
  },
  {
    id: "noite",
    label: "Noite",
    icon: "☾",
    habits: [
      {
        id: "hab_desejo",
        title: "Superar o desejo",
        description: "Perceber o desejo surgindo, sustentar a decisão interior e não obedecer automaticamente ao impulso.",
        category: "Discipular",
        type: "single",
        done: false
      },
      {
        id: "hab_diario",
        title: "Escrever o Diário",
        description: "Registrar o dia com sinceridade e transformar percepções em direção prática.",
        category: "Discipular",
        type: "single",
        done: false
      }
    ]
  },
  {
    id: "qualquer",
    label: "Qualquer horário",
    icon: "⏰",
    habits: [
      {
        id: "hab_disc3x",
        title: "Eu Sou Discípulo 3x",
        description: "Recordar conscientemente a direção interior ao longo do dia.",
        category: "Discipular",
        type: "count",
        count: 0,
        target: 3
      }
    ]
  }
];

export const weeklyHabits = [
  {
    id: "week_templo",
    title: "Templo Interior",
    category: "Discipular",
    doneThisWeek: 0,
    target: 2
  },
  {
    id: "week_servico",
    title: "Serviço silencioso",
    category: "Serviço",
    doneThisWeek: 1,
    target: 3
  }
];

export const timedHabits = [
  {
    id: "time_reading",
    title: "Reading",
    category: "Estudo",
    minutes: 0,
    targetMinutes: 240
  }
];

export const taskBoard = [
  {
    title: "Ler BST 244 Uma pequena grande oferenda: A pequena militancia",
    group: "Atrasadas",
    priority: "Muito importante",
    origin: "Tarefa",
    date: "24/05/2026",
    proximity: "late"
  },
  {
    title: "Ler BST 98 Pequena Militancia",
    group: "Atrasadas",
    priority: "Muito importante",
    origin: "Tarefa",
    date: "24/05/2026",
    proximity: "late"
  },
  {
    title: "Preparar aula com exemplos vivos",
    group: "Hoje",
    priority: "Importante",
    origin: "Diário",
    date: "09/06/2026",
    proximity: "today"
  },
  {
    title: "Revisar compromisso da semana",
    group: "7 dias",
    priority: "Media",
    origin: "Manual",
    date: "13/06/2026",
    proximity: "week"
  }
];

export const eventBoard = [
  {
    title: "Aula / encontro discipular",
    group: "Hoje",
    date: "09/06/2026",
    time: "19:30",
    location: "Presencial",
    proximity: "today"
  },
  {
    title: "Reunião de pedagogos",
    group: "30 dias",
    date: "22/06/2026",
    time: "20:00",
    location: "Online",
    proximity: "month"
  }
];

export const diaryQuestions = [
  "O que aprendi sobre mim hoje?",
  "Que impulso eu consegui observar antes de obedecer?",
  "Qual pequena ação mostrou o caminho de hoje?"
];

export const reportRows = [
  { label: "Reflexões", planned: 18, done: 14 },
  { label: "Hábitos diários", planned: 21, done: 17 },
  { label: "Tarefas", planned: 9, done: 5 },
  { label: "Diário", planned: 7, done: 5 }
];

export const consistencyDays = [
  86, 64, 100, 72, 43, 91, 78, 0, 65, 88, 93, 55, 76, 82
];

export const categoryReport = [
  { label: "Interior", value: 82, color: "#66704f" },
  { label: "Disciplina", value: 67, color: "#b85d3b" },
  { label: "Servico", value: 54, color: "#4c6f7a" },
  { label: "Temperanca", value: 41, color: "#d49b32" }
];

export const journeyLevels = [
  { level: 1, name: "Despertar", unlocked: true },
  { level: 2, name: "Observacao", unlocked: true },
  { level: 3, name: "Pratica", unlocked: true },
  { level: 4, name: "Constancia", unlocked: false },
  { level: 5, name: "Dominio", unlocked: false },
  { level: 6, name: "Servico", unlocked: false },
  { level: 7, name: "Integracao", unlocked: false }
];
