import { getBoxNums, isCellLocked } from '../utils/sudoku.js';

function CollabDraftMarks({ helioDraft, thamyDraft }) {
  return (
    <div className="cell-draft">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
        const h = helioDraft.has(n);
        const t = thamyDraft.has(n);
        if (!h && !t) return <span key={n} />;
        const classes = ['on'];
        if (h) classes.push('draft-h');
        if (t) classes.push('draft-t');
        return (
          <span key={n} className={classes.join(' ')}>
            {n}
          </span>
        );
      })}
    </div>
  );
}

export default function SudokuGrid({ game, onSelectCell }) {
  const { board, solution, given, selected, isCollab, collabDrafts, drafts, paused } = game;

  return (
    <div className={`sudoku-grid${paused ? ' paused' : ''}`}>
      {board.map((row, r) =>
        row.map((v, c) => {
          const classes = ['cell'];
          if (c % 3 === 2 && c !== 8) classes.push('border-r');
          if (r % 3 === 2 && r !== 8) classes.push('border-b');
          if (!paused) {
            if (given[r][c]) classes.push('given');
            else if (isCellLocked(game, r, c)) classes.push('locked');
          }
          if (!paused && selected && selected[0] === r && selected[1] === c) classes.push('selected');
          else if (!paused && selected && (selected[0] === r || selected[1] === c)) {
            classes.push('highlight');
          }

          let content = null;
          if (!paused) {
            if (given[r][c]) {
              content = v;
            } else if (v) {
              content = v;
              classes.push(v === solution[r][c] ? 'correct' : 'error');
            } else if (isCollab && collabDrafts) {
              const helioDraft = collabDrafts.helio[r][c];
              const thamyDraft = collabDrafts.thamy[r][c];
              if (helioDraft.size > 0 || thamyDraft.size > 0) {
                content = (
                  <CollabDraftMarks helioDraft={helioDraft} thamyDraft={thamyDraft} />
                );
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
          }

          return (
            <div
              key={`${r}-${c}`}
              className={classes.join(' ')}
              onClick={() => !paused && onSelectCell(r, c)}
              role="button"
              tabIndex={paused ? -1 : 0}
              onKeyDown={(e) => {
                if (!paused && (e.key === 'Enter' || e.key === ' ')) onSelectCell(r, c);
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
  if (game.paused || !game.selected) return new Set();
  const [r, c] = game.selected;
  return getBoxNums(game.board, r, c);
}
