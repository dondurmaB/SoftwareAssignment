import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate } from "react-router-dom";
import {
  createDocument,
  deleteDocument,
  fetchCurrentUser,
  getStoredSession,
  listDocuments,
  listPermissions,
  listVersions,
  loadDocument,
  login,
  logout,
  persistSession,
  register,
  removePermission,
  restoreVersion,
  saveDocument,
  shareDocument,
  updatePermission
} from "./api";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import DocumentWorkspacePage from "./pages/DocumentWorkspacePage";
import type {
  DocumentDto,
  DocumentPermission,
  DocumentSummary,
  DocumentVersion,
  Role,
  StoredSession
} from "./types";

type AuthMode = "login" | "register";
type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

const editableRoles: Role[] = ["owner", "editor"];
const versionRoles: Role[] = ["owner", "editor"];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const documentMatch = useMatch("/documents/:documentId");

  const [session, setSession] = useState<StoredSession | null>(() => getStoredSession());
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    username: "",
    password: ""
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [bootstrapping, setBootstrapping] = useState(Boolean(getStoredSession()));

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<DocumentDto | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Sign in to load your workspace.");
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [shareIdentifier, setShareIdentifier] = useState("");
  const [shareRole, setShareRole] = useState<"editor" | "viewer">("viewer");
  const [sharingBusy, setSharingBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [selectionText, setSelectionText] = useState("");
  const [createTitle, setCreateTitle] = useState("");

  const activeRole = currentDocument?.role;
  const canEdit = activeRole ? editableRoles.includes(activeRole) : false;
  const canManagePermissions = activeRole === "owner";
  const canSeeVersions = activeRole ? versionRoles.includes(activeRole) : false;
  const canRestoreVersion = activeRole === "owner";

  const routeDocumentId = documentMatch?.params.documentId ? Number(documentMatch.params.documentId) : null;

  useEffect(() => {
    if (!session) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;

    async function bootstrapSession() {
      try {
        const user = await fetchCurrentUser();
        if (cancelled) return;
        const activeSession = getStoredSession();
        if (!activeSession) {
          persistSession(null);
          setSession(null);
          return;
        }

        const nextSession: StoredSession = {
          accessToken: activeSession.accessToken,
          refreshToken: activeSession.refreshToken,
          user
        };

        persistSession(nextSession);
        setSession(nextSession);
      } catch {
        if (cancelled) return;
        persistSession(null);
        setSession(null);
        setStatusMessage("Your previous session expired. Please sign in again.");
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setDocuments([]);
      setCurrentDocument(null);
      setPermissions([]);
      setVersions([]);
      return;
    }

    void refreshDocuments();
  }, [session]);

  useEffect(() => {
    if (!currentDocument || !canEdit || !dirty) return;

    setAutosaveState("pending");
    const timer = window.setTimeout(() => {
      void handleSaveDocument("autosave");
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [draftTitle, draftContent, currentDocument?.id, canEdit, dirty]);

  useEffect(() => {
    if (!session || routeDocumentId === null || Number.isNaN(routeDocumentId)) return;
    if (currentDocument?.id === routeDocumentId) return;
    void loadWorkspaceDocument(routeDocumentId);
  }, [session, routeDocumentId]);

  useEffect(() => {
    if (!bootstrapping && !session && location.pathname !== "/auth") {
      navigate("/auth", { replace: true });
    }

    if (!bootstrapping && session && location.pathname === "/auth") {
      navigate("/", { replace: true });
    }
  }, [bootstrapping, session, location.pathname, navigate]);

  const documentsByRole = useMemo(() => {
    const owned = documents.filter((document) => document.role === "owner");
    const shared = documents.filter((document) => document.role !== "owner");
    return { owned, shared };
  }, [documents]);

  function resetEditorFromDocument(document: DocumentDto): void {
    setCurrentDocument(document);
    setDraftTitle(document.title);
    setDraftContent(document.currentContent);
    setDirty(false);
    setAutosaveState("idle");
    setSelectionText("");
    setWorkspaceError("");
  }

  function mergeDocumentIntoList(nextDocument: DocumentDto): void {
    setDocuments((current) => {
      const nextSummary: DocumentSummary = {
        id: nextDocument.id,
        title: nextDocument.title,
        ownerUserId: nextDocument.ownerUserId,
        createdAt: nextDocument.createdAt,
        updatedAt: nextDocument.updatedAt,
        role: nextDocument.role
      };

      const remaining = current.filter((item) => item.id !== nextDocument.id);
      return [nextSummary, ...remaining].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  }

  async function refreshDocuments(): Promise<void> {
    setDocumentsBusy(true);
    setWorkspaceError("");

    try {
      const nextDocuments = await listDocuments();
      setDocuments(nextDocuments);
      if (nextDocuments.length === 0) {
        setStatusMessage("No documents yet. Create your first document.");
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to load documents.");
    } finally {
      setDocumentsBusy(false);
    }
  }

  async function loadWorkspaceDocument(documentId: number): Promise<void> {
    setDocumentBusy(true);
    setWorkspaceError("");

    try {
      const document = await loadDocument(documentId);
      resetEditorFromDocument(document);
      mergeDocumentIntoList(document);
      setStatusMessage(`Opened "${document.title}".`);

      if (versionRoles.includes(document.role)) {
        setHistoryBusy(true);
        try {
          const [nextVersions, nextPermissions] = await Promise.all([
            listVersions(document.id),
            document.role === "owner" ? listPermissions(document.id) : Promise.resolve([])
          ]);
          setVersions(nextVersions);
          setPermissions(nextPermissions);
        } finally {
          setHistoryBusy(false);
        }
      } else {
        setVersions([]);
        setPermissions([]);
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to open the document.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");

    try {
      const response =
        authMode === "register"
          ? await register({
              email: authForm.email.trim(),
              username: authForm.username.trim(),
              password: authForm.password
            })
          : await login({
              email: authForm.email.trim(),
              password: authForm.password
            });

      const nextSession: StoredSession = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user
      };

      persistSession(nextSession);
      setSession(nextSession);
      setAuthForm({ email: "", username: "", password: "" });
      setStatusMessage(authMode === "register" ? "Account created." : "Signed in.");
      navigate("/", { replace: true });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    setDocumentBusy(true);

    try {
      await logout();
      setSession(null);
      setCurrentDocument(null);
      setPermissions([]);
      setVersions([]);
      setDraftTitle("");
      setDraftContent("");
      setCreateTitle("");
      setAuthError("");
      setWorkspaceError("");
      setStatusMessage("Signed out.");
      navigate("/auth", { replace: true });
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to sign out.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleCreateDocument(fromDashboard = false): Promise<void> {
    const title = fromDashboard ? createTitle.trim() : draftTitle.trim();
    if (!title) {
      setWorkspaceError("Add a document title before creating it.");
      return;
    }

    setDocumentBusy(true);
    setWorkspaceError("");

    try {
      const document = await createDocument({
        title,
        content: fromDashboard ? "<p></p>" : draftContent
      });

      setCreateTitle("");
      resetEditorFromDocument(document);
      mergeDocumentIntoList(document);
      setVersions([]);
      setPermissions([]);
      setStatusMessage(`Created "${document.title}".`);
      navigate(`/documents/${document.id}`);
      await loadWorkspaceDocument(document.id);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to create the document.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleSaveDocument(mode: "manual" | "autosave"): Promise<void> {
    if (!currentDocument) {
      setWorkspaceError("Open a document before saving.");
      return;
    }

    if (!canEdit) {
      setWorkspaceError("You only have read access to this document.");
      return;
    }

    if (!draftTitle.trim()) {
      setWorkspaceError("Document title cannot be empty.");
      return;
    }

    if (mode === "manual") {
      setDocumentBusy(true);
    } else {
      setAutosaveState("saving");
    }

    try {
      const savedDocument = await saveDocument(currentDocument.id, {
        title: draftTitle.trim(),
        content: draftContent,
        saveType: mode
      });

      resetEditorFromDocument(savedDocument);
      mergeDocumentIntoList(savedDocument);
      setStatusMessage(mode === "manual" ? `Saved "${savedDocument.title}".` : "Autosave complete.");
      setAutosaveState("saved");

      if (canSeeVersions) {
        setVersions(await listVersions(savedDocument.id));
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to save the document.");
      setAutosaveState("error");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleDeleteDocument(): Promise<void> {
    if (!currentDocument || currentDocument.role !== "owner") return;
    const confirmed = window.confirm(`Delete "${currentDocument.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDocumentBusy(true);

    try {
      await deleteDocument(currentDocument.id);
      setDocuments((current) => current.filter((item) => item.id !== currentDocument.id));
      setCurrentDocument(null);
      setDraftTitle("");
      setDraftContent("");
      setPermissions([]);
      setVersions([]);
      setDirty(false);
      setStatusMessage(`Deleted "${currentDocument.title}".`);
      navigate("/");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to delete the document.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleShareDocument(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!currentDocument) return;

    setSharingBusy(true);
    setWorkspaceError("");

    try {
      await shareDocument({
        documentId: currentDocument.id,
        identifier: shareIdentifier.trim(),
        role: shareRole
      });
      setShareIdentifier("");
      setPermissions(await listPermissions(currentDocument.id));
      setStatusMessage("Access updated.");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to share the document.");
    } finally {
      setSharingBusy(false);
    }
  }

  async function handlePermissionRoleChange(userId: number, role: "editor" | "viewer"): Promise<void> {
    if (!currentDocument) return;

    setSharingBusy(true);

    try {
      await updatePermission({ documentId: currentDocument.id, userId, role });
      setPermissions(await listPermissions(currentDocument.id));
      setStatusMessage("Permission updated.");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to update the role.");
    } finally {
      setSharingBusy(false);
    }
  }

  async function handleRemovePermission(userId: number): Promise<void> {
    if (!currentDocument) return;

    setSharingBusy(true);

    try {
      await removePermission(currentDocument.id, userId);
      setPermissions(await listPermissions(currentDocument.id));
      setStatusMessage("Access removed.");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to remove access.");
    } finally {
      setSharingBusy(false);
    }
  }

  async function handleRestoreVersion(versionId: number): Promise<void> {
    if (!currentDocument || !canRestoreVersion) return;

    setHistoryBusy(true);

    try {
      const restored = await restoreVersion(currentDocument.id, versionId);
      const refreshedDocument = await loadDocument(currentDocument.id);
      resetEditorFromDocument(refreshedDocument);
      mergeDocumentIntoList(refreshedDocument);
      setVersions(await listVersions(currentDocument.id));
      setStatusMessage(`Restored version ${restored.newVersionNumber}.`);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to restore the version.");
    } finally {
      setHistoryBusy(false);
    }
  }

  const autosaveLabel = renderAutosaveLabel(autosaveState, dirty);

  if (bootstrapping) {
    return <BootScreen />;
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <AuthPage
            authMode={authMode}
            authBusy={authBusy}
            authError={authError}
            statusMessage={statusMessage}
            email={authForm.email}
            username={authForm.username}
            password={authForm.password}
            onModeChange={setAuthMode}
            onEmailChange={(value) => setAuthForm((current) => ({ ...current, email: value }))}
            onUsernameChange={(value) => setAuthForm((current) => ({ ...current, username: value }))}
            onPasswordChange={(value) => setAuthForm((current) => ({ ...current, password: value }))}
            onSubmit={(event) => void handleAuthSubmit(event)}
          />
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute session={session}>
            {session ? (
              <DashboardPage
                user={session.user}
                documentsBusy={documentsBusy}
                createTitle={createTitle}
                createBusy={documentBusy}
                statusMessage={statusMessage}
                workspaceError={workspaceError}
                owned={documentsByRole.owned}
                shared={documentsByRole.shared}
                onCreateTitleChange={setCreateTitle}
                onCreateDocument={() => void handleCreateDocument(true)}
                onRefresh={() => void refreshDocuments()}
                onLogout={() => void handleSignOut()}
              />
            ) : (
              <Navigate to="/auth" replace />
            )}
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents/:documentId"
        element={
          <ProtectedRoute session={session}>
            {session ? (
              <DocumentWorkspacePage
                user={session.user}
                currentDocument={currentDocument}
                draftTitle={draftTitle}
                draftContent={draftContent}
                canEdit={canEdit}
                canManagePermissions={canManagePermissions}
                canSeeVersions={canSeeVersions}
                canRestoreVersion={canRestoreVersion}
                documentBusy={documentBusy}
                historyBusy={historyBusy}
                sharingBusy={sharingBusy}
                statusMessage={statusMessage}
                workspaceError={workspaceError}
                autosaveLabel={autosaveLabel}
                permissions={permissions}
                versions={versions}
                shareIdentifier={shareIdentifier}
                shareRole={shareRole}
                selectionText={selectionText}
                onDraftTitleChange={(value) => {
                  setDraftTitle(value);
                  if (currentDocument) setDirty(true);
                }}
                onDraftContentChange={(value) => {
                  setDraftContent(value);
                  if (currentDocument) setDirty(true);
                }}
                onSelectionChange={setSelectionText}
                onSave={() => void handleSaveDocument("manual")}
                onDelete={() => void handleDeleteDocument()}
                onLogout={() => void handleSignOut()}
                onShareIdentifierChange={setShareIdentifier}
                onShareRoleChange={setShareRole}
                onShareSubmit={(event) => void handleShareDocument(event)}
                onPermissionRoleChange={(userId, role) => void handlePermissionRoleChange(userId, role)}
                onRemovePermission={(userId) => void handleRemovePermission(userId)}
                onRestoreVersion={(versionId) => void handleRestoreVersion(versionId)}
              />
            ) : (
              <Navigate to="/auth" replace />
            )}
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={session ? "/" : "/auth"} replace />} />
    </Routes>
  );
}

function ProtectedRoute({
  session,
  children
}: {
  session: StoredSession | null;
  children: JSX.Element;
}) {
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function BootScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "\"Segoe UI\", sans-serif",
        background:
          "radial-gradient(circle at top left, rgba(13, 148, 136, 0.18), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)"
      }}
    >
      <section
        style={{
          maxWidth: "560px",
          padding: "32px",
          background: "rgba(255,255,255,0.95)",
          borderRadius: "20px",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
        }}
      >
        <h1 style={{ margin: 0, fontSize: "34px" }}>Restoring Session</h1>
        <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.6 }}>
          Checking saved credentials and loading your workspace.
        </p>
      </section>
    </main>
  );
}

function renderAutosaveLabel(state: AutosaveState, dirty: boolean): string {
  if (state === "saving") return "saving";
  if (state === "pending") return "pending";
  if (state === "saved") return "saved";
  if (state === "error") return "failed";
  return dirty ? "unsaved changes" : "idle";
}
