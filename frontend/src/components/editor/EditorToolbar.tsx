import type { Editor } from '@tiptap/react'
import { Bold, Italic, Underline, Code, List, ListOrdered, Quote, Minus, Undo, Redo, Highlighter } from 'lucide-react'

interface Props { editor: Editor | null }

export default function EditorToolbar({ editor }: Props) {
  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, title: string, icon: React.ReactNode) => (
    <button key={title} type="button" title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: active ? 'var(--primary-light)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.1s' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      {icon}
    </button>
  )

  const divider = () => <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
      {btn(false, () => editor.chain().focus().undo().run(), 'Undo', <Undo size={15} />)}
      {btn(false, () => editor.chain().focus().redo().run(), 'Redo', <Redo size={15} />)}
      {divider()}
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', <Bold size={15} />)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', <Italic size={15} />)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline', <Underline size={15} />)}
      {btn(editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight().run(), 'Highlight', <Highlighter size={15} />)}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), 'Code', <Code size={15} />)}
      {divider()}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', <List size={15} />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', <ListOrdered size={15} />)}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote', <Quote size={15} />)}
      {divider()}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), 'Divider', <Minus size={15} />)}
    </div>
  )
}
