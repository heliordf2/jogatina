import { pool } from './db.js';
import { assertValidPlayer } from './chessLogic.js';
import {
  createGivenFromPuzzle,
  generateSudoku,
  isBoardComplete,
  isCellLocked,
} from './sudokuEngine.js';
import { VALID_SUDOKU_DIFFICULTIES } from '../shared/sudokuDifficulty.js';

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

function emptyCollabDraftsData() {
  const row = () => Array.from({ length: 9 }, () => []);
  return {
    helio: Array.from({ length: 9 }, row),
    thamy: Array.from({ length: 9 }, row),
  };
}

function parseCollabDrafts(value) {
  const empty = emptyCollabDraftsData();
  const raw = parseJson(value, empty);
  return {
    helio: (raw.helio ?? empty.helio).map((row) => row.map((nums) => [...nums])),
    thamy: (raw.thamy ?? empty.thamy).map((row) => row.map((nums) => [...nums])),
  };
}

function cloneCollabDrafts(drafts) {
  return {
    helio: drafts.helio.map((row) => row.map((nums) => [...nums])),
    thamy: drafts.thamy.map((row) => row.map((nums) => [...nums])),
  };
}

function clearCollabDraftAt(drafts, r, c) {
  drafts.helio[r][c] = [];
  drafts.thamy[r][c] = [];
}

