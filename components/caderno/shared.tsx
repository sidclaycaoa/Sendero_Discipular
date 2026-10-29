"use client";

import { MARK_END, MARK_START } from "@/lib/caderno-shared";

/** Sends one Caderno action; answers the server's JSON or throws its message. */
export async function cadernoAction<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/caderno", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!response) throw new Error("Sem conexão. Confira a internet e tente de novo.");
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar agora.");
  return data;
}

/** A search snippet with the matching words highlighted. */
export function Snippet({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${MARK_START}[^${MARK_END}]*${MARK_END})`, "g"));
  return <>{parts.map((part, index) => part.startsWith(MARK_START) ? <mark key={index} className="rounded-sm bg-[#fbeeb8] px-0.5 font-semibold text-ink">{part.slice(1, -1)}</mark> : part)}</>;
}

/** Puts a text on the clipboard; where the app view refuses the clipboard, uses the older way. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const done = document.execCommand("copy");
    area.remove();
    return done;
  }
}
