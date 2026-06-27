import { DIFF_NAMES } from '../data/constants.js';

export default function SudokuHistoryList({ history, color, limit = 5, emptyLabel = 'Nenhuma partida registrada' }) {
  if (!history?.length) {
    return (
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{emptyLabel}</p>
    );
  }

  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>
        Últimas partidas:
      </p>
      {history.slice(0, limit).map((h, idx) => {
        const bc = `badge-${h.type === 'collab' ? 'collab' : h.diff}`;
        const err = h.errors ?? 0;
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
                ⏱ {h.time} · ❌ {err} erro{err !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>
              +{h.pts} pts
            </div>
          </div>
        );
      })}
    </>
  );
}
