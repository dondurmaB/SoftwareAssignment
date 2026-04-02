from fastapi import APIRouter, HTTPException, status

from ..models import CreateDocumentRequest, DocumentDto, UpdateDocumentRequest
from ..store import InMemoryDocumentStore

router = APIRouter(prefix="/api/documents", tags=["documents"])
store = InMemoryDocumentStore()


@router.post("", response_model=DocumentDto, status_code=status.HTTP_201_CREATED)
def create_document(request: CreateDocumentRequest) -> DocumentDto:
    return store.create_document(request)


@router.get("/{document_id}", response_model=DocumentDto)
def get_document(document_id: str) -> DocumentDto:
    document = store.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.put("/{document_id}", response_model=DocumentDto)
def update_document(document_id: str, request: UpdateDocumentRequest) -> DocumentDto:
    document = store.update_document(document_id, request)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document
