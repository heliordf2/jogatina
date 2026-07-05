import dotenv from 'dotenv';
import pg from 'pg';
import { calcSoloScore } from '../shared/sudokuScoring.js';
import { DIFF_REMOVES } from '../shared/sudokuDifficulty.js';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

function fmt(n) {
  return n == null ? '—' : String(n);
}

async function main() {
  const gamesRes = await pool.query(`
    SELECT id, player_id, pts, time_str, difficulty, game_type, played_date, errors, created_at
    FROM sudoku_games
    ORDER BY created_at ASC, id ASC
  `);

  const statsRes = await pool.query(`
    SELECT player_id, total, games, best
    FROM sudoku_player_stats
    ORDER BY player_id
  `);

  const collabRes = await pool.query(`
    SELECT id, difficulty, collab_scores, collab_cells, errors, corrects, status, stats_recorded, updated_at
    FROM sudoku_collab_games
    ORDER BY updated_at ASC
  `);

  const rows = [];
  const mismatches = [];

  for (const g of gamesRes.rows) {
    let expected = null;
    let method = '';

    if (g.game_type === 'solo') {
      expected = calcSoloScore(g.errors, g.difficulty);
      method = `solo: max(0, round((1000 - ${g.errors}×80) × mult(${g.difficulty})))`;
    } else if (g.game_type === 'collab') {
      // Tenta achar duelo correspondente (mesma dificuldade, scores batem com algum registro)
      const wonCollabs = collabRes.rows.filter(
        (c) => c.status === 'won' && c.stats_recorded && c.difficulty === g.difficulty,
      );
      const fromCollab = wonCollabs.find((c) => {
        const scores = typeof c.collab_scores === 'string' ? JSON.parse(c.collab_scores) : c.collab_scores;
        return scores?.[g.player_id] === g.pts;
      });
      if (fromCollab) {
        const scores =
          typeof fromCollab.collab_scores === 'string'
            ? JSON.parse(fromCollab.collab_scores)
            : fromCollab.collab_scores;
        expected = scores[g.player_id] ?? null;
        method = 'collab: collab_scores do duelo arquivado';
      } else {
        // Estimativa: células do jogador × 10 (sem histórico de erros por jogador)
        const won = wonCollabs[wonCollabs.length - 1];
        if (won) {
          const cells =
            typeof won.collab_cells === 'string' ? JSON.parse(won.collab_cells) : won.collab_cells;
          const cellCount = cells?.[g.player_id]?.length ?? 0;
          expected = cellCount * 10;
          method = `collab: ${cellCount} células × 10 (sem penalidades −5)`;
        } else {
          expected = null;
          method = 'collab: sem duelo arquivado — não recalculável com precisão';
        }
      }
    }

    const ok = expected == null ? null : expected === g.pts;
    const row = {
      id: g.id,
      player: g.player_id,
      type: g.game_type,
      diff: g.difficulty,
      errors: g.errors,
      cellsToFill: DIFF_REMOVES[g.difficulty] ?? '?',
      stored: g.pts,
      expected,
      ok,
      date: g.played_date,
      time: g.time_str,
      method,
    };
    rows.push(row);
    if (ok === false) mismatches.push(row);
  }

  const sumByPlayer = {};
  for (const g of gamesRes.rows) {
    sumByPlayer[g.player_id] = (sumByPlayer[g.player_id] ?? 0) + g.pts;
  }

  const totalsAudit = statsRes.rows.map((s) => {
    const sumGames = sumByPlayer[s.player_id] ?? 0;
    const countGames = gamesRes.rows.filter((g) => g.player_id === s.player_id).length;
    return {
      player: s.player_id,
      storedTotal: s.total,
      correctTotal: sumGames,
      totalOk: s.total === sumGames,
      storedGames: s.games,
      correctGames: countGames,
      gamesOk: s.games === countGames,
      storedBest: s.best,
      correctBest: Math.max(
        0,
        ...gamesRes.rows.filter((g) => g.player_id === s.player_id && g.game_type === 'solo').map((g) => g.pts),
      ) || null,
    };
  });

  console.log(JSON.stringify({ games: rows, mismatches, totalsAudit, collabGames: collabRes.rows }, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
