import { pool } from './db.js';

const VALID_PLAYERS = new Set(['helio', 'thamy']);
const ONLINE_WINDOW_MS = 20_000;

export async function touchPresence(player) {
  if (!VALID_PLAYERS.has(player)) {
    throw new Error('Jogador inválido');
  }

  await pool.query(
    `
      INSERT INTO player_presence (player_id, last_seen)
      VALUES ($1, NOW())
      ON CONFLICT (player_id)
      DO UPDATE SET last_seen = NOW()
    `,
    [player],
  );
}

export async function getPresence() {
  const result = await pool.query(`
    SELECT player_id, last_seen
    FROM player_presence
  `);

  const presence = {
    helio: { online: false, lastSeen: null },
    thamy: { online: false, lastSeen: null },
  };

  const now = Date.now();
  for (const row of result.rows) {
    const lastSeen = row.last_seen?.toISOString?.() ?? null;
    const online = row.last_seen && now - new Date(row.last_seen).getTime() < ONLINE_WINDOW_MS;
    presence[row.player_id] = { online: Boolean(online), lastSeen };
  }

  return presence;
}
