import {
  DIFF_EMOJI,
  DIFF_NAMES,
  getDiffStats,
  SUDOKU_DIFFICULTY_IDS,
} from '../data/constants.js';

export default function DifficultyPicker({ diff, onSetDiff }) {
  const selected = getDiffStats(diff);

  return (
    <div className="difficulty-picker">
      <div className="diff-label">Dificuldade:</div>
      <div className="diff-select">
        {SUDOKU_DIFFICULTY_IDS.map((id) => {
          const stats = getDiffStats(id);
          const isActive = diff === id;
          const isExtreme = id === 'extreme';
          return (
            <button
              key={id}
              type="button"
              className={`diff-btn${isExtreme ? ' extreme' : ''}${isActive ? ' active' : ''}`}
              onClick={() => onSetDiff(id)}
            >
              <span className="diff-name">
                {DIFF_EMOJI[id]} {DIFF_NAMES[id].replace('💀 ', '')}
              </span>
              <span className="diff-meta">{stats.empty} vazios</span>
              <span className="diff-meta">{stats.given} fixas</span>
            </button>
          );
        })}
      </div>
      <div className="diff-preview">
        Selecionado: <strong>{DIFF_NAMES[diff]?.replace('💀 ', '')}</strong>
        {' — '}
        {selected.empty} vazios · {selected.given} fixas
      </div>
    </div>
  );
}
