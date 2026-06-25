import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import { isPlayerOnlineRemote } from '../hooks/useRemotePresence.js';

export default function CurrentPlayerBar({ player, detail, remotePresence = null }) {
  if (!player) return null;

  const online = remotePresence ? isPlayerOnlineRemote(remotePresence, player) : true;

  return (
    <div className="current-player-bar">
      <div className="current-player-av">
        <img src={IMGS[player]} alt={PLAYER_NAMES[player]} />
        <span className={`online-dot avatar-dot${online ? ' on' : ''}`} />
      </div>
      <div className="current-player-info">
        <div className="current-player-name" style={{ color: PLAYER_COLORS[player] }}>
          {PLAYER_NAMES[player]}
        </div>
        <div className={`current-player-meta${online ? ' online' : ''}`}>
          {online ? '● Online' : '○ Offline'}
          {detail ? ` · ${detail}` : ''}
        </div>
      </div>
    </div>
  );
}
