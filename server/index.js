import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, initDb } from './db.js';
import { getGameStats, getSudokuScores, saveGameStats, saveSudokuScores } from './statsRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3001;

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await initDb();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
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

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Falha ao iniciar servidor:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});
