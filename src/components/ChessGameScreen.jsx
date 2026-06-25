import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import CurrentPlayerBar from './CurrentPlayerBar.jsx';
import OtherPlayerBar from './OtherPlayerBar.jsx';
import {
  createOrJoinChessGame,
  fetchActiveChessGame,
  postChessMove,
  postChessResign,
} from '../utils/api.js';
import { isPlayerOnlineRemote } from '../hooks/useRemotePresence.js';
import {
  getCapturedPiecesFromMoves,
  normalizeMoves,
  PIECE_SYMBOLS,
} from '../utils/chessHelpers.js';
import { playCaptureSound, playCheckSound, playMoveSound, unlockAudio } from '../utils/chessSounds.js';

const MOVE_HIGHLIGHT = 'radial-gradient(circle, rgba(16, 185, 129, 0.55) 22%, transparent 22%)';
const CAPTURE_HIGHLIGHT = 'radial-gradient(circle, rgba(16, 185, 129, 0.5) 82%, transparent 82%)';
const SELECTED_HIGHLIGHT = 'rgba(16, 185, 129, 0.45)';
const POLL_MS = 1500;

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

function isValidGame(game) {
  return Boolean(
    game &&
      typeof game.id === 'number' &&
      typeof game.fen === 'string' &&
      game.whitePlayer &&
      game.blackPlayer,
  );
}

function mapServerGame(game) {
  if (!isValidGame(game)) {
    throw new Error('Dados da partida inválidos');
  }

  const chess = new Chess(game.fen);
  return {
    id: game.id,
    fen: game.fen,
    turn: chess.turn(),
    moves: normalizeMoves(game.moves),
    status: game.status,
    winner: game.winner,
    whitePlayer: game.whitePlayer,
    blackPlayer: game.blackPlayer,
    version: game.version,
  };
}

function isPlayingStatus(status) {
  return !['checkmate', 'draw', 'resigned'].includes(status);
}

