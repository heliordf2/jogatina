/** Multiplicadores por dificuldade (solo). */
export const SOLO_DIFF_MULT = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  extreme: 3,
};

export const SOLO_BASE_PTS = 1000;
export const SOLO_ERROR_PENALTY = 50;

export const COLLAB_CORRECT_PTS = 10;
export const COLLAB_WRONG_PENALTY = 5;

/** Pontuação final do modo solo ao completar o tabuleiro. */
export function calcSoloScore(errors, difficulty = 'easy') {
  const mult = SOLO_DIFF_MULT[difficulty] ?? SOLO_DIFF_MULT.easy;
  const raw = (SOLO_BASE_PTS - (errors ?? 0) * SOLO_ERROR_PENALTY) * mult;
  return Math.max(0, Math.round(raw));
}

/** Aplica acerto/erro no duelo; pontuação nunca fica negativa. */
export function applyCollabScore(currentScore, correct) {
  const base = currentScore ?? 0;
  if (correct) return base + COLLAB_CORRECT_PTS;
  return Math.max(0, base - COLLAB_WRONG_PENALTY);
}

/**
 * Mescla pontuação local com a do servidor sem apagar progresso remoto.
 * Usado quando o cliente ainda não tinha carregado os scores antes de salvar.
 */
export function mergeSudokuPlayer(remote, incoming) {
  const remotePlayer = remote ?? { total: 0, games: 0, best: null, history: [] };
  const incomingPlayer = incoming ?? { total: 0, games: 0, best: null, history: [] };

  const remoteGames = remotePlayer.games ?? 0;
  const incomingGames = incomingPlayer.games ?? 0;

  if (incomingGames <= remoteGames) {
    return remotePlayer;
  }

  const extraGames = incomingGames - remoteGames;
  const newEntries = (incomingPlayer.history ?? []).slice(0, extraGames);
  const addedPts = newEntries.reduce((sum, entry) => sum + (entry.pts ?? 0), 0);

  const remoteBest = remotePlayer.best ?? null;
  const incomingBest = incomingPlayer.best ?? null;
  const best =
    remoteBest != null && incomingBest != null
      ? Math.max(remoteBest, incomingBest)
      : incomingBest ?? remoteBest;

  return {
    total: (remotePlayer.total ?? 0) + addedPts,
    games: remoteGames + extraGames,
    best,
    history: [...newEntries, ...(remotePlayer.history ?? [])].slice(0, 20),
  };
}
