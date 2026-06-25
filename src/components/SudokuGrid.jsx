import { getBoxNums, isCellLocked } from '../utils/sudoku.js';

export default function SudokuGrid({ game, onSelectCell }) {
  const { board, solution, given, selected, isCollab, collabCells, drafts } = game;

  return (
    <div className="sudoku-grid">
      {board.map((row, r) =>
        row.map((v, c) => {
          const classes = ['cell'];
          if (c % 3 === 2 && c !== 8) classes.push('border-r');
          if (r % 3 === 2 && r !== 8) classes.push('border-b');
          if (given[r][c]) classes.push('given');
          else if (isCellLocked(game, r, c)) classes.push('locked');
          if (selected && selected[0] === r && selected[1] === c) classes.push('selected');
          else if (selected && (selected[0] === r || selected[1] === c)) {
            classes.push('highlight');
          }

          let content = null;
          if (given[r][c]) {
            content = v;
          } else if (v) {
            content = v;
            if (isCollab) {
              if (collabCells.helio.some(([cr, cc]) => cr === r && cc === c)) {
                classes.push('collab-h');
              } else if (collabCells.thamy.some(([cr, cc]) => cr === r && cc === c)) {
                classes.push('collab-t');
              } else {
                classes.push(v === solution[r][c] ? 'correct' : 'error');
              }
            } else {
              classes.push(v === solution[r][c] ? 'correct' : 'error');
            }
          } else {
            const draft = drafts[r][c];
            if (draft && draft.size > 0) {
              content = (
                <div className="cell-draft">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span key={n} className={draft.has(n) ? 'on' : ''}>
                      {draft.has(n) ? n : ''}
                    </span>
                  ))}
                </div>
              );
            }
          }

          return (
            <div
              key={`${r}-${c}`}
              className={classes.join(' ')}
              onClick={() => onSelectCell(r, c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectCell(r, c);
              }}
            >
              {content}
            </div>
          );
        }),
      )}
    </div>
  );
}

export function getDisabledNums(game) {
  if (!game.selected) return new Set();
  const [r, c] = game.selected;
  return getBoxNums(game.board, r, c);
}
