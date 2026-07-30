/** Multiplicadores por dificuldade (solo). */
export const SOLO_DIFF_MULT = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  extreme: 3,
};

export const SOLO_BASE_PTS = 1000;
export const SOLO_ERROR_PENALTY = 50;

/** Tempo de referência (segundos) por dificuldade: nele, o fator de tempo vale 1 + SOLO_TIME_BONUS_WEIGHT. */
export const SOLO_PAR_TIME_SEC = {
  easy: 20 * 60,
  medium: 25 * 60,
  hard: 30 * 60,
  extreme: 40 * 60,
};

export const SOLO_TIME_BONUS_WEIGHT = 0.5;

export const COLLAB_CORRECT_PTS = 10;
export const COLLAB_WRONG_PENALTY = 5;

/**
 * Fator de bônus por tempo: sempre >= 1 (nunca reduz o score base).
 * Quanto mais rápido que o parTime, maior o fator (sem teto); quanto mais
 * devagar, o fator decai continuamente rumo a 1, sem nunca chegar lá.
 */
export function calcTimeFactor(elapsedSeconds, difficulty = 'easy') {
  if (elapsedSeconds == null) return 1;
  const parTime = SOLO_PAR_TIME_SEC[difficulty] ?? SOLO_PAR_TIME_SEC.easy;
  const t = Math.max(1, elapsedSeconds);
  return 1 + SOLO_TIME_BONUS_WEIGHT * (parTime / t);
}

/** Pontuação final do modo solo ao completar o tabuleiro. */
export function calcSoloScore(errors, difficulty = 'easy', elapsedSeconds = null) {
  const mult = SOLO_DIFF_MULT[difficulty] ?? SOLO_DIFF_MULT.easy;
  const raw = (SOLO_BASE_PTS - (errors ?? 0) * SOLO_ERROR_PENALTY) * mult;
  const timeFactor = calcTimeFactor(elapsedSeconds, difficulty);
  return Math.max(0, Math.round(raw * timeFactor));
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
