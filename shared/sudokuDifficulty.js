/** Única fonte de verdade — células removidas (= vazias a resolver). */
export const DIFF_REMOVES = {
  easy: 32,
  medium: 40,
  hard: 50,
  extreme: 58,
};

export const SUDOKU_DIFFICULTY_IDS = ['easy', 'medium', 'hard', 'extreme'];

export const VALID_SUDOKU_DIFFICULTIES = new Set(SUDOKU_DIFFICULTY_IDS);

export function getDiffEmptyCount(diff) {
  return DIFF_REMOVES[diff] ?? DIFF_REMOVES.easy;
}

export function getDiffGivenCount(diff) {
  return 81 - getDiffEmptyCount(diff);
}

export function getDiffStats(diff) {
  const empty = getDiffEmptyCount(diff);
  const given = 81 - empty;
  return { empty, given, removes: empty };
}

export function formatDiffStats(diff) {
  const { empty, given } = getDiffStats(diff);
  return `${empty} vazios · ${given} fixas`;
}
