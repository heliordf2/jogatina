import { DIFF_EMPTY } from '../data/constants.js';
import CurrentPlayerBar from './CurrentPlayerBar.jsx';
import DifficultyPicker from './DifficultyPicker.jsx';

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
  joiningCollab = false,
}) {
  const playerDetail =
    mode === 'solo'
      ? `${scores[onlinePlayer].total} pts total`
      : 'duelo online';

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
          <DifficultyPicker diff={diff} onSetDiff={onSetDiff} />
          <button type="button" className="btn btn-primary" onClick={onStartSolo}>
            ▶ Iniciar Jogo Solo
          </button>
        </div>
      ) : (
        <div>
          <div className="info-box">
            <h3>🌐 Duelo online:</h3>
            <p>
              Helio e Thamy jogam em <strong>dispositivos diferentes</strong>, no mesmo tabuleiro sincronizado.
              <br />
              ✅ Certo: <strong>+10 pts</strong> &nbsp;❌ Errado: <strong>-5 pts</strong>
              <br />
              Quem inicia cria o puzzle — o outro entra na mesma partida ao clicar em Iniciar.
            </p>
          </div>
          <DifficultyPicker diff={diff} onSetDiff={onSetDiff} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartCollab}
            disabled={joiningCollab}
          >
            {joiningCollab ? 'Conectando...' : '⚔️ Iniciar / Entrar no Duelo'}
          </button>
        </div>
      )}
    </div>
  );
}
