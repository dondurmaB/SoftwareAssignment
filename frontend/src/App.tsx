import { useState, type CSSProperties } from "react";

import { createDocument, loadDocument, saveDocument } from "./api";

function App() {
  const [documentId, setDocumentId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateDocument() {
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("Creating document...");

    try {
      const document = await createDocument({ title, content });
      setDocumentId(document.id);
      setTitle(document.title);
      setContent(document.currentContent);
      setStatusMessage(`Created document ${document.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create document");
      setStatusMessage("Create failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoadDocument() {
    if (!documentId.trim()) {
      setErrorMessage("Document ID is required to load a document");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("Loading document...");

    try {
      const document = await loadDocument(documentId.trim());
      setTitle(document.title);
      setContent(document.currentContent);
      setStatusMessage(`Loaded document ${document.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load document");
      setStatusMessage("Load failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveDocument() {
    if (!documentId.trim()) {
      setErrorMessage("Document ID is required to save a document");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("Saving document...");

    try {
      const document = await saveDocument(documentId.trim(), {
        content,
        saveType: "manual"
      });
      setContent(document.currentContent);
      setStatusMessage(`Saved document ${document.id} at ${document.updatedAt}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save document");
      setStatusMessage("Save failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.heading}>Collaborative Document Editor PoC</h1>
        <p style={styles.subheading}>
          Minimal frontend-to-backend validation for document create, load, and save flows.
        </p>

        <label style={styles.label}>
          Title
          <input
            style={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="My document"
          />
        </label>

        <label style={styles.label}>
          Content
          <textarea
            style={styles.textarea}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Start writing..."
          />
        </label>

        <div style={styles.buttonRow}>
          <button style={styles.button} onClick={handleCreateDocument} disabled={isSubmitting}>
            Create Document
          </button>
        </div>

        <label style={styles.label}>
          Document ID
          <input
            style={styles.input}
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            placeholder="Paste a document ID"
          />
        </label>

        <div style={styles.buttonRow}>
          <button style={styles.button} onClick={handleLoadDocument} disabled={isSubmitting}>
            Load Document
          </button>
          <button style={styles.button} onClick={handleSaveDocument} disabled={isSubmitting}>
            Save Document
          </button>
        </div>

        <div style={styles.statusBox}>
          <strong>Status:</strong> {statusMessage}
        </div>

        {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 16px",
    background: "#f4f7fb",
    color: "#1f2937",
    fontFamily: "Arial, sans-serif"
  },
  card: {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "24px",
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  heading: {
    margin: 0
  },
  subheading: {
    margin: 0,
    color: "#4b5563"
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontWeight: 600
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px"
  },
  textarea: {
    minHeight: "240px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    resize: "vertical"
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  button: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: "14px",
    cursor: "pointer"
  },
  statusBox: {
    padding: "12px",
    borderRadius: "8px",
    background: "#ecfeff"
  },
  errorBox: {
    padding: "12px",
    borderRadius: "8px",
    background: "#fef2f2",
    color: "#b91c1c"
  }
};

export default App;
