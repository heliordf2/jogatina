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

CREATE TABLE IF NOT EXISTS game_sessions (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  game TEXT NOT NULL CHECK (game IN ('sudoku', 'chess')),
  mode TEXT CHECK (mode IS NULL OR mode IN ('solo', 'collab')),
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_started
  ON game_sessions (started_at DESC);

CREATE TABLE IF NOT EXISTS chess_games (
  id SERIAL PRIMARY KEY,
  fen TEXT NOT NULL,
  moves JSONB NOT NULL DEFAULT '[]',
  white_player TEXT NOT NULL REFERENCES players(id),
  black_player TEXT NOT NULL REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'playing',
  winner TEXT CHECK (winner IS NULL OR winner IN ('helio', 'thamy', 'draw')),
  version INTEGER NOT NULL DEFAULT 1,
  stats_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL REFERENCES players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chess_games_updated
  ON chess_games (updated_at DESC);

CREATE TABLE IF NOT EXISTS player_presence (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  sender TEXT NOT NULL CHECK (sender IN ('system', 'player')),
  player_id TEXT REFERENCES players(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_id
  ON chat_messages (id DESC);

INSERT INTO players (id) VALUES ('helio'), ('thamy') ON CONFLICT DO NOTHING;
