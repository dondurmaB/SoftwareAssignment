import React, { useMemo, useState } from "react";

interface EditorLike {
  state: {
    selection: {
      from: number;
      to: number;
    };
    doc: {
      textBetween: (from: number, to: number, separator: string) => string;
    };
  };
}

interface Props {
  editor: EditorLike | null;
  docId: string;
  onClose: () => void;
  canEdit: boolean;
}

type Feature = "rewrite" | "summarize" | "translate" | "enhance" | "grammar" | "custom";

const FEATURES: { value: Feature; label: string; desc: string }[] = [
  { value: "rewrite", label: "Rewrite", desc: "Improve clarity and flow" },
  { value: "summarize", label: "Summarize", desc: "Create a concise summary" },
  { value: "translate", label: "Translate", desc: "Translate to another language" },
  { value: "enhance", label: "Enhance", desc: "Improve structure and style" },
  { value: "grammar", label: "Fix Grammar", desc: "Correct grammar and spelling" },
  { value: "custom", label: "Custom Prompt", desc: "Give a custom instruction" }
];

export default function AIPanel({ editor, docId, onClose, canEdit }: Props) {
  const [feature, setFeature] = useState<Feature>("rewrite");
  const [tone, setTone] = useState("professional");
  const [summaryLength, setSummaryLength] = useState("medium");
  const [targetLang, setTargetLang] = useState("French");
  const [customInstruction, setCustomInstruction] = useState("");
  const [phase, setPhase] = useState<"configure" | "result">("configure");
  const [mockSuggestion, setMockSuggestion] = useState("");

  const selectedText = useMemo(() => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ");
  }, [editor]);

  function buildMockSuggestion() {
    switch (feature) {
      case "rewrite":
        return `Rewritten (${tone}): ${selectedText || "Sample rewritten text preview."}`;
      case "summarize":
        return `Summary (${summaryLength}): ${selectedText || "Sample summary preview."}`;
      case "translate":
        return `Translated to ${targetLang}: ${selectedText || "Sample translated preview."}`;
      case "enhance":
        return `Enhanced version: ${selectedText || "Sample enhanced preview."}`;
      case "grammar":
        return `Grammar-fixed version: ${selectedText || "Sample corrected preview."}`;
      case "custom":
        return `Custom instruction "${customInstruction || "No instruction"}": ${selectedText || "Sample custom preview."}`;
      default:
        return "Sample AI output preview.";
    }
  }

  function handleRun() {
    if (!canEdit || !docId.trim()) return;
    setMockSuggestion(buildMockSuggestion());
    setPhase("result");
  }

  function handleAccept() {
    setPhase("configure");
  }

  function handleReject() {
    setMockSuggestion("");
    setPhase("configure");
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.badge}>AI</span>
          <h3 style={styles.heading}>AI Writing Assistant</h3>
        </div>

        <button style={styles.iconButton} onClick={onClose} aria-label="Close AI panel">
          ×
        </button>
      </div>

      <div style={styles.body}>
        <div style={styles.warningBox}>
          <strong>Stabilized placeholder.</strong> This panel preserves the frontend flow for now, but full AI
          integration still depends on the backend contract and editor wiring.
        </div>

        {!canEdit && (
          <div style={styles.warningBox}>
            Viewers cannot use the AI assistant.
          </div>
        )}

        {!editor && (
          <div style={styles.warningBox}>
            AI panel is integrated for frontend demonstration. Full editor integration is in progress.
          </div>
        )}

        {!docId.trim() && (
          <div style={styles.warningBox}>
            Create or load a document first so the AI panel can attach to a document context.
          </div>
        )}

        {phase === "configure" && (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Feature</label>
              <div style={styles.featureList}>
                {FEATURES.map((item) => (
                  <label
                    key={item.value}
                    style={{
                      ...styles.featureCard,
                      ...(feature === item.value ? styles.featureCardActive : {})
                    }}
                  >
                    <input
                      type="radio"
                      name="feature"
                      value={item.value}
                      checked={feature === item.value}
                      onChange={() => setFeature(item.value)}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={styles.featureTitle}>{item.label}</div>
                      <div style={styles.featureDesc}>{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {feature === "rewrite" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Tone</label>
                <select style={styles.input} value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="professional">Professional</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                  <option value="friendly">Friendly</option>
                  <option value="academic">Academic</option>
                </select>
              </div>
            )}

            {feature === "summarize" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Summary length</label>
                <select style={styles.input} value={summaryLength} onChange={(e) => setSummaryLength(e.target.value)}>
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
            )}

            {feature === "translate" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Target language</label>
                <select style={styles.input} value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  {["French", "Spanish", "German", "Italian", "Arabic"].map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {feature === "custom" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Instruction</label>
                <textarea
                  style={styles.textareaSmall}
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="Enter your custom instruction"
                  rows={3}
                />
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Selected text</label>
              <div style={styles.previewBox}>
                {selectedText || "Selected text will appear here once connected to the rich-text editor."}
              </div>
            </div>

            <button
              style={{
                ...styles.primaryButton,
                ...(!canEdit || !docId.trim() ? styles.disabledButton : {})
              }}
              onClick={handleRun}
              disabled={!canEdit || !docId.trim()}
            >
              Run AI
            </button>
          </>
        )}

        {phase === "result" && (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Original text</label>
              <div style={styles.previewBox}>
                {selectedText || "(No selected text in this screen yet)"}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>AI Suggestion</label>
              <textarea
                style={styles.textareaLarge}
                value={mockSuggestion}
                onChange={(e) => setMockSuggestion(e.target.value)}
                rows={8}
              />
            </div>

            <div style={styles.actionColumn}>
              <button style={styles.primaryButton} onClick={handleAccept}>
                Accept & Apply
              </button>

              <button style={styles.secondaryButton} onClick={handleReject}>
                Reject
              </button>

              <button style={styles.ghostButton} onClick={() => setPhase("configure")}>
                Try different feature
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb"
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "28px",
    height: "24px",
    borderRadius: "999px",
    background: "#ecfdf5",
    color: "#0f766e",
    fontSize: "12px",
    fontWeight: 700,
    padding: "0 8px"
  },
  heading: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  label: {
    fontSize: "13px",
    fontWeight: 600
  },
  input: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    background: "#ffffff"
  },
  textareaSmall: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    background: "#ffffff",
    resize: "vertical",
    fontFamily: "inherit"
  },
  textareaLarge: {
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    lineHeight: 1.7,
    resize: "vertical",
    fontFamily: "inherit",
    background: "#ffffff"
  },
  previewBox: {
    background: "#f8fafc",
    padding: "10px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    lineHeight: 1.6,
    maxHeight: "120px",
    overflowY: "auto",
    color: "#111827"
  },
  warningBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#6b7280"
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  featureCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer"
  },
  featureCardActive: {
    border: "1px solid #0f766e",
    background: "#ecfdf5"
  },
  featureTitle: {
    fontSize: "13px",
    fontWeight: 500
  },
  featureDesc: {
    fontSize: "12px",
    color: "#6b7280"
  },
  actionColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
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
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#1f2937",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer"
  },
  ghostButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "8px 12px",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    cursor: "pointer"
  },
  iconButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px"
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed"
  }
};
