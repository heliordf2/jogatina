import { execSync, spawn } from 'node:child_process';

const API_PORT = Number(process.env.PORT) || 3001;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_INTERVAL_MS = 250;

function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of output.split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`Porta ${port} liberada (PID ${pid})`);
        } catch {
          // ignore
        }
      }
      return;
    }

    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti:${port} | xargs kill -9 2>/dev/null`, {
      stdio: 'ignore',
      shell: true,
    });
  } catch {
    // porta já livre
  }
}

async function waitForApi() {
  const started = Date.now();
  while (Date.now() - started < HEALTH_TIMEOUT_MS) {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // API ainda não disponível
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_INTERVAL_MS));
  }
  throw new Error(`API não respondeu em ${API_URL} dentro de ${HEALTH_TIMEOUT_MS / 1000}s`);
}

function shutdown(server, client, code = 0) {
  server?.kill();
  client?.kill();
  process.exit(code);
}

freePort(API_PORT);

const server = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PORT: String(API_PORT) },
});

let client = null;

server.on('exit', (code) => shutdown(server, client, code ?? 1));

process.on('SIGINT', () => shutdown(server, client, 0));
process.on('SIGTERM', () => shutdown(server, client, 0));

waitForApi()
  .then(() => {
    console.log('API pronta — iniciando Vite...');
    client = spawn('npm', ['run', 'client'], {
      stdio: 'inherit',
      shell: true,
    });
    client.on('exit', (code) => shutdown(server, client, code ?? 1));
  })
  .catch((error) => {
    console.error(error.message);
    shutdown(server, client, 1);
  });
