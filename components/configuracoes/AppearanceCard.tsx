"use client";

import { useState, useSyncExternalStore } from "react";
import { Moon } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import { readThemeChoice, THEMES, type ThemeChoice } from "@/lib/theme";

const noSubscribe = () => () => undefined;

/** Claro, Escuro or Automático (follows the iPhone); the choice stays on this phone. */
export function AppearanceCard() {
  const saved = useSyncExternalStore(noSubscribe, () => readThemeChoice(document.cookie), () => "claro" as ThemeChoice);
  const [picked, setPicked] = useState<ThemeChoice | null>(null);
  const current = picked ?? saved;

  function choose(value: ThemeChoice) {
    setPicked(value);
    (window as unknown as { senderoTema?: (choice: string) => void }).senderoTema?.(value);
  }

  return (
    <Card className="mt-4">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper text-moss"><Moon className="h-5 w-5" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Aparência</p>
          <p className="mt-1 text-sm leading-6 text-ink/65">Claro, escuro ou igual ao iPhone. Fica guardado neste celular.</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Aparência" className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-paper p-1">
        {THEMES.map((theme) => (
          <button key={theme.value} type="button" role="radio" aria-checked={current === theme.value} onClick={() => choose(theme.value)}
            className={`min-h-10 rounded-full text-sm font-semibold ${current === theme.value ? "bg-ink text-paper" : "text-ink/65"}`}>{theme.label}</button>
        ))}
      </div>
      {current === "auto" ? <p className="mt-2 text-xs leading-5 text-ink/55">Segue o iPhone: escurece quando ele escurece (Ajustes › Tela e Brilho).</p> : null}
    </Card>
  );
}
