import { useEffect, useRef, useState } from 'react'
import type { ConnectionStatus, ChatMessage } from '../store'

interface Props {
  status: ConnectionStatus
  messages: ChatMessage[]
  sending: boolean
  onSend: (content: string) => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: '连接中...',
  connected: '已连接',
  disconnected: '未连接',
}

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  connecting: '#ffd700',
  connected: '#4ade80',
  disconnected: '#e94560',
}

export function ChatPanel({ status, messages, sending, onSend }: Props) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || sending || status !== 'connected') return
    onSend(text)
    setInput('')
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">Chat</span>
        <span className="chat-status" style={{ color: STATUS_COLOR[status] }}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-empty">发送消息开始对话</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg-${msg.role}`}>
            <span className="chat-msg-label">
              {msg.role === 'user' ? 'You' : 'Agent'}
            </span>
            <span className="chat-msg-text">{msg.content}</span>
          </div>
        ))}
        {sending && (
          <div className="chat-msg chat-msg-assistant">
            <span className="chat-msg-label">Agent</span>
            <span className="chat-msg-text chat-typing">思考中...</span>
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          type="text"
          value={input}
          placeholder={status === 'connected' ? '输入消息...' : '等待连接...'}
          disabled={status !== 'connected' || sending}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          className="chat-send-btn"
          disabled={!input.trim() || sending || status !== 'connected'}
          onClick={handleSubmit}
        >
          {sending ? '...' : '发送'}
        </button>
      </div>
    </div>
  )
}
