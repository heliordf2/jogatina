import IMGS from '../assets/imgs.js';
import { DIFF_EMPTY } from '../data/constants.js';
import { isPlayerOnline } from '../utils/presence.js';

export default function HomeScreen({
  mode,
  diff,
  player,
  scores,
  onlinePlayer,
  onSetMode,
  onSetDiff,
  onSelectPlayer,
  onStartSolo,
  onStartCollab,
  onShowRanking,
  onBack,
}) {
  return (
    <div className="screen active">
      <div className="header">
        <button type="button" className="btn" onClick={onBack}>
          ← Voltar
        </button>
        <div className="logo">
          Su<span>doku</span> 🎮
        </div>
        <button type="button" className="btn" onClick={onShowRanking}>
          🏆 Ranking
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab${mode === 'solo' ? ' active' : ''}`}
          onClick={() => onSetMode('solo')}
        >
          ⚡ Solo
        </button>
        <button
          type="button"
          className={`tab${mode === 'collab' ? ' active' : ''}`}
          onClick={() => onSetMode('collab')}
        >
          🤝 Colaborativo
        </button>
      </div>

      {mode === 'solo' ? (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '.8rem', fontWeight: 500 }}>
            Quem vai jogar?
          </p>
          <div className="player-select">
            {['helio', 'thamy'].map((p) => (
              <button
                key={p}
                type="button"
                className={`player-card${player === p ? ' selected' : ''}`}
                onClick={() => onSelectPlayer(p)}
              >
                <div className="avatar">
                  <img src={IMGS[p]} alt={p === 'helio' ? 'Helio' : 'Thamy'} />
                  <span className={`online-dot avatar-dot${isPlayerOnline(onlinePlayer, p) ? ' on' : ''}`} />
                </div>
                <div className="p-name">{p === 'helio' ? 'Helio' : 'Thamy'}</div>
                <div className="p-score">{scores[p].total} pts total</div>
                <div className="p-badge">
                  {isPlayerOnline(onlinePlayer, p) ? '● Online' : `${scores[p].games} jogo${scores[p].games !== 1 ? 's' : ''}`}
                </div>
              </button>
            ))}
          </div>
          <div className="diff-label">Dificuldade:</div>
          <div className="diff-select">
            {['easy', 'medium', 'hard', 'extreme'].map((d) => (
              <button
                key={d}
                type="button"
                className={`diff-btn${d === 'extreme' ? ' extreme' : ''}${diff === d ? ' active' : ''}`}
                onClick={() => onSetDiff(d)}
              >
                {d === 'easy' && '😊 Fácil'}
                {d === 'medium' && '😤 Médio'}
                {d === 'hard' && '🔥 Difícil'}
                {d === 'extreme' && '💀 Extremo'}
                <br />
                <span style={{ fontSize: 10, opacity: 0.7 }}>{DIFF_EMPTY[d]}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={onStartSolo}>
            ▶ Iniciar Jogo Solo
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '.8rem', fontWeight: 500 }}>
            Quem vai jogar?
          </p>
          <div className="player-select">
            {['helio', 'thamy'].map((p) => (
              <div key={p} className="player-card player-card-static">
                <div className="avatar">
                  <img src={IMGS[p]} alt={p === 'helio' ? 'Helio' : 'Thamy'} />
                  <span className={`online-dot avatar-dot${isPlayerOnline(onlinePlayer, p) ? ' on' : ''}`} />
                </div>
                <div className="p-name">{p === 'helio' ? 'Helio' : 'Thamy'}</div>
                <div className="p-score">{scores[p].total} pts total</div>
                <div className="p-badge">
                  {isPlayerOnline(onlinePlayer, p) ? '● Online' : `${scores[p].games} jogo${scores[p].games !== 1 ? 's' : ''}`}
                </div>
              </div>
            ))}
          </div>
          <div className="info-box">
            <h3>🤝 Duelo em turnos:</h3>
            <p>
              Helio e Thamy jogam no <strong>mesmo dispositivo</strong>, passando um para o outro.
              <br />
              ✅ Certo: <strong>+10 pts</strong> &nbsp;❌ Errado: <strong>-5 pts</strong>
              <br />
              Cada um só joga na <strong>sua vez</strong> — identifique-se ao iniciar!
            </p>
          </div>
          <div className="diff-label">Dificuldade:</div>
          <div className="diff-select">
            {['easy', 'medium', 'hard', 'extreme'].map((d) => (
              <button
                key={d}
                type="button"
                className={`diff-btn${d === 'extreme' ? ' extreme' : ''}${diff === d ? ' active' : ''}`}
                onClick={() => onSetDiff(d)}
              >
                {d === 'easy' && '😊 Fácil'}
                {d === 'medium' && '😤 Médio'}
                {d === 'hard' && '🔥 Difícil'}
                {d === 'extreme' && '💀 Extremo'}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={onStartCollab}>
            ⚔️ Iniciar Duelo
          </button>
        </div>
      )}
    </div>
  );
}
