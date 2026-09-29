// ATOM Business Component — "Tab / Tab Group"
// Figma: https://www.figma.com/design/ZpEYnJ4POb86CDMAM3BWCG/%F0%9F%92%8E-ATOM---Business-Component?node-id=424-16506
//
// This component's own Code Connect note maps it to AntD's `Anchor`
// (`direction="horizontal"`), not `Tabs` — that is why every tab item carries
// its own full-height underline segment (colored when active, a faint
// `rgba(0,0,0,0.06)` line otherwise) instead of Tabs' single shared baseline
// and sliding ink bar. Per FIGMA_DESIGN_SYSTEM.md's maintenance rule: use
// this component for any page-level top tab bar, rather than AntD `Tabs`
// directly, and update that doc's component-mapping table if this drifts.
//
// Anchor is built for in-page scrollspy navigation, so this wraps it to
// behave like ordinary content-switching tabs: clicks are intercepted
// (preventDefault, so the browser never jumps to a `#hash`) and turned into
// a controlled `activeKey` the caller owns and renders panels from — the
// same shape as AntD `Tabs`' `items`/`activeKey`/`onChange`, so swapping one
// for the other at a callsite is a small, mechanical change.

import { Anchor, Badge, Card, Space } from 'antd'

export interface PageTabItem {
  key: string
  label: string
  /** Renders the same round `Badge` counter the Figma component's "counter" variant shows. */
  count?: number
}

export default function PageTabs({
  items,
  activeKey,
  onChange,
}: {
  items: PageTabItem[]
  activeKey: string
  onChange: (key: string) => void
}) {
  return (
    <Card
      className="page-tabs"
      styles={{ body: { padding: '0 8px' } }}
      style={{ marginBottom: 16, borderRadius: 10 }}
    >
      {/* Scoped override, same pattern already used in LeavePage.tsx. Anchor's
          own baseline (`::before`) and sliding active-segment (`.ant-anchor-ink`,
          which computes its `left`/`width` from the active link's own layout)
          are exactly the Figma component's underline behaviour and are left
          alone — the one real deviation from stock Anchor is that its links
          size to content and left-align, where Figma stretches them to fill
          the bar in equal-width segments, so only that gets overridden. */}
      <style>{`
        .page-tabs .ant-anchor-link { flex: 1 0 0; min-width: 0; text-align: center; padding-inline: 24px; }
        .page-tabs .ant-anchor-link-title { white-space: nowrap; }
      `}</style>
      <Anchor
        direction="horizontal"
        affix={false}
        // This antd version has no controlled `currentAnchor` prop — forcing
        // the highlighted link through `getCurrentAnchor` (which normally
        // just lets scroll-computed links be renamed) works the same way,
        // since there's nothing on the page for its scrollspy to find anyway.
        getCurrentAnchor={() => `#${activeKey}`}
        onClick={(e, link) => {
          e.preventDefault()
          onChange(link.href.replace('#', ''))
        }}
        items={items.map((item) => ({
          key: item.key,
          href: `#${item.key}`,
          title: item.count !== undefined ? (
            <Space size={8}>
              {item.label}
              <Badge count={item.count} />
            </Space>
          ) : (
            item.label
          ),
        }))}
      />
    </Card>
  )
}
