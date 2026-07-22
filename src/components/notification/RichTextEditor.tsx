import { useRef, useEffect } from 'react'
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined, StrikethroughOutlined,
  OrderedListOutlined, UnorderedListOutlined, LinkOutlined,
} from '@ant-design/icons'

interface Props {
  defaultHtml: string
  onChange: (html: string) => void
}

const TOOLBAR_BUTTONS: { icon: React.ReactNode; command: string; arg?: string }[] = [
  { icon: <BoldOutlined />, command: 'bold' },
  { icon: <ItalicOutlined />, command: 'italic' },
  { icon: <UnderlineOutlined />, command: 'underline' },
  { icon: <StrikethroughOutlined />, command: 'strikeThrough' },
  { icon: <UnorderedListOutlined />, command: 'insertUnorderedList' },
  { icon: <OrderedListOutlined />, command: 'insertOrderedList' },
]

export default function RichTextEditor({ defaultHtml, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Seed content once — this is intentionally an uncontrolled editor so
  // typing doesn't fight React re-renders / lose cursor position. Parent
  // remounts this component (via key=) whenever it wants a fresh default.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = defaultHtml
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exec = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const insertLink = () => {
    const url = window.prompt('Link URL')
    if (url) exec('createLink', url)
  }

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        {TOOLBAR_BUTTONS.map((b, i) => (
          <button
            key={i}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec(b.command, b.arg) }}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'none', borderRadius: 4, cursor: 'pointer', color: '#595959', fontSize: 13,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#eee')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
          >
            {b.icon}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); insertLink() }}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'none', borderRadius: 4, cursor: 'pointer', color: '#595959', fontSize: 13,
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#eee')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
        >
          <LinkOutlined />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML) }}
        style={{ minHeight: 140, padding: 12, fontSize: 13.5, outline: 'none', lineHeight: 1.6 }}
      />
    </div>
  )
}
