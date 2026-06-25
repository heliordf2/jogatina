import defaultStats from '../data/gameStats.json';
import { fetchGameStats, saveGameStatsApi } from './api.js';

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

function isStatsEmpty(stats) {
  return (
    stats.sudoku.helio.games === 0 &&
    stats.sudoku.thamy.games === 0 &&
    stats.chess.helio.games === 0 &&
    stats.chess.thamy.games === 0
  );
}

function loadStatsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return mergeWithDefault(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clearStatsLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function saveStatsToLocalStorage(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats, null, 2));
  } catch {
    // ignore
  }
}

export async function loadGameStats() {
  try {
    const remote = mergeWithDefault(await fetchGameStats());

    if (isStatsEmpty(remote)) {
      const local = loadStatsFromLocalStorage();
      if (local && !isStatsEmpty(local)) {
        await saveGameStatsApi(local);
        clearStatsLocalStorage();
        return local;
      }
    }

    return remote;
  } catch {
    const local = loadStatsFromLocalStorage();
    return local ?? cloneDefault();
  }
}

export async function saveGameStats(stats) {
  try {
    await saveGameStatsApi(stats);
    clearStatsLocalStorage();
  } catch {
    saveStatsToLocalStorage(stats);
  }
}

export async function syncSudokuStats(scores) {
  const stats = await loadGameStats();
  stats.sudoku.helio = sudokuPlayerFromScores(scores.helio);
  stats.sudoku.thamy = sudokuPlayerFromScores(scores.thamy);
  await saveGameStats(stats);
}

export async function recordChessResult(winner) {
  const stats = await loadGameStats();

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

  await saveGameStats(stats);
}
