// A "what changed since you last looked" layer for the Leave module.
//
// This is prototype scaffolding, not product UI. The Leave tickets move faster
// than anyone can re-explore eleven screens, so every spec change we apply is
// registered here once and then pinned to the exact control it affected. Turn
// the highlights off and the module looks exactly as it will ship.
//
// Registering a change is the same act as marking it, deliberately: an entry
// with no `<Mark>` anywhere is a change nobody can find, and a `<Mark>` with no
// entry will not compile.

import { useState, useSyncExternalStore } from 'react'
import { Button, Drawer, Switch, Tag, Tooltip, Typography } from 'antd'
import { CloseOutlined, ThunderboltFilled } from '@ant-design/icons'

const { Text } = Typography

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export type ChangeKind = 'new' | 'changed'

export interface LeaveChange {
  kind: ChangeKind
  /** Which screen it lands on, for grouping in the summary drawer. */
  area: string
  /** One line, in the user's terms — what is different now. */
  what: string
  /** Why, in the spec's terms — what the old behaviour was. */
  was?: string
  ticket: string
  ticketKey: string
  /** When the ticket changed, not when we built it. */
  on: string
}

export const LEAVE_CHANGES = {
  'balance-drawer': {
    kind: 'new',
    area: 'Leave Profile',
    what: 'New Leave Balance Details drawer: entitlement breakdown, month-by-month usage, and the audit trail for one leave type.',
    ticket: 'MOVE-4137',
    ticketKey: 'MOVE-4137',
    on: '17 Sep 2026',
  },
  'balance-row-click': {
    kind: 'new',
    area: 'Leave Profile',
    what: 'Click any row in Leave Balances to open its details drawer.',
    ticket: 'MOVE-4137 biz req 1',
    ticketKey: 'MOVE-4137',
    on: '17 Sep 2026',
  },
  'drawer-actions': {
    kind: 'new',
    area: 'Leave Profile',
    what: 'Edit Leave Entitlement and Leave Entitlement Change History now open from inside the balance details drawer.',
    was: 'Both sat under the page-level Actions dropdown, which had no row context.',
    ticket: 'MOVE-4137 biz req 2 · MOVE-3494 biz req 4',
    ticketKey: 'MOVE-4137',
    on: '17 Sep 2026',
  },
  'page-actions-removed': {
    kind: 'changed',
    area: 'Leave Profile',
    what: 'The page-level Actions dropdown is gone — Apply Leave is a secondary CTA beside Add Leave Entitlement.',
    was: 'Actions held Leave Entitlement Change History; the ticket has since struck that row out.',
    ticket: 'MOVE-3494 biz req 4',
    ticketKey: 'MOVE-3494',
    on: '17 Sep 2026',
  },
  'carry-forward': {
    kind: 'changed',
    area: 'Leave rules',
    what: 'Carry-forward cap now follows the leave type’s own default entitlement: Annual Leave 12 days, Annual Leave (Drivers) 2× = 14 days. Edit the default and the cap moves with it.',
    was: 'A flat 7 days for every annual-leave type.',
    ticket: 'MOVE-3900 biz req 1.2 & 2.2',
    ticketKey: 'MOVE-3900',
    on: '17 Sep 2026',
  },
  'proration': {
    kind: 'changed',
    area: 'Leave rules',
    what: 'Pro-ration counts completed months of service. A 20 Jul start is 5 completed months in that year → 5 days.',
    was: 'Part-months rounded up, so the same start date gave 6 days.',
    ticket: 'MOVE-3900 biz req 1.2',
    ticketKey: 'MOVE-3900',
    on: '17 Sep 2026',
  },
  'annual-leave-drivers': {
    kind: 'changed',
    area: 'Manage Leave Types',
    what: 'Annual Leave is auto-added to non-drivers only; drivers get Annual Leave (Drivers), now with its own full spec rather than "same as annual leave, except".',
    ticket: 'MOVE-3900 biz req 2 · MOVE-3410',
    ticketKey: 'MOVE-3900',
    on: '17 Sep 2026',
  },
  'entitlement-total': {
    kind: 'changed',
    area: 'Leave Profile',
    what: 'Annual leave rows show the total entitlement for the year — carried forward plus this year’s default.',
    ticket: 'MOVE-3494 biz req 2 → MOVE-4137 biz req 1.2',
    ticketKey: 'MOVE-4137',
    on: '17 Sep 2026',
  },
  'validity-period': {
    kind: 'changed',
    area: 'Leave Profile',
    what: 'Validity Period always shows a real date range. Manually added entitlements use the dates entered when they were added.',
    was: 'System types showed the manage-page wording ("Every calendar year"), which contradicted the ticket’s own childcare example.',
    ticket: 'MOVE-3494 biz req 2',
    ticketKey: 'MOVE-3494',
    on: '17 Sep 2026',
  },
  'balances-sort': {
    kind: 'changed',
    area: 'Leave Profile',
    what: 'Leave Balances sorts system types in the manage-page order first, then custom types by effective date, newest first.',
    was: 'Alphabetical within auto-added and manually added groups.',
    ticket: 'MOVE-3494 biz req 2',
    ticketKey: 'MOVE-3494',
    on: '10 Sep 2026',
  },
  'applications-pagination': {
    kind: 'changed',
    area: 'Leave Profile',
    what: 'Leave Applications is paginated at 10 rows per page.',
    ticket: 'MOVE-3494 biz req 3',
    ticketKey: 'MOVE-3494',
    on: '10 Sep 2026',
  },
  'apply-no-validity': {
    kind: 'changed',
    area: 'Apply Leave',
    what: 'A leave type with no validity period reads plainly as "Available: x days", with no valid-from or valid-until clause.',
    ticket: 'MOVE-3777 biz req 3.1',
    ticketKey: 'MOVE-3777',
    on: '17 Sep 2026',
  },
} satisfies Record<string, LeaveChange>

