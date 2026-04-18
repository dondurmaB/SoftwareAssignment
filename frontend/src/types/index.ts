// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: number
  email: string
  username: string
  created_at: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
}

export interface AuthResponse extends TokenPair {
  user: User
}

// ── Documents ─────────────────────────────────────────────────────────────────
export type DocumentRole = 'owner' | 'editor' | 'viewer'

export interface DocumentListItem {
  id: number
  title: string
  owner_user_id: number
  created_at: string
  updated_at: string
  role: DocumentRole
}

export interface DocumentRead extends DocumentListItem {
  current_content: string
}

export interface DocumentVersion {
  id: number
  version_number: number
  created_by_user_id: number
  created_at: string
  is_current: boolean
}

export interface DocumentRestoreResponse {
  id: number
  title: string
  current_content: string
  updated_at: string
  new_version_number: number
}

// ── Permissions ───────────────────────────────────────────────────────────────
export interface DocumentPermission {
  user_id: number
  email: string
  username: string
  role: DocumentRole
}

// ── AI ────────────────────────────────────────────────────────────────────────
export type AIAction = 'rewrite' | 'summarize' | 'translate' | 'enhance'

export type AIDecision = 'accepted' | 'rejected'

export interface AIHistoryItem {
  interaction_id: number
  document_id: number
  user_id: number
  username: string
  action: AIAction
  selected_text: string
  prompt_text: string
  model_name: string
  status: string
  created_at: string
  suggestion_id: number | null
  suggested_text: string | null
  decision_status: string | null
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
export interface ActiveUser {
  user_id: number
  username: string
}

export type WSMessage =
  | { type: 'session_joined'; document_id: number; role: DocumentRole; content: string; active_users: ActiveUser[] }
  | { type: 'document_update'; document_id: number; content: string; updated_by_user_id: number }
  | { type: 'presence_update'; active_users: ActiveUser[] }
  | { type: 'error'; detail: string }
  | { type: 'pong' }

// ── UI ────────────────────────────────────────────────────────────────────────
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
