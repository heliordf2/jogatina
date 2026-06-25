import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import CurrentPlayerBar from './CurrentPlayerBar.jsx';
import OtherPlayerBar from './OtherPlayerBar.jsx';
import ChessboardBoundary from './ChessboardBoundary.jsx';
import {
  createOrJoinChessGame,
  fetchActiveChessGame,
  postChessMove,
  postChessRematchRequest,
  postChessRematchRespond,
  postChessResign,
} from '../utils/api.js';
import { isPlayerOnlineRemote } from '../hooks/useRemotePresence.js';
import {
  getCapturedPiecesFromMoves,
  normalizeMoves,
  PIECE_SYMBOLS,
  safeChess,
} from '../utils/chessHelpers.js';
import { playCaptureSound, playCheckSound, playMoveSound, unlockAudio } from '../utils/chessSounds.js';

const MOVE_HIGHLIGHT = 'radial-gradient(circle, rgba(16, 185, 129, 0.55) 22%, transparent 22%)';
const CAPTURE_HIGHLIGHT = 'radial-gradient(circle, rgba(16, 185, 129, 0.5) 82%, transparent 82%)';
const SELECTED_HIGHLIGHT = 'rgba(16, 185, 129, 0.45)';
const POLL_MS = 1500;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
      game.blackPlayer &&
      safeChess(Chess, game.fen),
  );
}

function getOpponent(game, player) {
  if (!game || !player) return null;
  if (player === game.whitePlayer) return game.blackPlayer;
  if (player === game.blackPlayer) return game.whitePlayer;
  return null;
}

function mapServerGame(game) {
  if (!isValidGame(game)) return null;

  const chess = safeChess(Chess, game.fen);
  if (!chess) return null;

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
    rematchRequestedBy: game.rematchRequestedBy ?? null,
  };
}

function isPlayingStatus(status) {
  return !['checkmate', 'draw', 'resigned', 'abandoned'].includes(status);
}

