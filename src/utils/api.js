const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 404) {
      throw new Error(body.error || 'Rota não encontrada — reinicie o servidor (npm run dev)');
    }
    throw new Error(body.error || `Erro na API (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function fetchGameStats() {
  return request('/stats');
}

export function saveGameStatsApi(stats) {
  return request('/stats', {
    method: 'PUT',
    body: JSON.stringify(stats),
  });
}

export function fetchSudokuScores() {
  return request('/sudoku/scores');
}

export function saveSudokuScoresApi(scores) {
  return request('/sudoku/scores', {
    method: 'PUT',
    body: JSON.stringify(scores),
  });
}

export function checkApiHealth() {
  return request('/health');
}

export function recordGameStartApi({ player, game, mode = null }) {
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ player, game, mode }),
  });
}

export function fetchActiveChessGame() {
  return fetch(`${API_BASE}/chess/game`, {
    headers: { 'Content-Type': 'application/json' },
  }).then(async (response) => {
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Erro na API (${response.status})`);
    }
    return response.json();
  });
}

export function createOrJoinChessGame({ player, forceNew = false }) {
  return request('/chess/game', {
    method: 'POST',
    body: JSON.stringify({ player, forceNew }),
  });
}

export function postChessMove({ player, from, to, promotion = 'q' }) {
  return request('/chess/game/move', {
    method: 'POST',
    body: JSON.stringify({ player, from, to, promotion }),
  });
}

export function postChessResign({ player }) {
  return request('/chess/game/resign', {
    method: 'POST',
    body: JSON.stringify({ player }),
  });
}

export function fetchPresence() {
  return request('/presence');
}

export function touchPresenceApi(player) {
  return request('/presence', {
    method: 'POST',
    body: JSON.stringify({ player }),
  });
}

export function fetchChatMessages() {
  return request('/chat');
}

export function postChatMessage({ sender, player = null, text }) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ sender, player, text }),
  });
}

export function clearChatApi() {
  return request('/chat', { method: 'DELETE' });
}
