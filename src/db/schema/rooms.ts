export const ROOMS_TABLE = 'rooms'

export const createRoomsTableSql = `
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

CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host_user_id ON rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity_at ON rooms(last_activity_at);
`
