# State Sync V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Real-time agent state synchronization between mobaiclaw backend and pixel office frontend via WebSocket notifications.

**Architecture:** AgentLoop emits state events through the existing bus as `__state` channel messages. WS Gateway broadcasts them as `agent.state` JSON-RPC notifications. Frontend StateStore receives and distributes to scene/chat components.

**Tech Stack:** Go (mobaiclaw backend), React 19 + TypeScript + Phaser (frontend)

**Working Directories:**
- Tasks 1-3 (backend): `/Users/zhaopeng/projects/github/mobaiclaw`
- Tasks 4-7 (frontend): `/Users/zhaopeng/projects/github/Star-Office-UI/pixel-office-template/.worktrees/feature-chat`

---

### Task 1: Backend — emitState method on AgentLoop

**Files:**
- Modify: `pkg/agent/loop.go` (mobaiclaw repo)
- Modify: `pkg/constants/channels.go`

**Step 1: Add `"__state"` to internalChannels**

In `pkg/constants/channels.go`, add `"__state"` to the `internalChannels` map:

```go
var internalChannels = map[string]struct{}{
	"cli":      {},
	"ws":       {},
	"system":   {},
	"subagent": {},
	"__state":  {}, // state sync internal channel
}
```

Without this, every `emitState` call would trigger a warn log in the channel dispatcher (`channels/manager.go`) when it fails to find a handler for the `"__state"` channel.

**Step 2: Add `"encoding/json"` import to loop.go**

`loop.go` does not currently import `"encoding/json"`. Add it to the import block since `emitState` uses `json.Marshal`.

**Step 3: Add emitState method**

Add at the end of `loop.go`:

```go
// emitState publishes an agent state change notification via the bus.
// WS Gateway picks these up from the "__state" channel and broadcasts
// them as "agent.state" JSON-RPC notifications.
func (al *AgentLoop) emitState(agentID, state, detail string) {
	payload, _ := json.Marshal(map[string]any{
		"agent_id":  agentID,
		"state":     state,
		"detail":    detail,
		"timestamp": time.Now().Unix(),
	})
	al.bus.PublishOutbound(bus.OutboundMessage{
		Channel: "__state",
		Content: string(payload),
	})
}
```

**Step 4: Verify it compiles**

Run: `go build ./pkg/agent/`
Expected: no errors

**Step 5: Commit**

```bash
git add pkg/agent/loop.go pkg/constants/channels.go
git commit -m "feat(agent): add emitState method and __state internal channel"
```

---

### Task 2: Backend — Wire emitState into Agent Loop

**Files:**
- Modify: `pkg/agent/loop.go` (processMessage / runAgentLoop / processOptions)
- Modify: `pkg/agent/llm_iteration.go` (callLLM / tool execution)

**Step 1: Add `SkipStateEmit` flag to processOptions**

Find the `processOptions` struct in `loop.go` and add:

```go
	SkipStateEmit bool // suppress emitState for heartbeat scenarios
```

Then in `ProcessHeartbeat()`, set `SkipStateEmit: true` in its processOptions.

**Step 2: Create conditional emit helper**

To avoid repeating the skip check at every call site, add a wrapper in `loop.go`:

```go
func (al *AgentLoop) maybeEmitState(opts processOptions, agentID, state, detail string) {
	if opts.SkipStateEmit {
		return
	}
	al.emitState(agentID, state, detail)
}
```

**Step 3: Emit `thinking` when message arrives**

In `processMessage()`, after agent is resolved, emit thinking state:

```go
	agent, ok := al.registry.GetAgent(route.AgentID)
	if !ok {
		agent = al.registry.GetDefaultAgent()
	}
	al.emitState(agent.ID, "thinking", "")
```

Note: `processMessage` is not called for heartbeats (they call `runAgentLoop` directly), so plain `emitState` is fine here.

**Step 4: Emit `working` before LLM call (first attempt only)**

In `llm_iteration.go`, `runLLMIteration` needs access to `opts`. It already receives `opts processOptions`. Before `callLLM()`, inside the retry loop:

```go
	if retry == 0 {
		al.maybeEmitState(opts, agent.ID, "working", "calling LLM")
	}
```

**Step 5: Emit `working` before tool execution**

In `llm_iteration.go`, inside the tool loop (after the tool call logging):

```go
	al.maybeEmitState(opts, agent.ID, "working", "calling tool: "+tc.Name)
```

**Step 6: Emit `idle` when processing completes**

In `runAgentLoop()`, after session save, before send response:

```go
	al.maybeEmitState(opts, agent.ID, "idle", "")
```

**Step 7: Emit `error` on failure**

In `runAgentLoop()`, at the error handling block:

```go
	if err != nil {
		if errors.Is(err, context.Canceled) {
			al.maybeEmitState(opts, agent.ID, "idle", "cancelled")
			return "", nil
		}
		al.maybeEmitState(opts, agent.ID, "error", err.Error())
		return "", err
	}
```

**Step 8: Verify it compiles**

