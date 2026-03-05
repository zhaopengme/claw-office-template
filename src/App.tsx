import { useState, useEffect, useRef } from 'react'
import { PhaserGame } from './game/PhaserGame'
import type { PhaserGameHandle } from './game/PhaserGame'
import { StatusBar } from './components/StatusBar'
import { ChatPanel } from './components/ChatPanel'
import { LoadingOverlay } from './components/Skeleton'
import { StoreProvider, useAppState } from './store'
import { useWebSocket } from './hooks/useWebSocket'
import type { OfficeConfig } from './config/types'

const DEFAULT_LOCALE = 'zh'

function AppInner() {
  const [config, setConfig] = useState<OfficeConfig | null>(null)
  const [currentState, setCurrentState] = useState('idle')
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  const [error, setError] = useState<string | null>(null)
  const gameRef = useRef<PhaserGameHandle>(null)
  const { sendMessage, selectSession } = useWebSocket(config?.ws?.url)
  const { wsStatus, agentStates, messages, sending, sessions, currentSessionKey } = useAppState()

  useEffect(() => {
    fetch('./office.config.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Config load failed: ${res.status}`)
        return res.json()
      })
      .then((data: OfficeConfig) => {
        setConfig(data)
        setCurrentState(data.character.defaultState)
      })
      .catch((err) => setError(String(err)))
  }, [])

  useEffect(() => {
    if (!config) return
    const root = document.documentElement
    root.style.setProperty('--office-width', `${config.office.width}px`)
    root.style.setProperty('--office-height', `${config.office.height}px`)
  }, [config])

  useEffect(() => {
    const firstAgentId = Object.keys(agentStates)[0]
    const agentState = firstAgentId ? agentStates[firstAgentId] : { state: 'idle' as const }
    const mapped = agentState.state === 'thinking' ? 'working' : agentState.state
    setCurrentState(mapped)
  }, [agentStates])

  useEffect(() => {
    gameRef.current?.changeState(currentState)
  }, [currentState])

  useEffect(() => {
    if (!config) return
    const title = config.locales?.[locale]?.title ?? config.office.title
    gameRef.current?.updateTitle(title)
  }, [locale, config])

  const localeStrings = config?.locales?.[locale]

  if (error) {
    return (
      <div style={{ color: '#e94560', padding: 40, textAlign: 'center' }}>
        <h2>Failed to load office config</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <>
      <LoadingOverlay locale={localeStrings} />
      {config && (
        <div className="main-layout">
          <div className="office-column">
            <PhaserGame ref={gameRef} config={config} />
            <StatusBar
              config={config}
              currentState={currentState}
              locale={locale}
              onStateChange={setCurrentState}
              onLocaleChange={setLocale}
            />
          </div>
          <ChatPanel
            status={wsStatus}
            messages={messages}
            sending={sending}
            sessions={sessions}
            currentSessionKey={currentSessionKey}
            onSend={sendMessage}
            onSelectSession={selectSession}
          />
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}
