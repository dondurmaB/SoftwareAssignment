export type Role = "owner" | "editor" | "viewer";

export type SaveType = "manual" | "autosave";

export interface DocumentDto {
  id: string;
  ownerUserId: string;
  title: string;
  currentContent: string;
  latestVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
}

export interface UpdateDocumentRequest {
  content: string;
  saveType?: SaveType;
}
