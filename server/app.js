import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import {
  applyChessMove,
  getActiveChessGame,
  getOrCreateChessGame,
  requestChessRematch,
  respondChessRematch,
  resignChessGame,
} from './chessRepository.js';
import { addChatMessage, clearChatMessages, listChatMessages } from './chatRepository.js';
import { getPresence, touchPresence } from './presenceRepository.js';
import { listGameSessions, recordGameStart } from './sessionsRepository.js';
import { getGameStats, getSudokuScores, saveGameStats, saveSudokuScores } from './statsRepository.js';
import {
  applySudokuCollabCell,
  applySudokuCollabDraft,
  applySudokuCollabHint,
  getActiveSudokuCollabGame,
  getOrCreateSudokuCollabGame,
  requestSudokuCollabRematch,
  respondSudokuCollabRematch,
  toggleSudokuCollabPause,
  toggleSudokuCollabTurnLock,
} from './sudokuCollabRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbReady = false;

async function ensureDb() {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }
}

export function safeApiError(error) {
  const message = error?.message || 'Erro interno';

  if (/DATABASE_URL não configurada/i.test(message)) {
    return 'Banco de dados não configurado no servidor';
  }

  if (
    /127\.0\.0\.1|localhost|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|timeout|connect/i.test(
      message,
    ) ||
    /postgres:\/\//i.test(message) ||
    message.includes('password')
  ) {
    return 'Erro ao acessar o banco de dados';
  }

  return message;
}

function registerApiRoutes(router) {
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    next();
  });

  router.get('/health', async (_req, res) => {
    res.json({
      ok: true,
      features: ['chat', 'presence', 'chess-online', 'sudoku-collab-online'],
    });
  });

  router.get('/stats', async (_req, res) => {
    try {
      res.json(await getGameStats());
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.put('/stats', async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Corpo inválido' });
        return;
      }
      await saveGameStats(req.body);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.get('/sudoku/scores', async (_req, res) => {
    try {
      res.json(await getSudokuScores());
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.put('/sudoku/scores', async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Corpo inválido' });
        return;
      }
      await saveSudokuScores(req.body);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.get('/sudoku/collab/game', async (_req, res) => {
    try {
      const game = await getActiveSudokuCollabGame();
      if (!game) {
        res.status(404).json({ error: 'Nenhum duelo ativo' });
        return;
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game', async (req, res) => {
    try {
      const { player, difficulty, forceNew = false } = req.body ?? {};
      if (!player || !difficulty) {
        res.status(400).json({ error: 'player e difficulty são obrigatórios' });
        return;
      }
      const result = await getOrCreateSudokuCollabGame({
        player,
        difficulty,
        forceNew: Boolean(forceNew),
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game/cell', async (req, res) => {
    try {
      const { player, row, col, value } = req.body ?? {};
      if (!player || row == null || col == null || value == null) {
        res.status(400).json({ error: 'player, row, col e value são obrigatórios' });
        return;
      }
      res.json(
        await applySudokuCollabCell({
          player,
          row: Number(row),
          col: Number(col),
          value: Number(value),
        }),
      );
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game/rematch/request', async (req, res) => {
    try {
      const { player } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      res.json(await requestSudokuCollabRematch({ player }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game/rematch/respond', async (req, res) => {
    try {
      const { player, accept } = req.body ?? {};
      if (!player || accept == null) {
        res.status(400).json({ error: 'player e accept são obrigatórios' });
        return;
      }
      res.json(await respondSudokuCollabRematch({ player, accept: Boolean(accept) }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game/draft', async (req, res) => {
    try {
      const { player, row, col, num } = req.body ?? {};
      if (!player || row == null || col == null || num == null) {
        res.status(400).json({ error: 'player, row, col e num são obrigatórios' });
        return;
      }
      res.json(
        await applySudokuCollabDraft({
          player,
          row: Number(row),
          col: Number(col),
          num: Number(num),
        }),
      );
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game/turn-lock', async (req, res) => {
    try {
      const { player, locked } = req.body ?? {};
      if (!player || locked == null) {
        res.status(400).json({ error: 'player e locked são obrigatórios' });
        return;
      }
      res.json(await toggleSudokuCollabTurnLock({ player, locked: Boolean(locked) }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game/hint', async (req, res) => {
    try {
      const { player } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      res.json(await applySudokuCollabHint({ player }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sudoku/collab/game/pause', async (req, res) => {
    try {
      const { player, paused } = req.body ?? {};
      if (!player || paused == null) {
        res.status(400).json({ error: 'player e paused são obrigatórios' });
        return;
      }
      res.json(await toggleSudokuCollabPause({ player, paused: Boolean(paused) }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/sessions', async (req, res) => {
    try {
      const { player, game, mode } = req.body ?? {};
      if (!player || !game) {
        res.status(400).json({ error: 'player e game são obrigatórios' });
        return;
      }
      const session = await recordGameStart({ player, game, mode: mode ?? null });
      res.status(201).json(session);
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.get('/sessions', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(await listGameSessions(limit));
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.get('/chess/game', async (_req, res) => {
    try {
      const game = await getActiveChessGame();
      if (!game) {
        res.status(404).json({ error: 'Nenhuma partida ativa' });
        return;
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.post('/chess/game', async (req, res) => {
    try {
      const { player, forceNew = false } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      res.status(201).json(await getOrCreateChessGame({ player, forceNew: Boolean(forceNew) }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/chess/game/move', async (req, res) => {
    try {
      const { player, from, to, promotion } = req.body ?? {};
      if (!player || !from || !to) {
        res.status(400).json({ error: 'player, from e to são obrigatórios' });
        return;
      }
      res.json(await applyChessMove({ player, from, to, promotion }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/chess/game/resign', async (req, res) => {
    try {
      const { player } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      res.json(await resignChessGame({ player }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/chess/game/rematch/request', async (req, res) => {
    try {
      const { player } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      res.json(await requestChessRematch({ player }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.post('/chess/game/rematch/respond', async (req, res) => {
    try {
      const { player, accept } = req.body ?? {};
      if (!player || accept == null) {
        res.status(400).json({ error: 'player e accept são obrigatórios' });
        return;
      }
      res.json(await respondChessRematch({ player, accept: Boolean(accept) }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.get('/presence', async (_req, res) => {
    try {
      res.json(await getPresence());
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.post('/presence', async (req, res) => {
    try {
      const { player } = req.body ?? {};
      if (!player) {
        res.status(400).json({ error: 'player é obrigatório' });
        return;
      }
      await touchPresence(player);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.get('/chat', async (_req, res) => {
    try {
      res.json(await listChatMessages());
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });

  router.post('/chat', async (req, res) => {
    try {
      const { sender, player, text } = req.body ?? {};
      if (!sender || !text) {
        res.status(400).json({ error: 'sender e text são obrigatórios' });
        return;
      }
      res.status(201).json(await addChatMessage({ sender, player, text }));
    } catch (error) {
      res.status(400).json({ error: safeApiError(error) });
    }
  });

  router.delete('/chat', async (_req, res) => {
    try {
      await clearChatMessages();
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: safeApiError(error) });
    }
  });
}

export function createApp({ serveStatic = false } = {}) {
  const app = express();
  const api = express.Router();

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

  registerApiRoutes(api);
  app.use('/api', api);

  // Na Vercel o caminho pode chegar sem o prefixo /api
  if (process.env.VERCEL) {
    app.use(api);
  }

  if (serveStatic) {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: safeApiError(error) });
  });

  return app;
}

export const app = createApp();
