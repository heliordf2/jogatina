import IMGS from '../assets/imgs.js';
import { PLAYER_NAMES } from '../data/constants.js';
import { isPlayerOnline } from '../utils/presence.js';

export default function PlayerPresence({ onlinePlayer, compact = false }) {
  return (
    <div className={`player-presence${compact ? ' compact' : ''}`}>
      {['helio', 'thamy'].map((p) => {
        const online = isPlayerOnline(onlinePlayer, p);
        return (
          <div key={p} className={`presence-chip presence-${p}${online ? ' is-online' : ''}`}>
            <div className="presence-av-wrap">
              <img src={IMGS[p]} alt={PLAYER_NAMES[p]} className="presence-av" />
              <span className={`online-dot${online ? ' on' : ''}`} title={online ? 'Online' : 'Offline'} />
            </div>
            <div className="presence-info">
              <span className="presence-name">{PLAYER_NAMES[p]}</span>
              <span className={`presence-status${online ? ' online' : ''}`}>
                {online ? '● Online' : '○ Offline'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
