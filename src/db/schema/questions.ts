export const GAME_QUESTIONS_TABLE = 'game_questions'

export const createGameQuestionsTableSql = `
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

CREATE INDEX IF NOT EXISTS idx_game_questions_round_id ON game_questions(round_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_room_id ON game_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_asker_user_id ON game_questions(asker_user_id);
`
