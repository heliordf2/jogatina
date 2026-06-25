import { Chess } from 'chess.js';

const VALID_PLAYERS = new Set(['helio', 'thamy']);
const ACTIVE_STATUSES = new Set(['playing', 'check']);

export function rollChessColors() {
  const whitePlayer = Math.random() < 0.5 ? 'helio' : 'thamy';
  return {
    whitePlayer,
    blackPlayer: whitePlayer === 'helio' ? 'thamy' : 'helio',
  };
}

export function getChessWinner(chess, whitePlayer, blackPlayer) {
  if (!chess.isGameOver()) return null;
  if (chess.isDraw()) return 'draw';
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? blackPlayer : whitePlayer;
  }
  return null;
}

export function getChessStatus(chess) {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isDraw()) return 'draw';
  if (chess.isCheck()) return 'check';
  return 'playing';
}

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.has(status);
}

export function assertValidPlayer(player) {
  if (!VALID_PLAYERS.has(player)) {
    throw new Error('Jogador inválido');
  }
}

export function getTurnPlayer(row) {
  const chess = new Chess(row.fen);
  return chess.turn() === 'w' ? row.white_player : row.black_player;
}

export function normalizeMoves(moves) {
  if (Array.isArray(moves)) return moves;
  if (typeof moves === 'string') {
    try {
      const parsed = JSON.parse(moves);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function formatChessGame(row) {
  if (!row?.fen) return null;

  let chess;
  try {
    chess = new Chess(row.fen);
  } catch {
    return null;
  }

  return {
    id: row.id,
    fen: row.fen,
    moves: normalizeMoves(row.moves),
    whitePlayer: row.white_player,
    blackPlayer: row.black_player,
    turn: chess.turn(),
    status: row.status,
    winner: row.winner,
    version: row.version,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export function isValidGameRow(row) {
  if (!row?.fen || !row.white_player || !row.black_player) return false;
  try {
    new Chess(row.fen);
    return true;
  } catch {
    return false;
  }
}
