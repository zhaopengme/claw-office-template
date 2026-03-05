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

export interface AppState {
  wsStatus: ConnectionStatus
  agentState: AgentState
  messages: ChatMessage[]
  sending: boolean
}

export type Action =
  | { type: 'ws/status'; status: ConnectionStatus }
  | { type: 'agent/state'; state: AgentState }
  | { type: 'chat/addMessage'; message: ChatMessage }
  | { type: 'chat/sending'; sending: boolean }

const initialState: AppState = {
  wsStatus: 'disconnected',
  agentState: { state: 'idle', detail: '' },
  messages: [],
  sending: false,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ws/status':
      return { ...state, wsStatus: action.status }
    case 'agent/state':
      return { ...state, agentState: action.state }
    case 'chat/addMessage':
      return { ...state, messages: [...state.messages, action.message] }
    case 'chat/sending':
      return { ...state, sending: action.sending }
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
