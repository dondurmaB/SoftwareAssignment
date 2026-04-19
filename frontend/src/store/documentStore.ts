import { create } from 'zustand'
import type {
  DocumentRead,
  DocumentListItem,
  DocumentVersion,
  DocumentPermission,
  DocumentSaveMode,
} from '../types'
import { documentApi } from '../api'

function mergeDocumentIntoList(documents: DocumentListItem[], document: DocumentRead): DocumentListItem[] {
  const next = {
    id: document.id,
    title: document.title,
    owner_user_id: document.owner_user_id,
    created_at: document.created_at,
    updated_at: document.updated_at,
    role: document.role,
  }
  return documents.map((item) => (item.id === document.id ? next : item))
}

interface DocumentState {
  documents: DocumentListItem[]
  currentDoc: DocumentRead | null
  versions: DocumentVersion[]
  permissions: DocumentPermission[]
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'

  fetchDocuments: () => Promise<void>
  fetchDocument: (id: number) => Promise<DocumentRead>
  createDocument: (title: string) => Promise<DocumentRead>
  updateContent: (id: number, content: string, saveMode?: DocumentSaveMode) => Promise<DocumentRead>
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

  updateContent: async (id, content, saveMode = 'autosave') => {
    set({ saveStatus: 'saving' })
    try {
      const { data } = await documentApi.update(id, { content, save_mode: saveMode })
      set((s) => ({
        currentDoc: s.currentDoc?.id === id ? data : s.currentDoc,
        documents: mergeDocumentIntoList(s.documents, data),
        saveStatus: 'saved',
      }))
      return data
    } catch {
      set({ saveStatus: 'error' })
      throw new Error('Failed to update document content.')
    }
  },

  updateTitle: async (id, title) => {
    const { data } = await documentApi.update(id, { title })
    set((s) => ({
      currentDoc: s.currentDoc?.id === id ? data : s.currentDoc,
      documents: mergeDocumentIntoList(s.documents, data),
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
    const currentDoc = get().currentDoc
    const doc: DocumentRead = {
      id: data.id,
      title: data.title,
      current_content: data.current_content,
      owner_user_id: currentDoc?.owner_user_id ?? 0,
      created_at: currentDoc?.created_at ?? '',
      updated_at: data.updated_at,
      role: currentDoc?.role ?? 'owner',
    }
    set((s) => ({
      currentDoc: doc,
      documents: mergeDocumentIntoList(s.documents, doc),
      saveStatus: 'saved',
    }))
    await get().fetchVersions(docId)
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
