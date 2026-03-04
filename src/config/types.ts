export interface OfficeConfig {
  office: {
    title: string
    background: string
    width: number
    height: number
  }
  character: {
    name: string
    defaultState: string
  }
  states: Record<string, StateConfig>
  furniture: FurnitureConfig
  theme: ThemeConfig
  links?: {
    github?: string
    twitter?: string
  }
  locales?: Record<string, LocaleStrings>
}

export interface LocaleStrings {
  title: string
  loading: string
  entering: string
  states: Record<string, string>
}

export interface StateConfig {
  label: string
  area: string
}

export interface FurnitureItem {
  x: number
  y: number
  depth: number
  origin?: { x: number; y: number }
  scale?: number
}

export interface FurnitureConfig {
  sofa: FurnitureItem
  sofaShadow: FurnitureItem
  desk: FurnitureItem
  flower: FurnitureItem
  plants: FurnitureItem[]
  poster: FurnitureItem
  cat: FurnitureItem
  coffeeMachine: FurnitureItem
  coffeeMachineShadow: FurnitureItem
  serverroom: FurnitureItem
  starWorking: FurnitureItem
  errorBug: FurnitureItem & { pingPong: { leftX: number; rightX: number; speed: number } }
  syncAnim: FurnitureItem
}

export interface ThemeConfig {
  backgroundColor: string
  accentColor: string
  fontFamily: string
}
