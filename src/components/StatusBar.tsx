import type { OfficeConfig } from '../config/types'

const LOCALE_LABELS: Record<string, string> = {
  zh: '中',
  en: 'EN',
  ja: '日',
}

interface StatusBarProps {
  config: OfficeConfig
  currentState: string
  locale: string
  onStateChange: (state: string) => void
  onLocaleChange: (locale: string) => void
}

export function StatusBar({ config, currentState, locale, onStateChange, onLocaleChange }: StatusBarProps) {
  const localeData = config.locales?.[locale]
  const title = localeData?.title ?? config.office.title
  const states = Object.entries(config.states)
  const locales = Object.keys(config.locales ?? {})

  return (
    <div className="status-bar">
      <span className="status-bar-title">{title}</span>
      <div className="status-bar-states">
        {states.map(([key, st]) => {
          const label = localeData?.states?.[key] ?? st.label
          return (
            <button
              key={key}
              className={`status-btn ${key === currentState ? 'active' : ''}`}
              onClick={() => onStateChange(key)}
            >
              {label}
            </button>
          )
        })}
      </div>
      <span className="status-bar-name">{config.character.name}</span>
      {config.links?.github && (
        <a
          className="status-bar-link"
          href={config.links.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      )}
      {config.links?.twitter && (
        <a
          className="status-bar-link"
          href={config.links.twitter}
          target="_blank"
          rel="noopener noreferrer"
        >
          /X
        </a>
      )}
      {locales.length > 1 && (
        <div className="status-bar-locales">
          {locales.map((lc) => (
            <button
              key={lc}
              className={`locale-btn ${lc === locale ? 'active' : ''}`}
              onClick={() => onLocaleChange(lc)}
            >
              {LOCALE_LABELS[lc] ?? lc}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
