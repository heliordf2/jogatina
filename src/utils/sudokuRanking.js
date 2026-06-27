/** Agrega estatísticas a partir do histórico de partidas. */
export function aggregateSudokuHistory(history, { type = null } = {}) {
  const filtered = (history ?? []).filter((h) => (type ? h.type === type : true));
  const games = filtered.length;
  const total = filtered.reduce((sum, h) => sum + (h.pts ?? 0), 0);
  const best = games ? Math.max(...filtered.map((h) => h.pts ?? 0)) : null;
  const errorsTotal = filtered.reduce((sum, h) => sum + (h.errors ?? 0), 0);
  const avg = games ? Math.round(total / games) : 0;
  const avgErrors = games ? Math.round((errorsTotal / games) * 10) / 10 : 0;

  return {
    total,
    games,
    best,
    history: filtered,
    errorsTotal,
    avg,
    avgErrors,
  };
}
