import IMGS from '../assets/imgs.js';

export default function WinScreen({ result, onShowRanking, onGoHome }) {
  if (!result) return null;

  return (
    <div className="screen active">
      <div className="win-wrap">
        <div className="win-emoji">{result.emoji}</div>
        <div className="win-title">{result.title}</div>
        <div className="win-sub">{result.sub}</div>
        <div className="win-stats">
          <div className="stat-box">
            <div className="stat-lbl">Tempo</div>
            <div className="stat-val">{result.time}</div>
          </div>
          <div className="stat-box">
            <div className="stat-lbl">Pontos</div>
            <div className="stat-val">{result.pts}</div>
          </div>
          <div className="stat-box">
            <div className="stat-lbl">Erros</div>
            <div className="stat-val">{result.errors}</div>
          </div>
        </div>

        {result.collabDetail && (
          <div
            style={{
              background: 'var(--surface1)',
              borderRadius: 12,
              padding: '1rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 6px' }}>
                  <img src={IMGS.helio} alt="Helio" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ fontSize: 13, color: '#534AB7', fontWeight: 700 }}>Helio</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#534AB7' }}>
                  {result.collabDetail.helio.pts} pts
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {result.collabDetail.helio.cells} células
                </div>
              </div>
              <div style={{ fontSize: 26, color: 'var(--text3)' }}>vs</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 6px' }}>
                  <img src={IMGS.thamy} alt="Thamy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ fontSize: 13, color: '#993556', fontWeight: 700 }}>Thamy</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#993556' }}>
                  {result.collabDetail.thamy.pts} pts
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {result.collabDetail.thamy.cells} células
                </div>
              </div>
            </div>
          </div>
        )}

        <button type="button" className="btn btn-primary" style={{ marginBottom: 10 }} onClick={onShowRanking}>
          🏆 Ver Ranking
        </button>
        <button
          type="button"
          className="btn"
          style={{ width: '100%', justifyContent: 'center', padding: 12 }}
          onClick={onGoHome}
        >
          🎮 Jogar Novamente
        </button>
      </div>
    </div>
  );
}
