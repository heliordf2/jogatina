import dotenv from 'dotenv';
import pg from 'pg';
import { calcSoloScore } from '../shared/sudokuScoring.js';
import { DIFF_REMOVES } from '../shared/sudokuDifficulty.js';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  const sessions = await pool.query(`
    SELECT player_id, mode, COUNT(*)::int AS n
    FROM game_sessions
    WHERE game = 'sudoku'
    GROUP BY player_id, mode
    ORDER BY player_id, mode
  `);

  const allGames = await pool.query(`SELECT COUNT(*)::int AS n FROM sudoku_games`);
  const wonCollabs = await pool.query(`
    SELECT id, difficulty, collab_scores, errors, corrects, status, stats_recorded, updated_at
    FROM sudoku_collab_games
    WHERE status = 'won' AND stats_recorded = TRUE
    ORDER BY updated_at
  `);

  const collabInGames = await pool.query(`
    SELECT * FROM sudoku_games WHERE game_type = 'collab' ORDER BY id
  `);

  console.log(JSON.stringify({ sessions: sessions.rows, totalSudokuGames: allGames.rows[0].n, wonCollabs: wonCollabs.rows, collabInGames: collabInGames.rows }, null, 2));
  await pool.end();
}

main().catch(console.error);
