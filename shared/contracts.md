# Shared Data Contracts

This document defines the explicit API contracts used by the frontend and backend for the collaborative document editor PoC.

## Role

Allowed values:

- `owner`
- `editor`
- `viewer`

## DocumentDto

```json
{
  "id": "string",
  "ownerUserId": "string",
  "title": "string",
  "currentContent": "string",
  "latestVersionId": "string | null",
  "createdAt": "string (ISO 8601 datetime)",
  "updatedAt": "string (ISO 8601 datetime)"
}
```

## CreateDocumentRequest

```json
{
  "title": "string",
  "content": "string"
}
```

## UpdateDocumentRequest

```json
{
  "content": "string",
  "saveType": "\"manual\" | \"autosave\" (optional)"
}
```

## API Endpoints

### `POST /api/documents`

Creates a document and returns `DocumentDto`.

### `GET /api/documents/{id}`

Returns `DocumentDto` if found, otherwise `404`.

### `PUT /api/documents/{id}`

Updates the document content and returns `DocumentDto` if found, otherwise `404`.
