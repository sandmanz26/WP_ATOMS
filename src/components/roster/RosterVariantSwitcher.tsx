// Floating variant switcher for Roster 4.0 — a demo/exploration tool, not a
// PRD feature. Follows the same draggable/collapsible pattern as
// notification/StatusSwitcher.tsx so both behave the same way in a demo.
//
// Lets a presenter try calendar display options live:
//   variant 1 — calendar style (4 densities)
//   variant 2 — freeze the weekday header row or let it scroll away
//   variant 3 — whether the legend shows at all, and whether it filters
//   variant 4 — how much contrast the drawer's shift picker carries
//   variant 5 — where On Leave staff appear in the drawer
//   variant 6 — how the Edit Roster drawer lays its employees out

import { useEffect, useRef, useState } from 'react'
import { Segmented, Switch, Typography } from 'antd'
import { ControlOutlined, CloseOutlined, HolderOutlined } from '@ant-design/icons'

const { Text } = Typography

export type CalendarStyle = 'comfortable' | 'compact' | 'chips' | 'detailed'
export type ShiftContrast = 'strong' | 'subtle'
export type OnLeaveDisplay = 'inline' | 'section'
export type LegendMode = 'hidden' | 'filters' | 'plain'
export type DrawerLayout = 'table' | 'grouped' | 'stacked'

export interface RosterVariantState {
  calendarStyle: CalendarStyle
  freezeDayNames: boolean
  legendMode: LegendMode
  shiftContrast: ShiftContrast
  onLeaveDisplay: OnLeaveDisplay
  drawerLayout: DrawerLayout
}

export const DEFAULT_VARIANTS: RosterVariantState = {
  calendarStyle: 'comfortable',
  freezeDayNames: true,
  // Feedback 2 removed the legend from the page; the two older behaviours stay
  // reachable here so they can still be compared.
  legendMode: 'hidden',
  shiftContrast: 'strong',
  onLeaveDisplay: 'inline',
  // Feedback 1 — the stacked drawer ran too long, so a table is the default now.
  drawerLayout: 'table',
}

export const LEGEND_MODE_OPTIONS: { value: LegendMode; label: string; hint: string }[] = [
  { value: 'hidden', label: 'Hidden', hint: 'No legend above the calendar — the bar colours carry their own labels.' },
  { value: 'filters', label: 'Filters', hint: 'Legend is shown, and clicking a chip hides that group in every day cell.' },
  { value: 'plain', label: 'Plain', hint: 'Legend is shown as a plain colour key, with no filtering.' },
]

export const DRAWER_LAYOUT_OPTIONS: { value: DrawerLayout; label: string; hint: string }[] = [
  { value: 'table', label: 'Table', hint: 'One row per employee across fixed columns. Roughly half the height of the stacked list.' },
  { value: 'grouped', label: 'Grouped table', hint: 'The same table, split into sections by shift with a count on each — for scanning who is on what.' },
  { value: 'stacked', label: 'Stacked cards', hint: 'The original layout — each employee is a block with its controls underneath.' },
]

export const SHIFT_CONTRAST_OPTIONS: { value: ShiftContrast; label: string; hint: string }[] = [
  { value: 'strong', label: 'Strong', hint: 'Selected shift is a solid fill, so it holds up next to the Standby checkbox.' },
  { value: 'subtle', label: 'Subtle', hint: 'The original look — selected shift is a raised white tile.' },
]

export const ON_LEAVE_DISPLAY_OPTIONS: { value: OnLeaveDisplay; label: string; hint: string }[] = [
  { value: 'inline', label: 'In the list', hint: 'On Leave staff sit in the main list with their shift shown but disabled, so ops can see which shift they were on.' },
  { value: 'section', label: 'Separate section', hint: 'The original layout — On Leave staff are chips in their own box above the list.' },
]

export const CALENDAR_STYLE_OPTIONS: { value: CalendarStyle; label: string; hint: string }[] = [
  { value: 'comfortable', label: 'Comfortable', hint: 'Full-width bars with group name and count.' },
  { value: 'compact', label: 'Compact', hint: 'Same bars, tighter rows — a full month fits without scrolling.' },
  { value: 'chips', label: 'Chips', hint: 'Groups collapse to inline mini chips. The densest option.' },
  { value: 'detailed', label: 'Detailed', hint: 'Bars plus the staff names in each group, no click needed.' },
]

/** Cell metrics per style, consumed by the calendar. */
export const CALENDAR_STYLE_METRICS: Record<
  CalendarStyle,
  { minHeight: number; barFontSize: number; barPadding: string; gap: number; datePadding: string; showNames: boolean }
> = {
  comfortable: { minHeight: 124, barFontSize: 11, barPadding: '2px 7px', gap: 5, datePadding: '8px 10px', showNames: false },
  compact: { minHeight: 74, barFontSize: 10, barPadding: '0px 5px', gap: 2, datePadding: '4px 6px', showNames: false },
  chips: { minHeight: 62, barFontSize: 10, barPadding: '0px 5px', gap: 3, datePadding: '4px 6px', showNames: false },
  detailed: { minHeight: 170, barFontSize: 11, barPadding: '2px 7px', gap: 5, datePadding: '8px 10px', showNames: true },
}

