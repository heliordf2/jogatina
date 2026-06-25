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

const API_FETCH_OPTIONS = {
  cache: 'no-store',
  headers: { 'Content-Type': 'application/json' },
};

function isValidChessGame(game) {
  return Boolean(
    game &&
      typeof game.id === 'number' &&
      typeof game.fen === 'string' &&
      game.whitePlayer &&
      game.blackPlayer,
  );
}

function isValidSudokuCollabGame(game) {
  return Boolean(
    game &&
      typeof game.id === 'number' &&
      Array.isArray(game.board) &&
      game.board.length === 9 &&
      game.collabTurn &&
      game.difficulty,
  );
}

function sanitizeClientError(message, fallback) {
  if (!message) return fallback;
  if (/127\.0\.0\.1|localhost|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(message)) {
    return 'Não foi possível conectar ao servidor';
  }
  if (/postgres:\/\//i.test(message) || /password/i.test(message)) {
    return 'Erro de conexão com o banco de dados';
  }
  return message;
}

function devOnlyHint(devText, prodText) {
  return import.meta.env.DEV ? devText : prodText;
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...API_FETCH_OPTIONS,
      ...options,
      headers: {
        ...API_FETCH_OPTIONS.headers,
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(
      sanitizeClientError(
        error.message,
        devOnlyHint('API offline — rode npm run dev', 'Não foi possível conectar ao servidor'),
      ),
    );
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404) {
      const fallback = devOnlyHint(
        'Rota não encontrada — reinicie com npm run dev',
        'Recurso não encontrado no servidor',
      );
      throw new Error(sanitizeClientError(body.error, fallback));
    }
    throw new Error(
      sanitizeClientError(body.error, `Erro na API (${response.status})`),
    );
  }

  if (response.status === 204) return null;
  return body;
}

export async function checkApiHealth({ retries = 1, delayMs = 0 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/health`, API_FETCH_OPTIONS);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(sanitizeClientError(body.error, `Erro na API (${response.status})`));
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
  return fetch(`${API_BASE}/chess/game?_=${Date.now()}`, API_FETCH_OPTIONS).then(
    async (response) => {
      if (response.status === 404 || response.status === 304) return null;
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          sanitizeClientError(body?.error, `Erro na API (${response.status})`),
        );
      }
      if (!isValidChessGame(body)) return null;
      return body;
    },
  );
}

export async function createOrJoinChessGame({ player, forceNew = false }) {
  const game = await request('/chess/game', {
    method: 'POST',
    body: JSON.stringify({ player, forceNew }),
  });
  if (!isValidChessGame(game)) {
    throw new Error('Resposta inválida do servidor ao criar a partida');
  }
  return game;
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

export function fetchActiveSudokuCollabGame() {
  return fetch(`${API_BASE}/sudoku/collab/game?_=${Date.now()}`, API_FETCH_OPTIONS).then(
    async (response) => {
      if (response.status === 404 || response.status === 304) return null;
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          sanitizeClientError(body?.error, `Erro na API (${response.status})`),
        );
      }
      if (!isValidSudokuCollabGame(body)) return null;
      return body;
    },
  );
}

export async function createOrJoinSudokuCollabGame({ player, difficulty, forceNew = false }) {
  const result = await request('/sudoku/collab/game', {
    method: 'POST',
    body: JSON.stringify({ player, difficulty, forceNew }),
  });
  if (!isValidSudokuCollabGame(result?.game)) {
    throw new Error('Resposta inválida do servidor ao criar o duelo');
  }
  return result;
}

export function postSudokuCollabCell({ player, row, col, value }) {
  return request('/sudoku/collab/game/cell', {
    method: 'POST',
    body: JSON.stringify({ player, row, col, value }),
  });
}

export function postSudokuCollabTurnLock({ player, locked }) {
  return request('/sudoku/collab/game/turn-lock', {
    method: 'POST',
    body: JSON.stringify({ player, locked }),
  });
}

export function postSudokuCollabHint({ player }) {
  return request('/sudoku/collab/game/hint', {
    method: 'POST',
    body: JSON.stringify({ player }),
  });
}

export function postSudokuCollabPause({ player, paused }) {
  return request('/sudoku/collab/game/pause', {
    method: 'POST',
    body: JSON.stringify({ player, paused }),
  });
}
