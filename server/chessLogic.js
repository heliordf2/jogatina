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

export function formatChessGame(row) {
  const chess = new Chess(row.fen);
  return {
    id: row.id,
    fen: row.fen,
    moves: row.moves ?? [],
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
