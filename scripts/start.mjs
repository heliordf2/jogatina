import { existsSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distIndex = path.join(root, 'dist', 'index.html');

process.env.NODE_ENV = 'production';

if (!existsSync(distIndex)) {
  console.log('Build não encontrado — gerando dist/...');
  execSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });
}

const server = spawn('node', ['server/index.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_ENV: 'production' },
});

server.on('exit', (code) => process.exit(code ?? 1));

process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
