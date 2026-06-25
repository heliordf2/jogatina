-- Schema relacional do Jogatina

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY CHECK (id IN ('helio', 'thamy'))
);

CREATE TABLE IF NOT EXISTS sudoku_player_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  total INTEGER NOT NULL DEFAULT 0,
  games INTEGER NOT NULL DEFAULT 0,
  best INTEGER
);

CREATE TABLE IF NOT EXISTS sudoku_games (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  pts INTEGER NOT NULL,
  time_str VARCHAR(10) NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  game_type VARCHAR(10) NOT NULL CHECK (game_type IN ('solo', 'collab')),
  played_date VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sudoku_games_player_created
  ON sudoku_games (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chess_player_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  games INTEGER NOT NULL DEFAULT 0
);

INSERT INTO players (id) VALUES ('helio'), ('thamy') ON CONFLICT DO NOTHING;
