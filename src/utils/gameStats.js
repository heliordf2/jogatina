import defaultStats from '../data/gameStats.json';
import { loadScores } from './scores.js';

const STORAGE_KEY = 'jogatina_game_stats';

function cloneDefault() {
  return structuredClone(defaultStats);
}

function mergeWithDefault(parsed) {
  const base = cloneDefault();
  for (const game of Object.keys(base)) {
    for (const player of ['helio', 'thamy']) {
      base[game][player] = { ...base[game][player], ...parsed[game]?.[player] };
    }
  }
  return base;
}

function sudokuPlayerFromScores(playerScores) {
  return {
    total: playerScores.total,
    games: playerScores.games,
    best: playerScores.best,
    history: (playerScores.history ?? []).map((h) => ({
      pts: h.pts,
      time: h.time,
      diff: h.diff,
      type: h.type,
      date: h.date,
    })),
  };
}

function migrateSudokuFromScores(stats) {
  const scores = loadScores();
  stats.sudoku.helio = sudokuPlayerFromScores(scores.helio);
  stats.sudoku.thamy = sudokuPlayerFromScores(scores.thamy);
  return stats;
}

function needsSudokuHistoryMigration(stats) {
  for (const player of ['helio', 'thamy']) {
    const history = stats.sudoku[player]?.history;
    if (!Array.isArray(history) || history.length === 0) {
      const scores = loadScores();
      if (scores[player]?.history?.length > 0) return true;
    }
  }
  return false;
}

export function loadGameStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const migrated = migrateSudokuFromScores(cloneDefault());
      saveGameStats(migrated);
      return migrated;
    }
    const stats = mergeWithDefault(JSON.parse(raw));
    if (needsSudokuHistoryMigration(stats)) {
      const migrated = migrateSudokuFromScores(stats);
      saveGameStats(migrated);
      return migrated;
    }
    return stats;
  } catch {
    return cloneDefault();
  }
}

export function saveGameStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats, null, 2));
  } catch {
    // ignore storage errors
  }
}

export function syncSudokuStats(scores) {
  const stats = loadGameStats();
  stats.sudoku.helio = sudokuPlayerFromScores(scores.helio);
  stats.sudoku.thamy = sudokuPlayerFromScores(scores.thamy);
  saveGameStats(stats);
}

export function recordChessResult(winner) {
  const stats = loadGameStats();

  if (winner === 'draw') {
    stats.chess.helio.draws += 1;
    stats.chess.helio.games += 1;
    stats.chess.thamy.draws += 1;
    stats.chess.thamy.games += 1;
  } else {
    const loser = winner === 'helio' ? 'thamy' : 'helio';
    stats.chess[winner].wins += 1;
    stats.chess[winner].games += 1;
    stats.chess[loser].losses += 1;
    stats.chess[loser].games += 1;
  }

  saveGameStats(stats);
}
