/** Guided practice tools that a habit can open from Hábitos (stored in HabitTemplate.practiceTool). */

export type PracticeToolKey = "TRATAK" | "INTERVALOS" | "TEMPLO" | "CAMARA";

export type PracticeTool =
  | { key: "TRATAK"; label: string; kind: "tratak"; durationSec: number; hint: string }
  | { key: "INTERVALOS"; label: string; kind: "intervals"; durationSec: number; everySec: number; hint: string }
  | { key: "TEMPLO" | "CAMARA"; label: string; kind: "music"; audioSrc: string; trackName: string; spotifyUrl: string; hint: string };

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
};

export function practiceTool(value: unknown): PracticeTool | null {
  return typeof value === "string" && value in PRACTICE_TOOLS ? PRACTICE_TOOLS[value as PracticeToolKey] : null;
}

export function practiceToolKey(value: unknown): PracticeToolKey | null {
  return practiceTool(value)?.key ?? null;
}
