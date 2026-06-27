import { useEffect, useState } from 'react';
import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';
import defaultStats from '../data/gameStats.json';
import { loadGameStats } from '../utils/gameStats.js';
import { aggregateSudokuHistory } from '../utils/sudokuRanking.js';
import SudokuHistoryList from './SudokuHistoryList.jsx';

function SudokuBlock({ player, data, typeFilter = null }) {
  const stats = aggregateSudokuHistory(data.history, { type: typeFilter });
  const best = stats.best != null ? `${stats.best} pts` : '—';
  const label = typeFilter === 'collab' ? 'duelos' : 'jogos';

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
            {stats.total} pts · {stats.games} {label} · Melhor: {best}
            {stats.games > 0 && (
              <> · ❌ {stats.errorsTotal} erro{stats.errorsTotal !== 1 ? 's' : ''}</>
            )}
          </div>
        </div>
      </div>
      <SudokuHistoryList
        history={stats.history}
        color={PLAYER_COLORS[player]}
        limit={5}
        emptyLabel="Nenhuma partida registrada"
      />
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
        <div className="stats-game-title">🔢 Sudoku — geral</div>
        <SudokuBlock player="helio" data={stats.sudoku.helio} />
        <SudokuBlock player="thamy" data={stats.sudoku.thamy} />
      </div>

      <div className="stats-game-block">
        <div className="stats-game-title">⚔️ Sudoku — duelo colaborativo</div>
        <SudokuBlock player="helio" data={stats.sudoku.helio} typeFilter="collab" />
        <SudokuBlock player="thamy" data={stats.sudoku.thamy} typeFilter="collab" />
      </div>

      <div className="stats-game-block">
        <div className="stats-game-title">♟️ Xadrez</div>
        <ChessLine player="helio" data={stats.chess.helio} />
        <ChessLine player="thamy" data={stats.chess.thamy} />
      </div>
    </div>
  );
}
