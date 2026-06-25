import { spawn } from 'node:child_process';

const server = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const client = spawn('npm', ['run', 'client'], {
  stdio: 'inherit',
  shell: true,
});

function shutdown(code = 0) {
  server.kill();
  client.kill();
  process.exit(code);
}

server.on('exit', (code) => shutdown(code ?? 1));
client.on('exit', (code) => shutdown(code ?? 1));

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
