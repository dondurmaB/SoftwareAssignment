import api from './client'
import type {
  User,
  AuthResponse, DocumentRead, DocumentListItem,
  DocumentVersion, DocumentRestoreResponse,
  DocumentPermission, DocumentRole, AIHistoryItem, AIAction
} from '../types'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, username: string, password: string) =>
    api.post<AuthResponse>('/api/auth/register', { email, username, password }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),

  refresh: (refresh_token: string) =>
    api.post<AuthResponse>('/api/auth/refresh', { refresh_token }),

  me: () =>
    api.get<User>('/api/auth/me'),

  logout: (refresh_token: string) =>
    api.post('/api/auth/logout', { refresh_token }),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentApi = {
  list: () =>
    api.get<DocumentListItem[]>('/api/documents'),

  get: (id: number) =>
    api.get<DocumentRead>(`/api/documents/${id}`),

  create: (title: string, content = '') =>
    api.post<DocumentRead>('/api/documents', { title, content }),

  update: (id: number, data: { title?: string; content?: string }) =>
    api.put<DocumentRead>(`/api/documents/${id}`, data),

  delete: (id: number) =>
    api.delete(`/api/documents/${id}`),

  // Versions
  getVersions: (id: number) =>
    api.get<DocumentVersion[]>(`/api/documents/${id}/versions`),

  restoreVersion: (docId: number, versionId: number) =>
    api.post<DocumentRestoreResponse>(`/api/documents/${docId}/versions/${versionId}/restore`),

  // Permissions
  getPermissions: (id: number) =>
    api.get<DocumentPermission[]>(`/api/documents/${id}/permissions`),

  share: (docId: number, identifier: string, role: 'editor' | 'viewer') =>
    api.post<DocumentPermission>(`/api/documents/${docId}/share`, { identifier, role }),

  updatePermission: (docId: number, userId: number, role: 'editor' | 'viewer') =>
    api.put<DocumentPermission>(`/api/documents/${docId}/permissions/${userId}`, { role }),

  removePermission: (docId: number, userId: number) =>
    api.delete(`/api/documents/${docId}/permissions/${userId}`),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  getHistory: (docId: number) =>
    api.get<AIHistoryItem[]>(`/api/ai/history/${docId}`),

  decideOnSuggestion: (suggestionId: number, decision: 'accepted' | 'rejected') =>
    api.post(`/api/ai/suggestions/${suggestionId}/decision`, { decision }),

  cancelInteraction: (interactionId: number) =>
    api.post(`/api/ai/interactions/${interactionId}/cancel`),
}

// ── Token helper for SSE/WS (bypasses axios interceptor) ─────────────────────
export async function getValidToken(): Promise<string> {
  const token = localStorage.getItem('access_token') ?? ''
  if (!token) return ''
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const expiresInMs = payload.exp * 1000 - Date.now()
    if (expiresInMs < 60_000) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) { localStorage.clear(); window.location.href = '/login'; return '' }
      const { data } = await api.post('/api/auth/refresh', { refresh_token: refreshToken })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      return data.access_token
    }
  } catch {}
  return token
}
