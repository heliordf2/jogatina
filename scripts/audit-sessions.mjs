import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  const recent = await pool.query(`
    SELECT id, player_id, game, mode, session_date, session_time, started_at
    FROM game_sessions
    WHERE game = 'sudoku'
    ORDER BY started_at DESC
    LIMIT 30
  `);
  console.log(JSON.stringify(recent.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
