const PIECE_SYMBOLS = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

const PIECE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 };

export function getCapturedPiecesFromMoves(Chess, moves = []) {
  const chess = new Chess();
  const whiteLost = [];
  const blackLost = [];

  for (const san of moves) {
    const move = chess.move(san);
    if (!move?.captured) continue;

    const lost = { type: move.captured, color: move.color === 'w' ? 'b' : 'w' };
    if (move.color === 'w') blackLost.push(lost);
    else whiteLost.push(lost);
  }

  const sortFn = (a, b) => PIECE_ORDER[a.type] - PIECE_ORDER[b.type];
  return {
    whiteLost: whiteLost.sort(sortFn),
    blackLost: blackLost.sort(sortFn),
  };
}

export { PIECE_SYMBOLS };

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
