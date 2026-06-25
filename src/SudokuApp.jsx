import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import GameScreen from './components/GameScreen.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import RankingScreen from './components/RankingScreen.jsx';
import SharedChat from './components/SharedChat.jsx';
import WinScreen from './components/WinScreen.jsx';
import {
  createEmptyDrafts,
  createInitialGameState,
  DIFF_MULT,
  DIFF_NAMES,
  INITIAL_SCORES,
  PLAYER_NAMES,
} from './data/constants.js';
import {
  createOrJoinSudokuCollabGame,
  fetchActiveSudokuCollabGame,
  postSudokuCollabCell,
  postSudokuCollabHint,
  postSudokuCollabPause,
  postSudokuCollabTurnLock,
} from './utils/api.js';
import { syncSudokuStats } from './utils/gameStats.js';
import { recordGameStart } from './utils/gameSessions.js';
import { loadScores, saveScores } from './utils/scores.js';
import { generateSudoku, isCellLocked, removeDraftFromRegion } from './utils/sudoku.js';

const COLLAB_POLL_MS = 1500;

/** Em modo livre (!turnLocked), qualquer jogador pode interagir com o tabuleiro. */
function canCollabPlay(game, player) {
  if (!game.isCollab) return true;
  if (game.collabTurn === player) return true;
  return !game.turnLocked;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function calcProgress(game) {
  if (!game.board.length || !game.given.length) {
    return { filled: 0, total: 0, pct: 0 };
  }
  let filled = 0;
  let total = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!game.given[r][c]) {
        total++;
        if (game.board[r][c] === game.solution[r][c]) filled++;
      }
    }
  }
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return { filled, total, pct };
}

function serverGameToLocal(serverGame, prev) {
  return {
    board: serverGame.board,
    solution: serverGame.solution,
    given: serverGame.given,
    selected: prev?.selected ?? null,
    errors: serverGame.errors,
    corrects: serverGame.corrects,
    hints: serverGame.hints,
    timer: serverGame.timer,
    collabTurn: serverGame.collabTurn,
    collabScores: serverGame.collabScores,
    collabCells: serverGame.collabCells,
    isCollab: true,
    draftMode: prev?.draftMode ?? false,
    drafts: prev?.drafts ?? createEmptyDrafts(),
    turnLocked: serverGame.turnLocked,
    paused: serverGame.paused,
    serverId: serverGame.id,
    serverVersion: serverGame.version,
    serverStatus: serverGame.status,
    serverDifficulty: serverGame.difficulty,
  };
}

