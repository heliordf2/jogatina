import { pool } from './db.js';

const VALID_PLAYERS = new Set(['helio', 'thamy']);
const MAX_MESSAGES = 200;

function formatChatRow(row) {
  const date = new Date(row.created_at);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return {
    id: row.id,
    sender: row.sender,
    player: row.player_id,
    text: row.text,
    time: `${hours}:${minutes < 10 ? '0' : ''}${minutes}`,
  };
}

export async function listChatMessages(limit = MAX_MESSAGES) {
  const result = await pool.query(
    `
      SELECT id, sender, player_id, text, created_at
      FROM chat_messages
      ORDER BY id ASC
      LIMIT $1
    `,
    [Math.min(limit, MAX_MESSAGES)],
  );

  return result.rows.map(formatChatRow);
}

export async function addChatMessage({ sender, player = null, text }) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error('Mensagem vazia');
  }
  if (!['system', 'player'].includes(sender)) {
    throw new Error('Remetente inválido');
  }
  if (sender === 'player' && !VALID_PLAYERS.has(player)) {
    throw new Error('Jogador inválido');
  }

  const result = await pool.query(
    `
      INSERT INTO chat_messages (sender, player_id, text)
      VALUES ($1, $2, $3)
      RETURNING id, sender, player_id, text, created_at
    `,
    [sender, sender === 'player' ? player : null, trimmed],
  );

  await pool.query(`
    DELETE FROM chat_messages
    WHERE id NOT IN (
      SELECT id FROM chat_messages ORDER BY id DESC LIMIT ${MAX_MESSAGES}
    )
  `);

  return formatChatRow(result.rows[0]);
}

export async function clearChatMessages() {
  await pool.query('DELETE FROM chat_messages');
}
