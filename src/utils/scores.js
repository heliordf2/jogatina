import { INITIAL_SCORES } from '../data/constants.js';
import { fetchSudokuScores, saveSudokuScoresApi } from './api.js';

const STORAGE_KEY = 'sudoku_ht_v2';

function cloneDefault() {
  return structuredClone(INITIAL_SCORES);
}

function mergeScores(parsed) {
  return {
    helio: { ...INITIAL_SCORES.helio, ...parsed.helio },
    thamy: { ...INITIAL_SCORES.thamy, ...parsed.thamy },
  };
}

function isScoresEmpty(scores) {
  return scores.helio.games === 0 && scores.thamy.games === 0;
}

function loadScoresFromLocalStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return mergeScores(JSON.parse(data));
  } catch {
    return null;
  }
}

function clearScoresLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function loadScores() {
  try {
    const remote = mergeScores(await fetchSudokuScores());

    if (isScoresEmpty(remote)) {
      const local = loadScoresFromLocalStorage();
      if (local && !isScoresEmpty(local)) {
        await saveSudokuScoresApi(local);
        clearScoresLocalStorage();
        return local;
      }
    }

    return remote;
  } catch {
    const local = loadScoresFromLocalStorage();
    return local ?? cloneDefault();
  }
}

export async function saveScores(scores) {
  try {
    await saveSudokuScoresApi(scores);
    clearScoresLocalStorage();
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      // ignore storage errors
    }
  }
}
