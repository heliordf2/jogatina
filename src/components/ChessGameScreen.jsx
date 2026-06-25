import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import { isPlayerOnline } from '../utils/presence.js';
import {
  getCapturedPiecesFromMoves,
  getChessStatus,
  getChessWinner,
  PIECE_SYMBOLS,
} from '../utils/chessHelpers.js';
import { recordChessResult } from '../utils/gameStats.js';
import { playCaptureSound, playCheckSound, playMoveSound, unlockAudio } from '../utils/chessSounds.js';

const MOVE_HIGHLIGHT = 'radial-gradient(circle, rgba(16, 185, 129, 0.55) 22%, transparent 22%)';
const CAPTURE_HIGHLIGHT = 'radial-gradient(circle, rgba(16, 185, 129, 0.5) 82%, transparent 82%)';
const SELECTED_HIGHLIGHT = 'rgba(16, 185, 129, 0.45)';

function CapturedPanel({ label, pieces, color }) {
  return (
    <div className={`captured-side captured-${color}`}>
      <span className="captured-label">{label}</span>
      <span className="captured-sub">peças perdidas</span>
      <div className="captured-pieces">
        {pieces.length === 0 ? (
          <span className="captured-empty">—</span>
        ) : (
          pieces.map((piece, i) => (
            <span key={`${piece.type}-${i}`} className={`captured-piece piece-${piece.color}`}>
              {PIECE_SYMBOLS[piece.color][piece.type]}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function createInitialState() {
  const chess = new Chess();
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    moves: [],
    status: 'playing',
    winner: null,
  };
}

export default function ChessGameScreen({
  myself,
  onlinePlayer,
  onGoHome,
  onSwitchPlayer,
  onSystemMessage,
  showToast,
}) {
  const chessRef = useRef(new Chess());
  const [gameState, setGameState] = useState(createInitialState);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const prevMovesCount = useRef(0);
  const recordedResultRef = useRef(false);

  const activePlayer = gameState.turn === 'w' ? 'helio' : 'thamy';
  const isMyTurn = myself === activePlayer;
  const isPlaying = !['checkmate', 'draw'].includes(gameState.status);
  const myPieceColor = myself === 'helio' ? 'w' : 'b';
  const boardOrientation = myself === 'helio' ? 'white' : 'black';

  const { whiteLost, blackLost } = useMemo(
    () => getCapturedPiecesFromMoves(Chess, gameState.moves),
    [gameState.moves],
  );

  useEffect(() => {
    setSelectedSquare(null);
  }, [gameState.fen]);

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    if (!gameState.winner || recordedResultRef.current) return;
    if (!['checkmate', 'draw'].includes(gameState.status)) return;

    recordedResultRef.current = true;
    recordChessResult(gameState.winner);
  }, [gameState.winner, gameState.status]);

  useEffect(() => {
    const moves = gameState.moves || [];
    if (moves.length <= prevMovesCount.current) {
      prevMovesCount.current = moves.length;
      return;
    }

    const chess = new Chess();
    for (let i = 0; i < moves.length - 1; i += 1) {
      chess.move(moves[i]);
    }
    const lastMove = chess.move(moves[moves.length - 1]);

    if (lastMove) {
      if (lastMove.captured) playCaptureSound();
      else playMoveSound();
      if (chess.inCheck()) {
        setTimeout(() => playCheckSound(), lastMove.captured ? 130 : 70);
      }
    }

    prevMovesCount.current = moves.length;
  }, [gameState.moves]);

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !isMyTurn || !isPlaying) return [];
    const chess = new Chess(gameState.fen);
    return chess.moves({ square: selectedSquare, verbose: true });
  }, [selectedSquare, gameState.fen, isMyTurn, isPlaying]);

  const squareStyles = useMemo(() => {
    const styles = {};
    if (!selectedSquare) return styles;
    styles[selectedSquare] = { backgroundColor: SELECTED_HIGHLIGHT };
    for (const move of legalMoves) {
      styles[move.to] = {
        background: move.captured ? CAPTURE_HIGHLIGHT : MOVE_HIGHLIGHT,
      };
    }
    return styles;
  }, [selectedSquare, legalMoves]);

  function isOwnPiece(square) {
    const chess = new Chess(gameState.fen);
    const piece = chess.get(square);
    return piece?.color === myPieceColor;
  }

  function applyMove(from, to) {
    if (!isMyTurn || !isPlaying) {
      if (!isMyTurn) {
        showToast(`É a vez de ${PLAYER_NAMES[activePlayer]}!`);
      }
      return false;
    }

    try {
      const move = chessRef.current.move({ from, to, promotion: 'q' });
      if (!move) return false;

      const chess = chessRef.current;
      const winner = getChessWinner(chess);
      const status = getChessStatus(chess);

      setGameState({
        fen: chess.fen(),
        turn: chess.turn(),
        moves: chess.history(),
        status,
        winner,
      });

      if (winner && winner !== 'draw') {
        onSystemMessage(`🏆 ${PLAYER_NAMES[winner]} venceu a partida!`);
      } else if (winner === 'draw') {
        onSystemMessage('🤝 Partida empatada!');
      }

      return true;
    } catch {
      return false;
    }
  }

  function tryMove(from, to) {
    if (!to) return false;
    const moved = applyMove(from, to);
    if (moved) setSelectedSquare(null);
    return moved;
  }

  function handlePieceClick({ square }) {
    if (!isPlaying || !square) return;
    if (!isMyTurn) {
      showToast(`É a vez de ${PLAYER_NAMES[activePlayer]}!`);
      return;
    }
    if (!isOwnPiece(square)) return;
    setSelectedSquare((prev) => (prev === square ? null : square));
  }

  function handleSquareClick({ square }) {
    if (!isPlaying || !square) return;
    if (!isMyTurn) {
      showToast(`É a vez de ${PLAYER_NAMES[activePlayer]}!`);
      return;
    }

    if (selectedSquare) {
      if (tryMove(selectedSquare, square)) return;
      if (isOwnPiece(square)) {
        setSelectedSquare(square);
        return;
      }
    }

    if (isOwnPiece(square)) {
      setSelectedSquare(square);
    }
  }

  function handlePieceDrag({ square }) {
    if (!isMyTurn || !isPlaying || !square) return;
    setSelectedSquare(square);
  }

  function handleDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare || !isMyTurn || !isPlaying) {
      setSelectedSquare(null);
      return false;
    }
    const moved = tryMove(sourceSquare, targetSquare);
    if (!moved) setSelectedSquare(sourceSquare);
    return moved;
  }

  function handleResign() {
    if (!isPlaying || !myself) return;
    const winner = myself === 'helio' ? 'thamy' : 'helio';
    setGameState((s) => ({ ...s, status: 'checkmate', winner }));
    onSystemMessage(`🏳️ ${PLAYER_NAMES[myself]} desistiu. ${PLAYER_NAMES[winner]} vence!`);
  }

  function handleNewGame() {
    chessRef.current = new Chess();
    setGameState(createInitialState());
    setSelectedSquare(null);
    prevMovesCount.current = 0;
    recordedResultRef.current = false;
    onSystemMessage('♟️ Nova partida iniciada!');
  }

  const gameResult = useMemo(() => {
    if (gameState.status === 'draw') {
      return { type: 'draw', title: 'Empate!', subtitle: 'A partida terminou empatada.' };
    }
    if (gameState.status === 'checkmate' && gameState.winner) {
      const won = gameState.winner === myself;
      return won
        ? { type: 'win', title: 'Vitória!', subtitle: 'Parabéns, você venceu a partida.' }
        : {
            type: 'loss',
            title: 'Derrota',
            subtitle: `${PLAYER_NAMES[gameState.winner]} venceu a partida.`,
          };
    }
    return null;
  }, [gameState, myself]);

  return (
    <div className="screen active chess-screen">
      <div className="game-header">
        <button type="button" className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onGoHome}>
          ← Sair
        </button>
        <div className="game-title">♟️ Helio vs Thamy</div>
        <button type="button" className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onSwitchPlayer}>
          👤 Trocar
        </button>
      </div>

      <div className={`turn-banner turn-${activePlayer}`}>
        <div className="turn-left">
          <div className="avatar-sm">
            <img src={IMGS[activePlayer]} alt={PLAYER_NAMES[activePlayer]} />
            <span className={`online-dot avatar-dot sm${isPlayerOnline(onlinePlayer, activePlayer) ? ' on' : ''}`} />
          </div>
          <span style={{ color: PLAYER_COLORS[activePlayer] }}>{PLAYER_NAMES[activePlayer]}</span>
          {isPlaying && (gameState.status === 'check' ? ' — Xeque!' : ' — sua vez!')}
        </div>
        <div className="turn-right">
          {myself ? `Você: ${PLAYER_NAMES[myself]}` : 'Identifique-se'}
        </div>
      </div>

      {gameResult && (
        <div className={`game-result game-result-${gameResult.type}`}>
          <h2>{gameResult.title}</h2>
          <p>{gameResult.subtitle}</p>
          <div className="chess-result-actions">
            <button type="button" className="btn btn-primary" onClick={handleNewGame}>
              🔄 Nova partida
            </button>
            <button type="button" className="btn" onClick={onGoHome}>
              🏠 Voltar
            </button>
          </div>
        </div>
      )}

      <div className="board-layout">
        <CapturedPanel label={PLAYER_NAMES.thamy} pieces={blackLost} color="black" />
        <div className="board-container">
          <Chessboard
            options={{
              position: gameState.fen,
              boardOrientation,
              allowDragging: isMyTurn && isPlaying,
              canDragPiece: ({ square }) => isMyTurn && isPlaying && isOwnPiece(square),
              onPieceClick: handlePieceClick,
              onSquareClick: handleSquareClick,
              onPieceDrag: handlePieceDrag,
              onPieceDrop: handleDrop,
              squareStyles,
              boardStyle: {
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              },
              darkSquareStyle: { backgroundColor: '#b58863' },
              lightSquareStyle: { backgroundColor: '#f0d9b5' },
            }}
          />
        </div>
        <CapturedPanel label={PLAYER_NAMES.helio} pieces={whiteLost} color="white" />
      </div>

      {gameState.status === 'check' && isPlaying && (
        <p className="chess-status-msg">⚠️ Xeque!</p>
      )}

      <div className="actions">
        {isPlaying && (
          <button type="button" className="btn btn-danger" onClick={handleResign}>
            🏳️ Desistir
          </button>
        )}
        <button type="button" className="btn" onClick={handleNewGame}>
          🔄 Novo
        </button>
      </div>
    </div>
  );
}
