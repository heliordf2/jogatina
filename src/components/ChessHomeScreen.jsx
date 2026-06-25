import CurrentPlayerBar from './CurrentPlayerBar.jsx';

export default function ChessHomeScreen({ onBack, onStart, onlinePlayer, remotePresence, joining = false }) {
  return (
    <div className="screen active">
      <div className="header">
        <button type="button" className="btn" onClick={onBack}>
          ← Voltar
        </button>
        <div className="logo">
          Xa<span>drez</span> ♟️
        </div>
        <div />
      </div>

      <CurrentPlayerBar player={onlinePlayer} detail="jogando online" remotePresence={remotePresence} />

      <div className="info-box" style={{ marginTop: '1rem' }}>
        <h3>🌐 Duelo online:</h3>
        <p>
          Helio e Thamy jogam em <strong>dispositivos diferentes</strong>, com a partida sincronizada em tempo real.
          <br />
          As cores (<strong>brancas</strong> e <strong>pretas</strong>) são sorteadas aleatoriamente a cada partida.
          <br />
          Cada um entra com seu usuário na tela inicial e aguarda a vez do oponente.
        </p>
      </div>

      <button type="button" className="btn btn-primary" onClick={onStart} disabled={joining}>
        {joining ? 'Conectando...' : '♟️ Iniciar / Entrar na Partida'}
      </button>
    </div>
  );
}
