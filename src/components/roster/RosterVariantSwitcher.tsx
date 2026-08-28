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
//   variant 7 — how a shift-pattern card draws its weekly headcounts
//   variant 8 — whether AntD runs on the team's Figma design tokens
//   variant 9 — what a day cell says when you hover it
//   variant 10 — whether the view drawer draws controls or plain values
//   variant 11 — whether the drawer opens with a headcount summary
//
// 27 Aug review: the panel now uses the same chrome as Live Tracking 2.0's
// "Display settings" — amber header, 260px, one compact label/control row per
// option — so a presenter meets the same control in both prototypes. The
// per-option explanations moved onto label tooltips; that layout has no room
// for a line of prose under every row, and losing the reasoning outright would
// have made the panel harder to demo from.

import { useEffect, useRef, useState } from 'react'
import { Button, Select, Switch, Tooltip, Typography } from 'antd'
import { ControlOutlined, CloseOutlined, HolderOutlined } from '@ant-design/icons'

const { Text } = Typography

export type CalendarStyle = 'comfortable' | 'compact' | 'chips' | 'detailed'
export type ShiftContrast = 'strong' | 'swatch' | 'pill' | 'subtle' | 'dropdown'
export type OnLeaveDisplay = 'inline' | 'section'
export type LegendMode = 'hidden' | 'filters' | 'plain'
export type DrawerLayout = 'table' | 'grouped' | 'stacked'
export type PatternCardStyle = 'plain' | 'table'
export type DesignSystem = 'off' | 'figma' | 'figmaCompact'
export type CellHoverHint = 'off' | 'view' | 'edit'
export type ViewStyle = 'controls' | 'readonly'
export type DaySummary = 'off' | 'chips'

export interface RosterVariantState {
  calendarStyle: CalendarStyle
  freezeDayNames: boolean
  legendMode: LegendMode
  shiftContrast: ShiftContrast
  onLeaveDisplay: OnLeaveDisplay
  drawerLayout: DrawerLayout
  patternCardStyle: PatternCardStyle
  designSystem: DesignSystem
  cellHoverHint: CellHoverHint
  viewStyle: ViewStyle
  daySummary: DaySummary
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
  patternCardStyle: 'plain',
  // Off by default so the comparison is opt-in and nothing shifts unasked.
  designSystem: 'off',
  // The hover tint is always on now that a cell is clickable; only the wording
  // is switchable, and it starts at the one that matches the built flow.
  cellHoverHint: 'view',
  // Both default to the improved reading; the previous behaviour stays
  // selectable so the two can still be put side by side.
  viewStyle: 'readonly',
  daySummary: 'chips',
}

export const VIEW_STYLE_OPTIONS: { value: ViewStyle; label: string; hint: string }[] = [
  {
    value: 'readonly',
    label: 'Plain values',
    hint: 'Viewing shows the roster as values — a coloured shift tag and a dash where a modifier is off. Nothing pretends to be clickable, and View stops looking like Edit.',
  },
  {
    value: 'controls',
    label: 'Disabled controls',
    hint: 'The original: viewing draws the same buttons and checkboxes as editing, all greyed out. Eleven rows of dead controls, and the two modes look alike.',
  },
]

export const DAY_SUMMARY_OPTIONS: { value: DaySummary; label: string; hint: string }[] = [
  {
    value: 'chips',
    label: 'Count chips',
    hint: "A headcount per shift above the table, so the day reads at a glance instead of by counting rows. Standby always shows — red at zero, matching the calendar's empty-standby bar.",
  },
  { value: 'off', label: 'Off', hint: 'Just the employee count, as before.' },
]

export const DESIGN_SYSTEM_OPTIONS: { value: DesignSystem; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: "AntD's own defaults — what the prototype has been built against so far." },
  { value: 'figma', label: 'Figma tokens', hint: 'The team\'s exported design system: colours, sizes and SF Pro Text.' },
  { value: 'figmaCompact', label: 'Figma compact', hint: 'The same tokens on the compact scale — smaller type, tighter controls.' },
]

export const CELL_HOVER_HINT_OPTIONS: { value: CellHoverHint; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'Hover still tints the cell, but says nothing.' },
  {
    value: 'view',
    label: 'Click to view',
    hint: "What the cell actually does: MOVE-3967 opens the day read-only first, and Edit lives inside the drawer. This wording also stays true on a past month, where Edit is disabled.",
  },
  {
    value: 'edit',
    label: 'Click to edit',
    hint: 'The wording asked for in review. Kept so the two can be compared — note it over-promises on a past month, where the drawer opens but Edit is disabled.',
  },
]

