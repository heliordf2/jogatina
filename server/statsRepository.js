import { pool } from './db.js';

const PLAYERS = ['helio', 'thamy'];
const HISTORY_LIMIT = 20;

function emptySudokuPlayer() {
  return { total: 0, games: 0, best: null, history: [] };
}

function emptyChessPlayer() {
  return { wins: 0, losses: 0, draws: 0, games: 0 };
}

function mapSudokuGameRow(row) {
  return {
    pts: row.pts,
    time: row.time_str,
    diff: row.difficulty,
    type: row.game_type,
    date: row.played_date,
    errors: row.errors ?? 0,
  };
}

async function fetchSudokuPlayer(playerId) {
  const statsResult = await pool.query(
    `
      SELECT total, games, best
      FROM sudoku_player_stats
      WHERE player_id = $1
    `,
    [playerId],
  );

  const historyResult = await pool.query(
    `
      SELECT pts, time_str, difficulty, game_type, played_date, errors
      FROM sudoku_games
      WHERE player_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [playerId, HISTORY_LIMIT],
  );

  const stats = statsResult.rows[0];
  if (!stats) return emptySudokuPlayer();

  return {
    total: stats.total,
    games: stats.games,
    best: stats.best,
    history: historyResult.rows.map(mapSudokuGameRow),
  };
}

async function fetchChessPlayer(playerId) {
  const result = await pool.query(
    `
      SELECT wins, losses, draws, games
      FROM chess_player_stats
      WHERE player_id = $1
    `,
    [playerId],
  );

  const stats = result.rows[0];
  if (!stats) return emptyChessPlayer();

  return {
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    games: stats.games,
  };
}

async function saveSudokuPlayer(client, playerId, playerData) {
  const current = await client.query(
    'SELECT games FROM sudoku_player_stats WHERE player_id = $1 FOR UPDATE',
    [playerId],
  );
  // Importa apenas um ranking legado para um jogador ainda sem partidas.
  // Rankings existentes nunca podem ser substituídos por snapshots do cliente.
  if (Number(current.rows[0]?.games ?? 0) > 0) return;

  await client.query(
    `
      INSERT INTO sudoku_player_stats (player_id, total, games, best)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (player_id)
      DO UPDATE SET
        total = GREATEST(sudoku_player_stats.total, EXCLUDED.total),
        games = GREATEST(sudoku_player_stats.games, EXCLUDED.games),
        best = GREATEST(sudoku_player_stats.best, EXCLUDED.best)
    `,
    [playerId, playerData.total ?? 0, playerData.games ?? 0, playerData.best ?? null],
  );

  const history = (playerData.history ?? []).slice(0, HISTORY_LIMIT);
  for (const entry of history) {
    await client.query(
      `
        INSERT INTO sudoku_games (player_id, pts, time_str, difficulty, game_type, played_date, errors)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        playerId,
        entry.pts ?? 0,
        entry.time ?? '0:00',
        entry.diff ?? 'easy',
        entry.type ?? 'solo',
        entry.date ?? '',
        entry.errors ?? 0,
      ],
    );
  }
}

async function saveChessPlayer(client, playerId, playerData) {
  await client.query(
    `
      INSERT INTO chess_player_stats (player_id, wins, losses, draws, games)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (player_id)
      DO UPDATE SET
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        draws = EXCLUDED.draws,
        games = EXCLUDED.games
    `,
    [
      playerId,
      playerData.wins ?? 0,
      playerData.losses ?? 0,
      playerData.draws ?? 0,
      playerData.games ?? 0,
    ],
  );
}

export async function getSudokuScores() {
  const scores = {};
  for (const playerId of PLAYERS) {
    scores[playerId] = await fetchSudokuPlayer(playerId);
  }
  return scores;
}

export async function saveSudokuScores(scores) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const playerId of PLAYERS) {
      await saveSudokuPlayer(client, playerId, scores[playerId] ?? emptySudokuPlayer());
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordSudokuSoloGame(playerId, game) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `
        INSERT INTO sudoku_games
          (player_id, pts, time_str, difficulty, game_type, played_date, errors, result_key)
        VALUES ($1, $2, $3, $4, 'solo', $5, $6, $7)
        ON CONFLICT (result_key) WHERE result_key IS NOT NULL DO NOTHING
        RETURNING id
      `,
      [playerId, game.pts, game.time, game.diff, game.date, game.errors, game.resultKey],
    );
    if (inserted.rowCount > 0) {
      await client.query(
        `
          INSERT INTO sudoku_player_stats (player_id, total, games, best)
          VALUES ($1, $2, 1, $2)
          ON CONFLICT (player_id)
          DO UPDATE SET
            total = sudoku_player_stats.total + EXCLUDED.total,
            games = sudoku_player_stats.games + 1,
            best = GREATEST(COALESCE(sudoku_player_stats.best, 0), EXCLUDED.best)
        `,
        [playerId, game.pts],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getSudokuScores();
}

export async function getGameStats() {
  const sudoku = {};
  for (const playerId of PLAYERS) {
    sudoku[playerId] = await fetchSudokuPlayer(playerId);
  }

  const chess = {};
  for (const playerId of PLAYERS) {
    chess[playerId] = await fetchChessPlayer(playerId);
  }

  return { sudoku, chess };
}

export async function saveGameStats(stats) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const playerId of PLAYERS) {
      if (stats.chess?.[playerId]) {
        await saveChessPlayer(client, playerId, stats.chess[playerId]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
