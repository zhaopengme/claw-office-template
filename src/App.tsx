import { useState, useEffect, useRef } from 'react'
import { PhaserGame } from './game/PhaserGame'
import type { PhaserGameHandle } from './game/PhaserGame'
import { StatusBar } from './components/StatusBar'
import { LoadingOverlay } from './components/Skeleton'
import type { OfficeConfig } from './config/types'

const DEFAULT_LOCALE = 'zh'

export default function App() {
  const [config, setConfig] = useState<OfficeConfig | null>(null)
  const [currentState, setCurrentState] = useState('idle')
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  const [error, setError] = useState<string | null>(null)
  const gameRef = useRef<PhaserGameHandle>(null)

  // Load config on mount
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

  // Set CSS custom properties from config
  useEffect(() => {
    if (!config) return
    const root = document.documentElement
    root.style.setProperty('--office-width', `${config.office.width}px`)
    root.style.setProperty('--office-height', `${config.office.height}px`)
  }, [config])

  // Sync state changes to Phaser scene
  useEffect(() => {
    gameRef.current?.changeState(currentState)
  }, [currentState])

  // Sync locale to Phaser scene plaque
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
        <>
          <PhaserGame ref={gameRef} config={config} />
          <StatusBar
            config={config}
            currentState={currentState}
            locale={locale}
            onStateChange={setCurrentState}
            onLocaleChange={setLocale}
          />
        </>
      )}
    </>
  )
}
