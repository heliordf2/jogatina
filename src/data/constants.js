export const DIFF_NAMES = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
  extreme: '💀 Extremo',
};

export const DIFF_MULT = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  extreme: 3,
};

export const DIFF_EMPTY = {
  easy: '36 vazios',
  medium: '45 vazios',
  hard: '51 vazios',
  extreme: '53 vazios',
};

export const QUICK_MESSAGES = [
  '😂 Que sorte!',
  '🤔 Difícil...',
  '🎉 Vai Helio!',
  '🌹 Vai Thamy!',
  '💡 Preciso de dica',
  '😤 Quase!',
];

export const CHESS_QUICK_MESSAGES = [
  '👍 Boa jogada!',
  '😂 Sorte!',
  '🔥 Xeque!',
  '♟️ Boa!',
  '👏 Muito bem!',
  '😮 Uau!',
  '💪 Vamos!',
  '🎯 Boa estratégia!',
];

export const PLAYER_NAMES = {
  helio: 'Helio',
  thamy: 'Thamy',
};

export const PLAYER_COLORS = {
  helio: '#534AB7',
  thamy: '#993556',
};

export const INITIAL_SCORES = {
  helio: { total: 0, games: 0, best: null, history: [] },
  thamy: { total: 0, games: 0, best: null, history: [] },
};

export function createEmptyDrafts() {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set()),
  );
}

export function createInitialGameState() {
  return {
    board: [],
    solution: [],
    given: [],
    selected: null,
    errors: 0,
    corrects: 0,
    hints: 3,
    timer: 0,
    collabTurn: 'helio',
    collabScores: { helio: 0, thamy: 0 },
    collabCells: { helio: [], thamy: [] },
    isCollab: false,
    draftMode: false,
    drafts: createEmptyDrafts(),
    turnLocked: false,
    paused: false,
  };
}