function stateToDbPatch(state, extras = {}) {
  return {
    board: state.board,
    collab_turn: extras.collab_turn ?? state.collabTurn,
    collab_scores: state.collabScores,
    collab_cells: state.collabCells,
    collab_drafts: state.collabDrafts,
    errors: state.errors,
    corrects: state.corrects,
    hints: state.hints,
    turn_locked: extras.turn_locked ?? state.turnLocked,
    paused: extras.paused ?? state.paused,
    timer_seconds: extras.timer_seconds ?? state.timer_seconds ?? 0,
    timer_started_at: extras.timer_started_at ?? state.timer_started_at ?? new Date(),
    status: extras.status ?? state.status ?? 'playing',
  };
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
    collabDrafts: parseCollabDrafts(row.collab_drafts),
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
    rematchRequestedBy: row.rematch_requested_by ?? null,
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
  if (row) return formatSudokuCollabGame(row);

  const pending = await pool.query(`
    SELECT *
    FROM sudoku_collab_games
    WHERE rematch_requested_by IS NOT NULL
      AND status IN ('playing', 'won')
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const pendingRow = pending.rows[0] ?? null;
  return pendingRow ? formatSudokuCollabGame(pendingRow) : null;
}

async function insertSudokuCollabGame(client, difficulty, createdBy) {
  const { solution, puzzle } = generateSudoku(difficulty);
  const initial = createInitialRow({ difficulty, puzzle, solution, createdBy });

  const inserted = await client.query(
    `
      INSERT INTO sudoku_collab_games (
        difficulty, puzzle, solution, board, given,
        collab_turn, collab_scores, collab_cells, collab_drafts,
        errors, corrects, hints, turn_locked, paused,
        timer_seconds, status, created_by
      )
      VALUES (
        $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb,
        $6, $7::jsonb, $8::jsonb, $9::jsonb,
        $10, $11, $12, $13, $14,
        $15, $16, $17
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
      JSON.stringify(initial.collab_drafts),
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

  return inserted.rows[0];
}

async function getRematchableSudokuRow(client) {
  const active = await getActiveGameRow(client);
  if (active) return active;

  const result = await client.query(`
    SELECT *
    FROM sudoku_collab_games
    WHERE status = 'won'
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return result.rows[0] ?? null;
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
    collab_drafts: emptyCollabDraftsData(),
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
  if (!VALID_SUDOKU_DIFFICULTIES.has(difficulty)) {
    throw new Error('Dificuldade inválida');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await getActiveGameRow(client);
    let replacedDueToDifficulty = false;

    if (existing && !forceNew && existing.difficulty === difficulty) {
      await client.query('COMMIT');
      return { game: formatSudokuCollabGame(existing), joined: existing.created_by !== player };
    }

    if (existing && (forceNew || existing.difficulty !== difficulty)) {
      replacedDueToDifficulty = !forceNew && existing.difficulty !== difficulty;
      await client.query(
        `
          UPDATE sudoku_collab_games
          SET status = 'abandoned', updated_at = NOW(), version = version + 1
          WHERE id = $1
        `,
        [existing.id],
      );
    }

    const inserted = await insertSudokuCollabGame(client, difficulty, player);

    await client.query('COMMIT');
    return {
      game: formatSudokuCollabGame(inserted),
      joined: false,
      replacedDueToDifficulty,
    };
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
  const scores = state.collabScores ?? state.collab_scores;

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
        INSERT INTO sudoku_games (player_id, pts, time_str, difficulty, game_type, played_date, errors)
        VALUES ($1, $2, $3, $4, 'collab', $5, $6)
      `,
      [playerId, pts, timeStr, dbRow.difficulty, playedDate, dbRow.errors ?? 0],
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
        collab_drafts = $6::jsonb,
        errors = $7,
        corrects = $8,
        hints = $9,
        turn_locked = $10,
        paused = $11,
        timer_seconds = $12,
        timer_started_at = $13,
        status = $14,
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
      JSON.stringify(patch.collab_drafts),
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

    const strictTurn = state.turnLocked;
    if (strictTurn && state.collabTurn !== player) {
      throw new Error('Não é a sua vez');
    }
    if (state.given[r]?.[c] || isCellLocked(state, r, c)) {
      throw new Error('Célula bloqueada');
    }

    const timerPatch = syncTimerBeforeMutation(dbRow);
    const next = {
      ...state,
      board: state.board.map((row) => [...row]),
      collabScores: { ...state.collabScores },
      collabCells: {
        helio: [...state.collabCells.helio],
        thamy: [...state.collabCells.thamy],
      },
      collabDrafts: cloneCollabDrafts(state.collabDrafts),
      ...timerPatch,
      turnLocked: false,
    };

    let chatMessage = null;

    if (n === 0) {
      next.board[r][c] = 0;
      next.collabCells.helio = next.collabCells.helio.filter(([cr, cc]) => !(cr === r && cc === c));
      next.collabCells.thamy = next.collabCells.thamy.filter(([cr, cc]) => !(cr === r && cc === c));
      clearCollabDraftAt(next.collabDrafts, r, c);
    } else {
      const correct = n === next.solution[r][c];
      const actor = strictTurn ? next.collabTurn : player;
      next.board[r][c] = n;
      next.collabCells.helio = next.collabCells.helio.filter(([cr, cc]) => !(cr === r && cc === c));
      next.collabCells.thamy = next.collabCells.thamy.filter(([cr, cc]) => !(cr === r && cc === c));
      next.collabCells[actor] = [...next.collabCells[actor], [r, c]];
      clearCollabDraftAt(next.collabDrafts, r, c);

      if (correct) {
        next.collabScores[actor] = next.collabScores[actor] + 10;
        next.corrects += 1;
        chatMessage = `${actor === 'helio' ? '🟣 Helio' : '🩷 Thamy'} acertou +10! ✅`;
      } else {
        next.collabScores[actor] = Math.max(0, next.collabScores[actor] - 5);
        next.errors += 1;
        chatMessage = `❌ ${actor === 'helio' ? 'Helio' : 'Thamy'} errou -5pts`;
      }

      if (strictTurn) {
        next.collabTurn = actor === 'helio' ? 'thamy' : 'helio';
      }
    }

    let status = 'playing';
    if (isBoardComplete(next.board, next.solution)) {
      status = 'won';
      next.timer_seconds = computeTimer({ ...dbRow, ...timerPatch });
    }

    const updated = await updateGameRow(
      client,
      dbRow,
      stateToDbPatch(next, {
        status,
        timer_seconds: next.timer_seconds,
        timer_started_at: next.timer_started_at,
      }),
    );

    if (status === 'won') {
      await recordCollabWinStats(client, updated, {
        collabScores: next.collabScores,
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
    const updated = await updateGameRow(
      client,
      dbRow,
      stateToDbPatch(state, {
        turn_locked: Boolean(locked),
        timer_seconds: timerPatch.timer_seconds,
        timer_started_at: timerPatch.timer_started_at,
        status: dbRow.status,
      }),
    );

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
    const strictTurn = state.turnLocked;
    if (strictTurn && state.collabTurn !== player) {
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
      collabScores: { ...state.collabScores },
      collabCells: {
        helio: [...state.collabCells.helio],
        thamy: [...state.collabCells.thamy],
      },
      collabDrafts: cloneCollabDrafts(state.collabDrafts),
      ...timerPatch,
      hints: state.hints - 1,
      corrects: state.corrects + 1,
      turnLocked: false,
    };

    next.board[r][c] = next.solution[r][c];
    next.collabCells[player] = [...next.collabCells[player], [r, c]];
    clearCollabDraftAt(next.collabDrafts, r, c);
    if (strictTurn) {
      next.collabTurn = player === 'helio' ? 'thamy' : 'helio';
    }

    let status = 'playing';
    if (isBoardComplete(next.board, next.solution)) {
      status = 'won';
      next.timer_seconds = computeTimer({ ...dbRow, ...timerPatch });
    }

    const updated = await updateGameRow(
      client,
      dbRow,
      stateToDbPatch(next, {
        status,
        timer_seconds: next.timer_seconds,
        timer_started_at: next.timer_started_at,
      }),
    );

    if (status === 'won') {
      await recordCollabWinStats(client, updated, {
        collabScores: next.collabScores,
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

export async function applySudokuCollabDraft({ player, row: rowIndex, col, num }) {
  assertValidPlayer(player);

  if (num < 1 || num > 9) {
    throw new Error('Número inválido');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dbRow = await getActiveGameRow(client);
    if (!dbRow) throw new Error('Nenhum duelo ativo');

    const state = rowToState(dbRow);
    const r = rowIndex;
    const c = col;

    const strictTurn = state.turnLocked;
    if (strictTurn && state.collabTurn !== player) {
      throw new Error('Não é a sua vez');
    }
    if (state.given[r]?.[c] || state.board[r]?.[c] !== 0) {
      throw new Error('Célula indisponível para rascunho');
    }
    if (isCellLocked(state, r, c)) {
      throw new Error('Célula bloqueada');
    }

    const timerPatch = syncTimerBeforeMutation(dbRow);
    const collabDrafts = cloneCollabDrafts(state.collabDrafts);
    const cell = collabDrafts[player][r][c];
    const idx = cell.indexOf(num);
    if (idx >= 0) cell.splice(idx, 1);
    else {
      cell.push(num);
      cell.sort((a, b) => a - b);
    }

    const next = {
      ...state,
      collabDrafts,
      ...timerPatch,
    };

    const updated = await updateGameRow(
      client,
      dbRow,
      stateToDbPatch(next, {
        timer_seconds: timerPatch.timer_seconds,
        timer_started_at: timerPatch.timer_started_at,
        status: dbRow.status,
      }),
    );

    await client.query('COMMIT');
    return { game: formatSudokuCollabGame(updated) };
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

    const updated = await updateGameRow(
      client,
      dbRow,
      stateToDbPatch(state, {
        paused: Boolean(paused),
        timer_seconds: timerSeconds,
        timer_started_at: timerStartedAt,
        status: dbRow.status,
      }),
    );

    await client.query('COMMIT');
    return { game: formatSudokuCollabGame(updated) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function requestSudokuCollabRematch({ player }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const row = await getRematchableSudokuRow(client);
    if (!row) {
      throw new Error('Nenhum duelo para reiniciar');
    }

    if (row.rematch_requested_by === player) {
      await client.query('COMMIT');
      return { action: 'pending', game: formatSudokuCollabGame(row) };
    }

    if (row.rematch_requested_by && row.rematch_requested_by !== player) {
      await client.query('ROLLBACK');
      return respondSudokuCollabRematch({ player, accept: true });
    }

    const updated = await client.query(
      `
        UPDATE sudoku_collab_games
        SET rematch_requested_by = $2, version = version + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [row.id, player],
    );

    await client.query('COMMIT');
    return { action: 'requested', game: formatSudokuCollabGame(updated.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function respondSudokuCollabRematch({ player, accept }) {
  assertValidPlayer(player);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      SELECT *
      FROM sudoku_collab_games
      WHERE rematch_requested_by IS NOT NULL
        AND status IN ('playing', 'won')
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Nenhum pedido de nova partida pendente');
    }

    if (row.rematch_requested_by === player) {
      throw new Error('Aguarde a resposta do outro jogador');
    }

    if (!accept) {
      const updated = await client.query(
        `
          UPDATE sudoku_collab_games
          SET rematch_requested_by = NULL, version = version + 1, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [row.id],
      );
      await client.query('COMMIT');
      return { action: 'declined', game: formatSudokuCollabGame(updated.rows[0]) };
    }

    const requester = row.rematch_requested_by;

    if (row.status === 'playing') {
      await client.query(
        `
          UPDATE sudoku_collab_games
          SET status = 'abandoned', rematch_requested_by = NULL, version = version + 1, updated_at = NOW()
          WHERE id = $1
        `,
        [row.id],
      );
    } else {
      await client.query(
        `
          UPDATE sudoku_collab_games
          SET rematch_requested_by = NULL, version = version + 1, updated_at = NOW()
          WHERE id = $1
        `,
        [row.id],
      );
    }

    const inserted = await insertSudokuCollabGame(client, row.difficulty, requester);
    await client.query('COMMIT');
    return { action: 'accepted', game: formatSudokuCollabGame(inserted) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
