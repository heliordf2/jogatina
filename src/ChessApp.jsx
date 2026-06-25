import { useCallback, useRef, useState } from 'react';
import ChessGameScreen from './components/ChessGameScreen.jsx';
import ChessHomeScreen from './components/ChessHomeScreen.jsx';
import PlayerPresence from './components/PlayerPresence.jsx';
import SharedChat from './components/SharedChat.jsx';
import WhoAmI from './components/WhoAmI.jsx';
import { PLAYER_NAMES } from './data/constants.js';
import { recordGameStart } from './utils/gameSessions.js';

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
  const [whoAmIVisible, setWhoAmIVisible] = useState(false);
  const [whoAmISubtitle, setWhoAmISubtitle] = useState(null);
  const whoAmIDoneRef = useRef(null);

  const openWhoAmI = useCallback((onDone, subtitle) => {
    whoAmIDoneRef.current = onDone;
    setWhoAmISubtitle(subtitle);
    setWhoAmIVisible(true);
  }, []);

  const handoffToPlayer = useCallback(
    (player) => {
      setMyself(player);
      onSetOnline(player);
    },
    [onSetOnline],
  );

  const startGame = useCallback(() => {
    openWhoAmI((selected) => {
      handoffToPlayer(selected);
      recordGameStart(selected, 'chess');
      addChatMsg(
        'system',
        null,
        `♟️ Partida iniciada! ${PLAYER_NAMES[selected]} está com o dispositivo.`,
      );
      setScreen('game');
    }, 'Identifique-se para jogar xadrez');
  }, [addChatMsg, handoffToPlayer, openWhoAmI]);

  const goHome = useCallback(() => {
    setScreen('home');
    setMyself(null);
    onSetOnline(null);
  }, [onSetOnline]);

  const switchPlayer = useCallback(() => {
    openWhoAmI((selected) => {
      handoffToPlayer(selected);
      addChatMsg('system', null, `👤 ${PLAYER_NAMES[selected]} ficou online.`);
    }, 'Quem está com o dispositivo agora?');
  }, [addChatMsg, handoffToPlayer, openWhoAmI]);

  const handleTurnHandoff = useCallback(
    (player) => {
      handoffToPlayer(player);
    },
    [handoffToPlayer],
  );

  return (
    <div className="app chess-app">
      <WhoAmI
        visible={whoAmIVisible}
        subtitle={whoAmISubtitle}
        onSelect={(p) => {
          setWhoAmIVisible(false);
          setWhoAmISubtitle(null);
          whoAmIDoneRef.current?.(p);
          whoAmIDoneRef.current = null;
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
          onTurnHandoff={handleTurnHandoff}
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
