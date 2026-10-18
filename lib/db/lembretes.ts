import { getSaoPauloDateKey } from "@/lib/date";
import { ensureSenderoSeeded, getSenderoDb } from "@/lib/db/d1";
import { getActiveUser, getDiaryEntry, getHabitDashboard, getTodayReflectionTopics } from "@/lib/db/sendero";
import { practiceHref } from "@/lib/practice";
import { generateVapidKeys, sendPush, type VapidKeys } from "@/lib/push";

/** Daily phone reminders. Each one is sent only while something of its kind is still pending today. */

export type ReminderKind = "REFLEXAO" | "PRATICAS" | "DIARIO";
export type Reminder = { id: string; kind: ReminderKind; time: string; enabled: boolean; lastSentDate: string | null };

export const REMINDER_KINDS: Record<ReminderKind, { label: string; detail: string; defaultTime: string; url: string }> = {
  REFLEXAO: { label: "Reflexões do dia", detail: "Só avisa se ainda houver reflexão de hoje por fazer.", defaultTime: "07:00", url: "/refletir" },
  PRATICAS: { label: "Práticas diárias", detail: "Só avisa se faltar alguma prática diária.", defaultTime: "18:00", url: "/habitos" },
  DIARIO: { label: "Diário", detail: "Só avisa se o Diário de hoje estiver em branco.", defaultTime: "21:30", url: "/diario" },
};

// A reminder missed by more than this (e.g. a skipped cron run) is dropped instead of arriving late.
const LATE_LIMIT_MIN = 45;

const isKind = (value: unknown): value is ReminderKind => typeof value === "string" && value in REMINDER_KINDS;
const isTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export async function getVapidKeys(): Promise<VapidKeys> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  let row = await db.prepare('SELECT publicKey, privateJwk FROM "PushKey" WHERE id = \'vapid\'').first<{ publicKey: string; privateJwk: string }>();
  if (!row) {
    const keys = await generateVapidKeys();
    // Two first requests at once keep whichever key was stored first.
    await db.prepare('INSERT OR IGNORE INTO "PushKey" (id, publicKey, privateJwk, createdAt) VALUES (\'vapid\', ?, ?, ?)')
      .bind(keys.publicKey, JSON.stringify(keys.privateJwk), new Date().toISOString()).run();
    row = await db.prepare('SELECT publicKey, privateJwk FROM "PushKey" WHERE id = \'vapid\'').first<{ publicKey: string; privateJwk: string }>();
  }
  if (!row) throw new Error("Chave de notificação indisponível.");
  return { publicKey: row.publicKey, privateJwk: JSON.parse(row.privateJwk) as JsonWebKey };
}

