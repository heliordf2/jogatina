# Jogatina

App React com **Sudoku** e **Xadrez** para Helio e Thamy.

## Como rodar

1. Copie `.env.example` para `.env` e configure `DATABASE_URL` (PostgreSQL / Neon).
2. Instale e inicie:

```bash
npm install
npm run dev
```

Isso sobe a **API** (`http://localhost:3001`) e o **Vite** (`http://localhost:5173`) juntos.

## Banco de dados

As estatísticas (Sudoku + Xadrez) e o ranking do Sudoku são salvos no PostgreSQL via API:

| Endpoint | Descrição |
|----------|-----------|
| `GET/PUT /api/stats` | Estatísticas da home |
| `GET/PUT /api/sudoku/scores` | Ranking detalhado do Sudoku |
| `GET /api/health` | Verifica conexão com o banco |
| `GET /api/sessions` | Histórico de inícios de jogo |
| `POST /api/sessions` | Registra início de jogo (usuário, data, hora, jogo) |

Tabelas criadas automaticamente no PostgreSQL:

| Tabela | Descrição |
|--------|-----------|
| `players` | Jogadores (`helio`, `thamy`) |
| `sudoku_player_stats` | Totais do Sudoku por jogador |
| `sudoku_games` | Histórico de partidas do Sudoku |
| `chess_player_stats` | Vitórias/derrotas/empates no Xadrez |
| `game_sessions` | Início de cada partida (usuário, data, hora, jogo) |

Schema em `server/schema.sql`.

## Scripts

- `npm run dev` — API + frontend (desenvolvimento)
- `npm run server` — só a API
- `npm run client` — só o frontend
- `npm run build` — build de produção
- `npm run preview` — preview do build
- `npm start` — produção (build + API servindo o frontend)

### Produção

O app precisa rodar o **servidor Node** (não só os arquivos estáticos de `dist/`):

```bash
npm install
npm start
```

Configure `DATABASE_URL` no ambiente. O `npm start` define `NODE_ENV=production`, gera o `dist/` se necessário e sobe a API na porta `PORT` (padrão 3001).

Em plataformas como Render/Railway, use o comando de start: `npm start`.

### Sudoku
- Modo **Solo** e **Colaborativo** (duelo em turnos no mesmo dispositivo)
- Ranking, dificuldades, rascunho, dicas e chat no modo colaborativo

### Xadrez
- Helio (brancas) vs Thamy (pretas) no mesmo dispositivo
- Mecânica baseada no projeto [xadrez](../xadrez) (`chess.js` + `react-chessboard`)
- Chat durante a partida, captura de peças, sons e desistência

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run preview` — preview do build
