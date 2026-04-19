import { useEffect, useRef, useCallback, useState } from 'react'
import type { WSMessage, ActiveUser } from '../types'
import { getValidToken } from '../api'

interface UseCollaborationOptions {
  docId: number
  onRemoteEdit: (content: string, userId: number) => void
  onPresenceChange: (users: ActiveUser[]) => void
  enabled: boolean
}

export function useCollaboration({
  docId,
  onRemoteEdit,
  onPresenceChange,
  enabled,
}: UseCollaborationOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>()
  const mountedRef = useRef(true)
  const attemptsRef = useRef(0)

  const connect = useCallback(async () => {
    if (!enabled || !docId || !mountedRef.current) return
    const token = await getValidToken()
    if (!token) return

    // Backend uses ?token= query param for WebSocket auth
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://localhost:8000/ws/documents/${docId}?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      // Send join_session message after connection (backend protocol)
      ws.send(JSON.stringify({ type: 'join_session' }))
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, 30_000)
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      let msg: WSMessage
      try { msg = JSON.parse(event.data) } catch { return }

      switch (msg.type) {
        case 'session_joined':
          setConnected(true)
          attemptsRef.current = 0
          onPresenceChange(msg.active_users)
          break
        case 'document_update':
          onRemoteEdit(msg.content, msg.updated_by_user_id)
          break
        case 'presence_update':
          onPresenceChange(msg.active_users)
          break
        case 'error':
          console.error('[WS]', msg.detail)
          break
        case 'pong':
          break
      }
    }

    ws.onclose = (event) => {
      clearInterval(pingTimerRef.current)
      if (!mountedRef.current) return
      setConnected(false)
      if (event.code === 1008) return // auth failure
      attemptsRef.current++
      const backoff = Math.min(1000 * Math.pow(2, attemptsRef.current), 15000)
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, backoff)
    }

    ws.onerror = () => ws.close()
  }, [docId, enabled, onRemoteEdit, onPresenceChange])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      clearInterval(pingTimerRef.current)
      wsRef.current?.close(1000, 'unmounted')
    }
  }, [connect])

  const sendEdit = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'edit_event', content }))
    }
  }, [])

  return { connected, sendEdit }
}