export async function listReminders(userId: string): Promise<Reminder[]> {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const now = new Date().toISOString();
  // Missing kinds start switched on at their default time.
  await db.batch((Object.keys(REMINDER_KINDS) as ReminderKind[]).map((kind) =>
    db.prepare('INSERT OR IGNORE INTO "Reminder" (id, userId, kind, time, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .bind(`reminder_${userId}_${kind}`, userId, kind, REMINDER_KINDS[kind].defaultTime, now, now)));
  const rows = await db.prepare('SELECT id, kind, time, enabled, lastSentDate FROM "Reminder" WHERE userId = ?').bind(userId)
    .all<{ id: string; kind: string; time: string; enabled: number; lastSentDate: string | null }>();
  const order = Object.keys(REMINDER_KINDS);
  return rows.results.filter((row) => isKind(row.kind))
    .map((row) => ({ id: row.id, kind: row.kind as ReminderKind, time: row.time, enabled: Boolean(row.enabled), lastSentDate: row.lastSentDate }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export async function updateReminder(userId: string, id: string, input: { time?: unknown; enabled?: unknown }) {
  await ensureSenderoSeeded();
  const db = getSenderoDb();
  const now = new Date().toISOString();
  if (input.time !== undefined) {
    if (!isTime(input.time)) throw new Error("Horário inválido.");
    // A new time today should still fire today.
    await db.prepare('UPDATE "Reminder" SET time = ?, lastSentDate = NULL, updatedAt = ? WHERE id = ? AND userId = ?').bind(input.time, now, id, userId).run();
  }
  if (typeof input.enabled === "boolean") {
    await db.prepare('UPDATE "Reminder" SET enabled = ?, updatedAt = ? WHERE id = ? AND userId = ?').bind(input.enabled ? 1 : 0, now, id, userId).run();
  }
}

export async function saveSubscription(userId: string, input: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }, origin: string) {
  await ensureSenderoSeeded();
  const { endpoint } = input;
  const p256dh = input.keys?.p256dh;
  const auth = input.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") throw new Error("Inscrição inválida.");
  await getSenderoDb().prepare(`
    INSERT INTO "PushSubscription" (id, userId, endpoint, p256dh, auth, origin, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, p256dh = excluded.p256dh, auth = excluded.auth, origin = excluded.origin
  `).bind(`push_${crypto.randomUUID()}`, userId, endpoint, p256dh, auth, origin, new Date().toISOString()).run();
}

export async function removeSubscription(userId: string, endpoint: unknown) {
  await ensureSenderoSeeded();
  if (typeof endpoint !== "string") return;
  await getSenderoDb().prepare('DELETE FROM "PushSubscription" WHERE userId = ? AND endpoint = ?').bind(userId, endpoint).run();
}

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string; origin: string };

async function deliver(userId: string, message: { title: string; body: string; url: string; tag: string }) {
  const db = getSenderoDb();
  const subscriptions = (await db.prepare('SELECT id, endpoint, p256dh, auth, origin FROM "PushSubscription" WHERE userId = ?').bind(userId).all<SubscriptionRow>()).results;
  if (!subscriptions.length) return 0;
  const keys = await getVapidKeys();
  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      const result = await sendPush(subscription, message, keys, subscription.origin);
      if (result.gone) await db.prepare('DELETE FROM "PushSubscription" WHERE id = ?').bind(subscription.id).run();
      if (result.ok) {
        sent += 1;
        await db.prepare('UPDATE "PushSubscription" SET lastSentAt = ? WHERE id = ?').bind(new Date().toISOString(), subscription.id).run();
      }
    } catch {
      // One unreachable phone must not stop the others.
    }
  }
  return sent;
}

export async function sendTestReminder(userId: string) {
  return deliver(userId, { title: "Sendero", body: "Lembretes ativos neste celular.", url: "/configuracoes", tag: "sendero-teste" });
}

/** What is still pending today for a reminder; null means nothing to remind. Texts stay generic for the lock screen. */
async function pendingMessage(kind: ReminderKind, user: { id: string; cycleAnchorDate: Date }, dateKey: string) {
  if (kind === "REFLEXAO") {
    const open = (await getTodayReflectionTopics(user.id, user.cycleAnchorDate)).filter((topic) => topic.status !== "feita").length;
    return open ? `${open === 1 ? "Uma reflexão espera" : `${open} reflexões esperam`} por você hoje.` : null;
  }
  if (kind === "PRATICAS") {
    const open = (await getHabitDashboard(user.id, dateKey)).habits.filter((habit) => habit.cadence === "DAILY" && habit.progress < habit.targetCount).length;
    return open ? `${open === 1 ? "Falta uma prática" : `Faltam ${open} práticas`} de hoje.` : null;
  }
  const diary = await getDiaryEntry(user.id, dateKey);
  return diary?.answers.some((answer) => answer.trim()) ? null : "O Diário de hoje ainda está em branco.";
}

function saoPauloMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}

/** Minutes past a HH:MM time, or null when it is not due now (not yet, or too long ago to still help). */
function minutesLate(time: string, nowMinutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const late = nowMinutes - (hour * 60 + minute);
  return late < 0 || late > LATE_LIMIT_MIN ? null : late;
}

/** Runs from the Worker's cron: sends each reminder whose time has come today and is still pending. */
export async function sendDueReminders(now = new Date()) {
  const user = await getActiveUser();
  if (!user) return [];
  const db = getSenderoDb();
  const dateKey = getSaoPauloDateKey(now);
  const minutes = saoPauloMinutes(now);
  const sent: string[] = [];
  for (const reminder of await listReminders(user.id)) {
    if (!reminder.enabled || reminder.lastSentDate === dateKey || minutesLate(reminder.time, minutes) === null) continue;
    // Marked first, so an overlapping run never sends twice.
    const claimed = await db.prepare('UPDATE "Reminder" SET lastSentDate = ? WHERE id = ? AND (lastSentDate IS NULL OR lastSentDate <> ?)').bind(dateKey, reminder.id, dateKey).run();
    if (!Number(claimed.meta?.changes ?? 1)) continue;
    const body = await pendingMessage(reminder.kind, user, dateKey);
    if (!body) continue;
    await deliver(user.id, { title: "Sendero", body, url: REMINDER_KINDS[reminder.kind].url, tag: `sendero-${reminder.kind.toLowerCase()}` });
    sent.push(reminder.kind);
  }

  // Habits with their own hour: a reminder at that time if not done yet today.
  const timed = (await db.prepare(`
    SELECT id, scheduledTime FROM "HabitTemplate"
    WHERE userId = ? AND isActive = 1 AND remind = 1 AND scheduledTime IS NOT NULL AND (lastRemindedDate IS NULL OR lastRemindedDate <> ?)
  `).bind(user.id, dateKey).all<{ id: string; scheduledTime: string }>()).results.filter((habit) => minutesLate(habit.scheduledTime, minutes) !== null);
  if (!timed.length) return sent;
  const habits = new Map((await getHabitDashboard(user.id, dateKey)).habits.map((habit) => [habit.id, habit]));
  for (const { id } of timed) {
    const claimed = await db.prepare('UPDATE "HabitTemplate" SET lastRemindedDate = ? WHERE id = ? AND (lastRemindedDate IS NULL OR lastRemindedDate <> ?)').bind(dateKey, id, dateKey).run();
    const habit = habits.get(id);
    if (!Number(claimed.meta?.changes ?? 1) || !habit) continue;
    const done = habit.cadence === "WEEKLY" ? habit.todayCount > 0 || habit.progress >= habit.targetCount : habit.progress >= habit.targetCount;
    if (done) continue;
    await deliver(user.id, { title: "Sendero", body: `Hora de: ${habit.title}`, url: practiceHref(habit.id, habit.practiceTool) ?? "/habitos", tag: `sendero-habito-${id}` });
    sent.push(`HABITO:${id}`);
  }
  return sent;
}
