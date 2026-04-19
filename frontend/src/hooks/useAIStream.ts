import { useState, useRef, useCallback } from 'react'
import type { AIAction } from '../types'
import { getValidToken } from '../api'
import { buildApiUrl } from '../api/client'

interface AIStreamDonePayload {
  interaction_id: number
  suggestion_id: number
}

interface AICanceledPayload {
  interaction_id: number
}

interface StreamOptions {
  documentId: number
  action: AIAction
  selectedText: string
  options?: Record<string, string>
}

export function useAIStream() {
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [interactionId, setInteractionId] = useState<number | null>(null)
  const [suggestionId, setSuggestionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setStreamedText('')
    setInteractionId(null)
    setSuggestionId(null)
    setError(null)
    setStreaming(false)
  }, [])

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setError('AI generation was canceled.')
    setStreaming(false)
  }, [])

  const startStream = useCallback(async (opts: StreamOptions) => {
    reset()
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    const token = await getValidToken()

    if (!token) {
      setError('Sign in before using the AI assistant.')
      setStreaming(false)
      abortRef.current = null
      return
    }

    try {
      const response = await fetch(buildApiUrl('/api/ai/stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_id: opts.documentId,
          action: opts.action,
          selected_text: opts.selectedText,
          options: opts.options ?? {},
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Request failed' }))
        setError(err.detail ?? (response.status === 404 ? 'AI assistant backend is not available yet.' : 'Request failed'))
        setStreaming(false)
        return
      }

      if (!response.body) {
        setError('AI assistant returned no stream data.')
        setStreaming(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      const handleEventBlock = (rawBlock: string) => {
        const lines = rawBlock.replace(/\r/g, '').split('\n').filter(Boolean)
        if (lines.length === 0) return

        let eventType = 'message'
        const dataLines: string[] = []

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
            continue
          }
          if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6))
            continue
          }
          if (line.startsWith('data:')) {
            dataLines.push(line.slice(5))
          }
        }

        const data = dataLines.join('\n')
        if (!data) return

        switch (eventType) {
          case 'done': {
            try {
              const payload = JSON.parse(data) as AIStreamDonePayload
              setInteractionId(payload.interaction_id)
              setSuggestionId(payload.suggestion_id)
            } catch {
              setError('AI stream finished with an invalid completion payload.')
            }
            break
          }
          case 'error':
            setError(data)
            break
          case 'canceled': {
            try {
              const payload = JSON.parse(data) as AICanceledPayload
              setInteractionId(payload.interaction_id)
            } catch {
              // Ignore malformed cancel payloads and fall back to a generic message.
            }
            setError('AI generation was canceled.')
            break
          }
          default:
            accumulated += data
            setStreamedText(accumulated)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          handleEventBlock(buffer.slice(0, boundary))
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) handleEventBlock(buffer)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('AI generation was canceled.')
      } else {
        setError(err.message ?? 'Stream failed')
      }
    } finally {
      abortRef.current = null
      setStreaming(false)
    }
  }, [reset])

  return { streaming, streamedText, interactionId, suggestionId, error, startStream, cancelStream, reset }
}
