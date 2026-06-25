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
  const removes = { easy: 36, medium: 45, hard: 51, extreme: 53 }[diff] ?? 36;
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

export function isCellLocked(state, r, c) {
  return (
    !state.given[r][c] &&
    state.board[r][c] !== 0 &&
    state.board[r][c] === state.solution[r][c]
  );
}

export function isBoardComplete(board, solution) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

export function createGivenFromPuzzle(puzzle) {
  return puzzle.map((row) => row.map((v) => v !== 0));
}
