-- Caderno: notebooks → sections → pages, in the manner of OneNote.
-- Nothing is ever deleted by the app on its own: pages and notebooks are archived first,
-- and a page is deleted for good only from the archive, after the user confirms.
CREATE TABLE IF NOT EXISTS "Notebook" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,                -- #rrggbb, identity only (never the practice-group colors)
  kind TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL | ENTRADA (where quick notes land) | FRASES (next stage)
  position INTEGER NOT NULL DEFAULT 0,
  archivedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Notebook_userId_idx" ON "Notebook" (userId, position);

CREATE TABLE IF NOT EXISTS "NoteSection" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  notebookId TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archivedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "NoteSection_notebookId_idx" ON "NoteSection" (notebookId, position);

-- A page lives in a notebook, in a section (or loose, NULL) and may be a subpage of another (one level).
CREATE TABLE IF NOT EXISTS "NotePage" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  notebookId TEXT NOT NULL,
  sectionId TEXT,
  parentId TEXT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT,                       -- editor document (TipTap JSON)
  plainText TEXT NOT NULL DEFAULT '', -- the same text without formatting, for previews and search
  position INTEGER NOT NULL DEFAULT 0,
  archivedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "NotePage_notebookId_idx" ON "NotePage" (notebookId, sectionId, position);
CREATE INDEX IF NOT EXISTS "NotePage_userId_updated_idx" ON "NotePage" (userId, updatedAt);

-- Earlier versions of a page, kept so no text is ever lost (at most one every few minutes).
CREATE TABLE IF NOT EXISTS "NotePageVersion" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  pageId TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  plainText TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "NotePageVersion_pageId_idx" ON "NotePageVersion" (pageId, createdAt);

-- One search over pages and, when asked, reflections and the diary. Accents are ignored.
-- kind: PAGINA | REFLEXAO | DIARIO; refId points to the row of that kind.
CREATE VIRTUAL TABLE IF NOT EXISTS "SearchIndex" USING fts5(
  kind UNINDEXED, refId UNINDEXED, userId UNINDEXED, title, body,
  tokenize = 'unicode61 remove_diacritics 2'
);
-- What was last indexed of reflections and the diary (count and last change), to refresh only when it moved.
CREATE TABLE IF NOT EXISTS "SearchSource" (
  userId TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT NOT NULL,
  PRIMARY KEY (userId, kind)
);

-- The Diário leaves the bottom menu: it opens with "play" from its practice in Hábitos.
UPDATE "HabitTemplate" SET practiceTool = 'DIARIO' WHERE lower(trim(title)) = 'escrever o diário' AND practiceTool IS NULL;
