"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Card } from "@/components/app/AppShell";
import type { Reminder, ReminderKind } from "@/lib/db/lembretes";

type KindInfo = Record<ReminderKind, { label: string; detail: string }>;
type Status = "unsupported" | "needs-install" | "denied" | "off" | "on";

const noSubscribe = () => () => undefined;

function readSupport(): "ok" | "unsupported" | "needs-install" {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "ok";
  // iPhone only offers notifications to the app opened from the home screen.
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return iphone && !installed ? "needs-install" : "unsupported";
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Turns phone notifications on or off and sets the time of each daily reminder. */
export function RemindersPanel({ reminders: initial, kinds }: { reminders: Reminder[]; kinds: KindInfo }) {
  const support = useSyncExternalStore(noSubscribe, readSupport, () => "ok" as const);
  const permission = useSyncExternalStore(noSubscribe, () => ("Notification" in window ? Notification.permission : "default"), () => "default" as NotificationPermission);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [reminders, setReminders] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (support !== "ok") return;
    // Whether this phone is signed up lives in the browser, not in the database.
    void navigator.serviceWorker.getRegistration("/").then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setSubscribed(Boolean(subscription)))
      .catch(() => setSubscribed(false));
  }, [support]);

  const status: Status = support !== "ok" ? support : permission === "denied" ? "denied" : subscribed ? "on" : "off";

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      if (await Notification.requestPermission() !== "granted") { setMessage("As notificações foram recusadas neste celular."); return; }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/lembretes/inscricao")).json() as { publicKey: string };
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) });
      const response = await fetch("/api/lembretes/inscricao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      if (!response.ok) throw new Error();
      setSubscribed(true);
      setMessage("Pronto. Os lembretes vão chegar neste celular.");
    } catch {
      setMessage("Não foi possível ativar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/lembretes/inscricao", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Lembretes desligados neste celular.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const { sent } = await (await fetch("/api/lembretes", { method: "POST" })).json() as { sent: number };
      setMessage(sent ? "Teste enviado. Deve chegar em alguns segundos." : "Nenhum celular recebeu. Desligue e ative de novo.");
    } catch {
      setMessage("Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string, change: { time?: string; enabled?: boolean }) {
    setReminders((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));
    const response = await fetch("/api/lembretes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...change }) }).catch(() => null);
    if (!response?.ok) setMessage("Não foi possível salvar esse horário.");
  }

  return (
    <Card className="mt-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper text-moss">{status === "on" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Lembretes no celular</p>
          <p className="mt-1 text-sm leading-6 text-ink/65">Avisos discretos na tela de bloqueio, sem mostrar o conteúdo das suas reflexões.</p>
        </div>
      </div>

      {status === "needs-install" ? (
        <p className="mt-3 rounded-lg border border-clay/30 bg-clay/5 p-3 text-sm leading-6 text-ink/80">No iPhone, os lembretes só funcionam com o Sendero aberto pelo ícone da tela de início. No Safari, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong> e abra por lá.</p>
      ) : status === "unsupported" ? (
        <p className="mt-3 rounded-lg bg-paper p-3 text-sm leading-6 text-ink/75">Este navegador não aceita notificações.</p>
      ) : status === "denied" ? (
        <p className="mt-3 rounded-lg border border-clay/30 bg-clay/5 p-3 text-sm leading-6 text-ink/80">As notificações estão bloqueadas. No iPhone: <strong>Ajustes</strong> → <strong>Notificações</strong> → <strong>Sendero</strong> → ligue <strong>Permitir Notificações</strong>.</p>
      ) : status === "on" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={test} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-moss disabled:opacity-50"><Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar teste</button>
          <button type="button" disabled={busy} onClick={disable} className="inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold text-ink/55 disabled:opacity-50">Desligar neste celular</button>
        </div>
      ) : (
        <button type="button" disabled={busy || subscribed === null} onClick={enable} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-paper disabled:opacity-50"><Bell className="h-4 w-4" aria-hidden="true" /> Ativar lembretes neste celular</button>
      )}
      {message ? <p role="status" className="mt-2 text-sm text-ink/70">{message}</p> : null}

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {reminders.map((reminder) => (
          <li key={reminder.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${reminder.enabled ? "text-ink" : "text-ink/45"}`}>{kinds[reminder.kind].label}</p>
              <p className="mt-0.5 text-xs leading-5 text-ink/55">{kinds[reminder.kind].detail}</p>
            </div>
            <input type="time" aria-label={`Horário: ${kinds[reminder.kind].label}`} value={reminder.time} disabled={!reminder.enabled} onChange={(event) => event.target.value && save(reminder.id, { time: event.target.value })} className="min-h-10 w-[7.25rem] shrink-0 rounded-lg border border-line bg-paper px-2 text-sm tabular-nums disabled:opacity-45" />
            <button type="button" role="switch" aria-checked={reminder.enabled} aria-label={`Ligar ${kinds[reminder.kind].label}`} onClick={() => save(reminder.id, { enabled: !reminder.enabled })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${reminder.enabled ? "bg-moss" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${reminder.enabled ? "left-[1.4rem]" : "left-0.5"}`} />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-5 text-ink/50">Os horários seguem o fuso de São Paulo e podem chegar até 15 minutos depois.</p>
    </Card>
  );
}
