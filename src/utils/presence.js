const STORAGE_KEY = 'jogatina_online';

export function readPresence() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'helio' || v === 'thamy' ? v : null;
  } catch {
    return null;
  }
}

export function writePresence(player) {
  try {
    if (player) localStorage.setItem(STORAGE_KEY, player);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isPlayerOnline(onlinePlayer, player) {
  return onlinePlayer === player;
}
