import { useCallback, useEffect, useRef } from 'react'
import { useAppDispatch } from '../store'

interface PendingRequest {
  resolve: (content: string) => void
  reject: (err: Error) => void
}

const DEFAULT_WS_URL = 'ws://localhost:18791/ws'

let msgId = 0
function nextId() {
  return String(++msgId)
}

export function useWebSocket(wsUrl?: string) {
  const dispatch = useAppDispatch()
  const url = wsUrl || DEFAULT_WS_URL
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map())
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    dispatch({ type: 'ws/status', status: 'connecting' })
    const ws = new WebSocket(url)

    ws.onopen = () => dispatch({ type: 'ws/status', status: 'connected' })

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
              pending.resolve(data.result?.content ?? '')
            }
          }
          return
        }

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
  }, [dispatch, url])

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
