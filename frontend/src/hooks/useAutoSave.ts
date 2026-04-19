import { useCallback, useEffect, useRef } from 'react'
import { useDocumentStore } from '../store/documentStore'

export function useAutoSave(docId: number | undefined, content: string, delay = 1500) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const { updateContent, setSaveStatus } = useDocumentStore()
  const lastSavedRef = useRef<string | null>(null)

  const syncSavedContent = useCallback((nextContent: string) => {
    clearTimeout(timerRef.current)
    lastSavedRef.current = nextContent
  }, [])

  useEffect(() => {
    lastSavedRef.current = null
    clearTimeout(timerRef.current)
  }, [docId])

  useEffect(() => {
    if (!content || !docId) return
    if (lastSavedRef.current === null) {
      lastSavedRef.current = content
      return
    }
    if (content === lastSavedRef.current) return

    setSaveStatus('unsaved')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await updateContent(docId, content, 'autosave')
        lastSavedRef.current = content
      } catch {
        // Store already marks saveStatus as error; keep the last saved baseline intact.
      }
    }, delay)

    return () => clearTimeout(timerRef.current)
  }, [content, docId, delay, updateContent, setSaveStatus])

  return { syncSavedContent }
}
