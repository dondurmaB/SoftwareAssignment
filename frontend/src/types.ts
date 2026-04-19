export type Role = "owner" | "editor" | "viewer";

export type SaveType = "manual" | "autosave";
export type AIFeature = "rewrite" | "summarize" | "translate" | "enhance" | "grammar" | "custom";

export interface User {
  id: number;
  email: string;
  username: string;
  createdAt: string;
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "bearer";
  user: User;
}

export interface DocumentSummary {
  id: number;
  title: string;
  ownerUserId: number;
  createdAt: string;
  updatedAt: string;
  role: Role;
}

export interface DocumentDto extends DocumentSummary {
  currentContent: string;
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  saveType?: SaveType;
}

export interface DocumentPermission {
  userId: number;
  email: string;
  username: string;
  role: Role;
}

export interface DocumentVersion {
  id: number;
  versionNumber: number;
  createdByUserId: number;
  createdAt: string;
  isCurrent: boolean;
}

export interface RestoreVersionResponse {
  id: number;
  title: string;
  currentContent: string;
  updatedAt: string;
  newVersionNumber: number;
}
