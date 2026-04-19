import type { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import RichTextEditor from "../components/editor/RichTextEditor";
import type { DocumentDto, DocumentPermission, DocumentVersion, User } from "../types";

interface Props {
  user: User;
  currentDocument: DocumentDto | null;
  draftTitle: string;
  draftContent: string;
  canEdit: boolean;
  canManagePermissions: boolean;
  canSeeVersions: boolean;
  canRestoreVersion: boolean;
  documentBusy: boolean;
  historyBusy: boolean;
  sharingBusy: boolean;
  statusMessage: string;
  workspaceError: string;
  autosaveLabel: string;
  permissions: DocumentPermission[];
  versions: DocumentVersion[];
  shareIdentifier: string;
  shareRole: "editor" | "viewer";
  selectionText: string;
  onDraftTitleChange: (value: string) => void;
  onDraftContentChange: (value: string) => void;
  onSelectionChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onLogout: () => void;
  onShareIdentifierChange: (value: string) => void;
  onShareRoleChange: (value: "editor" | "viewer") => void;
  onShareSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPermissionRoleChange: (userId: number, role: "editor" | "viewer") => void;
  onRemovePermission: (userId: number) => void;
  onRestoreVersion: (versionId: number) => void;
}

export default function DocumentWorkspacePage(props: Props) {
  const {
    user,
    currentDocument,
    draftTitle,
    draftContent,
    canEdit,
    canManagePermissions,
    canSeeVersions,
    canRestoreVersion,
    documentBusy,
    historyBusy,
    sharingBusy,
    statusMessage,
    workspaceError,
    autosaveLabel,
    permissions,
    versions,
    shareIdentifier,
    shareRole,
    selectionText,
    onDraftTitleChange,
    onDraftContentChange,
    onSelectionChange,
    onSave,
    onDelete,
    onLogout,
    onShareIdentifierChange,
    onShareRoleChange,
    onShareSubmit,
    onPermissionRoleChange,
    onRemovePermission,
    onRestoreVersion
  } = props;

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.topBar}>
          <div>
            <div style={styles.breadcrumbs}>
              <Link to="/" style={styles.backLink}>
                Dashboard
              </Link>
              <span>/</span>
              <span>{currentDocument?.title ?? "Document"}</span>
            </div>
            <h1 style={styles.heading}>{currentDocument ? currentDocument.title : "Open a document"}</h1>
            <p style={styles.subheading}>
              {currentDocument
                ? `Signed in as ${user.username} · role: ${currentDocument.role}`
                : "Choose a document from the dashboard to begin editing."}
            </p>
          </div>

          <div style={styles.actions}>
            <button style={styles.secondaryButton} type="button" onClick={onLogout}>
              Logout
            </button>
            <button style={styles.primaryButton} type="button" onClick={onSave} disabled={!currentDocument || !canEdit || documentBusy}>
              Save Now
            </button>
            <button
              style={styles.dangerButton}
              type="button"
              onClick={onDelete}
              disabled={!currentDocument || currentDocument.role !== "owner" || documentBusy}
            >
              Delete
            </button>
          </div>
        </header>

        <div style={styles.statusRow}>
          <div style={styles.infoBox}>{statusMessage}</div>
          <div style={styles.infoBox}>Autosave: {autosaveLabel}</div>
        </div>

        {workspaceError ? <div style={styles.errorBox}>{workspaceError}</div> : null}

        <div style={styles.grid}>
          <section style={styles.editorCard}>
            <label style={styles.label}>
              Title
              <input
                style={styles.input}
                value={draftTitle}
                onChange={(event) => onDraftTitleChange(event.target.value)}
                disabled={!currentDocument || !canEdit}
              />
            </label>

            <RichTextEditor
              content={draftContent}
              editable={Boolean(currentDocument && canEdit)}
              onChange={onDraftContentChange}
              onSelectionChange={onSelectionChange}
            />
          </section>

          <aside style={styles.sidePanels}>
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Sharing</h2>
                <span style={styles.helperText}>{canManagePermissions ? "Owner controls" : "Read only"}</span>
              </div>

              {!currentDocument ? (
                <div style={styles.emptyState}>Open a document to manage access.</div>
              ) : canManagePermissions ? (
                <>
                  <form style={styles.form} onSubmit={onShareSubmit}>
                    <label style={styles.label}>
                      Email or username
                      <input
                        style={styles.input}
                        value={shareIdentifier}
                        onChange={(event) => onShareIdentifierChange(event.target.value)}
                        placeholder="collab@example.com"
                        required
                      />
                    </label>

                    <label style={styles.label}>
                      Role
                      <select
                        style={styles.input}
                        value={shareRole}
                        onChange={(event) => onShareRoleChange(event.target.value as "editor" | "viewer")}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                    </label>

                    <button style={styles.primaryButton} type="submit" disabled={sharingBusy}>
                      Share Document
                    </button>
                  </form>

                  <div style={styles.list}>
                    {permissions.map((permission) => (
                      <div key={permission.userId} style={styles.row}>
                        <div>
                          <div style={styles.rowTitle}>{permission.username}</div>
                          <div style={styles.rowMeta}>{permission.email}</div>
                        </div>

                        {permission.role === "owner" ? (
                          <span style={styles.roleBadge}>owner</span>
                        ) : (
                          <div style={styles.inlineActions}>
                            <select
                              style={styles.smallSelect}
                              value={permission.role}
                              onChange={(event) =>
                                onPermissionRoleChange(permission.userId, event.target.value as "editor" | "viewer")
                              }
                            >
                              <option value="viewer">viewer</option>
                              <option value="editor">editor</option>
                            </select>
                            <button style={styles.ghostButton} type="button" onClick={() => onRemovePermission(permission.userId)}>
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={styles.emptyState}>Only the owner can change document access.</div>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Version History</h2>
                <span style={styles.helperText}>{historyBusy ? "Syncing..." : `${versions.length} versions`}</span>
              </div>

              {!currentDocument ? (
                <div style={styles.emptyState}>Open a document to inspect versions.</div>
              ) : !canSeeVersions ? (
                <div style={styles.emptyState}>Viewers cannot access version history.</div>
              ) : versions.length === 0 ? (
                <div style={styles.emptyState}>No versions available yet.</div>
              ) : (
                <div style={styles.list}>
                  {versions.map((version) => (
                    <div key={version.id} style={styles.row}>
                      <div>
                        <div style={styles.rowTitle}>
                          Version {version.versionNumber} {version.isCurrent ? "(current)" : ""}
                        </div>
                        <div style={styles.rowMeta}>Saved {formatTimestamp(version.createdAt)}</div>
                      </div>
                      <button
                        style={styles.secondaryButton}
                        type="button"
                        onClick={() => onRestoreVersion(version.id)}
                        disabled={!canRestoreVersion || version.isCurrent || historyBusy}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>AI Assistant</h2>
                <span style={styles.helperText}>Backend contract pending</span>
              </div>

              <div style={styles.placeholder}>
                <strong>Selected text:</strong>
                <div style={styles.selection}>{selectionText || "Select text in the editor to prepare AI actions."}</div>
              </div>
            </section>
          </aside>
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
    maxWidth: "1500px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "20px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(148, 163, 184, 0.18)"
  },
  breadcrumbs: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "10px"
  },
  backLink: {
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 700
  },
  heading: {
    margin: 0,
    fontSize: "28px"
  },
  subheading: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px"
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap"
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
  ghostButton: {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "#0f766e",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer"
  },
  dangerButton: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer"
  },
  statusRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px"
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
    alignItems: "start"
  },
  editorCard: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "20px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.97)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)"
  },
  sidePanels: {
    display: "flex",
    flexDirection: "column",
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
    gap: "12px",
    alignItems: "center"
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px"
  },
  helperText: {
    color: "#64748b",
    fontSize: "13px"
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
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px"
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    padding: "12px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  rowTitle: {
    fontSize: "14px",
    fontWeight: 700
  },
  rowMeta: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px"
  },
  roleBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 700
  },
  inlineActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  smallSelect: {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#ffffff"
  },
  emptyState: {
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6
  },
  placeholder: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px dashed #cbd5e1",
    background: "#ffffff",
    color: "#475569",
    lineHeight: 1.6,
    fontSize: "14px"
  },
  selection: {
    marginTop: "10px",
    fontStyle: "italic"
  }
};
