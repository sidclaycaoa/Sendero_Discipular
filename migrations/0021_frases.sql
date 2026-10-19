-- Frases e passagens: the Caderno's special notebook. A phrase is either a literal quotation
-- (always with its source: author and work at least) or the user's own synthesis, and the two
-- are never confused. A literal from one of the AD's books is checked against the book index.
CREATE TABLE IF NOT EXISTS "Passage" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  kind TEXT NOT NULL,               -- LITERAL | SINTESE
  text TEXT NOT NULL,
  author TEXT,                      -- required for LITERAL
  work TEXT,                        -- required for LITERAL
  edition TEXT,
  location TEXT,                    -- "Livro V, 1", "cap. 3", "p. 28 do PDF"
  sourceType TEXT NOT NULL,         -- LIVRO_AD (from IndexedPassage) | MANUAL (typed by the user) | PAGINA (born from a Caderno page)
  sourceRef TEXT,                   -- IndexedPassage id or NotePage id
  note TEXT,                        -- the user's comment, never mixed with the quotation
  archivedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Passage_userId_idx" ON "Passage" (userId, archivedAt, createdAt);