Run: `go build ./pkg/agent/`
Expected: no errors

**Step 9: Commit**

```bash
git add pkg/agent/loop.go pkg/agent/llm_iteration.go
git commit -m "feat(agent): emit state events at key processing points"
```

---

### Task 3: Backend — WS Gateway state broadcast

**Files:**
- Modify: `pkg/wsgateway/server.go:44-65` (New function)

**Step 1: Filter internal channels from existing broadcast listener**

In `server.go`, modify the existing `wsgateway-broadcast` listener to skip all internal channels using the existing `constants.IsInternalChannel()` helper. This covers `__state`, `ws`, `system`, `subagent`, `cli` — and any future internal channels automatically.

```go
		ol.AddOutboundListener("wsgateway-broadcast", func(msg bus.OutboundMessage) {
			if constants.IsInternalChannel(msg.Channel) {
				return
			}
			s.broadcast(map[string]string{
				"channel": msg.Channel,
				"chat_id": msg.ChatID,
				"content": msg.Content,
			})
		})
```

Add `"github.com/zhaopengme/mobaiclaw/pkg/constants"` to imports if not already present.

**Why?** Internal channels have their own delivery mechanisms:
- `__state`: dedicated `wsgateway-state` listener (Step 2)
- `ws`: delivered via handler's waiter mechanism (agent.wait response)
- `system`, `subagent`, `cli`: not relevant to WS clients

**Step 2: Add state listener in New()**

In the same `if ol, ok` block, after the modified broadcast listener:

```go
		ol.AddOutboundListener("wsgateway-state", func(msg bus.OutboundMessage) {
			if msg.Channel != "__state" {
				return
			}
			var params map[string]any
			if err := json.Unmarshal([]byte(msg.Content), &params); err != nil {
				return
			}
			s.broadcastNotification("agent.state", params)
		})
```

**Step 3: Extract broadcastNotification from broadcast**

Refactor the existing `broadcast` method into a more generic `broadcastNotification`:

```go
func (s *Server) broadcastNotification(method string, params any) {
	notif := newNotification(method, params)

	s.mu.RLock()
	conns := make([]*conn, 0, len(s.connections))
	for _, c := range s.connections {
		conns = append(conns, c)
	}
	s.mu.RUnlock()

	for _, c := range conns {
		if err := c.writeJSON(notif); err != nil {
			logger.WarnCF("wsgateway", "Broadcast error", map[string]any{"conn_id": c.id, "error": err.Error()})
		}
	}
}

func (s *Server) broadcast(params any) {
	s.broadcastNotification("message.outbound", params)
}
```

**Step 4: Add json import if not present**

Check if `encoding/json` is already imported; add if missing.

**Step 5: Verify it compiles**

Run: `go build ./pkg/wsgateway/`
Expected: no errors

**Step 6: Commit**

```bash
git add pkg/wsgateway/server.go
git commit -m "feat(wsgateway): broadcast agent.state notifications, filter ws/state from chat broadcast"
```

---

### Task 4: Frontend — StateStore (Context + Reducer)

**Files:**
- Create: `src/store/index.ts` (pixel-office-template worktree)

**Step 1: Create the store**

```typescript
import { createContext, useContext, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'

// --- Types ---

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

// --- Actions ---

export type Action =
  | { type: 'ws/status'; status: ConnectionStatus }
  | { type: 'agent/state'; state: AgentState }
  | { type: 'chat/addMessage'; message: ChatMessage }
  | { type: 'chat/sending'; sending: boolean }

// --- Reducer ---

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

// --- Context ---

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
```

**Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors

**Step 3: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: add StateStore with Context + Reducer"
```

---

### Task 5: Frontend — Rewrite useWebSocket to dispatch to store

**Files:**
- Modify: `src/hooks/useWebSocket.ts`

**Step 1: Rewrite useWebSocket**

Replace entire file:

```typescript
import { useCallback, useEffect, useRef } from 'react'
import { useAppDispatch } from '../store'

const WS_URL = 'ws://localhost:18791/ws'

interface PendingRequest {
  resolve: (content: string) => void
  reject: (err: Error) => void
}

let msgId = 0
function nextId() {
  return String(++msgId)
}

