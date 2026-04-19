import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { DocumentSummary, User } from "../types";

interface Props {
  user: User;
  documentsBusy: boolean;
  createTitle: string;
  createBusy: boolean;
  statusMessage: string;
  workspaceError: string;
  owned: DocumentSummary[];
  shared: DocumentSummary[];
  onCreateTitleChange: (value: string) => void;
  onCreateDocument: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export default function DashboardPage(props: Props) {
  const {
    user,
    documentsBusy,
    createTitle,
    createBusy,
    statusMessage,
    workspaceError,
    owned,
    shared,
    onCreateTitleChange,
    onCreateDocument,
    onRefresh,
    onLogout
  } = props;

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.topBar}>
          <div>
            <h1 style={styles.heading}>Dashboard</h1>
            <p style={styles.subheading}>
              Signed in as <strong>{user.username}</strong> ({user.email})
            </p>
          </div>

          <div style={styles.actions}>
            <button style={styles.secondaryButton} type="button" onClick={onRefresh}>
              Refresh
            </button>
            <button style={styles.secondaryButton} type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Create Document</h2>
            <p style={styles.helperText}>Create a new document and open it immediately in the editor workspace.</p>

            <label style={styles.label}>
              Title
              <input
                style={styles.input}
                value={createTitle}
                onChange={(event) => onCreateTitleChange(event.target.value)}
                placeholder="Project plan"
              />
            </label>

            <button style={styles.primaryButton} type="button" onClick={onCreateDocument} disabled={createBusy}>
              {createBusy ? "Creating..." : "Create and Open"}
            </button>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Workspace Status</h2>
            <div style={styles.infoBox}>{statusMessage}</div>
            {workspaceError ? <div style={styles.errorBox}>{workspaceError}</div> : null}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Owned Documents</h2>
              {documentsBusy ? <span style={styles.helperText}>Loading...</span> : null}
            </div>

            {owned.length === 0 ? (
              <div style={styles.emptyState}>No owned documents yet.</div>
            ) : (
              <div style={styles.list}>
                {owned.map((document) => (
                  <Link key={document.id} to={`/documents/${document.id}`} style={styles.linkCard}>
                    <span style={styles.linkTitle}>{document.title}</span>
                    <span style={styles.linkMeta}>Updated {formatTimestamp(document.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Shared With Me</h2>

            {shared.length === 0 ? (
              <div style={styles.emptyState}>No shared documents yet.</div>
            ) : (
              <div style={styles.list}>
                {shared.map((document) => (
                  <Link key={document.id} to={`/documents/${document.id}`} style={styles.linkCard}>
                    <span style={styles.linkTitle}>{document.title}</span>
                    <span style={styles.linkMeta}>
                      {document.role} access · updated {formatTimestamp(document.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background:
      "radial-gradient(circle at top left, rgba(13, 148, 136, 0.18), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    color: "#0f172a",
    fontFamily: "\"Segoe UI\", sans-serif"
  },
  shell: {
    maxWidth: "1200px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "20px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(148, 163, 184, 0.18)"
  },
  heading: {
    margin: 0,
    fontSize: "30px"
  },
  subheading: {
    margin: "6px 0 0",
    color: "#64748b"
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px"
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "18px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)"
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center"
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px"
  },
  helperText: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontWeight: 600,
    fontSize: "14px"
  },
  input: {
    padding: "11px 13px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    background: "#ffffff",
    color: "#0f172a"
  },
  primaryButton: {
    padding: "11px 16px",
    borderRadius: "12px",
    border: "none",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer"
  },
  secondaryButton: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer"
  },
  infoBox: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #dbeafe",
    color: "#0f172a",
    fontSize: "14px"
  },
  errorBox: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    fontSize: "14px"
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  linkCard: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    textDecoration: "none",
    color: "#0f172a"
  },
  linkTitle: {
    fontWeight: 700
  },
  linkMeta: {
    fontSize: "12px",
    color: "#64748b"
  },
  emptyState: {
    color: "#64748b",
    fontSize: "14px"
  }
};
