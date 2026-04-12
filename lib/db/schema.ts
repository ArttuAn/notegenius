export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS notebooks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'Untitled Notebook',
  description TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('pdf','url','youtube','text')),
  title       TEXT NOT NULL,
  origin      TEXT NOT NULL,
  raw_text    TEXT,
  char_count  INTEGER DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','processing','ready','error')),
  error_msg   TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_notebook ON sources(notebook_id);

CREATE TABLE IF NOT EXISTS source_chunks (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  notebook_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text        TEXT NOT NULL,
  char_start  INTEGER NOT NULL,
  char_end    INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_source ON source_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_notebook ON source_chunks(notebook_id);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
  USING fts5(
    text,
    chunk_id UNINDEXED,
    source_id UNINDEXED,
    notebook_id UNINDEXED,
    content='source_chunks',
    content_rowid='rowid'
  );

CREATE TRIGGER IF NOT EXISTS chunks_fts_insert
  AFTER INSERT ON source_chunks BEGIN
    INSERT INTO chunks_fts(rowid, text, chunk_id, source_id, notebook_id)
    VALUES (new.rowid, new.text, new.id, new.source_id, new.notebook_id);
  END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_delete
  BEFORE DELETE ON source_chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, text, chunk_id, source_id, notebook_id)
    VALUES ('delete', old.rowid, old.text, old.id, old.source_id, old.notebook_id);
  END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_update
  AFTER UPDATE ON source_chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, text, chunk_id, source_id, notebook_id)
    VALUES ('delete', old.rowid, old.text, old.id, old.source_id, old.notebook_id);
    INSERT INTO chunks_fts(rowid, text, chunk_id, source_id, notebook_id)
    VALUES (new.rowid, new.text, new.id, new.source_id, new.notebook_id);
  END;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title       TEXT DEFAULT 'Chat',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_notebook ON chat_sessions(notebook_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  notebook_id TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content     TEXT NOT NULL,
  citations   TEXT DEFAULT '[]',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS generations (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN (
                'summary','faq','study_guide','timeline',
                'key_topics','concept_map','audio_script'
              )),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  source_ids  TEXT DEFAULT '[]',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generations_notebook ON generations(notebook_id);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title       TEXT DEFAULT 'Untitled Note',
  content     TEXT DEFAULT '',
  pinned      INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES
  ('theme',         'system',  unixepoch() * 1000),
  ('chunk_size',    '1200',    unixepoch() * 1000),
  ('chunk_overlap', '200',     unixepoch() * 1000),
  ('top_k',         '8',       unixepoch() * 1000);
`;

export type Notebook = {
  id: string;
  title: string;
  description: string | null;
  created_at: number;
  updated_at: number;
};

export type Source = {
  id: string;
  notebook_id: string;
  type: 'pdf' | 'url' | 'youtube' | 'text';
  title: string;
  origin: string;
  raw_text: string | null;
  char_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_msg: string | null;
  created_at: number;
};

export type SourceChunk = {
  id: string;
  source_id: string;
  notebook_id: string;
  chunk_index: number;
  text: string;
  char_start: number;
  char_end: number;
  created_at: number;
};

export type ChatSession = {
  id: string;
  notebook_id: string;
  title: string;
  created_at: number;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  notebook_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: number;
};

export type Citation = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  passage: string;
  charStart: number;
  charEnd: number;
  index: number;
};

export type Generation = {
  id: string;
  notebook_id: string;
  type: 'summary' | 'faq' | 'study_guide' | 'timeline' | 'key_topics' | 'concept_map' | 'audio_script';
  title: string;
  content: string;
  source_ids: string[];
  created_at: number;
};

export type Note = {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  pinned: number;
  created_at: number;
  updated_at: number;
};
