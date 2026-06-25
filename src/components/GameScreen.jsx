import IMGS from '../assets/imgs.js';
import { DIFF_NAMES, formatDiffStats, PLAYER_NAMES } from '../data/constants.js';
import { isPlayerOnlineRemote } from '../hooks/useRemotePresence.js';
import CurrentPlayerBar from './CurrentPlayerBar.jsx';
import OtherPlayerBar from './OtherPlayerBar.jsx';
import Numpad from './Numpad.jsx';
import SudokuGrid, { getDisabledNums } from './SudokuGrid.jsx';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDiffLabel(difficulty) {
  return DIFF_NAMES[difficulty]?.replace('💀 ', '') ?? difficulty;
}

function getCollabOpponent(player) {
  return player === 'helio' ? 'thamy' : 'helio';
}

export default function GameScreen({
  game,
  diff,
  player,
  onlinePlayer,
  remotePresence,
  progress,
  onGoHome,
  onSelectCell,
  onEnterNum,
  onToggleDraft,
  onTogglePause,
  onUseHint,
  onNewGame,
  onToggleTurnLock,
  onAcceptRematch,
  onDeclineRematch,
  rematchBusy = false,
}) {
  const disabledNums = getDisabledNums(game);
  const turn = game.collabTurn;
  const isMyTurn = turn === onlinePlayer;
  const boardLocked =
    game.isCollab &&
    !isMyTurn &&
    game.turnLocked;

  const rematchRequestedBy = game.rematchRequestedBy ?? null;
  const rematchOpponent = onlinePlayer ? getCollabOpponent(onlinePlayer) : null;
  const waitingRematchApproval = rematchRequestedBy === onlinePlayer;
  const incomingRematchRequest =
    rematchRequestedBy && rematchRequestedBy !== onlinePlayer && rematchOpponent === rematchRequestedBy;
  const newGameLabel = waitingRematchApproval ? '⏳ Aguardando...' : '🔄 Novo';
  const rematchDisabled = rematchBusy || waitingRematchApproval;

  const gameTitle = game.isCollab
    ? `⚔️ Duelo — ${formatDiffLabel(diff)} · ${formatDiffStats(diff)}`
    : `${PLAYER_NAMES[player]} — ${formatDiffLabel(diff)} · ${formatDiffStats(diff)}`;

  return (
    <div className="screen active">
      <CurrentPlayerBar player={onlinePlayer} remotePresence={remotePresence} />

      <div className="game-header">
        <button type="button" className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onGoHome}>
          ← Sair
        </button>
        <div className="game-title">{gameTitle}</div>
        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-lbl">⏱</div>
            <div className="stat-val">{game.paused ? '⏸' : formatTime(game.timer)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-lbl">✅</div>
            <div className="stat-val cv">{game.corrects}</div>
          </div>
          <div className="stat-box">
            <div className="stat-lbl">❌</div>
            <div className="stat-val ev">{game.errors}</div>
          </div>
          {game.isCollab && isMyTurn && (
            <button
              type="button"
              className={`stat-lock-btn ${game.turnLocked ? 'locked' : 'unlocked'}`}
              onClick={onToggleTurnLock}
              title={game.turnLocked ? 'Vez travada — só você joga' : 'Modo livre — ambos podem jogar'}
            >
              {game.turnLocked ? '🔒 Travado' : '🔓 Livre'}
            </button>
          )}
        </div>
      </div>

      {game.isCollab && incomingRematchRequest && (
        <div className="collab-rematch-banner">
          <p>
            <strong>{PLAYER_NAMES[rematchRequestedBy]}</strong> quer iniciar um novo duelo.
          </p>
          <div className="collab-rematch-actions">
            <button type="button" className="btn btn-primary" onClick={onAcceptRematch} disabled={rematchBusy}>
              ✅ Aceitar
            </button>
            <button type="button" className="btn" onClick={onDeclineRematch} disabled={rematchBusy}>
              Recusar
            </button>
          </div>
        </div>
      )}

      {game.isCollab && waitingRematchApproval && (
        <div className="collab-rematch-banner collab-rematch-waiting">
          <p>Aguardando {PLAYER_NAMES[rematchOpponent]} aceitar o novo duelo...</p>
        </div>
      )}

      {game.isCollab && (
        <div className="collab-scores">
          {['helio', 'thamy'].map((p) => (
            <div key={p} className={`csb csb-${p === 'helio' ? 'h' : 't'}`}>
              <div className="csb-av">
                <img src={IMGS[p]} alt={PLAYER_NAMES[p]} />
                <span className={`online-dot avatar-dot sm${isPlayerOnlineRemote(remotePresence, p) ? ' on' : ''}`} />
              </div>
              <div className="csb-info">
                <div className="csb-name" style={{ color: p === 'helio' ? '#534AB7' : '#993556' }}>
                  {PLAYER_NAMES[p]}
                </div>
                <div className="csb-pts" style={{ color: p === 'helio' ? '#534AB7' : '#993556' }}>
                  {game.collabScores[p]}
                </div>
                <div className="csb-cells" style={{ color: p === 'helio' ? '#534AB7' : '#993556' }}>
                  {game.collabCells[p].length} células
                </div>
              </div>
              <div
                className="csb-turn-dot"
                style={{ background: turn === p ? (p === 'helio' ? '#534AB7' : '#993556') : 'transparent' }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="board-wrap">
        <SudokuGrid game={game} onSelectCell={onSelectCell} />
        <div className={`board-paused-msg${game.paused ? ' show' : ''}`}>
          <div className="board-paused-inner">
            <div className="board-paused-icon">⏸</div>
            <div>Pausado</div>
            <button type="button" className="btn btn-primary" onClick={onTogglePause}>
              ▶ Continuar
            </button>
          </div>
        </div>
        <div className={`board-locked-msg${boardLocked ? ' show' : ''}`}>
          <div className="board-locked-inner">
            🔒 <strong>{PLAYER_NAMES[turn]}</strong> travou a vez — aguarde!
          </div>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
      </div>
      <div className="progress-info">
        <span><strong>{progress.pct}%</strong></span>
        <span><strong>{progress.filled}</strong> preenchidas</span>
        <span><strong>{progress.empty}</strong> vazias</span>
        <span><strong>{progress.given}</strong> fixas</span>
        <span><strong>{progress.total}</strong> a resolver</span>
      </div>

      <Numpad disabledNums={disabledNums} onEnterNum={onEnterNum} disabled={game.paused} />

      <div className="actions">
        <button
          type="button"
          className={`btn${game.paused ? ' btn-primary' : ''}`}
          onClick={onTogglePause}
        >
          {game.paused ? '▶ Continuar' : '⏸ Pausar'}
        </button>
        <button
          type="button"
          className={`btn btn-draft${game.draftMode ? ' on' : ''}`}
          onClick={onToggleDraft}
          disabled={game.paused}
        >
          {game.draftMode ? '✏️ Rascunho ON' : '✏️ Rascunho'}
        </button>
        <button type="button" className="btn" onClick={onUseHint} disabled={game.paused}>
          💡 Dica ({game.hints})
        </button>
        {game.isCollab ? (
          <button type="button" className="btn btn-danger" onClick={onNewGame} disabled={rematchDisabled}>
            {newGameLabel}
          </button>
        ) : (
          <button type="button" className="btn btn-danger" onClick={onNewGame}>
            🔄 Novo
          </button>
        )}
      </div>

      <OtherPlayerBar onlinePlayer={onlinePlayer} remotePresence={remotePresence} />
    </div>
  );
}
