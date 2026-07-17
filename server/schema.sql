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
  errors INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sudoku_games_player_created
  ON sudoku_games (player_id, created_at DESC);

ALTER TABLE sudoku_games
  ADD COLUMN IF NOT EXISTS result_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sudoku_games_result_key
  ON sudoku_games (result_key)
  WHERE result_key IS NOT NULL;

CREATE OR REPLACE FUNCTION protect_sudoku_games() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'O histórico do ranking Sudoku é imutável';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_sudoku_games_trigger ON sudoku_games;
CREATE TRIGGER protect_sudoku_games_trigger
  BEFORE UPDATE OR DELETE ON sudoku_games
  FOR EACH ROW EXECUTE FUNCTION protect_sudoku_games();

CREATE OR REPLACE FUNCTION protect_sudoku_totals() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Os totais do ranking Sudoku não podem ser removidos';
  END IF;
  IF NEW.total < OLD.total OR NEW.games < OLD.games OR
     (OLD.best IS NOT NULL AND (NEW.best IS NULL OR NEW.best < OLD.best)) THEN
    RAISE EXCEPTION 'Os totais do ranking Sudoku não podem diminuir';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_sudoku_totals_trigger ON sudoku_player_stats;
CREATE TRIGGER protect_sudoku_totals_trigger
  BEFORE UPDATE OR DELETE ON sudoku_player_stats
  FOR EACH ROW EXECUTE FUNCTION protect_sudoku_totals();

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
