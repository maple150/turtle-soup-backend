PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  roles TEXT NOT NULL DEFAULT '["player"]',
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (status IN ('active', 'blocked', 'deleted'))
);

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

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  current_round_id TEXT,
  current_soup_id TEXT,
  capacity INTEGER NOT NULL,
  settings TEXT NOT NULL DEFAULT '{}',
  last_activity_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  FOREIGN KEY (host_user_id) REFERENCES users(id),
  FOREIGN KEY (current_soup_id) REFERENCES soups(id),
  CHECK (status IN ('waiting', 'playing', 'revealed', 'finished')),
  CHECK (mode IN ('casual', 'ranked', 'private'))
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  soup_id TEXT,
  host_user_id TEXT NOT NULL,
  room_code_snapshot TEXT NOT NULL,
  room_name_snapshot TEXT NOT NULL,
  soup_title_snapshot TEXT,
  soup_answer_snapshot TEXT,
  round_no INTEGER NOT NULL,
  state TEXT NOT NULL,
  answer_revealed INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  result_summary TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (soup_id) REFERENCES soups(id),
  FOREIGN KEY (host_user_id) REFERENCES users(id),
  CHECK (state IN ('waiting', 'playing', 'revealed', 'finished')),
  CHECK (answer_revealed IN (0, 1))
);

CREATE TABLE IF NOT EXISTS game_questions (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  asker_user_id TEXT NOT NULL,
  asker_nickname_snapshot TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_type TEXT,
  answer_text TEXT,
  answered_by_user_id TEXT,
  answered_by_nickname_snapshot TEXT,
  asked_at INTEGER NOT NULL,
  answered_at INTEGER,
  ordinal INTEGER NOT NULL,
  FOREIGN KEY (round_id) REFERENCES game_rounds(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (asker_user_id) REFERENCES users(id),
  FOREIGN KEY (answered_by_user_id) REFERENCES users(id),
  CHECK (answer_type IS NULL OR answer_type IN ('yes', 'no', 'irrelevant'))
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  soup_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, soup_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (soup_id) REFERENCES soups(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host_user_id ON rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity_at ON rooms(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_soups_created_by ON soups(created_by);
CREATE INDEX IF NOT EXISTS idx_soups_difficulty ON soups(difficulty);
CREATE INDEX IF NOT EXISTS idx_soups_status ON soups(status);
CREATE INDEX IF NOT EXISTS idx_game_rounds_room_id ON game_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_host_user_id ON game_rounds(host_user_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_started_at ON game_rounds(started_at);
CREATE INDEX IF NOT EXISTS idx_game_questions_round_id ON game_questions(round_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_room_id ON game_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_asker_user_id ON game_questions(asker_user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_soup_id ON favorites(soup_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