export default function SudokuApp({
  onBack,
  onlinePlayer,
  onSetOnline,
  showToast,
  chatInputFocusedRef,
  chatMessages,
  addChatMsg,
  sendPlayerChat,
  clearChatMessages,
  remotePresence,
  onChatFocusChange,
}) {
  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState('solo');
  const [diff, setDiff] = useState('easy');
  const [scores, setScores] = useState(() => structuredClone(INITIAL_SCORES));
  const [game, setGame] = useState(createInitialGameState);
  const [winResult, setWinResult] = useState(null);
  const [joiningCollab, setJoiningCollab] = useState(false);

  const timerRef = useRef(null);
  const gameRef = useRef(game);
  const lastVersionRef = useRef(0);
  const winHandledRef = useRef(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    loadScores().then(setScores);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setGame((g) => {
        if (!g.isCollab) return { ...g, timer: g.timer + 1 };
        return g;
      });
    }, 1000);
  }, [stopTimer]);

  const handleCollabWin = useCallback(
    (serverGame) => {
      if (winHandledRef.current === serverGame.id) return;
      winHandledRef.current = serverGame.id;
      stopTimer();

      const timeStr = formatTime(serverGame.timer);
      const h = serverGame.collabScores.helio;
      const tt = serverGame.collabScores.thamy;
      const winner = h > tt ? 'helio' : tt > h ? 'thamy' : null;
      const gameDiff = serverGame.difficulty || diff;
      const diffLabel = DIFF_NAMES[gameDiff].replace('💀 ', '');

      loadScores().then(setScores);

      setWinResult({
        emoji: winner ? '🏆' : '🤝',
        title: winner ? `${PLAYER_NAMES[winner]} venceu o duelo!` : 'Empate!',
        sub: `Sudoku ${diffLabel} completado!`,
        time: timeStr,
        pts: Math.max(h, tt),
        errors: serverGame.errors,
        collabDetail: {
          helio: { pts: h, cells: serverGame.collabCells.helio.length },
          thamy: { pts: tt, cells: serverGame.collabCells.thamy.length },
        },
      });
      setTimeout(() => setScreen('win'), 700);
    },
    [diff, stopTimer],
  );

  const applyServerCollabGame = useCallback(
    (serverGame, { chatMessage, toastMessage, toastDuration = 1500, clearSelection = false } = {}) => {
      lastVersionRef.current = serverGame.version;
      setGame((prev) => {
        const next = serverGameToLocal(serverGame, prev);
        if (clearSelection) next.selected = null;
        return next;
      });
      if (serverGame.difficulty) setDiff(serverGame.difficulty);
      if (toastMessage) showToast(toastMessage, toastDuration);
      if (chatMessage) addChatMsg('system', null, chatMessage);
      if (serverGame.status === 'won') handleCollabWin(serverGame);
    },
    [addChatMsg, handleCollabWin, showToast],
  );

  const doStartSolo = useCallback(() => {
    stopTimer();
    const { solution, puzzle } = generateSudoku(diff);
    setGame({
      board: puzzle.map((r) => [...r]),
      solution,
      given: puzzle.map((r) => r.map((v) => v !== 0)),
      selected: null,
      errors: 0,
      corrects: 0,
      hints: 3,
      timer: 0,
      collabTurn: 'helio',
      collabScores: { helio: 0, thamy: 0 },
      collabCells: { helio: [], thamy: [] },
      isCollab: false,
      draftMode: false,
      drafts: createEmptyDrafts(),
      turnLocked: false,
      paused: false,
    });
    setScreen('game');
    startTimer();
    recordGameStart(onlinePlayer, 'sudoku', 'solo');
  }, [diff, onlinePlayer, startTimer, stopTimer]);

  const startSolo = useCallback(() => {
    if (!onlinePlayer) {
      showToast('Selecione quem você é na tela inicial');
      return;
    }
    doStartSolo();
  }, [doStartSolo, onlinePlayer, showToast]);

  const startCollab = useCallback(
    async (forceNew = false) => {
      if (!onlinePlayer) {
        showToast('Selecione quem você é na tela inicial');
        return;
      }

      setJoiningCollab(true);
      try {
        const { game: serverGame, joined } = await createOrJoinSudokuCollabGame({
          player: onlinePlayer,
          difficulty: diff,
          forceNew,
        });

        stopTimer();
        winHandledRef.current = null;
        lastVersionRef.current = serverGame.version;
        setGame(serverGameToLocal(serverGame, null));
        if (serverGame.difficulty) setDiff(serverGame.difficulty);
        setScreen('game');
        recordGameStart(onlinePlayer, 'sudoku', 'collab');

        if (joined) {
          addChatMsg('system', null, `🤝 ${PLAYER_NAMES[onlinePlayer]} entrou no duelo online!`);
        } else {
          addChatMsg(
            'system',
            null,
            `🎮 Duelo online! ${PLAYER_NAMES[serverGame.collabTurn]} começa jogando.`,
          );
        }

        if (serverGame.status === 'won') handleCollabWin(serverGame);
      } catch (error) {
        showToast(error.message);
      } finally {
        setJoiningCollab(false);
      }
    },
    [addChatMsg, diff, handleCollabWin, onlinePlayer, showToast, stopTimer],
  );

  const goHome = useCallback(() => {
    stopTimer();
    setScreen('home');
    setWinResult(null);
    winHandledRef.current = null;
    lastVersionRef.current = 0;
  }, [stopTimer]);

  const checkWin = useCallback(
    (currentGame) => {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (currentGame.board[r][c] !== currentGame.solution[r][c]) return false;
        }
      }

      stopTimer();
      const timeStr = formatTime(currentGame.timer);
      const diffLabel = DIFF_NAMES[diff].replace('💀 ', '');

      const pts = Math.max(
        0,
        Math.round((1000 - currentGame.errors * 80) * DIFF_MULT[diff]),
      );

      setScores((prev) => {
        const next = structuredClone(prev);
        const p = next[onlinePlayer];
        p.total += pts;
        p.games++;
        if (!p.best || pts > p.best) p.best = pts;
        p.history.unshift({
          pts,
          diff,
          time: timeStr,
          type: 'solo',
          date: new Date().toLocaleDateString('pt-BR'),
        });
        if (p.history.length > 20) p.history.pop();
        saveScores(next).catch(() => {});
        syncSudokuStats(next).catch(() => {});
        return next;
      });

      setWinResult({
        emoji: currentGame.errors === 0 ? '🎯' : '🎉',
        title: `${PLAYER_NAMES[onlinePlayer]} concluiu!`,
        sub:
          `Sudoku ${diffLabel}` +
          (currentGame.errors === 0 ? ' sem erros! Perfeito! 🌟' : ' resolvido!'),
        time: timeStr,
        pts,
        errors: currentGame.errors,
      });

      setTimeout(() => setScreen('win'), 700);
      return true;
    },
    [diff, onlinePlayer, stopTimer],
  );

  useEffect(() => {
    if (screen !== 'game' || !game.isCollab) return undefined;

    let cancelled = false;

    async function sync() {
      try {
        const serverGame = await fetchActiveSudokuCollabGame();
        if (cancelled || !serverGame) return;

        if (serverGame.version !== lastVersionRef.current) {
          lastVersionRef.current = serverGame.version;
          setGame((prev) => serverGameToLocal(serverGame, prev));
          if (serverGame.difficulty) setDiff(serverGame.difficulty);
          if (serverGame.status === 'won') handleCollabWin(serverGame);
        } else {
          setGame((prev) => (prev.isCollab ? { ...prev, timer: serverGame.timer } : prev));
        }
      } catch {
        // ignore transient sync errors
      }
    }

    sync();
    const id = setInterval(sync, COLLAB_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [game.isCollab, handleCollabWin, screen]);

  const selectCell = useCallback(
    (r, c) => {
      setGame((g) => {
        if (g.paused) return g;
        if (g.given[r][c] || isCellLocked(g, r, c)) return g;
        if (g.isCollab && !canCollabPlay(g, onlinePlayer)) {
          showToast(`🔒 ${PLAYER_NAMES[g.collabTurn]} travou a vez!`);
          return g;
        }
        return { ...g, selected: [r, c] };
      });
    },
    [onlinePlayer, showToast],
  );

  const enterNum = useCallback(
    async (n) => {
      const g = gameRef.current;
      if (g.paused) return;
      if (!g.selected) {
        showToast('Selecione uma célula!');
        return;
      }
      const [r, c] = g.selected;
      if (g.given[r][c] || isCellLocked(g, r, c)) return;

      if (g.draftMode && n !== 0) {
        if (g.isCollab && !canCollabPlay(g, onlinePlayer)) {
          showToast(`🔒 ${PLAYER_NAMES[g.collabTurn]} travou a vez!`);
          return;
        }
        setGame((current) => {
          if (current.board[r][c]) return current;
          const drafts = current.drafts.map((row) => row.map((set) => new Set(set)));
          const draft = drafts[r][c];
          if (draft.has(n)) draft.delete(n);
          else draft.add(n);
          return { ...current, drafts };
        });
        return;
      }

      if (g.isCollab && !canCollabPlay(g, onlinePlayer)) {
        showToast(`🔒 ${PLAYER_NAMES[g.collabTurn]} travou a vez!`);
        return;
      }

      if (g.isCollab) {
        try {
          const { game: serverGame, chatMessage } = await postSudokuCollabCell({
            player: onlinePlayer,
            row: r,
            col: c,
            value: n,
          });
          const toastMessage =
            n === 0
              ? null
              : chatMessage?.includes('acertou')
                ? chatMessage
                : chatMessage?.includes('errou')
                  ? chatMessage
                  : null;
          applyServerCollabGame(serverGame, {
            chatMessage,
            toastMessage: toastMessage ?? undefined,
            clearSelection: true,
          });
        } catch (error) {
          showToast(error.message);
        }
        return;
      }

      setGame((current) => {
        if (current.paused) return current;
        if (!current.selected) return current;
        const [row, col] = current.selected;
        if (current.given[row][col] || isCellLocked(current, row, col)) return current;

        const next = { ...current, board: current.board.map((rowArr) => [...rowArr]) };
        const drafts = next.drafts.map((row) => row.map((set) => new Set(set)));

        if (n === 0) {
          next.board[row][col] = 0;
          next.drafts = drafts;
          return next;
        }

        if (n === next.solution[row][col]) {
          next.board[row][col] = n;
          drafts[row][col].clear();
          removeDraftFromRegion(drafts, row, col, n);
          next.corrects++;
          next.drafts = drafts;
          setTimeout(() => checkWin(next), 0);
          return next;
        }

        next.board[row][col] = n;
        next.errors++;
        next.drafts = drafts;
        showToast('❌ Número incorreto!', 1500);
        return next;
      });
    },
    [applyServerCollabGame, checkWin, onlinePlayer, showToast],
  );

  const toggleDraft = useCallback(() => {
    setGame((g) => ({ ...g, draftMode: !g.draftMode }));
  }, []);

  const togglePause = useCallback(async () => {
    const g = gameRef.current;
    const paused = !g.paused;

    if (g.isCollab) {
      try {
        const { game: serverGame } = await postSudokuCollabPause({
          player: onlinePlayer,
          paused,
        });
        applyServerCollabGame(serverGame, { clearSelection: true });
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    setGame((current) => {
      if (paused) {
        stopTimer();
        return { ...current, paused: true, selected: null };
      }
      startTimer();
      return { ...current, paused: false };
    });
  }, [applyServerCollabGame, onlinePlayer, showToast, startTimer, stopTimer]);

  const toggleTurnLock = useCallback(async () => {
    const g = gameRef.current;
    if (!g.isCollab) return;

    if (g.collabTurn !== onlinePlayer) {
      showToast('Só quem está jogando pode travar!');
      return;
    }

    const locked = !g.turnLocked;
    try {
      const { game: serverGame, chatMessage } = await postSudokuCollabTurnLock({
        player: onlinePlayer,
        locked,
      });
      applyServerCollabGame(serverGame, { chatMessage });
    } catch (error) {
      showToast(error.message);
    }
  }, [applyServerCollabGame, onlinePlayer, showToast]);

  const useHint = useCallback(async () => {
    const g = gameRef.current;
    if (g.paused) return;
    if (g.hints <= 0) {
      showToast('Sem dicas restantes!');
      return;
    }
    if (g.isCollab && !canCollabPlay(g, onlinePlayer)) {
      showToast(`🔒 ${PLAYER_NAMES[g.collabTurn]} travou a vez!`);
      return;
    }

    if (g.isCollab) {
      try {
        const { game: serverGame, chatMessage } = await postSudokuCollabHint({
          player: onlinePlayer,
        });
        applyServerCollabGame(serverGame, {
          chatMessage,
          toastMessage: '💡 Dica usada!',
        });
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    setGame((current) => {
      if (current.paused) return current;
      if (current.hints <= 0) return current;

      const empties = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!current.given[r][c] && current.board[r][c] !== current.solution[r][c]) {
            empties.push([r, c]);
          }
        }
      }
      if (!empties.length) return current;

      const [r, c] = empties[Math.floor(Math.random() * empties.length)];
      const next = {
        ...current,
        board: current.board.map((row) => [...row]),
        drafts: current.drafts.map((row) => row.map((set) => new Set(set))),
        hints: current.hints - 1,
        corrects: current.corrects + 1,
      };
      next.board[r][c] = next.solution[r][c];
      next.drafts[r][c].clear();
      removeDraftFromRegion(next.drafts, r, c, next.solution[r][c]);
      showToast('💡 Dica usada!', 1500);
      setTimeout(() => checkWin(next), 0);
      return next;
    });
  }, [applyServerCollabGame, checkWin, onlinePlayer, showToast]);

  const newGame = useCallback(() => {
    stopTimer();
    if (game.isCollab) startCollab(true);
    else startSolo();
  }, [game.isCollab, startCollab, startSolo, stopTimer]);

  const moveSel = useCallback(
    (dr, dc) => {
      setGame((g) => {
        if (!g.selected) return g;
        const r = (g.selected[0] + dr + 9) % 9;
        const c = (g.selected[1] + dc + 9) % 9;
        if (g.given[r][c]) return g;
        if (g.isCollab && !canCollabPlay(g, onlinePlayer)) return g;
        return { ...g, selected: [r, c] };
      });
    },
    [onlinePlayer],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (screen !== 'game') return;
      if (chatInputFocusedRef?.current) return;

      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) enterNum(n);
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') enterNum(0);
      else if (e.key === 'ArrowRight') moveSel(0, 1);
      else if (e.key === 'ArrowLeft') moveSel(0, -1);
      else if (e.key === 'ArrowDown') moveSel(1, 0);
      else if (e.key === 'ArrowUp') moveSel(-1, 0);
      else if (e.key === 'd' || e.key === 'D') toggleDraft();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enterNum, moveSel, screen, toggleDraft, chatInputFocusedRef]);

  useEffect(() => () => {
    stopTimer();
  }, [stopTimer]);

  const progress = calcProgress(game);

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          mode={mode}
          diff={diff}
          scores={scores}
          onSetMode={setMode}
          onSetDiff={setDiff}
          onStartSolo={startSolo}
          onStartCollab={() => startCollab(false)}
          onShowRanking={() => setScreen('ranking')}
          onBack={onBack}
          onlinePlayer={onlinePlayer}
          remotePresence={remotePresence}
          joiningCollab={joiningCollab}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          game={game}
          diff={diff}
          player={onlinePlayer}
          onlinePlayer={onlinePlayer}
          remotePresence={remotePresence}
          progress={progress}
          onGoHome={goHome}
          onSelectCell={selectCell}
          onEnterNum={enterNum}
          onToggleDraft={toggleDraft}
          onTogglePause={togglePause}
          onUseHint={useHint}
          onNewGame={newGame}
          onToggleTurnLock={toggleTurnLock}
        />
      )}

      {screen === 'win' && (
        <WinScreen
          result={winResult}
          onShowRanking={() => setScreen('ranking')}
          onGoHome={goHome}
        />
      )}

      {screen === 'ranking' && <RankingScreen scores={scores} onGoHome={goHome} />}

      {(screen === 'home' || screen === 'game') && (
        <SharedChat
          messages={chatMessages}
          onlinePlayer={onlinePlayer}
          onSendPlayerMessage={sendPlayerChat}
          onClear={clearChatMessages}
          onChatFocusChange={onChatFocusChange}
        />
      )}
    </div>
  );
}
