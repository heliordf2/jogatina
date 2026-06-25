import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import './chess.css';
import ChessApp from './ChessApp.jsx';
import GameStatsPanel from './components/GameStatsPanel.jsx';
import MainPicker from './components/MainPicker.jsx';
import SharedChat from './components/SharedChat.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import Toast from './components/Toast.jsx';
import SudokuApp from './SudokuApp.jsx';
import { useRemotePresence } from './hooks/useRemotePresence.js';
import { PLAYER_NAMES } from './data/constants.js';
import {
  checkApiHealth,
  clearChatApi,
  fetchChatMessages,
  postChatMessage,
  touchPresenceApi,
} from './utils/api.js';
import { readPresence, writePresence } from './utils/presence.js';
import { applyTheme, readTheme, toggleTheme } from './utils/theme.js';

const CHAT_POLL_MS = 2000;
const PRESENCE_HEARTBEAT_MS = 5000;

export default function App() {
  const [game, setGame] = useState(null);
  const [onlinePlayer, setOnlinePlayer] = useState(readPresence);
  const [chatMessages, setChatMessages] = useState([]);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [theme, setTheme] = useState(readTheme);
  const remotePresence = useRemotePresence();

  const toastTimerRef = useRef(null);
  const chatInputFocusedRef = useRef(false);
  const lastChatIdRef = useRef(0);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const syncPresence = () => setOnlinePlayer(readPresence());
    const onStorage = (event) => {
      if (event.key === 'jogatina_online') syncPresence();
    };
    const onPresence = () => syncPresence();

    window.addEventListener('storage', onStorage);
    window.addEventListener('jogatina-presence', onPresence);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('jogatina-presence', onPresence);
    };
  }, []);

  useEffect(() => {
    if (!onlinePlayer) return undefined;

    touchPresenceApi(onlinePlayer).catch(() => {});
    const id = setInterval(() => {
      touchPresenceApi(onlinePlayer).catch(() => {});
    }, PRESENCE_HEARTBEAT_MS);

    return () => clearInterval(id);
  }, [onlinePlayer]);

  useEffect(() => {
    let cancelled = false;

    async function syncChat() {
      try {
        const messages = await fetchChatMessages();
        if (cancelled) return;
        setChatMessages(messages);
        lastChatIdRef.current = messages.at(-1)?.id ?? 0;
      } catch {
        // ignore transient sync errors
      }
    }

    syncChat();
    const id = setInterval(syncChat, CHAT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((current) => toggleTheme(current));
  }, []);

  const showToast = useCallback((msg, dur = 2000) => {
    setToast({ message: msg, visible: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, dur);
  }, []);

  useEffect(() => {
    checkApiHealth()
      .then((health) => {
        if (!health?.features?.includes('chat')) {
          showToast('Servidor desatualizado — reinicie com npm run dev', 4000);
        }
      })
      .catch(() => {
        showToast('API offline — rode npm run dev', 4000);
      });
  }, [showToast]);

  const setOnline = useCallback((player) => {
    setOnlinePlayer(player);
    writePresence(player);
    touchPresenceApi(player).catch(() => {});
  }, []);

  const addChatMsg = useCallback(async (sender, chatPlayer, text, { silent = false } = {}) => {
    try {
      const msg = await postChatMessage({ sender, player: chatPlayer, text });
      setChatMessages((msgs) => {
        if (msgs.some((m) => m.id === msg.id)) return msgs;
        const next = [...msgs, msg];
        lastChatIdRef.current = msg.id;
        return next.slice(-200);
      });
    } catch (error) {
      if (!silent) {
        const hint =
          error.message?.includes('404') || error.message?.includes('API')
            ? 'Servidor desatualizado — reinicie com npm run dev'
            : 'Não foi possível enviar a mensagem';
        showToast(hint);
      }
    }
  }, [showToast]);

  const openGame = useCallback(
    (nextGame) => {
      if (!onlinePlayer) {
        showToast('Selecione Helio ou Thamy na tela inicial');
        return;
      }
      setGame(nextGame);
    },
    [onlinePlayer, showToast],
  );

  const selectPlayer = useCallback(
    (player) => {
      if (player === onlinePlayer) return;
      setOnline(player);
      addChatMsg('system', null, `👤 ${PLAYER_NAMES[player]} ficou online.`, { silent: true });
    },
    [addChatMsg, onlinePlayer, setOnline],
  );

  const sendPlayerChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (!onlinePlayer) {
        showToast('Selecione quem você é na tela inicial');
        return;
      }

      addChatMsg('player', onlinePlayer, trimmed);
    },
    [addChatMsg, onlinePlayer, showToast],
  );

  const clearChatMessages = useCallback(async () => {
    try {
      await clearChatApi();
      setChatMessages([]);
      lastChatIdRef.current = 0;
      showToast('Chat limpo');
    } catch {
      showToast('Não foi possível limpar o chat');
    }
  }, [showToast]);

  const chatProps = {
    chatMessages,
    addChatMsg,
    onlinePlayer,
    remotePresence,
    sendPlayerChat,
    clearChatMessages,
    onChatFocusChange: (focused) => {
      chatInputFocusedRef.current = focused;
    },
    setOnline,
  };

  const leaveGame = useCallback(() => {
    setGame(null);
  }, []);

  return (
    <>
      <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
      <Toast message={toast.message} visible={toast.visible} />

      {!game ? (
        <div className="app">
          <MainPicker
            onlinePlayer={onlinePlayer}
            remotePresence={remotePresence}
            onSelectPlayer={selectPlayer}
            onSelectGame={openGame}
          />
          <SharedChat
            messages={chatMessages}
            onlinePlayer={onlinePlayer}
            onSendPlayerMessage={sendPlayerChat}
            onClear={clearChatMessages}
            onChatFocusChange={chatProps.onChatFocusChange}
            title="💬 Chat"
          />
          <GameStatsPanel />
        </div>
      ) : game === 'sudoku' ? (
        <SudokuApp
          onBack={leaveGame}
          onlinePlayer={onlinePlayer}
          onSetOnline={setOnline}
          showToast={showToast}
          chatInputFocusedRef={chatInputFocusedRef}
          {...chatProps}
        />
      ) : (
        <ChessApp
          onBack={leaveGame}
          onlinePlayer={onlinePlayer}
          onSetOnline={setOnline}
          showToast={showToast}
          chatInputFocusedRef={chatInputFocusedRef}
          {...chatProps}
        />
      )}
    </>
  );
}
