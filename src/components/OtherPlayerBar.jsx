import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import { isPlayerOnlineRemote } from '../hooks/useRemotePresence.js';
import { isPlayerOnline } from '../utils/presence.js';

export default function OtherPlayerBar({ onlinePlayer, remotePresence = null }) {
  if (!onlinePlayer) return null;

  const other = onlinePlayer === 'helio' ? 'thamy' : 'helio';
  const online = remotePresence
    ? isPlayerOnlineRemote(remotePresence, other)
    : isPlayerOnline(onlinePlayer, other);

  return (
    <div className="other-player-bar">
      <div className="other-player-av">
        <img src={IMGS[other]} alt={PLAYER_NAMES[other]} />
        <span className={`online-dot avatar-dot${online ? ' on' : ''}`} />
      </div>
      <div className="other-player-info">
        <div className="other-player-name" style={{ color: PLAYER_COLORS[other] }}>
          {PLAYER_NAMES[other]}
        </div>
        <div className={`other-player-meta${online ? ' online' : ''}`}>
          {online ? '● Online' : '○ Offline'}
        </div>
      </div>
    </div>
  );
}
