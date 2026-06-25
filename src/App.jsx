import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import './chess.css';
import ChessApp from './ChessApp.jsx';
import GameStatsPanel from './components/GameStatsPanel.jsx';
import MainPicker from './components/MainPicker.jsx';
import SharedChat from './components/SharedChat.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import Toast from './components/Toast.jsx';
import WhoAmI from './components/WhoAmI.jsx';
import SudokuApp from './SudokuApp.jsx';
import { PLAYER_NAMES } from './data/constants.js';
import { chatTime, loadChat, saveChat } from './utils/chat.js';
import { readPresence, writePresence } from './utils/presence.js';
import { applyTheme, readTheme, toggleTheme } from './utils/theme.js';

export default function App() {
  const [game, setGame] = useState(null);
  const [onlinePlayer, setOnlinePlayer] = useState(readPresence);
  const [chatMessages, setChatMessages] = useState(loadChat);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [whoAmI, setWhoAmI] = useState({ visible: false, onDone: null });
  const [theme, setTheme] = useState(readTheme);

  const toastTimerRef = useRef(null);
  const chatInputFocusedRef = useRef(false);

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

  const setOnline = useCallback((player) => {
    setOnlinePlayer(player);
    writePresence(player);
  }, []);

  const addChatMsg = useCallback((sender, chatPlayer, text) => {
    setChatMessages((msgs) => {
      const next = [...msgs, { sender, player: chatPlayer, text, time: chatTime() }];
      saveChat(next);
      return next;
    });
  }, []);

  const openWhoAmI = useCallback((onDone, subtitle) => {
    setWhoAmI({ visible: true, onDone, subtitle });
  }, []);

  const sendPlayerChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (onlinePlayer) {
        addChatMsg('player', onlinePlayer, trimmed);
        return;
      }

      openWhoAmI((player) => {
        setOnline(player);
        addChatMsg('player', player, trimmed);
      }, 'Identifique-se para enviar mensagens');
    },
    [addChatMsg, onlinePlayer, openWhoAmI, setOnline],
  );

  const chatProps = {
    chatMessages,
    addChatMsg,
    onlinePlayer,
    sendPlayerChat,
    onChatFocusChange: (focused) => {
      chatInputFocusedRef.current = focused;
    },
    setOnline,
  };

  const leaveGame = useCallback(() => {
    setOnline(null);
    setGame(null);
  }, [setOnline]);

  return (
    <>
      <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
      <Toast message={toast.message} visible={toast.visible} />

      <WhoAmI
        visible={whoAmI.visible}
        subtitle={whoAmI.subtitle}
        onSelect={(p) => {
          setWhoAmI({ visible: false, onDone: null, subtitle: null });
          whoAmI.onDone?.(p);
        }}
      />

      {!game ? (
        <div className="app">
          <MainPicker
            onSelectGame={setGame}
            onlinePlayer={onlinePlayer}
            onIdentify={() =>
              openWhoAmI((player) => {
                setOnline(player);
                addChatMsg('system', null, `👤 ${PLAYER_NAMES[player]} ficou online.`);
              })
            }
          />
          <SharedChat
            messages={chatMessages}
            onlinePlayer={onlinePlayer}
            onSendPlayerMessage={sendPlayerChat}
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
