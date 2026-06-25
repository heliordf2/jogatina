import { useCallback, useState } from 'react';
import ChessGameScreen from './components/ChessGameScreen.jsx';
import ChessHomeScreen from './components/ChessHomeScreen.jsx';
import SharedChat from './components/SharedChat.jsx';
import { PLAYER_NAMES } from './data/constants.js';
import { createOrJoinChessGame } from './utils/api.js';
import { recordGameStart } from './utils/gameSessions.js';

export default function ChessApp({
  onBack,
  onlinePlayer,
  showToast,
  chatMessages,
  addChatMsg,
  sendPlayerChat,
  clearChatMessages,
  remotePresence,
  onChatFocusChange,
}) {
  const [screen, setScreen] = useState('home');
  const [activeGame, setActiveGame] = useState(null);
  const [joining, setJoining] = useState(false);

  const startGame = useCallback(async () => {
    if (!onlinePlayer) {
      showToast('Selecione quem você é na tela inicial');
      return;
    }

    setJoining(true);
    try {
      const game = await createOrJoinChessGame({ player: onlinePlayer });
      setActiveGame(game);
      recordGameStart(onlinePlayer, 'chess');

      if (game.moves.length === 0) {
        addChatMsg(
          'system',
          null,
          `♟️ Partida online! ${PLAYER_NAMES[game.whitePlayer]} com as brancas, ${PLAYER_NAMES[game.blackPlayer]} com as pretas.`,
        );
      } else {
        addChatMsg('system', null, `♟️ ${PLAYER_NAMES[onlinePlayer]} entrou na partida online.`);
      }

      setScreen('game');
    } catch (error) {
      showToast(error.message);
    } finally {
      setJoining(false);
    }
  }, [addChatMsg, onlinePlayer, showToast]);

  const goHome = useCallback(() => {
    setScreen('home');
    setActiveGame(null);
  }, []);

  return (
    <div className="app chess-app">
      {screen === 'home' && (
        <ChessHomeScreen
          onBack={onBack}
          onStart={startGame}
          onlinePlayer={onlinePlayer}
          remotePresence={remotePresence}
          joining={joining}
        />
      )}

      {screen === 'game' && (
        <ChessGameScreen
          onlinePlayer={onlinePlayer}
          remotePresence={remotePresence}
          initialGame={activeGame}
          onGoHome={goHome}
          onSystemMessage={(text) => addChatMsg('system', null, text)}
          showToast={showToast}
        />
      )}

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
