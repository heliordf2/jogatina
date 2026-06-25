import IMGS from '../assets/imgs.js';
import { DIFF_NAMES, PLAYER_COLORS, PLAYER_NAMES } from '../data/constants.js';

export default function RankingScreen({ scores, onGoHome }) {
  const players = [
    { name: 'Helio', data: scores.helio, color: PLAYER_COLORS.helio, player: 'helio' },
    { name: 'Thamy', data: scores.thamy, color: PLAYER_COLORS.thamy, player: 'thamy' },
  ].sort((a, b) => b.data.total - a.data.total);

  const medals = ['🥇', '🥈'];

  return (
    <div className="screen active">
      <div className="header">
        <button type="button" className="btn" onClick={onGoHome}>
          ← Voltar
        </button>
        <div className="logo">🏆 Ranking</div>
        <div />
      </div>

      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
        Pontos acumulados de todas as partidas.
      </p>

      {players.map((p, i) => {
        const best = p.data.best || 0;
        const avg = p.data.games ? Math.round(p.data.total / p.data.games) : 0;

        return (
          <div key={p.player} className="rank-card">
            <div className="rank-row">
              <div className="rank-num">{medals[i]}</div>
              <div className="rank-av">
                <img src={IMGS[p.player]} alt={p.name} />
              </div>
              <div className="rank-info">
                <div className="rank-name">{p.name}</div>
                <div className="rank-detail">
                  {p.data.games} jogo{p.data.games !== 1 ? 's' : ''} · Melhor: {best} pts · Média:{' '}
                  {avg} pts
                </div>
              </div>
              <div className="rank-pts" style={{ color: p.color }}>
                {p.data.total}
              </div>
            </div>

            {p.data.history?.length > 0 && (
              <div style={{ paddingTop: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>
                  Últimas partidas:
                </p>
                {p.data.history.slice(0, 5).map((h, idx) => {
                  const bc = `badge-${h.type === 'collab' ? 'collab' : h.diff}`;
                  return (
                    <div key={idx} className="hist-item">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {h.date}{' '}
                          <span className={`badge ${bc}`}>
                            {h.type === 'collab' ? 'Duelo' : DIFF_NAMES[h.diff]}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                          ⏱ {h.time}
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: p.color }}>
                        +{h.pts} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
