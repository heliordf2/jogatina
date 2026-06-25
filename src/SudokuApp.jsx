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
import { syncSudokuStats } from './utils/gameStats.js';
import { recordGameStart } from './utils/gameSessions.js';
import { loadScores, saveScores } from './utils/scores.js';
import { generateSudoku, isCellLocked, removeDraftFromRegion } from './utils/sudoku.js';

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

  const timerRef = useRef(null);

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
      setGame((g) => ({ ...g, timer: g.timer + 1 }));
    }, 1000);
  }, [stopTimer]);

  const doStart = useCallback(
    (collab, currentPlayer) => {
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
        isCollab: collab,
        draftMode: false,
        drafts: createEmptyDrafts(),
        turnLocked: false,
        paused: false,
      });
      setScreen('game');
      startTimer();

      const sessionPlayer = collab ? currentPlayer : onlinePlayer;
      recordGameStart(sessionPlayer, 'sudoku', collab ? 'collab' : 'solo');

      if (collab && currentPlayer) {
        addChatMsg(
          'system',
          null,
          `🎮 Duelo iniciado! ${PLAYER_NAMES[currentPlayer]} começa jogando.`,
        );
      }
    },
    [addChatMsg, diff, onlinePlayer, startTimer, stopTimer],
  );

  const startSolo = useCallback(() => {
    if (!onlinePlayer) {
      showToast('Selecione quem você é na tela inicial');
      return;
    }
    doStart(false, null);
  }, [doStart, onlinePlayer, showToast]);

  const startCollab = useCallback(() => {
    if (!onlinePlayer) {
      showToast('Selecione quem você é na tela inicial');
      return;
    }
    doStart(true, onlinePlayer);
  }, [doStart, onlinePlayer, showToast]);

  const switchPlayer = useCallback(() => {
    if (!onlinePlayer) return;
    const next = onlinePlayer === 'helio' ? 'thamy' : 'helio';
    onSetOnline(next);
    addChatMsg('system', null, `👤 ${PLAYER_NAMES[next]} ficou online.`);
  }, [addChatMsg, onlinePlayer, onSetOnline]);

  const goHome = useCallback(() => {
    stopTimer();
    setScreen('home');
    setWinResult(null);
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

      if (currentGame.isCollab) {
        const h = currentGame.collabScores.helio;
        const tt = currentGame.collabScores.thamy;
        const winner = h > tt ? 'helio' : tt > h ? 'thamy' : null;

        setScores((prev) => {
          const next = structuredClone(prev);
          next.helio.total += h;
          next.helio.games++;
          next.thamy.total += tt;
          next.thamy.games++;
          const entry = {
            pts: 0,
            diff,
            time: timeStr,
            type: 'collab',
            date: new Date().toLocaleDateString('pt-BR'),
          };
          next.helio.history.unshift({ ...entry, pts: h });
          next.thamy.history.unshift({ ...entry, pts: tt });
          if (next.helio.history.length > 20) next.helio.history.pop();
          if (next.thamy.history.length > 20) next.thamy.history.pop();
          saveScores(next).catch(() => {});
          syncSudokuStats(next).catch(() => {});
          return next;
        });

        setWinResult({
          emoji: winner ? '🏆' : '🤝',
          title: winner ? `${PLAYER_NAMES[winner]} venceu o duelo!` : 'Empate!',
          sub: `Sudoku ${diffLabel} completado!`,
          time: timeStr,
          pts: Math.max(h, tt),
          errors: currentGame.errors,
          collabDetail: {
            helio: { pts: h, cells: currentGame.collabCells.helio.length },
            thamy: { pts: tt, cells: currentGame.collabCells.thamy.length },
          },
        });
      } else {
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
      }

      setTimeout(() => setScreen('win'), 700);
      return true;
    },
    [diff, onlinePlayer, stopTimer],
  );

  const selectCell = useCallback(
    (r, c) => {
      setGame((g) => {
        if (g.paused) return g;
        if (g.given[r][c] || isCellLocked(g, r, c)) return g;
        if (g.isCollab && g.collabTurn !== onlinePlayer) {
          if (g.turnLocked) {
            showToast(`🔒 ${PLAYER_NAMES[g.collabTurn]} travou a vez!`);
            return g;
          }
          showToast(`É a vez de ${PLAYER_NAMES[g.collabTurn]}!`);
          return g;
        }
        return { ...g, selected: [r, c] };
      });
    },
    [onlinePlayer, showToast],
  );

  const enterNum = useCallback(
    (n) => {
      setGame((g) => {
        if (g.paused) return g;
        if (!g.selected) {
          showToast('Selecione uma célula!');
          return g;
        }
        const [r, c] = g.selected;
        if (g.given[r][c] || isCellLocked(g, r, c)) return g;
        if (g.isCollab && g.collabTurn !== onlinePlayer) {
          showToast('🔒 Não é sua vez!');
          return g;
        }

        if (g.draftMode && n !== 0) {
          if (g.board[r][c]) return g;
          const drafts = g.drafts.map((row) => row.map((set) => new Set(set)));
          const draft = drafts[r][c];
          if (draft.has(n)) draft.delete(n);
          else draft.add(n);
          return { ...g, drafts };
        }

        const next = { ...g, board: g.board.map((row) => [...row]) };
        const drafts = next.drafts.map((row) => row.map((set) => new Set(set)));

        if (next.isCollab) {
          const turn = next.collabTurn;
          if (n === 0) {
            next.board[r][c] = 0;
            next.collabCells = {
              helio: next.collabCells.helio.filter(([cr, cc]) => !(cr === r && cc === c)),
              thamy: next.collabCells.thamy.filter(([cr, cc]) => !(cr === r && cc === c)),
            };
            next.drafts = drafts;
            return next;
          }

          const correct = n === next.solution[r][c];
          next.board[r][c] = n;
          drafts[r][c].clear();
          next.collabCells = {
            helio: next.collabCells.helio.filter(([cr, cc]) => !(cr === r && cc === c)),
            thamy: next.collabCells.thamy.filter(([cr, cc]) => !(cr === r && cc === c)),
          };
          next.collabCells[turn] = [...next.collabCells[turn], [r, c]];

          if (correct) {
            next.collabScores = {
              ...next.collabScores,
              [turn]: next.collabScores[turn] + 10,
            };
            next.corrects++;
            removeDraftFromRegion(drafts, r, c, n);
            const msg = `${turn === 'helio' ? '🟣 Helio' : '🩷 Thamy'} acertou +10! ✅`;
            showToast(msg, 1500);
            addChatMsg('system', null, msg);
          } else {
            next.collabScores = {
              ...next.collabScores,
              [turn]: Math.max(0, next.collabScores[turn] - 5),
            };
            next.errors++;
            const msg = `❌ ${PLAYER_NAMES[turn]} errou -5pts`;
            showToast(msg, 1500);
            addChatMsg('system', null, msg);
          }

          next.collabTurn = turn === 'helio' ? 'thamy' : 'helio';
          next.turnLocked = false;
          next.selected = null;
          next.drafts = drafts;
          setTimeout(() => {
            onSetOnline(next.collabTurn);
            checkWin(next);
          }, 0);
          return next;
        }

        if (n === 0) {
          next.board[r][c] = 0;
          next.drafts = drafts;
          return next;
        }

        if (n === next.solution[r][c]) {
          next.board[r][c] = n;
          drafts[r][c].clear();
          removeDraftFromRegion(drafts, r, c, n);
          next.corrects++;
          next.drafts = drafts;
          setTimeout(() => checkWin(next), 0);
          return next;
        }

        next.board[r][c] = n;
        next.errors++;
        next.drafts = drafts;
        showToast('❌ Número incorreto!', 1500);
        return next;
      });
    },
    [addChatMsg, checkWin, onlinePlayer, onSetOnline, showToast],
  );

  const toggleDraft = useCallback(() => {
    setGame((g) => ({ ...g, draftMode: !g.draftMode }));
  }, []);

  const togglePause = useCallback(() => {
    setGame((g) => {
      const paused = !g.paused;
      if (paused) {
        stopTimer();
        return { ...g, paused: true, selected: null };
      }
      startTimer();
      return { ...g, paused: false };
    });
  }, [startTimer, stopTimer]);

  const toggleTurnLock = useCallback(() => {
    setGame((g) => {
      if (g.collabTurn !== onlinePlayer) {
        showToast('Só quem está jogando pode travar!');
        return g;
      }
      const locked = !g.turnLocked;
      const msg = locked
        ? `🔒 ${PLAYER_NAMES[onlinePlayer]} travou a vez`
        : `🔓 ${PLAYER_NAMES[onlinePlayer]} destravou a vez`;
      addChatMsg('system', null, msg);
      return { ...g, turnLocked: locked };
    });
  }, [addChatMsg, onlinePlayer, showToast]);

  const useHint = useCallback(() => {
    setGame((g) => {
      if (g.paused) return g;
      if (g.hints <= 0) {
        showToast('Sem dicas restantes!');
        return g;
      }
      if (g.isCollab && g.collabTurn !== onlinePlayer) {
        showToast('🔒 Não é sua vez!');
        return g;
      }

      const empties = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!g.given[r][c] && g.board[r][c] !== g.solution[r][c]) {
            empties.push([r, c]);
          }
        }
      }
      if (!empties.length) return g;

      const [r, c] = empties[Math.floor(Math.random() * empties.length)];
      const next = {
        ...g,
        board: g.board.map((row) => [...row]),
        drafts: g.drafts.map((row) => row.map((set) => new Set(set))),
        hints: g.hints - 1,
        corrects: g.corrects + 1,
      };
      next.board[r][c] = next.solution[r][c];
      next.drafts[r][c].clear();
      removeDraftFromRegion(next.drafts, r, c, next.solution[r][c]);

      if (next.isCollab) {
        next.collabCells = {
          ...next.collabCells,
          [onlinePlayer]: [...next.collabCells[onlinePlayer], [r, c]],
        };
        next.collabTurn = onlinePlayer === 'helio' ? 'thamy' : 'helio';
        next.turnLocked = false;
        onSetOnline(next.collabTurn);
        addChatMsg('system', null, `💡 ${PLAYER_NAMES[onlinePlayer]} usou uma dica!`);
      }

      showToast('💡 Dica usada!', 1500);
      setTimeout(() => checkWin(next), 0);
      return next;
    });
  }, [addChatMsg, checkWin, onlinePlayer, onSetOnline, showToast]);

  const newGame = useCallback(() => {
    stopTimer();
    if (game.isCollab) startCollab();
    else startSolo();
  }, [game.isCollab, startCollab, startSolo, stopTimer]);

  const moveSel = useCallback(
    (dr, dc) => {
      setGame((g) => {
        if (!g.selected) return g;
        const r = (g.selected[0] + dr + 9) % 9;
        const c = (g.selected[1] + dc + 9) % 9;
        if (g.given[r][c]) return g;
        if (g.isCollab && g.collabTurn !== onlinePlayer) return g;
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
          onStartCollab={startCollab}
          onShowRanking={() => setScreen('ranking')}
          onBack={onBack}
          onlinePlayer={onlinePlayer}
          remotePresence={remotePresence}
          onSwitchPlayer={switchPlayer}
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
          onSwitchPlayer={switchPlayer}
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
