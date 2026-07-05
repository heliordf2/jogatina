import dotenv from 'dotenv';
import pg from 'pg';
import { calcSoloScore } from '../shared/sudokuScoring.js';
import { DIFF_REMOVES } from '../shared/sudokuDifficulty.js';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

function parseJson(v) {
  return typeof v === 'string' ? JSON.parse(v) : v;
}

async function main() {
  const games = (
    await pool.query(`
      SELECT id, player_id, pts, time_str, difficulty, game_type, played_date, errors, created_at
      FROM sudoku_games ORDER BY created_at ASC, id ASC
    `)
  ).rows;

  const stats = (
    await pool.query(`SELECT player_id, total, games, best FROM sudoku_player_stats ORDER BY player_id`)
  ).rows;

  const wonCollabs = (
    await pool.query(`
      SELECT id, difficulty, collab_scores, collab_cells, errors, corrects, updated_at
      FROM sudoku_collab_games
      WHERE status = 'won' AND stats_recorded = TRUE
      ORDER BY updated_at ASC
    `)
  ).rows;

  const perGame = games.map((g) => {
    const cells = DIFF_REMOVES[g.difficulty] ?? null;
    const expected =
      g.game_type === 'solo' ? calcSoloScore(g.errors, g.difficulty) : null;
    return {
      id: g.id,
      player: g.player_id,
      type: g.game_type,
      diff: g.difficulty,
      vazios: cells,
      errors: g.errors,
      stored_pts: g.pts,
      correct_pts: expected,
      diff_pts: expected == null ? null : g.pts - expected,
      status: expected == null ? 'n/a' : expected === g.pts ? 'ok' : 'ERRADO',
      date: g.played_date,
      time: g.time_str,
    };
  });

  const missingCollab = [];
  for (const c of wonCollabs) {
    const scores = parseJson(c.collab_scores);
    const cells = parseJson(c.collab_cells);
    const date = new Date(c.updated_at).toLocaleDateString('pt-BR');
    for (const player of ['helio', 'thamy']) {
      const correct = scores[player] ?? 0;
      const inHistory = games.some(
        (g) =>
          g.game_type === 'collab' &&
          g.player_id === player &&
          g.difficulty === c.difficulty &&
          g.pts === correct,
      );
      if (!inHistory) {
        missingCollab.push({
          ref: `collab#${c.id}`,
          player,
          type: 'collab',
          diff: c.difficulty,
          vazios: DIFF_REMOVES[c.difficulty],
          errors: c.errors,
          cells_jogador: cells?.[player]?.length ?? 0,
          stored_pts: 0,
          correct_pts: correct,
          diff_pts: -correct,
          status: 'AUSENTE (duelo ganho não está no histórico)',
          date,
        });
      }
    }
  }

  const sumStored = {};
  for (const g of games) sumStored[g.player_id] = (sumStored[g.player_id] ?? 0) + g.pts;

  const sumCorrect = { ...sumStored };
  for (const m of missingCollab) {
    sumCorrect[m.player] = (sumCorrect[m.player] ?? 0) + m.correct_pts;
  }

  const totals = stats.map((s) => ({
    player: s.player_id,
    stored_total: s.total,
    correct_total_min: sumCorrect[s.player_id] ?? 0,
    diff_total: s.total - (sumCorrect[s.player_id] ?? 0),
    stored_games: s.games,
    correct_games_min: games.filter((g) => g.player_id === s.player_id).length + missingCollab.filter((m) => m.player === s.player_id).length,
    stored_best: s.best,
    correct_best:
      Math.max(
        0,
        ...games
          .filter((g) => g.player_id === s.player_id && g.game_type === 'solo')
          .map((g) => g.pts),
      ) || null,
  }));

  const sessions = (
    await pool.query(`
      SELECT player_id, mode, COUNT(*)::int AS sessions
      FROM game_sessions WHERE game = 'sudoku'
      GROUP BY player_id, mode ORDER BY player_id, mode
    `)
  ).rows;

  console.log(
    JSON.stringify(
      {
        perGameRegistered: perGame,
        missingCollabGames: missingCollab,
        totals,
        sessions,
        note:
          'Partidas solo antigas sem registro em sudoku_games não são recalculáveis (faltam erros/dificuldade por partida).',
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch(console.error);
