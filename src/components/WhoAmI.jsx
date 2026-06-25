import IMGS from '../assets/imgs.js';
import { PLAYER_NAMES, PLAYER_COLORS } from '../data/constants.js';

export default function WhoAmI({ visible, onSelect, subtitle }) {
  if (!visible) return null;

  return (
    <div className="whoami-overlay">
      <div className="whoami-box">
        <h2>👋 Quem é você?</h2>
        <p>{subtitle || 'Identifique-se para jogar no duelo colaborativo'}</p>
        <div className="whoami-cards">
          {['helio', 'thamy'].map((player) => (
            <button
              key={player}
              type="button"
              className={`whoami-card ${player === 'helio' ? 'h' : 't'}`}
              onClick={() => onSelect(player)}
            >
              <div className="whoami-av">
                <img src={IMGS[player]} alt={PLAYER_NAMES[player]} />
              </div>
              <div className="whoami-name" style={{ color: PLAYER_COLORS[player] }}>
                {PLAYER_NAMES[player]}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