export default function RosterVariantSwitcher({
  value,
  onChange,
}: {
  value: RosterVariantState
  onChange: (next: RosterVariantState) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return
      const { startX, startY, origX, origY } = dragState.current
      setPos({
        x: Math.min(Math.max(origX + (e.clientX - startX), 8), window.innerWidth - 60),
        y: Math.min(Math.max(origY + (e.clientY - startY), 8), window.innerHeight - 60),
      })
    }
    const onUp = () => {
      dragState.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startDrag = (e: React.MouseEvent) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos?.x ?? rect.left,
      origY: pos?.y ?? rect.top,
    }
    e.preventDefault()
  }

  const set = <K extends keyof RosterVariantState>(key: K, v: RosterVariantState[K]) =>
    onChange({ ...value, [key]: v })

  // Default to bottom-right until the user drags it somewhere else.
  // Sits below AntD's drawer/modal layer (1000) so it never covers the Edit
  // Roster drawer's Save button, while still floating over the page itself.
  const style: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 900 }
    : { position: 'fixed', right: 24, bottom: 24, zIndex: 900 }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Calendar variant switcher (demo tool)"
        style={{
          ...style,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: '#1a1a1a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(15,23,42,.3)',
        }}
      >
        <ControlOutlined style={{ fontSize: 18 }} />
      </button>
    )
  }

  const activeHint = CALENDAR_STYLE_OPTIONS.find((o) => o.value === value.calendarStyle)?.hint

  return (
    <div
      style={{
        ...style,
        width: 320,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 16px 40px rgba(15,23,42,.28)',
        border: '1px solid #f0f0f0',
        overflow: 'hidden',
      }}
    >
      <div
        onMouseDown={startDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: '#1a1a1a',
          color: '#fff',
          cursor: 'grab',
        }}
      >
        <HolderOutlined />
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1 }}>Calendar Variants (demo)</Text>
        <button
          onClick={() => setOpen(false)}
          title="Hide"
          style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
        >
          <CloseOutlined style={{ fontSize: 13 }} />
        </button>
      </div>

      <div style={{ overflowY: 'auto', padding: 12 }}>
        {/* Variant 1 */}
        <Section title="Variant 1 · Calendar style">
          <Segmented
            size="small"
            block
            vertical
            value={value.calendarStyle}
            onChange={(v) => set('calendarStyle', v as CalendarStyle)}
            options={CALENDAR_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          {activeHint && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
              {activeHint}
            </Text>
          )}
        </Section>

        {/* Variant 2 */}
        <Section title="Variant 2 · Day name row">
          <Row
            label="Freeze day names"
            hint="Keeps Mon–Sun pinned while the calendar scrolls."
            checked={value.freezeDayNames}
            onChange={(v) => set('freezeDayNames', v)}
          />
        </Section>

        {/* Variant 3 */}
        <Section title="Variant 3 · Legend">
          <Segmented
            size="small"
            block
            vertical
            value={value.legendMode}
            onChange={(v) => set('legendMode', v as LegendMode)}
            options={LEGEND_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            {LEGEND_MODE_OPTIONS.find((o) => o.value === value.legendMode)?.hint}
          </Text>
        </Section>

        {/* Variant 4 */}
        <Section title="Variant 4 · Shift picker contrast">
          <Segmented
            size="small"
            block
            value={value.shiftContrast}
            onChange={(v) => set('shiftContrast', v as ShiftContrast)}
            options={SHIFT_CONTRAST_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            {SHIFT_CONTRAST_OPTIONS.find((o) => o.value === value.shiftContrast)?.hint}
          </Text>
        </Section>

        {/* Variant 5 */}
        <Section title="Variant 5 · On Leave staff">
          <Segmented
            size="small"
            block
            vertical
            value={value.onLeaveDisplay}
            onChange={(v) => set('onLeaveDisplay', v as OnLeaveDisplay)}
            options={ON_LEAVE_DISPLAY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            {ON_LEAVE_DISPLAY_OPTIONS.find((o) => o.value === value.onLeaveDisplay)?.hint}
          </Text>
        </Section>

        {/* Variant 6 */}
        <Section title="Variant 6 · Edit drawer layout" last>
          <Segmented
            size="small"
            block
            vertical
            value={value.drawerLayout}
            onChange={(v) => set('drawerLayout', v as DrawerLayout)}
            options={DRAWER_LAYOUT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            {DRAWER_LAYOUT_OPTIONS.find((o) => o.value === value.drawerLayout)?.hint}
          </Text>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: last ? undefined : '1px solid #f5f5f5' }}>
      <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </div>
  )
}

function Row({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <Text style={{ fontSize: 12, display: 'block' }}>{label}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{hint}</Text>
      </div>
      <Switch size="small" checked={checked} onChange={onChange} />
    </div>
  )
}
