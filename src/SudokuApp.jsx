import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import GameScreen from './components/GameScreen.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import PlayerPresence from './components/PlayerPresence.jsx';
import RankingScreen from './components/RankingScreen.jsx';
import SharedChat from './components/SharedChat.jsx';
import WhoAmI from './components/WhoAmI.jsx';
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
import { loadScores, saveScores } from './utils/scores.js';
import { generateSudoku, isCellLocked } from './utils/sudoku.js';

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
  onChatFocusChange,
}) {
  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState('solo');
  const [diff, setDiff] = useState('easy');
  const [player, setPlayer] = useState(null);
  const [myself, setMyself] = useState(null);
  const [scores, setScores] = useState(() => structuredClone(INITIAL_SCORES));
  const [game, setGame] = useState(createInitialGameState);
  const [winResult, setWinResult] = useState(null);
  const [whoAmI, setWhoAmI] = useState({ visible: false, onDone: null });

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
    (collab, currentMyself) => {
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
      });
      setScreen('game');
      startTimer();

      if (collab && currentMyself) {
        addChatMsg(
          'system',
          null,
          `🎮 Duelo iniciado! ${PLAYER_NAMES[currentMyself]} começa jogando.`,
        );
      }
    },
    [addChatMsg, diff, startTimer, stopTimer],
  );

  const startSolo = useCallback(() => {
    if (!player) {
      showToast('⚠️ Escolha um jogador primeiro!');
      return;
    }
    onSetOnline(player);
    doStart(false, null);
  }, [doStart, onSetOnline, player, showToast]);

  const startCollab = useCallback(() => {
    setWhoAmI({
      visible: true,
      onDone: (selected) => {
        setMyself(selected);
        onSetOnline(selected);
        doStart(true, selected);
      },
    });
  }, [doStart, onSetOnline]);

  const switchPlayer = useCallback(() => {
    setWhoAmI({
      visible: true,
      onDone: (selected) => {
        setMyself(selected);
        onSetOnline(selected);
        addChatMsg('system', null, `👤 ${PLAYER_NAMES[selected]} ficou online.`);
      },
    });
  }, [addChatMsg, onSetOnline]);

  const goHome = useCallback(() => {
    stopTimer();
    setScreen('home');
    setWinResult(null);
    setMyself(null);
    onSetOnline(null);
  }, [onSetOnline, stopTimer]);

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
          const p = next[player];
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
          title: `${PLAYER_NAMES[player]} concluiu!`,
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
    [diff, player, stopTimer],
  );

  const selectCell = useCallback(
    (r, c) => {
      setGame((g) => {
        if (g.given[r][c] || isCellLocked(g, r, c)) return g;
        if (g.isCollab && g.collabTurn !== myself) {
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
    [myself, showToast],
  );

  const enterNum = useCallback(
    (n) => {
      setGame((g) => {
        if (!g.selected) {
          showToast('Selecione uma célula!');
          return g;
        }
        const [r, c] = g.selected;
        if (g.given[r][c] || isCellLocked(g, r, c)) return g;
        if (g.isCollab && g.collabTurn !== myself) {
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
          setTimeout(() => checkWin(next), 0);
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
    [addChatMsg, checkWin, myself, showToast],
  );

  const toggleDraft = useCallback(() => {
    setGame((g) => ({ ...g, draftMode: !g.draftMode }));
  }, []);

  const toggleTurnLock = useCallback(() => {
    setGame((g) => {
      if (g.collabTurn !== myself) {
        showToast('Só quem está jogando pode travar!');
        return g;
      }
      const locked = !g.turnLocked;
      const msg = locked
        ? `🔒 ${PLAYER_NAMES[myself]} travou a vez`
        : `🔓 ${PLAYER_NAMES[myself]} destravou a vez`;
      addChatMsg('system', null, msg);
      return { ...g, turnLocked: locked };
    });
  }, [addChatMsg, myself, showToast]);

  const useHint = useCallback(() => {
    setGame((g) => {
      if (g.hints <= 0) {
        showToast('Sem dicas restantes!');
        return g;
      }
      if (g.isCollab && g.collabTurn !== myself) {
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

      if (next.isCollab) {
        next.collabCells = {
          ...next.collabCells,
          [myself]: [...next.collabCells[myself], [r, c]],
        };
        next.collabTurn = myself === 'helio' ? 'thamy' : 'helio';
        next.turnLocked = false;
        addChatMsg('system', null, `💡 ${PLAYER_NAMES[myself]} usou uma dica!`);
      }

      showToast('💡 Dica usada!', 1500);
      setTimeout(() => checkWin(next), 0);
      return next;
    });
  }, [addChatMsg, checkWin, myself, showToast]);

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
        if (g.isCollab && g.collabTurn !== myself) return g;
        return { ...g, selected: [r, c] };
      });
    },
    [myself],
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
      <WhoAmI
        visible={whoAmI.visible}
        onSelect={(p) => {
          setWhoAmI({ visible: false, onDone: null });
          whoAmI.onDone?.(p);
        }}
      />

      {screen === 'home' && (
        <HomeScreen
          mode={mode}
          diff={diff}
          player={player}
          scores={scores}
          onSetMode={setMode}
          onSetDiff={setDiff}
          onSelectPlayer={setPlayer}
          onStartSolo={startSolo}
          onStartCollab={startCollab}
          onShowRanking={() => setScreen('ranking')}
          onBack={onBack}
          onlinePlayer={onlinePlayer}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          game={game}
          diff={diff}
          player={player}
          myself={myself}
          onlinePlayer={onlinePlayer}
          progress={progress}
          onGoHome={goHome}
          onSwitchPlayer={switchPlayer}
          onSelectCell={selectCell}
          onEnterNum={enterNum}
          onToggleDraft={toggleDraft}
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
        <>
          <PlayerPresence onlinePlayer={onlinePlayer} compact={screen === 'game'} />
          <SharedChat
            messages={chatMessages}
            onlinePlayer={onlinePlayer}
            onSendPlayerMessage={sendPlayerChat}
            onChatFocusChange={onChatFocusChange}
          />
        </>
      )}
    </div>
  );
}
