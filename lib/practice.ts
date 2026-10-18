/** Guided practice tools that a habit can open from Hábitos (stored in HabitTemplate.practiceTool). */

export type PracticeToolKey = "TRATAK" | "INTERVALOS" | "TEMPLO" | "CAMARA" | "ASANA";
export type AsanaPose = { name: string; src: string };

export type PracticeTool =
  | { key: "TRATAK"; label: string; kind: "tratak"; durationSec: number; hint: string }
  | { key: "INTERVALOS"; label: string; kind: "intervals"; durationSec: number; everySec: number; hint: string }
  | { key: "TEMPLO" | "CAMARA"; label: string; kind: "music"; audioSrc: string; trackName: string; spotifyUrl: string; hint: string }
  | { key: "ASANA"; label: string; kind: "asana"; durationSec: number; poses: AsanaPose[]; cycleStart: string; hint: string };

export const PRACTICE_TOOLS: Record<PracticeToolKey, PracticeTool> = {
  TRATAK: {
    key: "TRATAK", label: "Tratak · círculo em tela cheia, 3 min", kind: "tratak", durationSec: 180,
    hint: "Deite o celular. O círculo ocupa a tela e o tempo corre sozinho; um som suave avisa o fim.",
  },
  INTERVALOS: {
    key: "INTERVALOS", label: "Formas geométricas · som a cada 30 s, 2 min", kind: "intervals", durationSec: 120, everySec: 30,
    hint: "Um som marca cada 30 segundos para você trocar a forma imaginada.",
  },
  TEMPLO: {
    key: "TEMPLO", label: "Música do Templo Interior", kind: "music",
    audioSrc: "/audio/templo-interior.mp3", trackName: "Bach · Concerto para cravo nº 1, BWV 1052",
    spotifyUrl: "https://open.spotify.com/album/48qaRUJRuWVAGrQIhPkwad",
    hint: "A música toca aqui no app e se repete até você parar.",
  },
  CAMARA: {
    key: "CAMARA", label: "Música da Câmara de Purificação", kind: "music",
    audioSrc: "/audio/camara-purificacao.mp3", trackName: "Bach · Air, Suíte orquestral nº 3, BWV 1068",
    spotifyUrl: "https://open.spotify.com/track/504wsV4Br1jy9xUvWzpAog",
    hint: "A música toca aqui no app e se repete até você parar.",
  },
  ASANA: {
    key: "ASANA", label: "Asana Yoga · uma posição por dia, 1 min", kind: "asana", durationSec: 60,
    poses: [
      { name: "Quadrado · Resistência física", src: "/asana/asana-1-quadrado.png" },
      { name: "Coluna · Esforço", src: "/asana/asana-2-coluna.png" },
      { name: "Cubo · Renovação", src: "/asana/asana-3-cubo.png" },
      { name: "Pentágono · Centro", src: "/asana/asana-4-pentagono.png" },
      { name: "Triângulo · Elevação", src: "/asana/asana-5-triangulo.png" },
      { name: "Ankh · Abertura e avanço", src: "/asana/asana-6-ankh.png" },
    ],
    cycleStart: "2026-10-18",
    hint: "Faça a posição do dia por 1 minuto, imaginando a forma e a cor. A cada 6 dias o ciclo recomeça.",
  },
};

/** The pose for a day (YYYY-MM-DD): the six poses follow in order from cycleStart, one per day. */
export function asanaOfDay(tool: Extract<PracticeTool, { kind: "asana" }>, dateKey: string) {
  const days = Math.round((Date.parse(`${dateKey}T12:00:00Z`) - Date.parse(`${tool.cycleStart}T12:00:00Z`)) / 86_400_000);
  const index = ((days % tool.poses.length) + tool.poses.length) % tool.poses.length;
  return { index, pose: tool.poses[index] };
}

export function practiceTool(value: unknown): PracticeTool | null {
  return typeof value === "string" && value in PRACTICE_TOOLS ? PRACTICE_TOOLS[value as PracticeToolKey] : null;
}

export function practiceToolKey(value: unknown): PracticeToolKey | null {
  return practiceTool(value)?.key ?? null;
}
