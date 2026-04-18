import { useEffect, useRef } from 'react'
import { useDocumentStore } from '../store/documentStore'

export function useAutoSave(docId: number | undefined, content: string, delay = 1500) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const { updateContent, setSaveStatus } = useDocumentStore()
  const lastSavedRef = useRef<string | null>(null)

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
      await updateContent(docId, content)
      lastSavedRef.current = content
    }, delay)

    return () => clearTimeout(timerRef.current)
  }, [content, docId, delay, updateContent, setSaveStatus])
}
