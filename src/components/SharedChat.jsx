import Chat from './Chat.jsx';

export default function SharedChat({
  messages,
  onlinePlayer,
  onSendPlayerMessage,
  onChatFocusChange,
  title = '💬 Chat',
  quickMessages,
}) {
  return (
    <Chat
      messages={messages}
      myself={onlinePlayer}
      onSend={onSendPlayerMessage}
      onSendQuick={onSendPlayerMessage}
      onFocusChange={onChatFocusChange}
      title={title}
      quickMessages={quickMessages}
    />
  );
}
