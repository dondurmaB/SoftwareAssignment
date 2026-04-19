import type {
  AuthResponse,
  CreateDocumentRequest,
  DocumentDto,
  DocumentPermission,
  DocumentSummary,
  DocumentVersion,
  RestoreVersionResponse,
  StoredSession,
  UpdateDocumentRequest,
  User
} from "./types";

const API_BASE_URL = "http://localhost:8000";
const SESSION_STORAGE_KEY = "collaborative-editor-session";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

interface ApiErrorPayload {
  detail?: string;
}

let inMemorySession: StoredSession | null = readStoredSession();
let refreshInFlight: Promise<StoredSession> | null = null;

function readStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function writeStoredSession(session: StoredSession | null): void {
  inMemorySession = session;

  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function ensureSession(): StoredSession {
  if (!inMemorySession) {
    throw new Error("Please sign in first.");
  }

  return inMemorySession;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed";

    try {
      const payload = (await response.json()) as ApiErrorPayload;
      message = payload.detail ?? message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
    retryOnUnauthorized = true
  } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const session = ensureSession();
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const response = await fetch(buildApiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (
    response.status === 401 &&
    auth &&
    retryOnUnauthorized &&
    path !== "/api/auth/refresh" &&
    inMemorySession?.refreshToken
  ) {
    await refreshSession();
    return request<T>(path, { ...options, retryOnUnauthorized: false });
  }

  return parseJson<T>(response);
}

function mapUser(payload: {
  id: number;
  email: string;
  username: string;
  created_at: string;
}): User {
  return {
    id: payload.id,
    email: payload.email,
    username: payload.username,
    createdAt: payload.created_at
  };
}

function mapAuthResponse(payload: {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: {
    id: number;
    email: string;
    username: string;
    created_at: string;
  };
}): AuthResponse {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    user: mapUser(payload.user)
  };
}

function mapDocumentSummary(payload: {
  id: number;
  title: string;
  owner_user_id: number;
  created_at: string;
  updated_at: string;
  role: DocumentSummary["role"];
}): DocumentSummary {
  return {
    id: payload.id,
    title: payload.title,
    ownerUserId: payload.owner_user_id,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    role: payload.role
  };
}

function mapDocument(payload: {
  id: number;
  title: string;
  owner_user_id: number;
  created_at: string;
  updated_at: string;
  role: DocumentDto["role"];
  current_content: string;
}): DocumentDto {
  return {
    ...mapDocumentSummary(payload),
    currentContent: payload.current_content
  };
}

function mapPermission(payload: {
  user_id: number;
  email: string;
  username: string;
  role: DocumentPermission["role"];
}): DocumentPermission {
  return {
    userId: payload.user_id,
    email: payload.email,
    username: payload.username,
    role: payload.role
  };
}

function mapVersion(payload: {
  id: number;
  version_number: number;
  created_by_user_id: number;
  created_at: string;
  is_current: boolean;
}): DocumentVersion {
  return {
    id: payload.id,
    versionNumber: payload.version_number,
    createdByUserId: payload.created_by_user_id,
    createdAt: payload.created_at,
    isCurrent: payload.is_current
  };
}

function mapRestoreResponse(payload: {
  id: number;
  title: string;
  current_content: string;
  updated_at: string;
  new_version_number: number;
}): RestoreVersionResponse {
  return {
    id: payload.id,
    title: payload.title,
    currentContent: payload.current_content,
    updatedAt: payload.updated_at,
    newVersionNumber: payload.new_version_number
  };
}

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function getStoredSession(): StoredSession | null {
  return inMemorySession;
}

export function persistSession(session: StoredSession | null): void {
  writeStoredSession(session);
}

export async function register(input: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const payload = await request<{
    access_token: string;
    refresh_token: string;
    token_type: "bearer";
    user: { id: number; email: string; username: string; created_at: string };
  }>("/api/auth/register", {
    method: "POST",
    body: input,
    auth: false,
    retryOnUnauthorized: false
  });

  return mapAuthResponse(payload);
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const payload = await request<{
    access_token: string;
    refresh_token: string;
    token_type: "bearer";
    user: { id: number; email: string; username: string; created_at: string };
  }>("/api/auth/login", {
    method: "POST",
    body: input,
    auth: false,
    retryOnUnauthorized: false
  });

  return mapAuthResponse(payload);
}

export async function refreshSession(): Promise<StoredSession> {
  const activeSession = ensureSession();

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const payload = await request<{
        access_token: string;
        refresh_token: string;
        token_type: "bearer";
        user: { id: number; email: string; username: string; created_at: string };
      }>("/api/auth/refresh", {
        method: "POST",
        body: { refresh_token: activeSession.refreshToken },
        auth: false,
        retryOnUnauthorized: false
      });

      const nextSession: StoredSession = {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        user: mapUser(payload.user)
      };

      writeStoredSession(nextSession);
      return nextSession;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function fetchCurrentUser(): Promise<User> {
  const payload = await request<{
    id: number;
    email: string;
    username: string;
    created_at: string;
  }>("/api/auth/me");

  const user = mapUser(payload);
  if (inMemorySession) {
    writeStoredSession({ ...inMemorySession, user });
  }
  return user;
}

export async function logout(): Promise<void> {
  if (!inMemorySession) {
    writeStoredSession(null);
    return;
  }

  try {
    await request<{ message: string }>("/api/auth/logout", {
      method: "POST",
      body: { refresh_token: inMemorySession.refreshToken },
      retryOnUnauthorized: false
    });
  } finally {
    writeStoredSession(null);
  }
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const payload = await request<
    Array<{
      id: number;
      title: string;
      owner_user_id: number;
      created_at: string;
      updated_at: string;
      role: DocumentSummary["role"];
    }>
  >("/api/documents");

  return payload.map(mapDocumentSummary);
}

export async function createDocument(payload: CreateDocumentRequest): Promise<DocumentDto> {
  const response = await request<{
    id: number;
    title: string;
    owner_user_id: number;
    created_at: string;
    updated_at: string;
    role: DocumentDto["role"];
    current_content: string;
  }>("/api/documents", {
    method: "POST",
    body: payload
  });

  return mapDocument(response);
}

export async function loadDocument(documentId: number): Promise<DocumentDto> {
  const payload = await request<{
    id: number;
    title: string;
    owner_user_id: number;
    created_at: string;
    updated_at: string;
    role: DocumentDto["role"];
    current_content: string;
  }>(`/api/documents/${documentId}`);

  return mapDocument(payload);
}

export async function saveDocument(
  documentId: number,
  payload: UpdateDocumentRequest
): Promise<DocumentDto> {
  const response = await request<{
    id: number;
    title: string;
    owner_user_id: number;
    created_at: string;
    updated_at: string;
    role: DocumentDto["role"];
    current_content: string;
  }>(`/api/documents/${documentId}`, {
    method: "PUT",
    body: {
      title: payload.title,
      content: payload.content
    }
  });

  return mapDocument(response);
}

export async function deleteDocument(documentId: number): Promise<void> {
  await request<{ message: string }>(`/api/documents/${documentId}`, {
    method: "DELETE"
  });
}

export async function shareDocument(input: {
  documentId: number;
  identifier: string;
  role: "editor" | "viewer";
}): Promise<DocumentPermission> {
  const payload = await request<{
    user_id: number;
    email: string;
    username: string;
    role: DocumentPermission["role"];
  }>(`/api/documents/${input.documentId}/share`, {
    method: "POST",
    body: { identifier: input.identifier, role: input.role }
  });

  return mapPermission(payload);
}

export async function listPermissions(documentId: number): Promise<DocumentPermission[]> {
  const payload = await request<
    Array<{
      user_id: number;
      email: string;
      username: string;
      role: DocumentPermission["role"];
    }>
  >(`/api/documents/${documentId}/permissions`);

  return payload.map(mapPermission);
}

export async function updatePermission(input: {
  documentId: number;
  userId: number;
  role: "editor" | "viewer";
}): Promise<DocumentPermission> {
  const payload = await request<{
    user_id: number;
    email: string;
    username: string;
    role: DocumentPermission["role"];
  }>(`/api/documents/${input.documentId}/permissions/${input.userId}`, {
    method: "PUT",
    body: { role: input.role }
  });

  return mapPermission(payload);
}

export async function removePermission(documentId: number, userId: number): Promise<void> {
  await request<{ message: string }>(`/api/documents/${documentId}/permissions/${userId}`, {
    method: "DELETE"
  });
}

export async function listVersions(documentId: number): Promise<DocumentVersion[]> {
  const payload = await request<
    Array<{
      id: number;
      version_number: number;
      created_by_user_id: number;
      created_at: string;
      is_current: boolean;
    }>
  >(`/api/documents/${documentId}/versions`);

  return payload.map(mapVersion);
}

export async function restoreVersion(documentId: number, versionId: number): Promise<RestoreVersionResponse> {
  const payload = await request<{
    id: number;
    title: string;
    current_content: string;
    updated_at: string;
    new_version_number: number;
  }>(`/api/documents/${documentId}/versions/${versionId}/restore`, {
    method: "POST"
  });

  return mapRestoreResponse(payload);
}
