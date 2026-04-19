import { useEffect, type CSSProperties } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface Props {
  content: string;
  editable: boolean;
  onChange: (value: string) => void;
  onSelectionChange: (selectedText: string) => void;
}

export default function RichTextEditor({ content, editable, onChange, onSelectionChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editor-prose"
      }
    },
    onUpdate({ editor: nextEditor }) {
      onChange(nextEditor.getHTML());
    },
    onSelectionUpdate({ editor: nextEditor }) {
      const { from, to } = nextEditor.state.selection;
      onSelectionChange(nextEditor.state.doc.textBetween(from, to, " ").trim());
    }
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== content) {
      editor.commands.setContent(content || "<p></p>", { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) {
    return <div style={styles.loading}>Loading editor...</div>;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton label="Bullet List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="Code Block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      </div>

      <div style={{ ...styles.surface, ...(editable ? null : styles.surfaceReadonly) }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToolbarButton({ label, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      style={{
        ...styles.toolbarButton,
        ...(active ? styles.toolbarButtonActive : null)
      }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  toolbar: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  toolbarButton: {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer"
  },
  toolbarButtonActive: {
    border: "1px solid #0f766e",
    background: "#ecfdf5",
    color: "#0f766e"
  },
  surface: {
    minHeight: "520px",
    padding: "18px",
    borderRadius: "18px",
    border: "1px solid #cbd5e1",
    background: "#ffffff"
  },
  surfaceReadonly: {
    background: "#f8fafc",
    color: "#475569"
  },
  loading: {
    minHeight: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "18px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#64748b"
  }
};
