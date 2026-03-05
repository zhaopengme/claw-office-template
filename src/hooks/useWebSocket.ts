import { useCallback, useEffect, useRef } from 'react'
import { useAppDispatch, useAppState } from '../store'

interface PendingRequest {
  resolve: (value: any) => void
  reject: (err: Error) => void
}

const DEFAULT_WS_URL = 'ws://localhost:18791/ws'

let msgId = 0
function nextId() {
  return String(++msgId)
}

export function useWebSocket(wsUrl?: string) {
  const dispatch = useAppDispatch()
  const { currentSessionKey } = useAppState()
  const url = wsUrl || DEFAULT_WS_URL
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map())
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionKeyRef = useRef<string | null>(null)

  sessionKeyRef.current = currentSessionKey

  const sendRpc = useCallback(
    (method: string, params: Record<string, any> = {}): Promise<any> => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('Not connected'))
      }
      const id = nextId()
      return new Promise((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject })
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
      })
    },
    []
  )

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    dispatch({ type: 'ws/status', status: 'connecting' })
    const ws = new WebSocket(url)

    ws.onopen = () => {
      dispatch({ type: 'ws/status', status: 'connected' })
      sendRpc('session.list').then((result) => {
        dispatch({ type: 'session/list', sessions: result?.sessions ?? [] })
      }).catch(() => {})
    }

    ws.onclose = () => {
      dispatch({ type: 'ws/status', status: 'disconnected' })
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

        if (data.id) {
          const pending = pendingRef.current.get(data.id)
          if (pending) {
            pendingRef.current.delete(data.id)
            if (data.error) {
              pending.reject(new Error(data.error.message))
            } else {
              pending.resolve(data.result)
            }
          }
          return
        }

        switch (data.method) {
          case 'agent.state':
            dispatch({
              type: 'agent/state',
              agentId: data.params?.agent_id ?? 'unknown',
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
  }, [dispatch, url, sendRpc])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const listSessions = useCallback(async () => {
    const result = await sendRpc('session.list')
    dispatch({ type: 'session/list', sessions: result?.sessions ?? [] })
  }, [sendRpc, dispatch])

  const loadHistory = useCallback(
    async (sessionKey: string) => {
      const result = await sendRpc('session.history', {
        session_key: sessionKey,
        limit: 50,
      })
      const msgs = (result?.messages ?? []).map(
        (m: { role: string; content: string }, i: number) => ({
          id: `hist-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })
      )
      dispatch({ type: 'chat/setMessages', messages: msgs })
    },
    [sendRpc, dispatch]
  )

  const selectSession = useCallback(
    async (sessionKey: string) => {
      dispatch({ type: 'session/select', key: sessionKey })
      await loadHistory(sessionKey)
    },
    [dispatch, loadHistory]
  )

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
        const result = await sendRpc('agent.wait', {
          content,
          session_key: sessionKeyRef.current ?? undefined,
          timeout_ms: 120000,
        })

        dispatch({
          type: 'chat/addMessage',
          message: {
            id: nextId(),
            role: 'assistant',
            content: result?.content ?? '',
          },
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
        listSessions().catch(() => {})
      }
    },
    [dispatch, sendRpc, listSessions]
  )

  return { sendMessage, listSessions, loadHistory, selectSession }
}