export const PATTERN_CARD_STYLE_OPTIONS: { value: PatternCardStyle; label: string; hint: string }[] = [
  { value: 'plain', label: 'Plain', hint: 'Headcounts on an open grid, no rules or fills — the current look.' },
  { value: 'table', label: 'Table', hint: 'Bordered cells with a shaded header, as the design sketch draws it.' },
]

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
  { value: 'strong', label: 'Strong', hint: 'Selected shift is a solid blue fill, so it holds up next to the Standby checkbox.' },
  {
    value: 'swatch',
    label: 'Shift colours',
    hint: "Selected shift wears the colour the calendar gives it — AM lilac, PM blue-grey, NA grey — so the drawer and the month grid agree. Leaves blue to Standby alone.",
  },
  {
    value: 'pill',
    label: 'Pill group',
    hint: 'One rounded frame around all three options with hairlines between them, rather than three separate boxes. The lightest of the button styles.',
  },
  { value: 'subtle', label: 'Subtle', hint: 'The original look — selected shift is a raised white tile on a grey track.' },
  {
    value: 'dropdown',
    label: 'Dropdown',
    hint: 'A compact Select — about a third of the width, and the only option that would still fit if the shift list grew past three. Costs a second click per change.',
  },
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
      <Button
        shape="circle"
        size="large"
        icon={<ControlOutlined />}
        onClick={() => setOpen(true)}
        title="Show display settings"
        style={{
          ...style,
          borderColor: '#ffd591',
          color: '#d48806',
          boxShadow: '0 6px 18px rgba(15,23,42,.18)',
        }}
      />
    )
  }

  return (
    <div
      style={{
        ...style,
        width: 260,
        maxHeight: '78vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid #ffd591',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(15,23,42,.18)',
      }}
    >
      <div
        onMouseDown={startDrag}
        style={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 10px',
          borderBottom: '1px solid #ffe7ba',
          background: '#fff7e6',
          borderRadius: '12px 12px 0 0',
          userSelect: 'none',
        }}
      >
        <HolderOutlined style={{ color: '#d48806' }} />
        <Text style={{ fontWeight: 600, fontSize: 13, color: '#d48806', flex: 1 }}>Display settings</Text>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} title="Hide" />
      </div>

      <div style={{ padding: '10px 12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SettingRow label="Calendar style" hint={hintOf(CALENDAR_STYLE_OPTIONS, value.calendarStyle)}>
          <Picker options={CALENDAR_STYLE_OPTIONS} value={value.calendarStyle} onChange={(v) => set('calendarStyle', v)} />
        </SettingRow>
        <SettingRow label="Freeze day names" hint="Keeps Mon–Sun pinned while the calendar scrolls.">
          <Switch size="small" checked={value.freezeDayNames} onChange={(v) => set('freezeDayNames', v)} />
        </SettingRow>
        <SettingRow label="Legend" hint={hintOf(LEGEND_MODE_OPTIONS, value.legendMode)}>
          <Picker options={LEGEND_MODE_OPTIONS} value={value.legendMode} onChange={(v) => set('legendMode', v)} />
        </SettingRow>
        <SettingRow label="Cell hover text" hint={hintOf(CELL_HOVER_HINT_OPTIONS, value.cellHoverHint)}>
          <Picker options={CELL_HOVER_HINT_OPTIONS} value={value.cellHoverHint} onChange={(v) => set('cellHoverHint', v)} />
        </SettingRow>

        <Divider />

        <SettingRow label="Viewing a day" hint={hintOf(VIEW_STYLE_OPTIONS, value.viewStyle)}>
          <Picker options={VIEW_STYLE_OPTIONS} value={value.viewStyle} onChange={(v) => set('viewStyle', v)} />
        </SettingRow>
        <SettingRow label="Day summary" hint={hintOf(DAY_SUMMARY_OPTIONS, value.daySummary)}>
          <Picker options={DAY_SUMMARY_OPTIONS} value={value.daySummary} onChange={(v) => set('daySummary', v)} />
        </SettingRow>

        <SettingRow label="Shift picker" hint={hintOf(SHIFT_CONTRAST_OPTIONS, value.shiftContrast)}>
          <Picker options={SHIFT_CONTRAST_OPTIONS} value={value.shiftContrast} onChange={(v) => set('shiftContrast', v)} />
        </SettingRow>
        <SettingRow label="On Leave staff" hint={hintOf(ON_LEAVE_DISPLAY_OPTIONS, value.onLeaveDisplay)}>
          <Picker options={ON_LEAVE_DISPLAY_OPTIONS} value={value.onLeaveDisplay} onChange={(v) => set('onLeaveDisplay', v)} />
        </SettingRow>
        <SettingRow label="Edit drawer" hint={hintOf(DRAWER_LAYOUT_OPTIONS, value.drawerLayout)}>
          <Picker options={DRAWER_LAYOUT_OPTIONS} value={value.drawerLayout} onChange={(v) => set('drawerLayout', v)} />
        </SettingRow>
        <SettingRow label="Pattern card" hint={hintOf(PATTERN_CARD_STYLE_OPTIONS, value.patternCardStyle)}>
          <Picker options={PATTERN_CARD_STYLE_OPTIONS} value={value.patternCardStyle} onChange={(v) => set('patternCardStyle', v)} />
        </SettingRow>

        <Divider />

        <SettingRow label="Design system" hint={hintOf(DESIGN_SYSTEM_OPTIONS, value.designSystem)}>
          <Picker options={DESIGN_SYSTEM_OPTIONS} value={value.designSystem} onChange={(v) => set('designSystem', v)} />
        </SettingRow>
      </div>
    </div>
  )
}

const Divider = () => <div style={{ height: 1, background: '#f0f0f0' }} />

function hintOf<T extends string>(options: { value: T; label: string; hint: string }[], value: T) {
  return options.find((o) => o.value === value)?.hint ?? ''
}

/** Live Tracking 2.0 puts the explanation nowhere; these options are worth
 *  keeping, so the label carries them as a tooltip instead of a prose line. */
function SettingRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Tooltip title={hint} placement="left" mouseEnterDelay={0.4}>
        <Text style={{ fontSize: 13, color: '#595959', whiteSpace: 'nowrap', cursor: 'help' }}>{label}</Text>
      </Tooltip>
      {children}
    </div>
  )
}

function Picker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <Select
      size="small"
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      style={{ width: 124 }}
      // The panel floats under AntD's drawer layer; its own dropdown has to
      // clear that or it renders behind the calendar.
      dropdownStyle={{ zIndex: 2100 }}
    />
  )
}
