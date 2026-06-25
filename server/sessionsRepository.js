import { pool } from './db.js';

const VALID_PLAYERS = new Set(['helio', 'thamy']);
const VALID_GAMES = new Set(['sudoku', 'chess']);
const VALID_MODES = new Set(['solo', 'collab']);

export async function recordGameStart({ player, game, mode = null }) {
  if (!VALID_PLAYERS.has(player)) {
    throw new Error('Jogador inválido');
  }
  if (!VALID_GAMES.has(game)) {
    throw new Error('Jogo inválido');
  }
  if (mode != null && !VALID_MODES.has(mode)) {
    throw new Error('Modo inválido');
  }

  const result = await pool.query(
    `
      INSERT INTO game_sessions (player_id, game, mode, session_date, session_time, started_at)
      VALUES (
        $1,
        $2,
        $3,
        (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
        (NOW() AT TIME ZONE 'America/Sao_Paulo')::time,
        NOW()
      )
      RETURNING id, player_id, game, mode, session_date, session_time, started_at
    `,
    [player, game, mode],
  );

  return result.rows[0];
}

export async function listGameSessions(limit = 50) {
  const result = await pool.query(
    `
      SELECT id, player_id, game, mode, session_date, session_time, started_at
      FROM game_sessions
      ORDER BY started_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}