export function useWebSocket() {
  const dispatch = useAppDispatch()
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map())
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    dispatch({ type: 'ws/status', status: 'connecting' })
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => dispatch({ type: 'ws/status', status: 'connected' })

    ws.onclose = () => {
      dispatch({ type: 'ws/status', status: 'disconnected' })
      // Reject all pending requests to prevent Promise leaks
      for (const [, pending] of pendingRef.current) {
        pending.reject(new Error('Connection closed'))
      }
      pendingRef.current.clear()
      wsRef.current = null
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)

        // Response with id — match to pending request
        if (data.id) {
          const pending = pendingRef.current.get(data.id)
          if (pending) {
            pendingRef.current.delete(data.id)
            if (data.error) {
              pending.reject(new Error(data.error.message))
            } else {
              pending.resolve(data.result?.content ?? '')
            }
          }
          return
        }

        // Notifications (no id) — route by method
        switch (data.method) {
          case 'agent.state':
            dispatch({
              type: 'agent/state',
              state: {
                state: data.params?.state ?? 'idle',
                detail: data.params?.detail ?? '',
              },
            })
            break

          case 'message.outbound':
            if (data.params?.content) {
              dispatch({
                type: 'chat/addMessage',
                message: {
                  id: nextId(),
                  role: 'assistant',
                  content: data.params.content,
                },
              })
            }
            break
        }
      } catch {
        // ignore malformed messages
      }
    }

    wsRef.current = ws
  }, [dispatch])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback(
    async (content: string) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected')
      }

      const id = nextId()

      dispatch({
        type: 'chat/addMessage',
        message: { id, role: 'user', content },
      })
      dispatch({ type: 'chat/sending', sending: true })

      try {
        const reply = await new Promise<string>((resolve, reject) => {
          pendingRef.current.set(id, { resolve, reject })
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              method: 'agent.wait',
              params: { content, timeout_ms: 120000 },
            })
          )
        })

        dispatch({
          type: 'chat/addMessage',
          message: { id: nextId(), role: 'assistant', content: reply },
        })
      } catch (err) {
        dispatch({
          type: 'chat/addMessage',
          message: {
            id: nextId(),
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        })
      } finally {
        dispatch({ type: 'chat/sending', sending: false })
      }
    },
    [dispatch]
  )

  return { sendMessage }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors

**Step 3: Commit**

```bash
git add src/hooks/useWebSocket.ts
git commit -m "refactor: useWebSocket dispatches to StateStore"
```

---

### Task 6: Frontend — Update App.tsx and ChatPanel to use store

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ChatPanel.tsx`

**Step 1: Update App.tsx**

```typescript
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
  const { sendMessage } = useWebSocket()
  const { wsStatus, agentState, messages, sending } = useAppState()

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

  // Sync agent state from backend to scene animation
  useEffect(() => {
    const mapped =
      agentState.state === 'thinking' ? 'working' : agentState.state
    setCurrentState(mapped)
  }, [agentState])

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
            onSend={sendMessage}
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
```

**Step 2: Update ChatPanel props to use store types**

Replace `ChatPanel.tsx`:

```typescript
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
```

**Step 3: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors

**Step 4: Commit**

```bash
git add src/App.tsx src/components/ChatPanel.tsx
git commit -m "refactor: App and ChatPanel consume StateStore"
```

---

### Task 7: Frontend — WS URL from config

**Files:**
- Modify: `src/config/types.ts`
- Modify: `public/office.config.json`
- Modify: `src/hooks/useWebSocket.ts`
- Modify: `src/App.tsx`

**Step 1: Add ws config type**

In `types.ts`, add to `OfficeConfig`:

```typescript
export interface OfficeConfig {
  // ... existing fields ...
  ws?: {
    url: string
    token?: string
  }
}
```

**Step 2: Add ws config to office.config.json**

```json
{
  "ws": {
    "url": "ws://localhost:18791/ws"
  }
}
```

**Step 3: Pass wsUrl to useWebSocket**

Update `useWebSocket` to accept an optional url parameter with default fallback:

```typescript
const DEFAULT_WS_URL = 'ws://localhost:18791/ws'

export function useWebSocket(wsUrl?: string) {
  const dispatch = useAppDispatch()
  const url = wsUrl || DEFAULT_WS_URL
  // ... use `url` instead of `WS_URL` in connect()
```

Add `url` to `connect`'s dependency array so reconnection happens if URL changes.

**Step 4: Pass from App**

```typescript
const { sendMessage } = useWebSocket(config?.ws?.url)
```

> **Note:** On first render `config` is null, so `wsUrl` is undefined → uses default.
> After config loads, URL won't change in practice (same value), so no unnecessary reconnect.

**Step 5: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors

**Step 6: Commit**

```bash
git add src/config/types.ts public/office.config.json src/hooks/useWebSocket.ts src/App.tsx
git commit -m "feat: make WS URL configurable via office.config.json"
```

---

### Task 8: End-to-end verification

**Step 1: Start mobaiclaw gateway**

```bash
cd /Users/zhaopeng/projects/github/mobaiclaw
go run ./cmd/mobaiclaw gateway
```

Verify: `✓ WebSocket gateway on ws://0.0.0.0:18791/ws` in output

**Step 2: Start frontend dev server**

```bash
cd /path/to/worktree
npm run dev
```

Verify: Vite starts at http://localhost:5173

**Step 3: Open browser and test**

1. Open http://localhost:5173
2. Chat panel shows "已连接" (green)
3. Type a message, press Enter
4. Observe: pixel character changes to working animation
5. Agent replies, character returns to idle
6. Disconnect WS → auto-reconnect after 3s

**Step 4: Commit all remaining changes if any**

```bash
git add -A
git commit -m "feat: state sync v1 complete"
```
