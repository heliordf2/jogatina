import PlayerPresence from './PlayerPresence.jsx';

export default function MainPicker({ onSelectGame, onlinePlayer, onIdentify }) {
  return (
    <div className="screen active">
      <div className="header">
        <div className="logo">
          Joga<span>tina</span> 🎮
        </div>
      </div>

      <p className="picker-subtitle">Escolha um jogo para começar</p>

      <div className="game-picker">
        <button type="button" className="game-card" onClick={() => onSelectGame('sudoku')}>
          <div className="game-card-icon">🔢</div>
          <div className="game-card-title">Sudoku</div>
          <div className="game-card-desc">
            Solo ou duelo colaborativo com ranking e dificuldades.
          </div>
        </button>

        <button type="button" className="game-card" onClick={() => onSelectGame('chess')}>
          <div className="game-card-icon">♟️</div>
          <div className="game-card-title">Xadrez</div>
          <div className="game-card-desc">
            Helio vs Thamy no mesmo dispositivo, com chat durante a partida.
          </div>
        </button>
      </div>

      <PlayerPresence onlinePlayer={onlinePlayer} />

      <button type="button" className="btn" style={{ width: '100%', marginTop: '.75rem' }} onClick={onIdentify}>
        👤 Identificar-se
      </button>
    </div>
  );
}
