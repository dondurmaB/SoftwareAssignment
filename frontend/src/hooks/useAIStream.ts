import { useState, useRef, useCallback } from 'react'
import type { AIAction } from '../types'
import { getValidToken } from '../api'

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
    setStreaming(false)
  }, [])

  const startStream = useCallback(async (opts: StreamOptions) => {
    reset()
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    const token = await getValidToken()

    try {
      const response = await fetch('http://localhost:8000/api/ai/stream', {
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
        setError(err.detail ?? 'Request failed')
        setStreaming(false)
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: error')) continue
          if (line.startsWith('event: done')) continue
          if (line.startsWith('data: ')) {
            const raw = line.slice(6)
            if (raw.startsWith('{') && raw.includes('interaction_id')) {
              try {
                const payload = JSON.parse(raw)
                setInteractionId(payload.interaction_id)
                setSuggestionId(payload.suggestion_id)
              } catch {}
            } else if (raw.trim()) {
              accumulated += raw
              setStreamedText(accumulated)
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message ?? 'Stream failed')
    } finally {
      setStreaming(false)
    }
  }, [reset])

  return { streaming, streamedText, interactionId, suggestionId, error, startStream, cancelStream, reset }
}