export default function ChessGameScreen({
  onlinePlayer,
  remotePresence,
  initialGame,
  onGoHome,
  onSystemMessage,
  showToast,
}) {
  const myself = onlinePlayer;
  const chessRef = useRef(new Chess());
  const lastVersionRef = useRef(0);
  const prevMovesCount = useRef(0);
  const announcedEndRef = useRef(false);

  const [gameState, setGameState] = useState(() => {
    if (!initialGame) return null;
    try {
      return mapServerGame(initialGame);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!initialGame);
  const [loadError, setLoadError] = useState(
    initialGame && !isValidGame(initialGame) ? 'Não foi possível carregar a partida' : null,
  );
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [moving, setMoving] = useState(false);

  const applyServerGame = useCallback((game) => {
    if (!game) return;
    const mapped = mapServerGame(game);
    chessRef.current = new Chess(mapped.fen);
    lastVersionRef.current = mapped.version;
    setGameState(mapped);
  }, []);

  const announceTerminalState = useCallback(
    (mapped) => {
      if (announcedEndRef.current || isPlayingStatus(mapped.status)) return;
      announcedEndRef.current = true;

      if (mapped.status === 'draw' || mapped.winner === 'draw') {
        onSystemMessage?.('🤝 Partida empatada!');
        return;
      }

      if (mapped.winner) {
        if (mapped.status === 'resigned') {
          onSystemMessage?.(`🏳️ ${PLAYER_NAMES[mapped.winner]} venceu por desistência!`);
        } else {
          onSystemMessage?.(`🏆 ${PLAYER_NAMES[mapped.winner]} venceu a partida!`);
        }
      }
    },
    [onSystemMessage],
  );

  useEffect(() => {
    if (initialGame) {
      applyServerGame(initialGame);
      chessRef.current = new Chess(initialGame.fen);
      lastVersionRef.current = initialGame.version;
      setLoading(false);
    }
  }, [applyServerGame, initialGame]);

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const game = await fetchActiveChessGame();
        if (cancelled || !game) return;
        if (game.version !== lastVersionRef.current) {
          const mapped = mapServerGame(game);
          applyServerGame(game);
          announceTerminalState(mapped);
        }
        if (!cancelled) setLoadError(null);
      } catch {
        if (!cancelled && !initialGame) {
          setLoadError('Não foi possível sincronizar a partida');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    sync();
    const id = setInterval(sync, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [announceTerminalState, applyServerGame, initialGame]);

  useEffect(() => {
    setSelectedSquare(null);
  }, [gameState?.fen]);

  useEffect(() => {
    const moves = gameState?.moves || [];
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
  }, [gameState?.moves]);

  const activePlayer =
    gameState?.turn === 'w' ? gameState.whitePlayer : gameState.blackPlayer;
  const isMyTurn = myself === activePlayer;
  const isPlaying = gameState ? isPlayingStatus(gameState.status) : false;
  const myPieceColor = myself === gameState?.whitePlayer ? 'w' : 'b';
  const boardOrientation = myself === gameState?.whitePlayer ? 'white' : 'black';

  const { whiteLost, blackLost } = useMemo(
    () => getCapturedPiecesFromMoves(Chess, gameState?.moves ?? []),
    [gameState?.moves],
  );

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !isMyTurn || !isPlaying || !gameState) return [];
    const chess = new Chess(gameState.fen);
    return chess.moves({ square: selectedSquare, verbose: true });
  }, [selectedSquare, gameState, isMyTurn, isPlaying]);

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
    if (!gameState) return false;
    const chess = new Chess(gameState.fen);
    const piece = chess.get(square);
    return piece?.color === myPieceColor;
  }

  async function applyMove(from, to) {
    if (!isMyTurn || !isPlaying || moving || !myself) {
      if (!isMyTurn && isPlaying) {
        showToast(`É a vez de ${PLAYER_NAMES[activePlayer]}!`);
      }
      return false;
    }

    setMoving(true);
    try {
      const game = await postChessMove({ player: myself, from, to, promotion: 'q' });
      applyServerGame(game);
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    } finally {
      setMoving(false);
    }
  }

  async function tryMove(from, to) {
    if (!to) return false;
    const moved = await applyMove(from, to);
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

  async function handleDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare || !isMyTurn || !isPlaying || !gameState) {
      setSelectedSquare(null);
      return false;
    }

    const chess = new Chess(gameState.fen);
    const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    if (!move) {
      setSelectedSquare(null);
      return false;
    }

    setSelectedSquare(null);
    void applyMove(sourceSquare, targetSquare);
    return true;
  }

  async function handleResign() {
    if (!isPlaying || !myself) return;
    try {
      const game = await postChessResign({ player: myself });
      applyServerGame(game);
      announceTerminalState(mapServerGame(game));
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleNewGame() {
    if (!myself) return;
    try {
      const game = await createOrJoinChessGame({ player: myself, forceNew: true });
      announcedEndRef.current = false;
      prevMovesCount.current = 0;
      applyServerGame(game);
      onSystemMessage?.(
        `🎲 Nova partida online! ${PLAYER_NAMES[game.whitePlayer]} com as brancas, ${PLAYER_NAMES[game.blackPlayer]} com as pretas.`,
      );
    } catch (error) {
      showToast(error.message);
    }
  }

  const gameResult = useMemo(() => {
    if (!gameState || isPlayingStatus(gameState.status)) return null;
    if (gameState.status === 'draw' || gameState.winner === 'draw') {
      return { type: 'draw', title: 'Empate!', subtitle: 'A partida terminou empatada.' };
    }
    if (gameState.winner) {
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

  if (!gameState) {
    return (
      <div className="screen active chess-screen">
        <p style={{ textAlign: 'center', color: 'var(--text2)', padding: '2rem 0' }}>
          {loadError || (loading ? 'Sincronizando partida...' : 'Não foi possível carregar a partida')}
        </p>
      </div>
    );
  }

  return (
    <div className="screen active chess-screen">
      <CurrentPlayerBar player={onlinePlayer} detail="jogando online" remotePresence={remotePresence} />

      <div className="game-header">
        <button type="button" className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onGoHome}>
          ← Sair
        </button>
        <div className="game-title">♟️ Helio vs Thamy</div>
        <div style={{ width: 64 }} />
      </div>

      <div className={`turn-banner turn-${activePlayer}`}>
        <div className="turn-left">
          <div className="avatar-sm">
            <img src={IMGS[activePlayer]} alt={PLAYER_NAMES[activePlayer]} />
            <span
              className={`online-dot avatar-dot sm${isPlayerOnlineRemote(remotePresence, activePlayer) ? ' on' : ''}`}
            />
          </div>
          <span style={{ color: PLAYER_COLORS[activePlayer] }}>{PLAYER_NAMES[activePlayer]}</span>
          {isPlaying &&
            (gameState.status === 'check'
              ? ' — Xeque!'
              : myself === activePlayer
                ? ' — sua vez!'
                : ' — aguardando...')}
        </div>
        <div className="turn-right">
          {myself === activePlayer
            ? `Sua vez — ${myself === gameState.whitePlayer ? '♔ brancas' : '♚ pretas'}`
            : myself
              ? `Aguardando ${PLAYER_NAMES[activePlayer]}`
              : 'Identifique-se'}
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
        <CapturedPanel
          label={PLAYER_NAMES[gameState.blackPlayer]}
          pieces={blackLost}
          color="black"
        />
        <div className="board-container">
          <Chessboard
            key={`${gameState.fen}-${myself ?? 'guest'}-${gameState.whitePlayer}-${gameState.version}`}
            options={{
              position: gameState.fen,
              boardOrientation,
              allowDragging: isMyTurn && isPlaying && !moving,
              canDragPiece: ({ square }) =>
                isMyTurn && isPlaying && !moving && isOwnPiece(square),
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
        <CapturedPanel
          label={PLAYER_NAMES[gameState.whitePlayer]}
          pieces={whiteLost}
          color="white"
        />
      </div>

      {gameState.status === 'check' && isPlaying && (
        <p className="chess-status-msg">⚠️ Xeque!</p>
      )}

      <div className="actions">
        {isPlaying && (
          <button type="button" className="btn btn-danger" onClick={handleResign} disabled={moving}>
            🏳️ Desistir
          </button>
        )}
        <button type="button" className="btn" onClick={handleNewGame} disabled={moving}>
          🔄 Novo
        </button>
      </div>

      <OtherPlayerBar onlinePlayer={onlinePlayer} remotePresence={remotePresence} />
    </div>
  );
}
