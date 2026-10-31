"use client";

import { useSyncExternalStore } from "react";
import { Sun } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import { readScreenAwakeStatus, type ScreenAwakeStatus } from "@/lib/screen-awake";

const noSubscribe = () => () => undefined;
const readStatus = () => JSON.stringify(readScreenAwakeStatus());
const readIos = () => /OS (\d+)_(\d+)/.exec(navigator.userAgent)?.slice(1, 3).join(".") ?? "";

/** What the iPhone answered the last time the app asked to keep the screen on while writing. */
export function ScreenAwakeCard() {
  const status = JSON.parse(useSyncExternalStore(noSubscribe, readStatus, () => "null")) as ScreenAwakeStatus | null;
  const ios = useSyncExternalStore(noSubscribe, readIos, () => "");
  const old = ios !== "" && Number(ios.split(".")[0]) * 100 + Number(ios.split(".")[1]) < 1804;
  const when = status ? new Date(status.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  let detail = "Ainda sem registro neste celular. Toque num campo de texto e volte aqui.";
  if (status && !status.supported) detail = `Este celular não oferece a trava da tela (registro de ${when}).`;
  else if (status?.held) detail = `Funcionando: o iPhone aceitou manter a tela acesa em ${when}.`;
  else if (status) detail = `O iPhone recusou em ${when}${status.refused ? ` (${status.refused})` : ""}.`;

  return (
    <Card className="mt-4">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper text-moss"><Sun className="h-5 w-5" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Tela acesa ao escrever</p>
          <p className="mt-1 text-sm leading-6 text-ink/65">{detail}</p>
          {old ? <p className="mt-1 text-sm leading-6 text-ink/65">Este iPhone está no iOS {ios}. No app instalado, a trava só funciona a partir do iOS 18.4: Ajustes › Geral › Atualização de Software.</p> : null}
          <p className="mt-1 text-xs leading-5 text-ink/55">Com o Modo Pouca Energia ligado, o iPhone pode apagar mais cedo.</p>
        </div>
      </div>
    </Card>
  );
}
