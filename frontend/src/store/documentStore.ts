import { create } from 'zustand'
import type { DocumentRead, DocumentListItem, DocumentVersion, DocumentPermission } from '../types'
import { documentApi } from '../api'

interface DocumentState {
  documents: DocumentListItem[]
  currentDoc: DocumentRead | null
  versions: DocumentVersion[]
  permissions: DocumentPermission[]
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'

  fetchDocuments: () => Promise<void>
  fetchDocument: (id: number) => Promise<DocumentRead>
  createDocument: (title: string) => Promise<DocumentRead>
  updateContent: (id: number, content: string) => Promise<void>
  updateTitle: (id: number, title: string) => Promise<void>
  deleteDocument: (id: number) => Promise<void>
  setCurrentDoc: (doc: DocumentRead | null) => void
  setSaveStatus: (s: 'saved' | 'saving' | 'unsaved' | 'error') => void

  fetchVersions: (id: number) => Promise<void>
  restoreVersion: (docId: number, versionId: number) => Promise<DocumentRead>

  fetchPermissions: (id: number) => Promise<void>
  shareDocument: (docId: number, identifier: string, role: 'editor' | 'viewer') => Promise<void>
  updatePermission: (docId: number, userId: number, role: 'editor' | 'viewer') => Promise<void>
  removePermission: (docId: number, userId: number) => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDoc: null,
  versions: [],
  permissions: [],
  saveStatus: 'saved',

  fetchDocuments: async () => {
    const { data } = await documentApi.list()
    set({ documents: data })
  },

  fetchDocument: async (id) => {
    const { data } = await documentApi.get(id)
    set({ currentDoc: data })
    return data
  },

  createDocument: async (title) => {
    const { data } = await documentApi.create(title)
    set((s) => ({ documents: [data, ...s.documents] }))
    return data
  },

  updateContent: async (id, content) => {
    set({ saveStatus: 'saving' })
    try {
      await documentApi.update(id, { content })
      set({ saveStatus: 'saved' })
    } catch {
      set({ saveStatus: 'error' })
    }
  },

  updateTitle: async (id, title) => {
    const { data } = await documentApi.update(id, { title })
    set((s) => ({
      currentDoc: s.currentDoc?.id === id ? { ...s.currentDoc, title } : s.currentDoc,
      documents: s.documents.map((d) => (d.id === id ? { ...d, title } : d)),
    }))
  },

  deleteDocument: async (id) => {
    await documentApi.delete(id)
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }))
  },

  setCurrentDoc: (doc) => set({ currentDoc: doc }),
  setSaveStatus: (s) => set({ saveStatus: s }),

  fetchVersions: async (id) => {
    const { data } = await documentApi.getVersions(id)
    set({ versions: data })
  },

  restoreVersion: async (docId, versionId) => {
    const { data } = await documentApi.restoreVersion(docId, versionId)
    const doc: DocumentRead = {
      id: data.id,
      title: data.title,
      current_content: data.current_content,
      owner_user_id: get().currentDoc?.owner_user_id ?? 0,
      created_at: get().currentDoc?.created_at ?? '',
      updated_at: data.updated_at,
      role: get().currentDoc?.role ?? 'owner',
    }
    set({ currentDoc: doc })
    return doc
  },

  fetchPermissions: async (id) => {
    const { data } = await documentApi.getPermissions(id)
    set({ permissions: data })
  },

  shareDocument: async (docId, identifier, role) => {
    await documentApi.share(docId, identifier, role)
    await get().fetchPermissions(docId)
  },

  updatePermission: async (docId, userId, role) => {
    await documentApi.updatePermission(docId, userId, role)
    await get().fetchPermissions(docId)
  },

  removePermission: async (docId, userId) => {
    await documentApi.removePermission(docId, userId)
    set((s) => ({ permissions: s.permissions.filter((p) => p.user_id !== userId) }))
  },
}))
