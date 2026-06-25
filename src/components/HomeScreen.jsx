import { DIFF_EMPTY } from '../data/constants.js';
import CurrentPlayerBar from './CurrentPlayerBar.jsx';

export default function HomeScreen({
  mode,
  diff,
  scores,
  onlinePlayer,
  remotePresence,
  onSetMode,
  onSetDiff,
  onStartSolo,
  onStartCollab,
  onShowRanking,
  onBack,
  onSwitchPlayer,
}) {
  const playerDetail =
    mode === 'solo'
      ? `${scores[onlinePlayer].total} pts total`
      : 'com o dispositivo';

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

      <CurrentPlayerBar player={onlinePlayer} detail={playerDetail} remotePresence={remotePresence} />

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
          <button type="button" className="btn" style={{ width: '100%', marginBottom: '.75rem' }} onClick={onSwitchPlayer}>
            👤 Trocar jogador com o dispositivo
          </button>
          <div className="info-box">
            <h3>🤝 Duelo em turnos:</h3>
            <p>
              Helio e Thamy jogam no <strong>mesmo dispositivo</strong>, passando um para o outro.
              <br />
              ✅ Certo: <strong>+10 pts</strong> &nbsp;❌ Errado: <strong>-5 pts</strong>
              <br />
              Cada um só joga na <strong>sua vez</strong> — troque o jogador online ao passar o aparelho.
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
