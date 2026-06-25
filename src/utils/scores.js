import { INITIAL_SCORES } from '../data/constants.js';

const STORAGE_KEY = 'sudoku_ht_v2';

export function loadScores() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return structuredClone(INITIAL_SCORES);
    const parsed = JSON.parse(data);
    return {
      helio: { ...INITIAL_SCORES.helio, ...parsed.helio },
      thamy: { ...INITIAL_SCORES.thamy, ...parsed.thamy },
    };
  } catch {
    return structuredClone(INITIAL_SCORES);
  }
}

export function saveScores(scores) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // ignore storage errors
  }
}
