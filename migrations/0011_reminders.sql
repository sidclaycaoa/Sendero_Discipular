-- Phone reminders (Web Push). The app signs pushes with its own key pair, created on first use.
CREATE TABLE IF NOT EXISTS "PushKey" (
  id TEXT PRIMARY KEY NOT NULL,     -- always 'vapid'
  publicKey TEXT NOT NULL,          -- base64url, shared with the phone when it subscribes
  privateJwk TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

-- One row per phone (or browser) that accepted notifications.
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  origin TEXT NOT NULL,             -- app address, used as the VAPID contact
  createdAt TEXT NOT NULL,
  lastSentAt TEXT
);
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription" (userId);

-- Daily reminders; each one is sent only when there is still something pending.
CREATE TABLE IF NOT EXISTS "Reminder" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  kind TEXT NOT NULL,               -- REFLEXAO | PRATICAS | DIARIO
  time TEXT NOT NULL,               -- HH:MM, America/Sao_Paulo
  enabled INTEGER NOT NULL DEFAULT 1,
  lastSentDate TEXT,                -- YYYY-MM-DD of the last send
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Reminder_userId_kind_key" ON "Reminder" (userId, kind);
