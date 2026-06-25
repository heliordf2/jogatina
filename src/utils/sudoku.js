import {
  generateSudoku,
  isCellLocked as isCellLockedCore,
} from '../../shared/sudokuGenerate.js';

export { generateSudoku };

export function getBoxNums(board, r, c) {
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  const used = new Set();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const v = board[br + i][bc + j];
      if (v) used.add(v);
    }
  }
  return used;
}

export function isCellLocked(game, r, c) {
  return isCellLockedCore(game, r, c);
}

export function removeDraftFromRegion(drafts, r, c, n) {
  for (let col = 0; col < 9; col += 1) {
    if (col !== c) drafts[r][col].delete(n);
  }

  for (let row = 0; row < 9; row += 1) {
    if (row !== r) drafts[row][c].delete(n);
  }

  const boxRow = Math.floor(r / 3) * 3;
  const boxCol = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const rr = boxRow + i;
      const cc = boxCol + j;
      if (rr !== r || cc !== c) drafts[rr][cc].delete(n);
    }
  }
}
