/** Agrega estatísticas a partir do histórico de partidas. */
export function parseGameDate(dateStr) {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return 0;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

export function sortSudokuHistory(history, sortBy = 'date') {
  const list = [...(history ?? [])];
  if (sortBy === 'pts') {
    return list.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
  }
  return list.sort((a, b) => parseGameDate(b.date) - parseGameDate(a.date));
}

export function getLatestGameTimestamp(history) {
  if (!history?.length) return 0;
  return Math.max(...history.map((h) => parseGameDate(h.date)));
}

export function aggregateSudokuHistory(history, { type = null, sortBy = 'date' } = {}) {
  const filtered = (history ?? []).filter((h) => (type ? h.type === type : true));
  const sorted = sortSudokuHistory(filtered, sortBy);
  const games = sorted.length;
  const total = sorted.reduce((sum, h) => sum + (h.pts ?? 0), 0);
  const best = games ? Math.max(...sorted.map((h) => h.pts ?? 0)) : null;
  const errorsTotal = sorted.reduce((sum, h) => sum + (h.errors ?? 0), 0);
  const avg = games ? Math.round(total / games) : 0;
  const avgErrors = games ? Math.round((errorsTotal / games) * 10) / 10 : 0;

  return {
    total,
    games,
    best,
    history: sorted,
    errorsTotal,
    avg,
    avgErrors,
    latestAt: getLatestGameTimestamp(sorted),
  };
}

export function sortPlayerRows(rows, sortBy = 'pts') {
  const copy = [...rows];
  if (sortBy === 'date') {
    return copy.sort((a, b) => (b.stats.latestAt ?? 0) - (a.stats.latestAt ?? 0));
  }
  return copy.sort((a, b) => b.stats.total - a.stats.total);
}
