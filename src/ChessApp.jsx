import { useCallback, useRef, useState } from 'react';
import ChessGameScreen from './components/ChessGameScreen.jsx';
import ChessHomeScreen from './components/ChessHomeScreen.jsx';
import PlayerPresence from './components/PlayerPresence.jsx';
import SharedChat from './components/SharedChat.jsx';
import WhoAmI from './components/WhoAmI.jsx';
import { PLAYER_NAMES } from './data/constants.js';

export default function ChessApp({
  onBack,
  onlinePlayer,
  onSetOnline,
  showToast,
  chatMessages,
  addChatMsg,
  sendPlayerChat,
  onChatFocusChange,
}) {
  const [screen, setScreen] = useState('home');
  const [myself, setMyself] = useState(null);
  const [whoAmI, setWhoAmI] = useState({ visible: false, onDone: null });

  const startGame = useCallback(() => {
    setWhoAmI({
      visible: true,
      onDone: (selected) => {
        setMyself(selected);
        onSetOnline(selected);
        addChatMsg(
          'system',
          null,
          `♟️ Partida iniciada! ${PLAYER_NAMES[selected]} está com o dispositivo.`,
        );
        setScreen('game');
      },
    });
  }, [addChatMsg, onSetOnline]);

  const goHome = useCallback(() => {
    setScreen('home');
    setMyself(null);
    onSetOnline(null);
  }, [onSetOnline]);

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

  return (
    <div className="app chess-app">
      <WhoAmI
        visible={whoAmI.visible}
        subtitle="Identifique-se para jogar xadrez"
        onSelect={(p) => {
          setWhoAmI({ visible: false, onDone: null });
          whoAmI.onDone?.(p);
        }}
      />

      {screen === 'home' && (
        <ChessHomeScreen
          onBack={onBack}
          onStart={startGame}
          onlinePlayer={onlinePlayer}
        />
      )}

      {screen === 'game' && (
        <ChessGameScreen
          myself={myself}
          onlinePlayer={onlinePlayer}
          onGoHome={goHome}
          onSwitchPlayer={switchPlayer}
          onSystemMessage={(text) => addChatMsg('system', null, text)}
          showToast={showToast}
        />
      )}

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
