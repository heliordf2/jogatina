import { useEffect, useRef, useState } from 'react';
import IMGS from '../assets/imgs.js';
import { PLAYER_COLORS, PLAYER_NAMES, QUICK_MESSAGES } from '../data/constants.js';

export default function Chat({
  messages,
  myself,
  onSend,
  onSendQuick,
  onFocusChange,
  quickMessages = QUICK_MESSAGES,
  title = '💬 Chat do Duelo',
}) {
  const [input, setInput] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="chat-wrap">
      <div className="chat-header">{title}</div>
      <div className="chat-messages" ref={boxRef}>
        {messages.map((msg, i) => {
          if (msg.sender === 'system') {
            return (
              <div
                key={i}
                style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', padding: '2px 0' }}
              >
                {msg.text}
              </div>
            );
          }

          const isMine = msg.player === myself;
          const color = PLAYER_COLORS[msg.player];
          const name = PLAYER_NAMES[msg.player];

          return (
            <div key={i} className={`chat-msg ${isMine ? 'mine' : 'theirs'}`}>
              <div className="chat-av">
                <img src={IMGS[msg.player]} alt={name} />
              </div>
              <div>
                <div className="chat-bubble">
                  {!isMine && (
                    <div className="chat-sender" style={{ color }}>
                      {name}
                    </div>
                  )}
                  {msg.text}
                </div>
                <div className="chat-time" style={{ textAlign: isMine ? 'right' : 'left' }}>
                  {msg.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="chat-quick">
        {quickMessages.map((text) => (
          <button key={text} type="button" onClick={() => onSendQuick(text)}>
            {text}
          </button>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="Digite uma mensagem..."
          maxLength={120}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button type="button" className="chat-send" onClick={handleSend}>
          Enviar
        </button>
      </div>
    </div>
  );
}
