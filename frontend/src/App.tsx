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
    if (!title.trim() || !content.trim()) {
      setErrorMessage("Title and content are required to create a document");
      setStatusMessage("Create failed");
      return;
    }

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
      setStatusMessage("Load failed");
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
      setStatusMessage("Save failed");
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

  function handleClearForm() {
    setDocumentId("");
    setTitle("");
    setContent("");
    setErrorMessage("");
    setStatusMessage("Form cleared");
  }

  async function handleCopyDocumentId() {
    if (!documentId.trim()) {
      setErrorMessage("No document ID to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(documentId);
      setErrorMessage("");
      setStatusMessage("Document ID copied to clipboard");
    } catch {
      setErrorMessage("Failed to copy document ID");
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.headerBlock}>
          <h1 style={styles.heading}>Collaborative Document Editor PoC</h1>
          <p style={styles.subheading}>
            Frontend validation for document creation, loading, saving, and user feedback flow.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Create or Edit Document</h2>

          <label style={styles.label}>
            Title
            <input
              style={styles.input}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter a document title"
            />
          </label>

          <label style={styles.label}>
            Content
            <textarea
              style={styles.textarea}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Start writing your document here..."
            />
          </label>

          <div style={styles.buttonRow}>
            <button
              style={{
                ...styles.button,
                ...(isSubmitting || !title.trim() || !content.trim() ? styles.buttonDisabled : {})
              }}
              onClick={handleCreateDocument}
              disabled={isSubmitting || !title.trim() || !content.trim()}
            >
              {isSubmitting ? "Working..." : "Create Document"}
            </button>

            <button
              style={styles.secondaryButton}
              onClick={handleClearForm}
              disabled={isSubmitting}
            >
              Clear Form
            </button>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Load or Save Existing Document</h2>

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
            <button
              style={{
                ...styles.button,
                ...(isSubmitting || !documentId.trim() ? styles.buttonDisabled : {})
              }}
              onClick={handleLoadDocument}
              disabled={isSubmitting || !documentId.trim()}
            >
              Load Document
            </button>

            <button
              style={{
                ...styles.button,
                ...(isSubmitting || !documentId.trim() ? styles.buttonDisabled : {})
              }}
              onClick={handleSaveDocument}
              disabled={isSubmitting || !documentId.trim()}
            >
              Save Document
            </button>

            <button
              style={styles.secondaryButton}
              onClick={handleCopyDocumentId}
              disabled={!documentId.trim()}
            >
              Copy ID
            </button>
          </div>
        </div>

        <div style={styles.statusBox}>
          <strong>Status:</strong> {statusMessage || "No action yet"}
        </div>

        {errorMessage ? (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {errorMessage}
          </div>
        ) : null}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "40px 16px",
    background: "#f4f7fb",
    color: "#1f2937",
    fontFamily: "Arial, sans-serif"
  },
  card: {
    maxWidth: "820px",
    margin: "0 auto",
    padding: "28px",
    background: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  headerBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  heading: {
    margin: 0,
    fontSize: "36px",
    lineHeight: 1.1
  },
  subheading: {
    margin: 0,
    color: "#4b5563",
    fontSize: "16px",
    lineHeight: 1.5
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "18px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#fafafa"
  },
  sectionTitle: {
    margin: 0,
    fontSize: "20px"
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontWeight: 600
  },
  input: {
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    background: "#ffffff"
  },
  textarea: {
    minHeight: "240px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    resize: "vertical",
    background: "#ffffff"
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  button: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer"
  },
  secondaryButton: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#1f2937",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer"
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed"
  },
  statusBox: {
    padding: "14px",
    borderRadius: "10px",
    background: "#ecfeff",
    border: "1px solid #bae6fd"
  },
  errorBox: {
    padding: "14px",
    borderRadius: "10px",
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca"
  }
};

export default App;