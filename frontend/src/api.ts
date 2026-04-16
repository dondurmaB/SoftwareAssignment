import type { CreateDocumentRequest, DocumentDto, UpdateDocumentRequest } from "./types";

const API_BASE_URL = "http://localhost:8000";

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function parseResponse(response: Response): Promise<DocumentDto> {
  if (!response.ok) {
    let errorMessage = "Request failed";

    try {
      const payload = (await response.json()) as { detail?: string };
      errorMessage = payload.detail ?? errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as DocumentDto;
}

export async function createDocument(payload: CreateDocumentRequest): Promise<DocumentDto> {
  const response = await fetch(buildApiUrl("/api/documents"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function loadDocument(documentId: string): Promise<DocumentDto> {
  const response = await fetch(buildApiUrl(`/api/documents/${documentId}`));
  return parseResponse(response);
}

export async function saveDocument(
  documentId: string,
  payload: UpdateDocumentRequest
): Promise<DocumentDto> {
  const response = await fetch(buildApiUrl(`/api/documents/${documentId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}
