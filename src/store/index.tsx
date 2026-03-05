import { createContext, useContext, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface AgentState {
  state: 'idle' | 'thinking' | 'working' | 'error'
  detail: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface SessionInfo {
  key: string
  agent_id: string
  messages: number
  updated: number
  created: number
}

export interface AppState {
  wsStatus: ConnectionStatus
  agentStates: Record<string, AgentState>
  messages: ChatMessage[]
  sending: boolean
  currentSessionKey: string | null
  sessions: SessionInfo[]
}

export type Action =
  | { type: 'ws/status'; status: ConnectionStatus }
  | { type: 'agent/state'; agentId: string; state: AgentState }
  | { type: 'chat/addMessage'; message: ChatMessage }
  | { type: 'chat/setMessages'; messages: ChatMessage[] }
  | { type: 'chat/sending'; sending: boolean }
  | { type: 'session/list'; sessions: SessionInfo[] }
  | { type: 'session/select'; key: string }

const initialState: AppState = {
  wsStatus: 'disconnected',
  agentStates: {},
  messages: [],
  sending: false,
  currentSessionKey: null,
  sessions: [],
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ws/status':
      return { ...state, wsStatus: action.status }
    case 'agent/state':
      return {
        ...state,
        agentStates: {
          ...state.agentStates,
          [action.agentId]: action.state,
        },
      }
    case 'chat/addMessage':
      return { ...state, messages: [...state.messages, action.message] }
    case 'chat/setMessages':
      return { ...state, messages: action.messages }
    case 'chat/sending':
      return { ...state, sending: action.sending }
    case 'session/list':
      return { ...state, sessions: action.sessions }
    case 'session/select':
      return { ...state, currentSessionKey: action.key, messages: [] }
    default:
      return state
  }
}

const StateCtx = createContext<AppState>(initialState)
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export function useAppState() {
  return useContext(StateCtx)
}

export function useAppDispatch() {
  return useContext(DispatchCtx)
}
