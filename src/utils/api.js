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
