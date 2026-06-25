import { pool } from './db.js';
import { assertValidPlayer } from './chessLogic.js';
import {
  createGivenFromPuzzle,
  generateSudoku,
  isBoardComplete,
  isCellLocked,
} from './sudokuEngine.js';

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'extreme']);

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function computeTimer(row) {
  if (row.status === 'won') return row.timer_seconds;
  if (row.paused) return row.timer_seconds;
  const started = new Date(row.timer_started_at).getTime();
  return row.timer_seconds + Math.floor((Date.now() - started) / 1000);
}

function rowToState(row) {
  const board = parseJson(row.board, []);
  const solution = parseJson(row.solution, []);
  const given = parseJson(row.given, []);
  return {
    board,
    solution,
    given,
    collabTurn: row.collab_turn,
    collabScores: parseJson(row.collab_scores, { helio: 0, thamy: 0 }),
    collabCells: parseJson(row.collab_cells, { helio: [], thamy: [] }),
    errors: row.errors,
    corrects: row.corrects,
    hints: row.hints,
    turnLocked: row.turn_locked,
    paused: row.paused,
  };
}

export function formatSudokuCollabGame(row) {
  if (!row) return null;
  return {
    id: row.id,
    difficulty: row.difficulty,
    ...rowToState(row),
    timer: computeTimer(row),
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

async function getActiveGameRow(client = pool) {
  const result = await client.query(`
    SELECT *
    FROM sudoku_collab_games
    WHERE status = 'playing'
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export async function getActiveSudokuCollabGame() {
  const row = await getActiveGameRow();
  if (!row) return null;
  return formatSudokuCollabGame(row);
}

function createInitialRow({ difficulty, puzzle, solution, createdBy }) {
  const given = createGivenFromPuzzle(puzzle);
  return {
    difficulty,
    puzzle,
    solution,
    board: puzzle.map((r) => [...r]),
    given,
    collab_turn: 'helio',
    collab_scores: { helio: 0, thamy: 0 },
    collab_cells: { helio: [], thamy: [] },
    errors: 0,
    corrects: 0,
    hints: 3,
    turn_locked: false,
    paused: false,
    timer_seconds: 0,
    status: 'playing',
    created_by: createdBy,
  };
}

export async function getOrCreateSudokuCollabGame({ player, difficulty, forceNew = false }) {
  assertValidPlayer(player);
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw new Error('Dificuldade inválida');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await getActiveGameRow(client);
    if (existing && !forceNew) {
      await client.query('COMMIT');
      return { game: formatSudokuCollabGame(existing), joined: existing.created_by !== player };
    }

    if (existing && forceNew) {
      await client.query(
        `
          UPDATE sudoku_collab_games
          SET status = 'abandoned', updated_at = NOW(), version = version + 1
          WHERE id = $1
        `,
        [existing.id],
      );
    }

    const { solution, puzzle } = generateSudoku(difficulty);
    const initial = createInitialRow({ difficulty, puzzle, solution, createdBy: player });

    const inserted = await client.query(
      `
        INSERT INTO sudoku_collab_games (
          difficulty, puzzle, solution, board, given,
          collab_turn, collab_scores, collab_cells,
          errors, corrects, hints, turn_locked, paused,
          timer_seconds, status, created_by
        )
        VALUES (
          $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb,
          $6, $7::jsonb, $8::jsonb,
          $9, $10, $11, $12, $13,
          $14, $15, $16
        )
        RETURNING *
      `,
      [
        initial.difficulty,
        JSON.stringify(puzzle),
        JSON.stringify(solution),
        JSON.stringify(initial.board),
        JSON.stringify(initial.given),
        initial.collab_turn,
        JSON.stringify(initial.collab_scores),
        JSON.stringify(initial.collab_cells),
        initial.errors,
        initial.corrects,
        initial.hints,
        initial.turn_locked,
        initial.paused,
        initial.timer_seconds,
        initial.status,
        initial.created_by,
      ],
    );

    await client.query('COMMIT');
    return { game: formatSudokuCollabGame(inserted.rows[0]), joined: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function recordCollabWinStats(client, dbRow, state) {
  if (dbRow.stats_recorded) return;

  const timer = computeTimer(dbRow);
  const timeStr = formatTime(timer);
  const playedDate = new Date().toLocaleDateString('pt-BR');
  const scores = state.collab_scores;

  for (const playerId of ['helio', 'thamy']) {
    const pts = scores[playerId] ?? 0;
    await client.query(
      `
        UPDATE sudoku_player_stats
        SET total = total + $2, games = games + 1
        WHERE player_id = $1
      `,
      [playerId, pts],
    );
    await client.query(
      `
        INSERT INTO sudoku_games (player_id, pts, time_str, difficulty, game_type, played_date)
        VALUES ($1, $2, $3, $4, 'collab', $5)
      `,
      [playerId, pts, timeStr, dbRow.difficulty, playedDate],
    );
  }

  await client.query(
    `UPDATE sudoku_collab_games SET stats_recorded = TRUE WHERE id = $1`,
    [dbRow.id],
  );
}

async function updateGameRow(client, row, patch) {
  const updated = await client.query(
    `
      UPDATE sudoku_collab_games
      SET
        board = $2::jsonb,
        collab_turn = $3,
        collab_scores = $4::jsonb,
        collab_cells = $5::jsonb,
        errors = $6,
        corrects = $7,
        hints = $8,
        turn_locked = $9,
        paused = $10,
        timer_seconds = $11,
        timer_started_at = $12,
        status = $13,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      row.id,
      JSON.stringify(patch.board),
      patch.collab_turn,
      JSON.stringify(patch.collab_scores),
      JSON.stringify(patch.collab_cells),
      patch.errors,
      patch.corrects,
      patch.hints,
      patch.turn_locked,
      patch.paused,
      patch.timer_seconds,
      patch.timer_started_at,
      patch.status,
    ],
  );
  return updated.rows[0];
}

function syncTimerBeforeMutation(row) {
  const timerSeconds = computeTimer(row);
  return {
    timer_seconds: timerSeconds,
    timer_started_at: row.paused ? row.timer_started_at : new Date(),
  };
}

export async function applySudokuCollabCell({ player, row: rowIndex, col, value }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dbRow = await getActiveGameRow(client);
    if (!dbRow) throw new Error('Nenhum duelo ativo');

    const state = rowToState(dbRow);
    const r = rowIndex;
    const c = col;
    const n = value;

    if (state.collabTurn !== player) {
      throw new Error('Não é a sua vez');
    }
    if (state.given[r]?.[c] || isCellLocked(state, r, c)) {
      throw new Error('Célula bloqueada');
    }

    const timerPatch = syncTimerBeforeMutation(dbRow);
    const next = {
      ...state,
      board: state.board.map((row) => [...row]),
      collab_scores: { ...state.collab_scores },
      collab_cells: {
        helio: [...state.collab_cells.helio],
        thamy: [...state.collab_cells.thamy],
      },
      ...timerPatch,
      turn_locked: false,
    };

    let chatMessage = null;

    if (n === 0) {
      next.board[r][c] = 0;
      next.collab_cells.helio = next.collab_cells.helio.filter(([cr, cc]) => !(cr === r && cc === c));
      next.collab_cells.thamy = next.collab_cells.thamy.filter(([cr, cc]) => !(cr === r && cc === c));
    } else {
      const correct = n === next.solution[r][c];
      const turn = next.collabTurn;
      next.board[r][c] = n;
      next.collab_cells.helio = next.collab_cells.helio.filter(([cr, cc]) => !(cr === r && cc === c));
      next.collab_cells.thamy = next.collab_cells.thamy.filter(([cr, cc]) => !(cr === r && cc === c));
      next.collab_cells[turn] = [...next.collab_cells[turn], [r, c]];

      if (correct) {
        next.collab_scores[turn] = next.collab_scores[turn] + 10;
        next.corrects += 1;
        chatMessage = `${turn === 'helio' ? '🟣 Helio' : '🩷 Thamy'} acertou +10! ✅`;
      } else {
        next.collab_scores[turn] = Math.max(0, next.collab_scores[turn] - 5);
        next.errors += 1;
        chatMessage = `❌ ${turn === 'helio' ? 'Helio' : 'Thamy'} errou -5pts`;
      }

      next.collabTurn = turn === 'helio' ? 'thamy' : 'helio';
    }

    let status = 'playing';
    if (isBoardComplete(next.board, next.solution)) {
      status = 'won';
      next.timer_seconds = computeTimer({ ...dbRow, ...timerPatch });
    }

    const updated = await updateGameRow(client, dbRow, {
      board: next.board,
      collab_turn: next.collabTurn,
      collab_scores: next.collab_scores,
      collab_cells: next.collab_cells,
      errors: next.errors,
      corrects: next.corrects,
      hints: next.hints,
      turn_locked: next.turn_locked,
      paused: next.paused,
      timer_seconds: next.timer_seconds,
      timer_started_at: next.timer_started_at,
      status,
    });

    if (status === 'won') {
      await recordCollabWinStats(client, updated, {
        collab_scores: next.collab_scores,
      });
    }

    await client.query('COMMIT');
    return { game: formatSudokuCollabGame(updated), chatMessage };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleSudokuCollabTurnLock({ player, locked }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dbRow = await getActiveGameRow(client);
    if (!dbRow) throw new Error('Nenhum duelo ativo');

    const state = rowToState(dbRow);
    if (state.collabTurn !== player) {
      throw new Error('Só quem está jogando pode travar');
    }

    const timerPatch = syncTimerBeforeMutation(dbRow);
    const updated = await updateGameRow(client, dbRow, {
      board: state.board,
      collab_turn: state.collabTurn,
      collab_scores: state.collab_scores,
      collab_cells: state.collab_cells,
      errors: state.errors,
      corrects: state.corrects,
      hints: state.hints,
      turn_locked: Boolean(locked),
      paused: state.paused,
      timer_seconds: timerPatch.timer_seconds,
      timer_started_at: timerPatch.timer_started_at,
      status: dbRow.status,
    });

    await client.query('COMMIT');
    const name = player === 'helio' ? 'Helio' : 'Thamy';
    const chatMessage = locked ? `🔒 ${name} travou a vez` : `🔓 ${name} destravou a vez`;
    return { game: formatSudokuCollabGame(updated), chatMessage };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function applySudokuCollabHint({ player }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dbRow = await getActiveGameRow(client);
    if (!dbRow) throw new Error('Nenhum duelo ativo');

    const state = rowToState(dbRow);
    if (state.collabTurn !== player) {
      throw new Error('Não é a sua vez');
    }
    if (state.hints <= 0) {
      throw new Error('Sem dicas restantes');
    }

    const empties = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.given[r][c] && state.board[r][c] !== state.solution[r][c]) {
          empties.push([r, c]);
        }
      }
    }
    if (!empties.length) throw new Error('Não há células para dica');

    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    const timerPatch = syncTimerBeforeMutation(dbRow);

    const next = {
      ...state,
      board: state.board.map((row) => [...row]),
      collab_scores: { ...state.collab_scores },
      collab_cells: {
        helio: [...state.collab_cells.helio],
        thamy: [...state.collab_cells.thamy],
      },
      ...timerPatch,
      hints: state.hints - 1,
      corrects: state.corrects + 1,
      turn_locked: false,
    };

    next.board[r][c] = next.solution[r][c];
    next.collab_cells[player] = [...next.collab_cells[player], [r, c]];
    next.collabTurn = player === 'helio' ? 'thamy' : 'helio';

    let status = 'playing';
    if (isBoardComplete(next.board, next.solution)) {
      status = 'won';
      next.timer_seconds = computeTimer({ ...dbRow, ...timerPatch });
    }

    const updated = await updateGameRow(client, dbRow, {
      board: next.board,
      collab_turn: next.collabTurn,
      collab_scores: next.collab_scores,
      collab_cells: next.collab_cells,
      errors: next.errors,
      corrects: next.corrects,
      hints: next.hints,
      turn_locked: next.turn_locked,
      paused: next.paused,
      timer_seconds: next.timer_seconds,
      timer_started_at: next.timer_started_at,
      status,
    });

    if (status === 'won') {
      await recordCollabWinStats(client, updated, {
        collab_scores: next.collab_scores,
      });
    }

    await client.query('COMMIT');
    const name = player === 'helio' ? 'Helio' : 'Thamy';
    return {
      game: formatSudokuCollabGame(updated),
      chatMessage: `💡 ${name} usou uma dica!`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleSudokuCollabPause({ player, paused }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dbRow = await getActiveGameRow(client);
    if (!dbRow) throw new Error('Nenhum duelo ativo');

    const state = rowToState(dbRow);
    const now = new Date();
    let timerSeconds = dbRow.timer_seconds;
    let timerStartedAt = dbRow.timer_started_at;

    if (paused && !dbRow.paused) {
      timerSeconds = computeTimer(dbRow);
    } else if (!paused && dbRow.paused) {
      timerStartedAt = now;
    }

    const updated = await updateGameRow(client, dbRow, {
      board: state.board,
      collab_turn: state.collabTurn,
      collab_scores: state.collab_scores,
      collab_cells: state.collab_cells,
      errors: state.errors,
      corrects: state.corrects,
      hints: state.hints,
      turn_locked: state.turn_locked,
      paused: Boolean(paused),
      timer_seconds: timerSeconds,
      timer_started_at: timerStartedAt,
      status: dbRow.status,
    });

    await client.query('COMMIT');
    return { game: formatSudokuCollabGame(updated) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
