import { closeDb } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3001;
const app = createApp({ serveStatic: process.env.NODE_ENV === 'production' });

async function start() {
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
