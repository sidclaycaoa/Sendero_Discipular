/** Leitura labels shared by the server and the screens. */

export type ReadingKind = "LIVRO" | "APOSTILA" | "TEXTO" | "AULA";
export type ReadingStatus = "LENDO" | "QUERO" | "PAUSADO" | "LIDO";
export const READING_KINDS: Record<ReadingKind, string> = { LIVRO: "Livro", APOSTILA: "Apostila", TEXTO: "Texto", AULA: "Leitura de aula" };
export const READING_STATUS: Record<ReadingStatus, string> = { LENDO: "Lendo", QUERO: "Quero ler", PAUSADO: "Pausado", LIDO: "Lido" };
