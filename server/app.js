import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import {
  applyChessMove,
  getActiveChessGame,
  getOrCreateChessGame,
  resignChessGame,
} from './chessRepository.js';
import { addChatMessage, clearChatMessages, listChatMessages } from './chatRepository.js';
import { getPresence, touchPresence } from './presenceRepository.js';
import { listGameSessions, recordGameStart } from './sessionsRepository.js';
import { getGameStats, getSudokuScores, saveGameStats, saveSudokuScores } from './statsRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbReady = false;

async function ensureDb() {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }
}

export function createApp({ serveStatic = false } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(async (_req, _res, next) => {
    try {
      await ensureDb();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/health', async (_req, res) => {
    res.json({
      ok: true,
      features: ['chat', 'presence', 'chess-online'],
    });
  });

  app.get('/api/stats', async (_req, res) => {
    try {
      res.json(await getGameStats());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/stats', async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Corpo inválido' });
        return;
      }
      await saveGameStats(req.body);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/sudoku/scores', async (_req, res) => {
    try {
      res.json(await getSudokuScores());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/sudoku/scores', async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Corpo inválido' });
        return;
      }
      await saveSudokuScores(req.body);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sessions', async (req, res) => {
    try {
      const { player, game, mode } = req.body ?? {};
      if (!player || !game) {
        res.status(400).json({ error: 'player e game são obrigatórios' });
        return;
      }
      const session = await recordGameStart({ player, game, mode: mode ?? null });
      res.status(201).json(session);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/sessions', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(await listGameSessions(limit));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/chess/game', async (_req, res) => {
    try {
      const game = await getActiveChessGame();
      if (!game) {
        res.status(404).json({ error: 'Nenhuma partida ativa' });
        return;
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chess/game', async (req, res) => {
    try {
      const { player, forceNew = false } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      res.status(201).json(await getOrCreateChessGame({ player, forceNew: Boolean(forceNew) }));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/chess/game/move', async (req, res) => {
    try {
      const { player, from, to, promotion } = req.body ?? {};
      if (!player || !from || !to) {
        res.status(400).json({ error: 'player, from e to são obrigatórios' });
        return;
      }
      res.json(await applyChessMove({ player, from, to, promotion }));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/chess/game/resign', async (req, res) => {
    try {
      const { player } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      res.json(await resignChessGame({ player }));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/presence', async (_req, res) => {
    try {
      res.json(await getPresence());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/presence', async (req, res) => {
    try {
      const { player } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      await touchPresence(player);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/chat', async (_req, res) => {
    try {
      res.json(await listChatMessages());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { sender, player, text } = req.body ?? {};
      if (!sender || !text) {
        res.status(400).json({ error: 'sender e text são obrigatórios' });
        return;
      }
      res.status(201).json(await addChatMessage({ sender, player, text }));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/chat', async (_req, res) => {
    try {
      await clearChatMessages();
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  if (serveStatic) {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message || 'Erro interno' });
  });

  return app;
}

export const app = createApp();
