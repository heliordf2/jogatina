import IMGS from '../assets/imgs.js';
import { PLAYER_NAMES } from '../data/constants.js';
import { isPlayerOnline } from '../utils/presence.js';

export default function ChessHomeScreen({ onBack, onStart, onlinePlayer }) {
  return (
    <div className="screen active">
      <div className="header">
        <button type="button" className="btn" onClick={onBack}>
          ← Voltar
        </button>
        <div className="logo">
          Xa<span>drez</span> ♟️
        </div>
        <div />
      </div>

      <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '.8rem', fontWeight: 500 }}>
        Quem vai jogar?
      </p>

      <div className="player-select">
        {['helio', 'thamy'].map((p) => (
          <div key={p} className="player-card player-card-static">
            <div className="avatar">
              <img src={IMGS[p]} alt={PLAYER_NAMES[p]} />
              <span className={`online-dot avatar-dot${isPlayerOnline(onlinePlayer, p) ? ' on' : ''}`} />
            </div>
            <div className="p-name">{PLAYER_NAMES[p]}</div>
            <div className="p-score">{p === 'helio' ? '♔ Brancas' : '♚ Pretas'}</div>
            <div className="p-badge">{isPlayerOnline(onlinePlayer, p) ? '● Online' : '○ Offline'}</div>
          </div>
        ))}
      </div>

      <div className="info-box">
        <h3>⚔️ Duelo local:</h3>
        <p>
          Helio e Thamy jogam no <strong>mesmo dispositivo</strong>, passando um para o outro.
          <br />
          Helio joga com as <strong>brancas</strong>, Thamy com as <strong>pretas</strong>.
          <br />
          Identifique-se ao iniciar e troque de jogador quando passar o aparelho!
        </p>
      </div>

      <button type="button" className="btn btn-primary" onClick={onStart}>
        ♟️ Iniciar Partida
      </button>
    </div>
  );
}
