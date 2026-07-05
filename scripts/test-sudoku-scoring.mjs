import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCollabScore,
  calcSoloScore,
  mergeSudokuPlayer,
} from '../shared/sudokuScoring.js';

test('calcSoloScore — partida perfeita fácil', () => {
  assert.equal(calcSoloScore(0, 'easy'), 1000);
});

test('calcSoloScore — penalidade por erro', () => {
  assert.equal(calcSoloScore(2, 'medium'), Math.round((1000 - 160) * 1.5));
});

test('calcSoloScore — zera com muitos erros', () => {
  assert.equal(calcSoloScore(13, 'easy'), 0);
  assert.equal(calcSoloScore(5, 'easy'), 600);
});

test('calcSoloScore — extremo amplifica a pontuação', () => {
  assert.equal(calcSoloScore(0, 'extreme'), 3000);
});

test('applyCollabScore — acerto e erro', () => {
  assert.equal(applyCollabScore(0, true), 10);
  assert.equal(applyCollabScore(10, false), 5);
  assert.equal(applyCollabScore(3, false), 0);
});

test('mergeSudokuPlayer — não apaga progresso remoto quando local está zerado', () => {
  const remote = {
    total: 500,
    games: 5,
    best: 900,
    history: [{ pts: 100, diff: 'easy', type: 'solo', date: '01/01/2026', time: '1:00', errors: 0 }],
  };
  const staleLocal = {
    total: 1000,
    games: 1,
    best: 1000,
    history: [{ pts: 1000, diff: 'easy', type: 'solo', date: '05/07/2026', time: '2:00', errors: 0 }],
  };

  const merged = mergeSudokuPlayer(remote, staleLocal);
  assert.equal(merged.total, remote.total);
  assert.equal(merged.games, remote.games);
});

test('mergeSudokuPlayer — soma nova partida sobre o remoto', () => {
  const remote = {
    total: 500,
    games: 5,
    best: 900,
    history: [],
  };
  const local = {
    total: 1500,
    games: 6,
    best: 1000,
    history: [{ pts: 1000, diff: 'easy', type: 'solo', date: '05/07/2026', time: '2:00', errors: 0 }],
  };

  const merged = mergeSudokuPlayer(remote, local);
  assert.equal(merged.total, 1500);
  assert.equal(merged.games, 6);
  assert.equal(merged.best, 1000);
  assert.equal(merged.history.length, 1);
  assert.equal(merged.history[0].pts, 1000);
});

test('mergeSudokuPlayer — duas partidas novas na mesma sessão', () => {
  const remote = { total: 200, games: 2, best: 120, history: [] };
  const local = {
    total: 500,
    games: 4,
    best: 150,
    history: [
      { pts: 150, diff: 'easy', type: 'solo', date: '05/07/2026', time: '3:00', errors: 1 },
      { pts: 150, diff: 'easy', type: 'solo', date: '05/07/2026', time: '2:00', errors: 1 },
    ],
  };

  const merged = mergeSudokuPlayer(remote, local);
  assert.equal(merged.total, 500);
  assert.equal(merged.games, 4);
});
