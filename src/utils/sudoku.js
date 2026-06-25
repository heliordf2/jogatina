export function generateSudoku(diff) {
  const base = () => [...Array(9)].map(() => Array(9).fill(0));

  function possible(b, r, c, n) {
    for (let i = 0; i < 9; i++) {
      if (b[r][i] === n || b[i][c] === n) return false;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (b[br + i][bc + j] === n) return false;
      }
    }
    return true;
  }

  function fill(b) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
          for (const n of nums) {
            if (possible(b, r, c, n)) {
              b[r][c] = n;
              if (fill(b)) return true;
              b[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  const sol = base();
  fill(sol);
  const puz = sol.map((r) => [...r]);
  const removes = { easy: 36, medium: 45, hard: 51, extreme: 53 }[diff];
  let removed = 0;
  const cells = [...Array(81).keys()].sort(() => Math.random() - 0.5);
  for (const idx of cells) {
    if (removed >= removes) break;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    puz[r][c] = 0;
    removed++;
  }
  return { solution: sol, puzzle: puz };
}

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
  return (
    !game.given[r][c] &&
    game.board[r][c] !== 0 &&
    game.board[r][c] === game.solution[r][c]
  );
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
