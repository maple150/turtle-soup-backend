export const SOUPS_TABLE = 'soups'

export const createSoupsTableSql = `
CREATE TABLE IF NOT EXISTS soups (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  favorite_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CHECK (status IN ('draft', 'published', 'archived')),
  CHECK (is_public IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_soups_created_by ON soups(created_by);
CREATE INDEX IF NOT EXISTS idx_soups_difficulty ON soups(difficulty);
CREATE INDEX IF NOT EXISTS idx_soups_status ON soups(status);
`
