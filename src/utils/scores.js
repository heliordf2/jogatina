import { INITIAL_SCORES } from '../data/constants.js';
import { mergeSudokuPlayer } from '../../shared/sudokuScoring.js';
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

let scoresLoadPromise = null;
let cachedScores = null;

function rememberScores(scores) {
  cachedScores = mergeScores(scores);
  return cachedScores;
}

/** Garante que a pontuação foi carregada do servidor antes de gravar uma partida. */
export async function ensureScoresLoaded() {
  if (cachedScores) return cachedScores;
  if (!scoresLoadPromise) {
    scoresLoadPromise = loadScores().then((scores) => {
      rememberScores(scores);
      return scores;
    });
  }
  return scoresLoadPromise;
}

export async function loadScores() {
  try {
    const remote = mergeScores(await fetchSudokuScores());

    if (isScoresEmpty(remote)) {
      const local = loadScoresFromLocalStorage();
      if (local && !isScoresEmpty(local)) {
        await saveSudokuScoresApi(local);
        clearScoresLocalStorage();
        return rememberScores(local);
      }
    }

    return rememberScores(remote);
  } catch {
    const local = loadScoresFromLocalStorage();
    const scores = local ?? cloneDefault();
    return rememberScores(scores);
  }
}

function mergeAllScores(remote, incoming) {
  return {
    helio: mergeSudokuPlayer(remote.helio, incoming.helio),
    thamy: mergeSudokuPlayer(remote.thamy, incoming.thamy),
  };
}

export async function saveScores(scores) {
  let payload = mergeScores(scores);

  try {
    const remote = mergeScores(await fetchSudokuScores());
    payload = mergeAllScores(remote, payload);
    await saveSudokuScoresApi(payload);
    clearScoresLocalStorage();
    rememberScores(payload);
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      rememberScores(payload);
    } catch {
      // ignore storage errors
    }
  }
}
