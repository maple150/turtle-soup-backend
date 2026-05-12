export const FAVORITES_TABLE = 'favorites'

export const createFavoritesTableSql = `
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  soup_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, soup_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (soup_id) REFERENCES soups(id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_soup_id ON favorites(soup_id);
`
