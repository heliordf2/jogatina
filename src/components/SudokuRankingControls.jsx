const TABS = [
  { id: 'all', label: '📊 Geral' },
  { id: 'collab', label: '⚔️ Duelo colaborativo' },
];

const SORT_OPTIONS = [
  { id: 'pts', label: '🏅 Pontos' },
  { id: 'date', label: '📅 Data' },
];

export default function SudokuRankingControls({ tab, sortBy, onTabChange, onSortChange }) {
  return (
    <div className="ranking-controls">
      <div className="tabs ranking-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ranking-sort-row">
        <span className="ranking-sort-heading">Ordenar por</span>
        <div className="tabs ranking-sort-tabs">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`tab${sortBy === opt.id ? ' active' : ''}`}
              onClick={() => onSortChange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
