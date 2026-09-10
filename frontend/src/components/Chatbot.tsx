import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Bot, Loader2, Minimize2, Maximize2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const API = '/api'

const QUICK_QUESTIONS = [
  'Is my area safe?',
  'Find nearest shelter',
  'Explain flood depth levels',
  'Emergency numbers',
  'Safe evacuation route',
  'Current rainfall summary',
]

function formatContent(text: string) {
  // Convert **bold** to bold and \n to line breaks
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part.split('\n').flatMap((line, j, arr) =>
          j < arr.length - 1 ? [line, <br key={j} />] : [line]
        )}</span>
  )
}

export default function Chatbot({ lat, lon }: { lat?: number; lon?: number }) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "👋 Hi! I'm **FloodAssist AI**, your intelligent flood safety assistant.\n\nI can help you with:\n- Flood risk for your area\n- Nearest shelters & hospitals\n- Safe evacuation routes\n- Emergency contacts\n- Rainfall & water depth info\n\nHow can I help you today?",
      timestamp: new Date().toISOString(),
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [unread, setUnread] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setUnread(0)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          user_id: user?.id ?? null,
          lat: lat ?? null,
          lon: lon ?? null,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const botMsg: Message = { role: 'assistant', content: data.reply, timestamp: data.timestamp }
      setMessages(prev => [...prev, botMsg])
      if (!isOpen) setUnread(n => n + 1)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Unable to connect to FloodAssist AI. Please check your connection.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }}
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            width: 60, height: 60, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
            color: '#fff', cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,212,170,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MessageCircle size={26} />
          {unread > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4, width: 20, height: 20,
              borderRadius: '50%', background: '#ef4444', border: '2px solid #0a0f1e',
              fontSize: 11, fontWeight: 700, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unread}</div>
          )}
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: isMaximized ? 0 : 28, right: isMaximized ? 0 : 28,
              width: isMaximized ? '100vw' : 380,
              height: isMaximized ? '100vh' : 560,
              zIndex: 9999,
              background: 'rgba(10,22,40,0.97)', backdropFilter: 'blur(24px)',
              border: '1px solid rgba(0,212,170,0.2)',
              borderRadius: isMaximized ? 0 : 20,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(90deg, rgba(0,212,170,0.08), rgba(59,130,246,0.08))',
              borderRadius: isMaximized ? 0 : '20px 20px 0 0',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Bot size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ff' }}>FloodAssist AI</div>
                <div style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  Online · Flood Safety Expert
                </div>
              </div>
              <button onClick={() => setIsMaximized(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d9bc0', padding: 4 }}>
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d9bc0', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Bot size={14} color="#fff" />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #00d4aa, #3b82f6)' : 'rgba(255,255,255,0.06)',
                    fontSize: 13, color: '#e8f0ff', lineHeight: 1.6,
                  }}>
                    {formatContent(msg.content)}
                    <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#7d9bc0', marginTop: 6 }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Bot size={14} color="#fff" />
                  </div>
                  <div style={{
                    padding: '10px 14px', borderRadius: '4px 16px 16px 16px',
                    background: 'rgba(255,255,255,0.06)', display: 'flex', gap: 4, alignItems: 'center',
                  }}>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i}
                        animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4aa' }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick questions */}
            {messages.length <= 1 && (
              <div style={{ padding: '0 20px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    style={{
                      padding: '5px 10px', borderRadius: 99,
                      border: '1px solid rgba(0,212,170,0.3)',
                      background: 'rgba(0,212,170,0.06)', color: '#00d4aa',
                      fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', gap: 8,
            }}>
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder="Ask FloodAssist AI anything..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e8f0ff', fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
                style={{
                  width: 40, height: 40, borderRadius: 12, border: 'none',
                  background: input.trim() ? 'linear-gradient(135deg, #00d4aa, #3b82f6)' : 'rgba(255,255,255,0.06)',
                  color: input.trim() ? '#fff' : '#7d9bc0',
                  cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                {isTyping ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
