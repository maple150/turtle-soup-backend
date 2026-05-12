export const GAME_ROUNDS_TABLE = 'game_rounds'

export const createGameRoundsTableSql = `
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

CREATE INDEX IF NOT EXISTS idx_game_rounds_room_id ON game_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_host_user_id ON game_rounds(host_user_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_started_at ON game_rounds(started_at);
`
