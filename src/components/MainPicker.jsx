import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import { isPlayerOnlineRemote } from '../hooks/useRemotePresence.js';
import { isPlayerOnline } from '../utils/presence.js';

export default function MainPicker({
  onlinePlayer,
  remotePresence,
  onSelectPlayer,
  onSelectGame,
}) {
  const canPlay = Boolean(onlinePlayer);

  function playerIsOnline(player) {
    if (remotePresence) return isPlayerOnlineRemote(remotePresence, player);
    return isPlayerOnline(onlinePlayer, player);
  }

  return (
    <div className="screen active">
      <div className="header">
        <div className="logo">
          Joga<span>tina</span> 🎮
        </div>
      </div>

      <p className="picker-subtitle">Quem está jogando?</p>

      <div className="picker-player-select">
        {['helio', 'thamy'].map((p) => {
          const online = playerIsOnline(p);
          return (
            <button
              key={p}
              type="button"
              className={`picker-player-card${onlinePlayer === p ? ' selected' : ''}`}
              onClick={() => onSelectPlayer(p)}
            >
              <div className="picker-player-av">
                <img src={IMGS[p]} alt={PLAYER_NAMES[p]} />
                <span className={`online-dot avatar-dot${online ? ' on' : ''}`} />
              </div>
              <span className="picker-player-name" style={{ color: PLAYER_COLORS[p] }}>
                {PLAYER_NAMES[p]}
              </span>
              <span className={`picker-player-status${online ? ' on' : ''}`}>
                {online ? '● Online' : '○ Offline'}
              </span>
            </button>
          );
        })}
      </div>

      <p className="picker-subtitle" style={{ marginTop: '1.25rem' }}>
        Escolha um jogo para começar
      </p>

      <div className="game-picker">
        <button
          type="button"
          className="game-card"
          disabled={!canPlay}
          onClick={() => onSelectGame('sudoku')}
        >
          <div className="game-card-icon">🔢</div>
          <div className="game-card-title">Sudoku</div>
          <div className="game-card-desc">
            Solo ou duelo colaborativo com ranking e dificuldades.
          </div>
        </button>

        <button
          type="button"
          className="game-card"
          disabled={!canPlay}
          onClick={() => onSelectGame('chess')}
        >
          <div className="game-card-icon">♟️</div>
          <div className="game-card-title">Xadrez</div>
          <div className="game-card-desc">
            Helio vs Thamy online, com partida e chat sincronizados.
          </div>
        </button>
      </div>

      {!canPlay && (
        <p className="picker-hint">Selecione Helio ou Thamy acima para liberar os jogos.</p>
      )}
    </div>
  );
}