export type ChangeId = keyof typeof LEAVE_CHANGES

/** The window this batch covers, shown on the banner. */
export const CHANGE_WINDOW = '10 – 17 Sep 2026'

const jiraUrl = (key: string) => `https://westpoint.atlassian.net/browse/${key}`

// ---------------------------------------------------------------------------
// Visibility, shared across every Leave page
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'wla.leave.whatsnew'

let visible = ((): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
})()

const listeners = new Set<() => void>()

function setVisible(next: boolean) {
  visible = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // Private browsing — the toggle still works for this session.
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useHighlights(): boolean {
  return useSyncExternalStore(subscribe, () => visible, () => true)
}

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

const ACCENT = '#722ed1'
const ACCENT_BG = '#f9f0ff'
const ACCENT_BORDER = '#d3adf7'

function TipBody({ change }: { change: LeaveChange }) {
  return (
    <div style={{ maxWidth: 280 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, opacity: 0.75, marginBottom: 4 }}>
        {change.kind === 'new' ? 'NEW' : 'CHANGED'} · {change.on}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{change.what}</div>
      {change.was && (
        <div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 6, opacity: 0.8 }}>
          Previously: {change.was}
        </div>
      )}
      <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>{change.ticket}</div>
    </div>
  )
}

/**
 * An inline pill pinned to the control that changed. Renders nothing when
 * highlights are off, so no layout is reserved for it in the shipping view.
 */
export function Mark({ id, label }: { id: ChangeId; label?: string }) {
  const on = useHighlights()
  if (!on) return null
  const change = LEAVE_CHANGES[id]
  return (
    <Tooltip title={<TipBody change={change} />} placement="top" color="#2b1a45">
      <Tag
        style={{
          margin: 0,
          fontSize: 9,
          lineHeight: '15px',
          padding: '0 5px',
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: 'help',
          color: ACCENT,
          background: ACCENT_BG,
          borderColor: ACCENT_BORDER,
        }}
      >
        {label ?? (change.kind === 'new' ? 'NEW' : 'UPDATED')}
      </Tag>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// The banner and its summary drawer
// ---------------------------------------------------------------------------

const ORDER: ChangeKind[] = ['new', 'changed']

function ChangeList() {
  const entries = (Object.entries(LEAVE_CHANGES) as [ChangeId, LeaveChange][])
  const areas = [...new Set(entries.map(([, c]) => c.area))]
  return (
    <>
      {areas.map((area) => (
        <div key={area} style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>{area}</Text>
          {entries
            .filter(([, c]) => c.area === area)
            .sort((a, b) => ORDER.indexOf(a[1].kind) - ORDER.indexOf(b[1].kind))
            .map(([id, c]) => (
              <div
                key={id}
                style={{
                  border: '1px solid #f0f0f0',
                  borderLeft: `3px solid ${c.kind === 'new' ? ACCENT : ACCENT_BORDER}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Tag
                    style={{
                      margin: 0, fontSize: 9, lineHeight: '15px', padding: '0 5px', fontWeight: 700,
                      letterSpacing: 0.4, color: ACCENT, background: ACCENT_BG, borderColor: ACCENT_BORDER,
                    }}
                  >
                    {c.kind === 'new' ? 'NEW' : 'UPDATED'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>{c.on}</Text>
                </div>
                <Text style={{ fontSize: 12, display: 'block', lineHeight: 1.55 }}>{c.what}</Text>
                {c.was && (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, lineHeight: 1.5 }}>
                    Previously: {c.was}
                  </Text>
                )}
                <a
                  href={jiraUrl(c.ticketKey)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, display: 'inline-block', marginTop: 6 }}
                >
                  {c.ticket}
                </a>
              </div>
            ))}
        </div>
      ))}
    </>
  )
}

/**
 * Sits at the top of every Leave page. Says how many changes are pinned, opens
 * the full list, and turns the pins off when they get in the way.
 */
export function WhatsNewBanner() {
  const on = useHighlights()
  const [open, setOpen] = useState(false)
  const total = Object.keys(LEAVE_CHANGES).length
  const fresh = Object.values(LEAVE_CHANGES as Record<string, LeaveChange>).filter((c) => c.kind === 'new').length

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: ACCENT_BG,
          border: `1px solid ${ACCENT_BORDER}`,
          borderRadius: 10,
          padding: '8px 14px',
          marginBottom: 16,
        }}
      >
        <ThunderboltFilled style={{ color: ACCENT, fontSize: 14 }} />
        <Text style={{ fontSize: 12, color: '#391085' }}>
          <strong>{total} spec changes</strong> from Jira, {CHANGE_WINDOW}
          {fresh > 0 && <> — {fresh} of them brand new</>}. Everything affected is pinned with a badge.
        </Text>
        <div style={{ flex: 1 }} />
        <Button size="small" type="link" style={{ fontSize: 12, padding: 0, height: 'auto' }} onClick={() => setOpen(true)}>
          See all changes
        </Button>
        <Tooltip title={on ? 'Hide the badges to see the shipping view' : 'Show the change badges again'}>
          <Switch size="small" checked={on} onChange={setVisible} />
        </Tooltip>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        width={440}
        closeIcon={<CloseOutlined />}
        title={<span style={{ fontSize: 15 }}>What changed in Leave</span>}
      >
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16, lineHeight: 1.6 }}>
          Ticket updates from {CHANGE_WINDOW}, as built. Each one is badged on the screen it affects — hover a
          badge for the rule, and the old behaviour where it differed.
        </Text>
        <ChangeList />
      </Drawer>
    </>
  )
}
