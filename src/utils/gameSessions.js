import { recordGameStartApi } from './api.js';

export function recordGameStart(player, game, mode = null) {
  if (!player || !game) return Promise.resolve();

  return recordGameStartApi({ player, game, mode }).catch(() => {});
}
