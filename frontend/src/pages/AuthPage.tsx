import type { CSSProperties, FormEvent } from "react";

type AuthMode = "login" | "register";

interface Props {
  authMode: AuthMode;
  authBusy: boolean;
  authError: string;
  statusMessage: string;
  email: string;
  username: string;
  password: string;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function AuthPage(props: Props) {
  const {
    authMode,
    authBusy,
    authError,
    statusMessage,
    email,
    username,
    password,
    onModeChange,
    onEmailChange,
    onUsernameChange,
    onPasswordChange,
    onSubmit
  } = props;

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.heading}>Collaborative Document Editor</h1>
          <p style={styles.subheading}>
            Sign in to access protected documents, sharing controls, autosave, and version history.
          </p>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(authMode === "login" ? styles.tabActive : null) }}
            onClick={() => onModeChange("login")}
            type="button"
          >
            Login
          </button>
          <button
            style={{ ...styles.tab, ...(authMode === "register" ? styles.tabActive : null) }}
            onClick={() => onModeChange("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <form style={styles.form} onSubmit={onSubmit}>
          <label style={styles.label}>
            Email
            <input style={styles.input} type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required />
          </label>

          {authMode === "register" ? (
            <label style={styles.label}>
              Username
              <input style={styles.input} value={username} onChange={(event) => onUsernameChange(event.target.value)} required />
            </label>
          ) : null}

          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
            />
          </label>

          <button style={styles.primaryButton} type="submit" disabled={authBusy}>
            {authBusy ? "Working..." : authMode === "register" ? "Create Account" : "Sign In"}
          </button>
        </form>

        {authError ? <div style={styles.errorBox}>{authError}</div> : null}
        <div style={styles.infoBox}>{statusMessage}</div>
      </section>
    </main>
  );
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
  card: {
    maxWidth: "560px",
    margin: "48px auto",
    padding: "32px",
    background: "rgba(255,255,255,0.96)",
    borderRadius: "24px",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  heading: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.05
  },
  subheading: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6
  },
  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px"
  },
  tab: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 600,
    cursor: "pointer"
  },
  tabActive: {
    background: "#0f766e",
    color: "#ffffff",
    border: "1px solid #0f766e"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px"
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
  }
};
