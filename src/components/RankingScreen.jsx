import { useState } from 'react';
import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS } from '../data/constants.js';
import { aggregateSudokuHistory, sortPlayerRows } from '../utils/sudokuRanking.js';
import SudokuHistoryList from './SudokuHistoryList.jsx';
import SudokuRankingControls from './SudokuRankingControls.jsx';

function buildPlayerRows(scores, tab, sortBy) {
  const typeFilter = tab === 'collab' ? 'collab' : null;

  const rows = [
    { name: 'Helio', player: 'helio', color: PLAYER_COLORS.helio, data: scores.helio },
    { name: 'Thamy', player: 'thamy', color: PLAYER_COLORS.thamy, data: scores.thamy },
  ].map((p) => ({
    ...p,
    stats: aggregateSudokuHistory(p.data.history, { type: typeFilter, sortBy }),
  }));

  return sortPlayerRows(rows, sortBy);
}

export default function RankingScreen({ scores, onGoHome }) {
  const [tab, setTab] = useState('all');
  const [sortBy, setSortBy] = useState('pts');
  const players = buildPlayerRows(scores, tab, sortBy);
  const medals = ['🥇', '🥈'];
  const isCollab = tab === 'collab';

  return (
    <div className="screen active">
      <div className="header">
        <button type="button" className="btn" onClick={onGoHome}>
          ← Voltar
        </button>
        <div className="logo">🏆 Ranking Sudoku</div>
        <div />
      </div>

      <SudokuRankingControls
        tab={tab}
        sortBy={sortBy}
        onTabChange={setTab}
        onSortChange={setSortBy}
      />

      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
        {isCollab
          ? 'Pontos e erros apenas dos duelos colaborativos online.'
          : 'Pontos acumulados de todas as partidas (solo + duelo).'}
        {sortBy === 'date'
          ? ' Ordenação pela partida mais recente.'
          : ' Ordenação pelo total de pontos.'}
      </p>

      {players.map((p, i) => {
        const { stats } = p;
        const best = stats.best ?? 0;

        return (
          <div key={p.player} className="rank-card">
            <div className="rank-row">
              <div className="rank-num">{stats.games > 0 ? medals[i] : '—'}</div>
              <div className="rank-av">
                <img src={IMGS[p.player]} alt={p.name} />
              </div>
              <div className="rank-info">
                <div className="rank-name">{p.name}</div>
                <div className="rank-detail">
                  {stats.games} jogo{stats.games !== 1 ? 's' : ''} · Melhor: {best} pts · Média:{' '}
                  {stats.avg} pts
                  {stats.games > 0 && (
                    <>
                      {' '}
                      · ❌ {stats.errorsTotal} erro{stats.errorsTotal !== 1 ? 's' : ''} total
                      {stats.games > 1 ? ` (${stats.avgErrors}/jogo)` : ''}
                    </>
                  )}
                </div>
              </div>
              <div className="rank-pts" style={{ color: p.color }}>
                {stats.total}
              </div>
            </div>

            <div style={{ paddingTop: 8 }}>
              <SudokuHistoryList
                history={stats.history}
                color={p.color}
                sortBy={sortBy}
                emptyLabel={
                  isCollab ? 'Nenhum duelo colaborativo registrado' : 'Nenhuma partida registrada'
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
