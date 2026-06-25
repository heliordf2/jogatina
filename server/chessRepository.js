import { Chess } from 'chess.js';
import { pool } from './db.js';
import {
  assertValidPlayer,
  formatChessGame,
  getChessStatus,
  getChessWinner,
  getTurnPlayer,
  isActiveStatus,
  rollChessColors,
} from './chessLogic.js';

async function incrementChessResult(client, winner) {
  if (winner === 'draw') {
    await client.query(`
      UPDATE chess_player_stats
      SET draws = draws + 1, games = games + 1
      WHERE player_id IN ('helio', 'thamy')
    `);
    return;
  }

  const loser = winner === 'helio' ? 'thamy' : 'helio';
  await client.query(
    `
      UPDATE chess_player_stats
      SET wins = wins + 1, games = games + 1
      WHERE player_id = $1
    `,
    [winner],
  );
  await client.query(
    `
      UPDATE chess_player_stats
      SET losses = losses + 1, games = games + 1
      WHERE player_id = $1
    `,
    [loser],
  );
}

async function recordStatsIfNeeded(client, row) {
  if (!row || row.stats_recorded || !['checkmate', 'draw', 'resigned'].includes(row.status)) {
    return row;
  }

  const winner = row.winner ?? 'draw';
  await incrementChessResult(client, winner);
  const updated = await client.query(
    `
      UPDATE chess_games
      SET stats_recorded = TRUE
      WHERE id = $1
      RETURNING *
    `,
    [row.id],
  );
  return updated.rows[0] ?? row;
}

async function getActiveGameRow(client = pool) {
  const result = await client.query(`
    SELECT *
    FROM chess_games
    WHERE status IN ('playing', 'check')
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export async function getActiveChessGame() {
  const row = await getActiveGameRow();
  if (!row) return null;
  return formatChessGame(row);
}

export async function getOrCreateChessGame({ player, forceNew = false }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await getActiveGameRow(client);
    if (existing && !forceNew) {
      await client.query('COMMIT');
      return formatChessGame(existing);
    }

    if (existing && forceNew) {
      const winner =
        player === existing.white_player ? existing.black_player : existing.white_player;
      await client.query(
        `
          UPDATE chess_games
          SET status = 'resigned', winner = $2, updated_at = NOW(), version = version + 1
          WHERE id = $1
        `,
        [existing.id, winner],
      );
      const abandoned = await client.query('SELECT * FROM chess_games WHERE id = $1', [existing.id]);
      await recordStatsIfNeeded(client, abandoned.rows[0]);
    }

    const colors = rollChessColors();
    const chess = new Chess();
    const inserted = await client.query(
      `
        INSERT INTO chess_games (
          fen, moves, white_player, black_player, status, created_by
        )
        VALUES ($1, $2::jsonb, $3, $4, 'playing', $5)
        RETURNING *
      `,
      [chess.fen(), JSON.stringify([]), colors.whitePlayer, colors.blackPlayer, player],
    );

    await client.query('COMMIT');
    return formatChessGame(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateGameState(client, row, chess) {
  const status = getChessStatus(chess);
  const winner = getChessWinner(chess, row.white_player, row.black_player);
  const terminal = ['checkmate', 'draw'].includes(status);

  const updated = await client.query(
    `
      UPDATE chess_games
      SET
        fen = $2,
        moves = $3::jsonb,
        status = $4,
        winner = $5,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      row.id,
      chess.fen(),
      JSON.stringify(chess.history()),
      status,
      terminal ? winner : null,
    ],
  );

  return recordStatsIfNeeded(client, updated.rows[0]);
}

export async function applyChessMove({ player, from, to, promotion = 'q' }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const row = await getActiveGameRow(client);
    if (!row) {
      throw new Error('Nenhuma partida ativa');
    }

    const turnPlayer = getTurnPlayer(row);
    if (turnPlayer !== player) {
      throw new Error('Não é a sua vez');
    }

    const chess = new Chess(row.fen);
    const move = chess.move({ from, to, promotion });
    if (!move) {
      throw new Error('Jogada inválida');
    }

    const nextRow = await updateGameState(client, row, chess);
    await client.query('COMMIT');
    return formatChessGame(nextRow);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function resignChessGame({ player }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const row = await getActiveGameRow(client);
    if (!row) {
      throw new Error('Nenhuma partida ativa');
    }

    if (player !== row.white_player && player !== row.black_player) {
      throw new Error('Você não está nesta partida');
    }

    const winner = player === row.white_player ? row.black_player : row.white_player;
    const updated = await client.query(
      `
        UPDATE chess_games
        SET status = 'resigned', winner = $2, version = version + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [row.id, winner],
    );

    const nextRow = await recordStatsIfNeeded(client, updated.rows[0]);
    await client.query('COMMIT');
    return formatChessGame(nextRow);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getChessGameById(id) {
  const result = await pool.query('SELECT * FROM chess_games WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return null;
  return formatChessGame(row);
}
