import { useEffect, useState } from 'react';
import IMGS from '../assets/imgs.js';
import { DIFF_NAMES, PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import defaultStats from '../data/gameStats.json';
import { loadGameStats } from '../utils/gameStats.js';

function SudokuHistory({ history, color }) {
  if (!history?.length) {
    return <div className="stats-history-empty">Nenhuma partida registrada</div>;
  }

  return (
    <div className="stats-history">
      {history.slice(0, 5).map((h, idx) => {
        const bc = `badge-${h.type === 'collab' ? 'collab' : h.diff}`;
        return (
          <div key={idx} className="stats-history-item">
            <div>
              <div className="stats-history-meta">
                {h.date}{' '}
                <span className={`badge ${bc}`}>
                  {h.type === 'collab' ? 'Duelo' : DIFF_NAMES[h.diff]}
                </span>
              </div>
              <div className="stats-history-time">⏱ {h.time}</div>
            </div>
            <div className="stats-history-pts" style={{ color }}>
              +{h.pts} pts
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SudokuBlock({ player, data }) {
  const best = data.best != null ? `${data.best} pts` : '—';

  return (
    <div className="stats-player-block">
      <div className="stats-player-row">
        <div className="stats-player-av">
          <img src={IMGS[player]} alt={PLAYER_NAMES[player]} />
        </div>
        <div className="stats-player-info">
          <div className="stats-player-name" style={{ color: PLAYER_COLORS[player] }}>
            {PLAYER_NAMES[player]}
          </div>
          <div className="stats-player-detail">
            {data.total} pts · {data.games} jogo{data.games !== 1 ? 's' : ''} · Melhor: {best}
          </div>
        </div>
      </div>
      <SudokuHistory history={data.history} color={PLAYER_COLORS[player]} />
    </div>
  );
}

function ChessLine({ player, data }) {
  return (
    <div className="stats-player-row">
      <div className="stats-player-av">
        <img src={IMGS[player]} alt={PLAYER_NAMES[player]} />
      </div>
      <div className="stats-player-info">
        <div className="stats-player-name" style={{ color: PLAYER_COLORS[player] }}>
          {PLAYER_NAMES[player]}
        </div>
        <div className="stats-player-detail">
          {data.wins}V · {data.losses}D · {data.draws}E · {data.games} partida
          {data.games !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

export default function GameStatsPanel() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    loadGameStats()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setStats(structuredClone(defaultStats));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!stats) {
    return (
      <div className="stats-panel">
        <div className="stats-header">📊 Estatísticas por jogo</div>
        <div className="stats-loading">Carregando estatísticas...</div>
      </div>
    );
  }

  return (
    <div className="stats-panel">
      <div className="stats-header">📊 Estatísticas por jogo</div>
      {error && <div className="stats-error">⚠️ {error} (exibindo cache local)</div>}

      <div className="stats-game-block">
        <div className="stats-game-title">🔢 Sudoku</div>
        <SudokuBlock player="helio" data={stats.sudoku.helio} />
        <SudokuBlock player="thamy" data={stats.sudoku.thamy} />
      </div>

      <div className="stats-game-block">
        <div className="stats-game-title">♟️ Xadrez</div>
        <ChessLine player="helio" data={stats.chess.helio} />
        <ChessLine player="thamy" data={stats.chess.thamy} />
      </div>
    </div>
  );
}
