/** Jornada: the seven stages of the hero's journey, shared by the server and the screens. */

export type CycleField = "monster" | "master" | "abyss" | "elixir";

export const STAGES: Array<{ name: string; prompt: string; field?: CycleField; fieldLabel?: string }> = [
  { name: "O chamado", prompt: "O trabalho começou. Leia o mito e dê nome ao seu monstro: onde ele aparece na sua vida?", field: "monster", fieldLabel: "O meu monstro" },
  { name: "O mestre", prompt: "Que ensinamento você leva para este trabalho? Um Bastião, uma frase de um livro, um conselho recebido.", field: "master", fieldLabel: "O conselho que levo" },
  { name: "O limiar", prompt: "Atravessar o limiar é dar o primeiro passo concreto. Leve a pergunta do mês para o Diário." },
  { name: "As provas", prompt: "Os dias do confronto. As suas práticas da ED são as armas." },
  { name: "O abismo", prompt: "Toda travessia tem uma descida. Qual foi a sua queda neste mês, e como você voltou?", field: "abyss", fieldLabel: "A queda e a volta" },
  { name: "O elixir", prompt: "O que mudou em você com este trabalho?", field: "elixir", fieldLabel: "O que mudou em mim" },
  { name: "O retorno", prompt: "Feche o trabalho: ele foi cumprido, ou o monstro ainda vive e o trabalho volta no próximo mês?" },
];

export const FIELD_LABELS: Record<CycleField, string> = { monster: "O meu monstro", master: "O conselho que levo", abyss: "A queda e a volta", elixir: "O que mudou em mim" };

/** The stage of a cycle on a given day: the seven stages share the days from its start to the end of the month. */
export function stageOf(startDate: string, todayKey: string) {
  const month = startDate.slice(0, 7);
  if (todayKey.slice(0, 7) > month) return { index: STAGES.length - 1, day: 0, days: 0, ended: true };
  const first = Number(startDate.slice(8, 10));
  const last = daysInMonth(month);
  const days = last - first + 1;
  const day = Math.min(days, Math.max(1, Number(todayKey.slice(8, 10)) - first + 1));
  return { index: Math.min(STAGES.length - 1, Math.floor(((day - 1) * STAGES.length) / days)), day, days, ended: false };
}

export function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const ROMAN: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(value: number) {
  let rest = value;
  let text = "";
  for (const [size, letters] of ROMAN) while (rest >= size) { text += letters; rest -= size; }
  return text;
}
