function resolveApiBase() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (!configured) return '/api';

  if (
    import.meta.env.PROD &&
    /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(configured)
  ) {
    return '/api';
  }

  return configured.replace(/\/$/, '');
}

const API_BASE = resolveApiBase();

function devOnlyHint(devText, prodText) {
  return import.meta.env.DEV ? devText : prodText;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        body.error ||
          devOnlyHint(
            'Rota não encontrada — reinicie com npm run dev',
            'Recurso não encontrado no servidor',
          ),
      );
    }
    throw new Error(body.error || `Erro na API (${response.status})`);
  }

  if (response.status === 204) return null;
  return body;
}

export async function checkApiHealth({ retries = 1, delayMs = 0 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Erro na API (${response.status})`);
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
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
