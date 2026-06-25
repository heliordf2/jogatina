import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes('localhost') ||
    process.env.DATABASE_URL?.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  max: process.env.VERCEL ? 1 : 10,
});

const PLAYERS = ['helio', 'thamy'];

export async function initDb() {
  await pool.query(`
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
  `);

  for (const playerId of PLAYERS) {
    await pool.query('INSERT INTO players (id) VALUES ($1) ON CONFLICT DO NOTHING', [playerId]);
    await pool.query(
      `
        INSERT INTO sudoku_player_stats (player_id, total, games, best)
        VALUES ($1, 0, 0, NULL)
        ON CONFLICT (player_id) DO NOTHING
      `,
      [playerId],
    );
    await pool.query(
      `
        INSERT INTO chess_player_stats (player_id, wins, losses, draws, games)
        VALUES ($1, 0, 0, 0, 0)
        ON CONFLICT (player_id) DO NOTHING
      `,
      [playerId],
    );
  }

  await migrateFromLegacyJson();
}

async function migrateFromLegacyJson() {
  const legacy = await pool.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = 'app_data'
    ) AS exists
  `);

  if (!legacy.rows[0]?.exists) return;

  const hasRelationalData = await pool.query(`
    SELECT
      (SELECT COALESCE(SUM(games), 0) FROM sudoku_player_stats) +
      (SELECT COALESCE(SUM(games), 0) FROM chess_player_stats) AS total_games
  `);

  if (Number(hasRelationalData.rows[0].total_games) > 0) return;

  const { rows } = await pool.query(
    "SELECT key, data FROM app_data WHERE key IN ('game_stats', 'sudoku_scores')",
  );

  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.data]));
  const sudokuSource = byKey.sudoku_scores ?? byKey.game_stats?.sudoku;

  if (sudokuSource) {
    for (const playerId of PLAYERS) {
      const player = sudokuSource[playerId];
      if (!player) continue;

      await pool.query(
        `
          UPDATE sudoku_player_stats
          SET total = $2, games = $3, best = $4
          WHERE player_id = $1
        `,
        [playerId, player.total ?? 0, player.games ?? 0, player.best ?? null],
      );

      await pool.query('DELETE FROM sudoku_games WHERE player_id = $1', [playerId]);

      for (const entry of player.history ?? []) {
        await pool.query(
          `
            INSERT INTO sudoku_games (player_id, pts, time_str, difficulty, game_type, played_date)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            playerId,
            entry.pts ?? 0,
            entry.time ?? '0:00',
            entry.diff ?? 'easy',
            entry.type ?? 'solo',
            entry.date ?? '',
          ],
        );
      }
    }
  }

  const chessSource = byKey.game_stats?.chess;
  if (chessSource) {
    for (const playerId of PLAYERS) {
      const player = chessSource[playerId];
      if (!player) continue;

      await pool.query(
        `
          UPDATE chess_player_stats
          SET wins = $2, losses = $3, draws = $4, games = $5
          WHERE player_id = $1
        `,
        [
          playerId,
          player.wins ?? 0,
          player.losses ?? 0,
          player.draws ?? 0,
          player.games ?? 0,
        ],
      );
    }
  }
}

export async function closeDb() {
  await pool.end();
}