function ErrorPanel({ message, onRetry, onGoHome }) {
  return (
    <div className="screen active chess-screen">
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <p style={{ color: 'var(--text2)', marginBottom: '1rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            🔄 Tentar novamente
          </button>
          <button type="button" className="btn" onClick={onGoHome}>
            🏠 Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChessGameScreen({
  onlinePlayer,
  remotePresence,
  initialGame,
  onGoHome,
  onSystemMessage,
  onGameUpdate,
  showToast,
}) {
  const myself = onlinePlayer;
  const chessRef = useRef(new Chess());
  const lastVersionRef = useRef(0);
  const prevMovesCount = useRef(0);
  const announcedEndRef = useRef(false);
  const hadGameRef = useRef(false);

  const [gameState, setGameState] = useState(() => mapServerGame(initialGame));
  const gameStateRef = useRef(gameState);
  const [loading, setLoading] = useState(!initialGame);
  const [loadError, setLoadError] = useState(() => {
    if (!initialGame) return null;
    return mapServerGame(initialGame) ? null : 'Não foi possível carregar a partida';
  });
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [moving, setMoving] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);

  const resetForNewGame = useCallback(() => {
    announcedEndRef.current = false;
    prevMovesCount.current = 0;
    setSelectedSquare(null);
  }, []);

  const applyServerGame = useCallback(
    (game) => {
      if (!game) return false;
      const mapped = mapServerGame(game);
      if (!mapped) {
        setLoadError('Dados da partida inválidos no servidor');
        return false;
      }
      if (gameStateRef.current?.id != null && gameStateRef.current.id !== mapped.id) {
        resetForNewGame();
      }
      chessRef.current = safeChess(Chess, mapped.fen) ?? new Chess(START_FEN);
      lastVersionRef.current = mapped.version;
      hadGameRef.current = true;
      setGameState(mapped);
      setLoadError(null);
      onGameUpdate?.(game);
      return true;
    },
    [onGameUpdate, resetForNewGame],
  );

  const handleRematchResult = useCallback(
    (result) => {
      const { action, game } = result;
      if (action === 'accepted') {
        if (!applyServerGame(game)) return;
        onSystemMessage?.(
          `🎲 Nova partida online! ${PLAYER_NAMES[game.whitePlayer]} com as brancas, ${PLAYER_NAMES[game.blackPlayer]} com as pretas.`,
        );
        showToast('Nova partida iniciada!', 2000);
        return;
      }

      applyServerGame(game);

      if (action === 'requested' || action === 'pending') {
        const opponent = getOpponent(game, myself);
        onSystemMessage?.(`🔄 ${PLAYER_NAMES[myself]} pediu uma nova partida.`);
        showToast(`Pedido enviado — aguardando ${PLAYER_NAMES[opponent]}`, 2500);
      } else if (action === 'declined') {
        onSystemMessage?.(`❌ ${PLAYER_NAMES[myself]} recusou a nova partida.`);
        showToast('Pedido de nova partida recusado', 2000);
      }
    },
    [applyServerGame, myself, onSystemMessage, showToast],
  );

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

  const retryLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const game = await fetchActiveChessGame();
      if (game && applyServerGame(game)) return;

      const created = await createOrJoinChessGame({
        player: myself,
        forceNew: true,
      });
      if (!applyServerGame(created)) {
        setLoadError('Não foi possível iniciar uma nova partida');
      }
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar a partida');
    } finally {
      setLoading(false);
    }
  }, [applyServerGame, myself]);

  useEffect(() => {
    if (!initialGame) return;
    const mapped = mapServerGame(initialGame);
    if (mapped) {
      applyServerGame(initialGame);
      setLoading(false);
    } else {
      setLoadError('Não foi possível carregar a partida');
      setLoading(false);
    }
  }, [applyServerGame, initialGame]);

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const game = await fetchActiveChessGame();
        if (cancelled) return;

        if (!game) {
          const current = gameStateRef.current;
          if (hadGameRef.current && current && isPlayingStatus(current.status)) {
            setLoadError('A partida foi encerrada no servidor');
          }
          return;
        }

        if (game.version !== lastVersionRef.current) {
          const mapped = mapServerGame(game);
          if (!mapped) {
            setLoadError('Dados da partida inválidos no servidor');
            return;
          }
          const isNewGame = gameStateRef.current?.id != null && gameStateRef.current.id !== mapped.id;
          applyServerGame(game);
          if (isNewGame) {
            onSystemMessage?.(
              `🎲 Nova partida online! ${PLAYER_NAMES[game.whitePlayer]} com as brancas, ${PLAYER_NAMES[game.blackPlayer]} com as pretas.`,
            );
          }
          announceTerminalState(mapped);
        }
      } catch {
        if (!cancelled && !hadGameRef.current) {
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
  }, [announceTerminalState, applyServerGame, onSystemMessage]);

  useEffect(() => {
    setSelectedSquare(null);
  }, [gameState?.fen]);

  useEffect(() => {
    const moves = gameState?.moves || [];
    if (moves.length <= prevMovesCount.current) {
      prevMovesCount.current = moves.length;
      return;
    }

    try {
      const chess = new Chess();
      for (let i = 0; i < moves.length - 1; i += 1) {
        const moved = chess.move(moves[i]);
        if (!moved) return;
      }
      const lastMove = chess.move(moves[moves.length - 1]);

      if (lastMove) {
        if (lastMove.captured) playCaptureSound();
        else playMoveSound();
        if (chess.inCheck()) {
          setTimeout(() => playCheckSound(), lastMove.captured ? 130 : 70);
        }
      }
    } catch {
      // ignora erros de replay de som
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
    const chess = safeChess(Chess, gameState.fen);
    if (!chess) return [];
    try {
      return chess.moves({ square: selectedSquare, verbose: true });
    } catch {
      return [];
    }
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
    const chess = safeChess(Chess, gameState.fen);
    if (!chess) return false;
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
      if (!applyServerGame(game)) {
        showToast('Resposta inválida do servidor');
        return false;
      }
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

  function handleDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare || !isMyTurn || !isPlaying || !gameState) {
      setSelectedSquare(null);
      return false;
    }

    const chess = safeChess(Chess, gameState.fen);
    if (!chess) return false;

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
      const mapped = mapServerGame(game);
      if (mapped) {
        applyServerGame(game);
        announceTerminalState(mapped);
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleNewGame() {
    if (!myself || rematchBusy) return;
    if (gameState?.rematchRequestedBy === myself) {
      showToast('Aguardando aprovação do outro jogador');
      return;
    }

    setRematchBusy(true);
    try {
      const result = await postChessRematchRequest({ player: myself });
      handleRematchResult(result);
    } catch (error) {
      showToast(error.message);
    } finally {
      setRematchBusy(false);
    }
  }

  async function handleAcceptRematch() {
    if (!myself || rematchBusy) return;
    setRematchBusy(true);
    try {
      const result = await postChessRematchRespond({ player: myself, accept: true });
      handleRematchResult(result);
    } catch (error) {
      showToast(error.message);
    } finally {
      setRematchBusy(false);
    }
  }

  async function handleDeclineRematch() {
    if (!myself || rematchBusy) return;
    setRematchBusy(true);
    try {
      const result = await postChessRematchRespond({ player: myself, accept: false });
      handleRematchResult(result);
    } catch (error) {
      showToast(error.message);
    } finally {
      setRematchBusy(false);
    }
  }

  const rematchRequestedBy = gameState?.rematchRequestedBy ?? null;
  const rematchOpponent = gameState ? getOpponent(gameState, myself) : null;
  const waitingRematchApproval = rematchRequestedBy === myself;
  const incomingRematchRequest =
    rematchRequestedBy && rematchRequestedBy !== myself && rematchOpponent === rematchRequestedBy;
  const newGameLabel = waitingRematchApproval ? '⏳ Aguardando...' : '🔄 Nova partida';
  const rematchDisabled = moving || rematchBusy || waitingRematchApproval;

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
      <ErrorPanel
        message={loadError || (loading ? 'Sincronizando partida...' : 'Não foi possível carregar a partida')}
        onRetry={retryLoad}
        onGoHome={onGoHome}
      />
    );
  }

  if (loadError && !isPlayingStatus(gameState.status)) {
    return (
      <ErrorPanel message={loadError} onRetry={retryLoad} onGoHome={onGoHome} />
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

      {loadError && (
        <p className="chess-status-msg" style={{ color: 'var(--text2)' }}>
          ⚠️ {loadError}
        </p>
      )}

      {incomingRematchRequest && (
        <div className="chess-rematch-banner">
          <p>
            <strong>{PLAYER_NAMES[rematchRequestedBy]}</strong> quer jogar uma nova partida.
          </p>
          <div className="chess-rematch-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAcceptRematch}
              disabled={rematchBusy}
            >
              ✅ Aceitar
            </button>
            <button type="button" className="btn" onClick={handleDeclineRematch} disabled={rematchBusy}>
              ❌ Recusar
            </button>
          </div>
        </div>
      )}

      {waitingRematchApproval && !incomingRematchRequest && (
        <div className="chess-rematch-banner chess-rematch-waiting">
          <p>Aguardando {PLAYER_NAMES[rematchOpponent]} aceitar a nova partida...</p>
        </div>
      )}

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
            <button type="button" className="btn btn-primary" onClick={handleNewGame} disabled={rematchDisabled}>
              {newGameLabel}
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
          <ChessboardBoundary
            resetKey={`${gameState.id}-${gameState.version}`}
            fallback={
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text2)' }}>
                <p>Não foi possível exibir o tabuleiro.</p>
                <button type="button" className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={retryLoad}>
                  🔄 Recarregar partida
                </button>
              </div>
            }
          >
            <Chessboard
              key={`${gameState.id}-${gameState.version}-${myself ?? 'guest'}`}
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
          </ChessboardBoundary>
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
        <button type="button" className="btn" onClick={handleNewGame} disabled={rematchDisabled}>
          {waitingRematchApproval ? '⏳ Aguardando...' : '🔄 Novo'}
        </button>
      </div>

      <OtherPlayerBar onlinePlayer={onlinePlayer} remotePresence={remotePresence} />
    </div>
  );
}
