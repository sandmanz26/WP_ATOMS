// Roster Calendar 4.0 — conventional month-grid calendar.
//
// As of the Aug 11 ticket rewrite this is the variant that matches the PRD.
// MOVE-3608 §2 now specifies "a monthly calendar grid for the whole team" with a
// Monday–Sunday layout and roster information as grouped bars within each day —
// the matrix layout it used to describe (employees as rows, dates as columns)
// is gone. RosterPage.tsx and Roster3Page.tsx still implement that older matrix
// reading and are kept only as prior explorations.
//
// What this page implements:
//   MOVE-3608 — month grid, greyed adjacent-month days, today highlighted,
//     grouped bars "Group (n)" for On Leave / AM / PM / Off / No Roster /
//     Standby, public holiday indicator, 12-month forward navigation, legend.
//     Standby is an independent assignment: an employee rostered AM and put on
//     standby appears in both bars.
//   MOVE-3607 — the two highlight badges, here as stat cards that also filter.
//   MOVE-3659 — clicking a bar opens the view-only Details Card, staff A–Z.
//   MOVE-3609/3610/3611/3705 — via the shared Manage Shift Patterns drawer.
//   MOVE-3658 — edit mode: pick a day, edit it in a drawer with its own
//     Save/Cancel, then commit or discard the whole session.
//
// Status resolution comes from the shared rosterStatusLogic.tsx, so rules
// cannot drift between the variants.

import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Checkbox, Drawer, Empty, Popover, Space, Tag, Tooltip, Typography, message } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  SettingOutlined,
  EditOutlined,
  FlagFilled,
  CloseOutlined,
} from '@ant-design/icons'
import {
  LEAVES,
  OPERATIONS_EMPLOYEES,
  PUBLIC_HOLIDAYS,
  ROSTER_RULES,
  ROSTER_OVERRIDES,
  applyOverrides,
  type RosterEmployee,
  type RosterOverride,
  type ShiftSelection,
} from './rosterData'
import {
  DAY_GROUP_ORDER,
  DAY_GROUP_STYLE,
  HIGHLIGHT_WINDOW_DAYS,
  ISO,
  computeDayGroups,
  computeRosterHighlights,
  employeesOnDuty,
  isoDayIndex,
  isWeekend,
  resolveDailyStatus,
  resolveShiftIgnoringLeave,
  shiftOptionsForDay,
  type DailyCellResult,
  type DayGroup,
  type DayGroupKey,
  type RosterContext,
} from './rosterStatusLogic'
import ManageRosterDrawer from './ManageRosterDrawer'
import ExtendShiftModal, { type ExtendDetails } from './ExtendShiftModal'
import StandbyReasonModal from './StandbyReasonModal'
import ShiftSelector from './ShiftSelector'
import RosterVariantSwitcher, {
  CALENDAR_STYLE_METRICS,
  DEFAULT_VARIANTS,
  type CalendarStyle,
  type DrawerLayout,
  type OnLeaveDisplay,
  type RosterVariantState,
  type ShiftContrast,
} from './RosterVariantSwitcher'
import { PAST_MONTH_TOOLTIP, canEditMonth } from './useRosterEdit'

const { Text, Title } = Typography

const MAX_MONTHS_AHEAD = 12
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Which highlight, if any, is currently filtering the calendar (feedback item 4). */
type HighlightFilter = 'none' | 'noStandby' | 'noShift'

interface CalendarDay {
  date: Dayjs
  inSelectedMonth: boolean
}

function buildCalendarWeeks(month: Dayjs): CalendarDay[][] {
  const monthStart = month.startOf('month')
  const monthEnd = month.endOf('month')
  const gridStart = monthStart.subtract(isoDayIndex(monthStart), 'day')
  const gridEnd = monthEnd.add(6 - isoDayIndex(monthEnd), 'day')

  const weeks: CalendarDay[][] = []
  let cursor = gridStart
  while (!cursor.isAfter(gridEnd, 'day')) {
    const week: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inSelectedMonth: cursor.isSame(month, 'month') })
      cursor = cursor.add(1, 'day')
    }
    weeks.push(week)
  }
  return weeks
}

export default function Roster4Page() {
  const today = useMemo(() => dayjs().startOf('day'), [])
  const [month, setMonth] = useState(() => today.startOf('month'))
  const [revision, setRevision] = useState(0)
  const [manageOpen, setManageOpen] = useState(false)
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>('none')
  const [openBarKey, setOpenBarKey] = useState<string | null>(null)

  // Demo-only display variants, driven by the floating switcher.
  const [variants, setVariants] = useState<RosterVariantState>(DEFAULT_VARIANTS)
  // Variant 3 — legend chips double as per-group filters.
  const [hiddenGroups, setHiddenGroups] = useState<Set<DayGroupKey>>(new Set())

  // Edit mode: a draft of overrides that only commits on Save.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RosterOverride[]>([])
  const [editDate, setEditDate] = useState<Dayjs | null>(null)

  const ctx: RosterContext = useMemo(
    () => ({
      rules: ROSTER_RULES,
      leaves: LEAVES,
      holidays: PUBLIC_HOLIDAYS,
      overrides: editing ? [...ROSTER_OVERRIDES, ...draft] : ROSTER_OVERRIDES,
    }),
    // The rules array is mutated in place by the Manage Shift Patterns drawer.
    [revision, editing, draft]
  )

  const weeks = useMemo(() => buildCalendarWeeks(month), [month])

  const highlights = useMemo(
    () => computeRosterHighlights(OPERATIONS_EMPLOYEES, today, ctx, HIGHLIGHT_WINDOW_DAYS),
    [today, ctx]
  )

  const filteredDates = useMemo(() => {
    if (highlightFilter === 'noStandby') return new Set(highlights.noStandbyDates)
    if (highlightFilter === 'noShift') return new Set(highlights.noShiftDates)
    return null
  }, [highlightFilter, highlights])

  const editableMonth = canEditMonth(month, today)
  const canGoNext = month.isBefore(today.add(MAX_MONTHS_AHEAD, 'month').startOf('month')) && !editing

  useEffect(() => {
    setEditDate(null)
    setOpenBarKey(null)
  }, [month])

  const startEdit = () => {
    setDraft([])
    setEditDate(null)
    setOpenBarKey(null)
    setEditing(true)
  }

  const saveEdit = () => {
    applyOverrides(draft)
    setDraft([])
    setEditDate(null)
    setEditing(false)
    setRevision((r) => r + 1)
    message.success('Roster updated successfully.')
  }

  const cancelEdit = () => {
    setDraft([])
    setEditDate(null)
    setEditing(false)
  }

  /** Folds one day's saved drawer edits into the session draft. */
  const commitDay = (overrides: RosterOverride[]) => {
    setDraft((prev) => {
      const next = [...prev]
      for (const override of overrides) {
        const existing = next.find((o) => o.employeeId === override.employeeId && o.date === override.date)
        if (existing) Object.assign(existing, override)
        else next.push({ ...override })
      }
      return next
    })
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Feedback 2 — the "Operations department — month grid…" subtitle is
          gone; the sidebar and breadcrumb already say where you are. The page
          is titled plainly "Roster": the 4.0 is a prototype variant number, not
          something the product should say out loud. */}
      <Title level={3} style={{ margin: '0 0 16px', fontWeight: 700 }}>Roster</Title>

      {/* Highlights sit under the title as stat cards, on their own row above
          the calendar. They are still clickable filters. */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {/* Wording set by the review, in the order the two were listed there.
            Note that this reads the standby check as "unassigned shift" and the
            AM/PM check as "unassigned roster", which is the reverse of how the
            two counts are computed; raised as an open item rather than silently
            swapped. */}
        <HighlightCard
          count={highlights.noStandbyDays}
          label="unassigned shift"
          windowDays={highlights.windowDays}
          active={highlightFilter === 'noStandby'}
          onClick={() => setHighlightFilter((f) => (f === 'noStandby' ? 'none' : 'noStandby'))}
        />
        <HighlightCard
          count={highlights.noShiftDays}
          label="unassigned roster"
          windowDays={highlights.windowDays}
          active={highlightFilter === 'noShift'}
          onClick={() => setHighlightFilter((f) => (f === 'noShift' ? 'none' : 'noShift'))}
        />
      </div>

      <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, background: '#fff', padding: 16 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Tooltip title={editing ? 'Month navigation is disabled while editing' : undefined}>
            <Button icon={<LeftOutlined />} disabled={editing} onClick={() => setMonth((m) => m.subtract(1, 'month'))} />
          </Tooltip>
          <Button icon={<RightOutlined />} disabled={!canGoNext} onClick={() => canGoNext && setMonth((m) => m.add(1, 'month'))} />
          <Text strong style={{ fontSize: 15, minWidth: 140 }}>{month.format('MMMM YYYY')}</Text>
          <Button icon={<CalendarOutlined />} disabled={editing} onClick={() => setMonth(today.startOf('month'))}>
            Today
          </Button>

          <div style={{ flex: 1 }} />

          {editing ? (
            <Space>
              <Button onClick={cancelEdit}>Cancel</Button>
              <Button type="primary" onClick={saveEdit}>Save</Button>
            </Space>
          ) : (
            <Space>
              <Button icon={<SettingOutlined />} onClick={() => setManageOpen(true)}>Manage Shift Patterns</Button>
              <Tooltip title={editableMonth ? undefined : PAST_MONTH_TOOLTIP}>
                <Button type="primary" icon={<EditOutlined />} disabled={!editableMonth} onClick={startEdit}>
                  Edit Roster
                </Button>
              </Tooltip>
            </Space>
          )}
        </div>

        {/* Feedback 2 removed the legend row. The two earlier behaviours stay
            available through Variant 3 so they can still be compared. */}
        {variants.legendMode !== 'hidden' && (
          <>
            <Legend
              filtersEnabled={variants.legendMode === 'filters'}
              hiddenGroups={hiddenGroups}
              onToggleGroup={(key) =>
                setHiddenGroups((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              }
            />
            <div style={{ height: 12 }} />
          </>
        )}

        {/* Weekday header — variant 2 pins it to the top of the viewport. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid #f0f0f0',
            background: '#fff',
            ...(variants.freezeDayNames
              ? { position: 'sticky' as const, top: 0, zIndex: 20 }
              : {}),
          }}
        >
          {DAY_HEADERS.map((label, i) => (
            <div key={label} style={{ padding: '8px 10px' }}>
              <Text strong style={{ fontSize: 12, color: i >= 5 ? '#cf1322' : '#595959' }}>{label}</Text>
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {week.map(({ date, inSelectedMonth }) => (
              <DayCell
                key={date.format(ISO)}
                date={date}
                inSelectedMonth={inSelectedMonth}
                isToday={date.isSame(today, 'day')}
                ctx={ctx}
                editing={editing}
                selected={!!editDate && editDate.isSame(date, 'day')}
                dimmedByFilter={!!filteredDates && !filteredDates.has(date.format(ISO))}
                openBarKey={openBarKey}
                onBarOpenChange={setOpenBarKey}
                onSelectForEdit={() => inSelectedMonth && setEditDate(date)}
                calendarStyle={variants.calendarStyle}
                hiddenGroups={variants.legendMode === 'filters' ? hiddenGroups : EMPTY_HIDDEN}
              />
            ))}
          </div>
        ))}
      </div>

      {editing && (
        <EditDayDrawer
          date={editDate}
          ctx={ctx}
          shiftContrast={variants.shiftContrast}
          onLeaveDisplay={variants.onLeaveDisplay}
          layout={variants.drawerLayout}
          onClose={() => setEditDate(null)}
          onCommitDay={commitDay}
        />
      )}

      <ManageRosterDrawer
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onRulesChanged={() => setRevision((r) => r + 1)}
      />

      <RosterVariantSwitcher value={variants} onChange={setVariants} />
    </div>
  )
}

/** Stable empty set so DayCell's props don't change identity every render. */
const EMPTY_HIDDEN: Set<DayGroupKey> = new Set()

/**
 * One highlight as a stat card: the count reads large, with what it counts
 * underneath. Replaces the old inline pill (17 Aug design).
 *
 * The count appears once, as the number — the design mock repeated it inside
 * the label too, which would have shown two different figures on one card.
 *
 * Still a filter: clicking narrows the calendar to the affected days, and the
 * active card carries a blue border so the filtered state is visible.
 */
function HighlightCard({
  count,
  label,
  windowDays,
  active,
  onClick,
}: {
  count: number
  label: string
  windowDays: number
  active: boolean
  onClick: () => void
}) {
  const clear = count === 0
  return (
    <Tooltip title={clear ? 'Nothing to filter' : active ? 'Click to clear the filter' : 'Click to filter the calendar to these days'}>
      <div
        onClick={() => !clear && onClick()}
        style={{
          minWidth: 230,
          padding: '14px 18px',
          borderRadius: 10,
          background: '#fff',
          border: `1px solid ${active ? '#1677ff' : '#f0f0f0'}`,
          boxShadow: active ? '0 0 0 2px #1677ff26' : undefined,
          cursor: clear ? 'default' : 'pointer',
          transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: '#1a1a1a' }}>{count}</div>
        <div style={{ marginTop: 2, fontSize: 12, whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 600, color: '#595959' }}>{label}</span>{' '}
          <Text type="secondary" style={{ fontSize: 12 }}>(in next {windowDays} days)</Text>
        </div>
      </div>
    </Tooltip>
  )
}

function DayCell({
  date,
  inSelectedMonth,
  isToday,
  ctx,
  editing,
  selected,
  dimmedByFilter,
  openBarKey,
  onBarOpenChange,
  onSelectForEdit,
  calendarStyle,
  hiddenGroups,
}: {
  date: Dayjs
  inSelectedMonth: boolean
  isToday: boolean
  ctx: RosterContext
  editing: boolean
  selected: boolean
  dimmedByFilter: boolean
  openBarKey: string | null
  onBarOpenChange: (key: string | null) => void
  onSelectForEdit: () => void
  calendarStyle: CalendarStyle
  hiddenGroups: Set<DayGroupKey>
}) {
  const dateStr = date.format(ISO)
  const metrics = CALENDAR_STYLE_METRICS[calendarStyle]
  const onDuty = employeesOnDuty(OPERATIONS_EMPLOYEES, dateStr)
  const groups = inSelectedMonth
    ? computeDayGroups(onDuty, date, ctx).filter((g) => !hiddenGroups.has(g.key))
    : []
  const holiday = PUBLIC_HOLIDAYS.find((h) => h.date === dateStr)
  const weekend = isWeekend(date)

  const background = isToday
    ? '#e6f4ff'
    : holiday
      ? '#f6ffed' // feedback item 3 — holidays read green
      : weekend
        ? '#fafafa'
        : '#fff'

  return (
    <div
      onClick={editing ? onSelectForEdit : undefined}
      style={{
        minHeight: metrics.minHeight,
        padding: metrics.datePadding,
        border: '1px solid #f5f5f5',
        marginTop: -1,
        marginLeft: -1,
        background,
        opacity: inSelectedMonth ? (dimmedByFilter ? 0.35 : 1) : 0.4,
        cursor: editing && inSelectedMonth ? 'pointer' : 'default',
        outline: selected ? '2px dashed #1677ff' : undefined,
        outlineOffset: -3,
        display: 'flex',
        flexDirection: 'column',
        gap: metrics.gap,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span
          style={{
            fontSize: calendarStyle === 'comfortable' || calendarStyle === 'detailed' ? 13 : 12,
            fontWeight: isToday ? 700 : 500,
            color: isToday ? '#1677ff' : weekend ? '#cf1322' : '#1a1a1a',
          }}
        >
          {date.format('DD')}
        </span>
        {holiday && (
          <Tooltip title={`Public Holiday — ${holiday.name}`}>
            <FlagFilled style={{ fontSize: 11, color: '#52c41a' }} />
          </Tooltip>
        )}
      </div>

      {calendarStyle === 'chips' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {groups.map((group) => (
            <GroupBar
              key={group.key}
              group={group}
              date={date}
              barKey={`${dateStr}|${group.key}`}
              openBarKey={openBarKey}
              onOpenChange={onBarOpenChange}
              interactive={!editing}
              metrics={metrics}
              chip
            />
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <GroupBar
            key={group.key}
            group={group}
            date={date}
            barKey={`${dateStr}|${group.key}`}
            openBarKey={openBarKey}
            onOpenChange={onBarOpenChange}
            interactive={!editing}
            metrics={metrics}
          />
        ))
      )}
    </div>
  )
}

function GroupBar({
  group,
  date,
  barKey,
  openBarKey,
  onOpenChange,
  interactive,
  metrics,
  chip = false,
}: {
  group: DayGroup
  date: Dayjs
  barKey: string
  openBarKey: string | null
  onOpenChange: (key: string | null) => void
  interactive: boolean
  metrics: (typeof CALENDAR_STYLE_METRICS)[CalendarStyle]
  chip?: boolean
}) {
  const style = DAY_GROUP_STYLE[group.key]
  const [hovered, setHovered] = useState(false)

  // Only clickable bars darken — in edit mode the day cell is the target, so a
  // hover highlight on a bar would point at the wrong thing.
  const active = interactive && (hovered || openBarKey === barKey)

  // In chip mode the label shrinks to its initial so a whole day fits on one line.
  const text = chip
    ? `${group.label === 'No Roster' ? 'NR' : group.label === 'On Leave' ? 'L' : group.label.charAt(0)}${group.members.length}`
    : `${group.label} (${group.members.length})`

  const bar = (
    <div
      title={chip ? `${group.label} (${group.members.length})` : undefined}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? style.bgHover : style.bg,
        color: style.fg,
        border: (active ? style.borderHover ?? style.border : style.border) ?? '1px solid transparent',
        borderRadius: 4,
        padding: metrics.barPadding,
        fontSize: metrics.barFontSize,
        fontWeight: 500,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background 0.12s ease, border-color 0.12s ease',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(chip ? { minWidth: 26, textAlign: 'center' as const } : {}),
      }}
    >
      {text}
      {metrics.showNames && (
        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, whiteSpace: 'normal' }}>
          {group.members.map((m) => m.employee.name.split(' ')[0]).join(', ')}
        </div>
      )}
    </div>
  )

  if (!interactive) return bar

  // Feedback new item 2 — a details card anchored to the bar, not a drawer.
  return (
    <Popover
      open={openBarKey === barKey}
      onOpenChange={(open) => onOpenChange(open ? barKey : null)}
      trigger="click"
      placement="right"
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ fontSize: 13 }}>
            <strong>{group.label}</strong>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}> — {date.format('D MMM YYYY')}</Text>
          </span>
          <CloseOutlined
            style={{ fontSize: 11, color: '#8c8c8c', cursor: 'pointer' }}
            onClick={() => onOpenChange(null)}
          />
        </div>
      }
      content={
        <div style={{ minWidth: 190, maxWidth: 280 }}>
          {group.members.map(({ employee, reason }) => (
            <div key={employee.id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
              {employee.name}
              {/* MOVE-3659 §1 — show the reason where one was captured. */}
              {reason && (
                <div style={{ fontSize: 11, color: '#8c8c8c', whiteSpace: 'normal' }}>{reason}</div>
              )}
            </div>
          ))}
        </div>
      }
    >
      {bar}
    </Popover>
  )
}

/**
 * MOVE-3658 §3 — the day's roster editor.
 *
 * Edits here are staged locally and only handed to the session draft when the
 * drawer's own Save is pressed; Cancel (or closing the drawer) throws that day's
 * changes away. The session-level Save/Cancel on the page then commits or
 * discards everything across all edited days.
 */
function EditDayDrawer({
  date,
  ctx,
  shiftContrast,
  onLeaveDisplay,
  layout,
  onClose,
  onCommitDay,
}: {
  date: Dayjs | null
  ctx: RosterContext
  shiftContrast: ShiftContrast
  onLeaveDisplay: OnLeaveDisplay
  layout: DrawerLayout
  onClose: () => void
  onCommitDay: (overrides: RosterOverride[]) => void
}) {
  // Pending edits for this day, keyed by employee id.
  const [pending, setPending] = useState<Record<string, Partial<RosterOverride>>>({})
  // Which employee, if any, has a reason modal open.
  const [extendFor, setExtendFor] = useState<{ employee: RosterEmployee; initial: ExtendDetails } | null>(null)
  const [standbyFor, setStandbyFor] = useState<{ employee: RosterEmployee; reason?: string } | null>(null)

  useEffect(() => {
    setPending({})
    setExtendFor(null)
    setStandbyFor(null)
  }, [date])

  if (!date) return <Drawer open={false} onClose={onClose} />

  const dateStr = date.format(ISO)
  // MOVE-3658 §3 — eligible employees are listed A–Z by name.
  const onDuty = employeesOnDuty(OPERATIONS_EMPLOYEES, dateStr).sort((a, b) => a.name.localeCompare(b.name))
  const resolved = onDuty.map((employee) => ({ employee, result: resolveDailyStatus(employee, date, ctx) }))
  const onLeave = resolved.filter((r) => r.result.status === 'ON_LEAVE')
  const editable = resolved.filter((r) => r.result.status !== 'ON_LEAVE')
  // Review feedback 1 — On Leave staff can sit in the main list with their shift
  // shown but disabled, so ops can see which shift they were meant to be on.
  const rows = onLeaveDisplay === 'inline' ? resolved : editable

  // MOVE-3769 §3 — weekdays offer AM/PM/NA, weekends AM/Off Day/NA. On a public
  // holiday the shift is fixed to Off Day and the control is read-only, so the
  // picker shows that one option rather than greying out choices nobody can
  // take — appending it to the weekday set gave a four-option row that
  // overflowed the Shift column.
  const dayHoliday = PUBLIC_HOLIDAYS.find((h) => h.date === dateStr)
  const dayShiftOptions: ShiftSelection[] = dayHoliday ? ['OFF'] : shiftOptionsForDay(date)

  const resolvedShift = (status: string): ShiftSelection => {
    if (status === 'AM' || status === 'AM_WEEKEND') return 'AM'
    if (status === 'PM') return 'PM'
    if (status === 'OFF' || status === 'PUBLIC_HOLIDAY') return 'OFF'
    return 'NA' // No Roster — an explicit choice now, not an empty control
  }

  const shiftOf = (employeeId: string, status: string) =>
    (pending[employeeId]?.shift as ShiftSelection | undefined) ?? resolvedShift(status)

  const valueOf = <K extends keyof RosterOverride>(
    employeeId: string,
    key: K,
    fallback: RosterOverride[K]
  ): RosterOverride[K] => (pending[employeeId]?.[key] as RosterOverride[K]) ?? fallback

  const stage = (employeeId: string, patch: Partial<RosterOverride>) =>
    setPending((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }))

  // Ticking Extend or Standby opens its modal; the box only turns on once the
  // required details are saved, so cancelling leaves it untouched.
  const onOpenExtend = (employee: RosterEmployee, initial: ExtendDetails) => setExtendFor({ employee, initial })
  const onOpenStandby = (employee: RosterEmployee, reason?: string) => setStandbyFor({ employee, reason })

  const handleSave = () => {
    const overrides: RosterOverride[] = Object.entries(pending).map(([employeeId, patch]) => ({
      employeeId,
      date: dateStr,
      ...patch,
    }))
    onCommitDay(overrides)
    setPending({})
    onClose()
  }

  const dirty = Object.keys(pending).length > 0

  // ---- Cells shared by all three layouts -----------------------------------
  //
  // Feedback 1 — the stacked list ran too long to scan, so the same controls are
  // reused across a table and a grouped table. Keeping them as one set of cell
  // renderers is what stops the layouts drifting apart in behaviour.

  const rowModel = ({ employee, result }: { employee: RosterEmployee; result: DailyCellResult }) => ({
    employee,
    result,
    onLeaveRow: result.status === 'ON_LEAVE',
    absent: !!valueOf(employee.id, 'absence', result.absent),
    standby: !!valueOf(employee.id, 'standby', result.standby),
    standbyReason: valueOf(employee.id, 'standbyReason', result.standbyReason),
    extend: !!valueOf(employee.id, 'extend', result.extend),
    extendHours: valueOf(employee.id, 'extendHours', result.extendHours),
    extendReason: valueOf(employee.id, 'extendReason', result.extendReason),
  })
  type Row = ReturnType<typeof rowModel>

  const detail = (text: string) => (
    <div style={{ marginTop: 2 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>{text}</Text>
    </div>
  )

  const nameCell = (row: Row) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {/* Feedback 5 — the Absence state reads next to the name. */}
      <span style={{ fontSize: 13 }}>{row.employee.name}</span>
      {row.absent && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>Absence</Tag>}
      {/* The tag carries the calendar's On Leave swatch, so the same status
          reads the same colour in the grid and in the drawer. */}
      {row.onLeaveRow && (
        <Tag
          style={{
            fontSize: 10,
            margin: 0,
            background: DAY_GROUP_STYLE.ON_LEAVE.bg,
            color: DAY_GROUP_STYLE.ON_LEAVE.fg,
            border: 'none',
          }}
        >
          On Leave
        </Tag>
      )}
    </div>
  )

  const shiftCell = (row: Row) => (
    <ShiftSelector
      contrast={shiftContrast}
      // Locked on a public holiday, while the employee is marked absent
      // (MOVE-3769 §3), and for On Leave rows, which are view-only.
      disabled={!!dayHoliday || row.absent || row.onLeaveRow}
      value={
        row.onLeaveRow
          ? resolveShiftIgnoringLeave(row.employee, date, ctx)
          : dayHoliday
            ? 'OFF'
            : shiftOf(row.employee.id, row.result.status)
      }
      options={dayShiftOptions}
      onChange={(v) => stage(row.employee.id, { shift: v })}
    />
  )

  const extendCell = (row: Row) => (
    <div>
      <Checkbox
        checked={row.extend}
        // Feedback 5 — Absence locks Extend and Standby too. An On Leave row is
        // view-only, and says so by disabling its fields the same way.
        disabled={row.absent || row.onLeaveRow}
        onChange={(e) =>
          e.target.checked
            ? onOpenExtend(row.employee, { hours: row.extendHours ?? 0, reason: row.extendReason ?? '' })
            : stage(row.employee.id, { extend: false, extendHours: undefined, extendReason: undefined })
        }
        style={{ fontSize: 12 }}
      >
        Extend
      </Checkbox>
      {/* Feedback 6 — the extension detail stays with its own checkbox. */}
      {!row.onLeaveRow &&
        row.extend &&
        (row.extendHours || row.extendReason) &&
        detail([row.extendHours ? `${row.extendHours}h` : null, row.extendReason].filter(Boolean).join(' · '))}
    </div>
  )

  const standbyCell = (row: Row) => (
    <div>
      {/* Standby is independent of the shift (MOVE-3608). */}
      <Checkbox
        checked={row.standby}
        disabled={row.absent || row.onLeaveRow}
        onChange={(e) =>
          e.target.checked
            ? // Feedback 2 — standby that came from the rule does not ask for a
              // reason when it is re-ticked.
              row.result.standbyFromRule
              ? stage(row.employee.id, { standby: true })
              : onOpenStandby(row.employee, row.standbyReason)
            : stage(row.employee.id, { standby: false, standbyReason: undefined })
        }
        style={{ fontSize: 12 }}
      >
        Standby
      </Checkbox>
      {/* MOVE-3769 §3 — stays visible even after the user unticks Standby, but
          not on an On Leave row: standby is cleared by leave (MOVE-3608), so
          "Standby from Rule" under an empty box would claim a shift that is not
          actually assigned. */}
      {!row.onLeaveRow && row.result.standbyFromRule && detail('Standby from Rule')}
      {!row.onLeaveRow && row.standbyReason && detail(row.standbyReason)}
    </div>
  )

  const absenceCell = (row: Row) => (
    <Checkbox
      checked={row.absent}
      disabled={row.onLeaveRow}
      onChange={(e) => stage(row.employee.id, { absence: e.target.checked })}
      style={{ fontSize: 12 }}
    >
      Absence
    </Checkbox>
  )

  // ---- Layouts -------------------------------------------------------------

  // The Shift column is sized for its widest content — AM / Off Day / NA on a
  // weekend or holiday — so the buttons never have to wrap.
  const TABLE_COLUMNS = '1.25fr 180px 1fr 1.15fr 96px'

  const tableHeader = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLUMNS,
        gap: 10,
        padding: '8px 10px',
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: '6px 6px 0 0',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}
    >
      {['Employee', 'Shift', 'Extend', 'Standby', 'Absence'].map((h) => (
        <Text key={h} type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {h}
        </Text>
      ))}
    </div>
  )

  const tableRow = (row: Row) => (
    <div
      key={row.employee.id}
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLUMNS,
        gap: 10,
        alignItems: 'start',
        padding: '10px',
        borderBottom: '1px solid #f5f5f5',
      }}
    >
      {nameCell(row)}
      <div>{shiftCell(row)}</div>
      {/* On Leave rows stay view-only, but say so through their own disabled
          fields rather than a highlighted row — the highlight pulled the eye to
          the one row that cannot be edited. */}
      {extendCell(row)}
      {standbyCell(row)}
      {absenceCell(row)}
    </div>
  )

  const stackedRow = (row: Row) => (
    <div key={row.employee.id} style={{ padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
      <div style={{ marginBottom: 6 }}>{nameCell(row)}</div>
      <div>{shiftCell(row)}</div>
      {/* Each modifier keeps its own state directly underneath it (feedback 2
          and 6), rather than trailing off in a shared block. On Leave rows keep
          the fields and disable them, matching the table layouts. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
        {extendCell(row)}
        {standbyCell(row)}
        <div>{absenceCell(row)}</div>
      </div>
    </div>
  )

  /** Groups the table by the shift each employee is currently on. */
  const groupedSections = () => {
    const models = rows.map(rowModel)
    const sections: { key: string; label: string; rows: Row[] }[] = [
      { key: 'AM', label: 'AM', rows: [] },
      { key: 'PM', label: 'PM', rows: [] },
      { key: 'OFF', label: 'Off Day', rows: [] },
      { key: 'NA', label: 'No Roster', rows: [] },
      { key: 'ON_LEAVE', label: 'On Leave', rows: [] },
    ]
    const byKey = new Map(sections.map((s) => [s.key, s]))
    for (const row of models) {
      const key = row.onLeaveRow
        ? 'ON_LEAVE'
        : dayHoliday
          ? 'OFF'
          : shiftOf(row.employee.id, row.result.status)
      byKey.get(key)?.rows.push(row)
    }
    return sections.filter((s) => s.rows.length > 0)
  }

  const isTable = layout !== 'stacked'

  return (
    <Drawer
      open
      onClose={onClose}
      // The table layouts need the width; the stacked list does not.
      width={isTable ? 760 : 480}
      title={`Edit Roster — ${date.format('D MMM YYYY')}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" disabled={!dirty} onClick={handleSave}>Save</Button>
        </div>
      }
    >
      {dayHoliday && (
        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: '#237804' }}>
            Public Holiday — {dayHoliday.name}. Every shift is fixed to Off Day and cannot be changed; standby can still be assigned.
          </Text>
        </div>
      )}

      {onLeaveDisplay === 'section' && (
      <div style={{ marginBottom: 20 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          On Leave <span style={{ fontStyle: 'italic' }}>(view only — excluded below)</span>
        </Text>
        <div
          style={{
            marginTop: 6,
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            padding: 10,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            minHeight: 42,
            alignItems: 'center',
          }}
        >
          {onLeave.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>No one on leave this day.</Text>
          ) : (
            // Leave type/timing is deliberately not surfaced: Operations hours
            // differ from the rest of the company, so someone on leave is
            // effectively unavailable regardless of the half-day marker.
            onLeave.map(({ employee }) => (
              <span
                key={employee.id}
                style={{
                  fontSize: 12,
                  padding: '2px 10px',
                  borderRadius: 12,
                  // Follows the On Leave swatch rather than a second red.
                  background: DAY_GROUP_STYLE.ON_LEAVE.bg,
                  color: DAY_GROUP_STYLE.ON_LEAVE.fg,
                }}
              >
                {employee.name}
              </span>
            ))
          )}
        </div>
      </div>
      )}

      <Text strong style={{ fontSize: 13 }}>{rows.length} Employees</Text>

      {rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No employees to roster on this date." />
      ) : layout === 'stacked' ? (
        rows.map((r) => stackedRow(rowModel(r)))
      ) : layout === 'table' ? (
        <div style={{ marginTop: 8, border: '1px solid #f0f0f0', borderRadius: 6 }}>
          {tableHeader}
          {rows.map((r) => tableRow(rowModel(r)))}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {groupedSections().map((section) => (
            <div key={section.key} style={{ marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 6 }}>
              <div style={{ padding: '8px 10px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <Text strong style={{ fontSize: 12 }}>
                  {section.label} <Text type="secondary" style={{ fontSize: 12 }}>({section.rows.length})</Text>
                </Text>
              </div>
              {section.rows.map(tableRow)}
            </div>
          ))}
        </div>
      )}

      <ExtendShiftModal
        open={!!extendFor}
        employeeName={extendFor?.employee.name ?? ''}
        initial={extendFor?.initial}
        onCancel={() => setExtendFor(null)}
        onSave={({ hours, reason }) => {
          if (extendFor) stage(extendFor.employee.id, { extend: true, extendHours: hours, extendReason: reason })
          setExtendFor(null)
        }}
      />

      <StandbyReasonModal
        open={!!standbyFor}
        employeeName={standbyFor?.employee.name ?? ''}
        initialReason={standbyFor?.reason}
        onCancel={() => setStandbyFor(null)}
        onSave={(reason) => {
          if (standbyFor) stage(standbyFor.employee.id, { standby: true, standbyReason: reason })
          setStandbyFor(null)
        }}
      />
    </Drawer>
  )
}

function Legend({
  filtersEnabled,
  hiddenGroups,
  onToggleGroup,
}: {
  filtersEnabled: boolean
  hiddenGroups: Set<DayGroupKey>
  onToggleGroup: (key: DayGroupKey) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {DAY_GROUP_ORDER.map((key) => (
        <LegendChip
          key={key}
          groupKey={key}
          filtersEnabled={filtersEnabled}
          hidden={hiddenGroups.has(key)}
          onToggle={() => onToggleGroup(key)}
        />
      ))}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 14px 5px 8px',
          borderRadius: 20,
          border: '1px solid #f0f0f0',
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#f6ffed',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FlagFilled style={{ fontSize: 11, color: '#52c41a' }} />
        </span>
        <Text style={{ fontSize: 13 }}>Public Holiday</Text>
      </div>
    </div>
  )
}

function LegendChip({
  groupKey,
  filtersEnabled,
  hidden,
  onToggle,
}: {
  groupKey: DayGroupKey
  filtersEnabled: boolean
  hidden: boolean
  onToggle: () => void
}) {
  const style = DAY_GROUP_STYLE[groupKey]
  const initial = style.label.replace('On ', '').charAt(0).toUpperCase()
  const off = filtersEnabled && hidden

  const chip = (
    <div
      onClick={filtersEnabled ? onToggle : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 14px 5px 8px',
        borderRadius: 20,
        border: `1px solid ${off ? '#f0f0f0' : '#e6e6e6'}`,
        background: off ? '#fafafa' : '#fff',
        opacity: off ? 0.5 : 1,
        cursor: filtersEnabled ? 'pointer' : 'default',
        textDecoration: off ? 'line-through' : undefined,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: style.bg,
          border: style.border,
          color: style.fg,
          fontSize: 11,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: off ? 'grayscale(1)' : undefined,
        }}
      >
        {initial}
      </span>
      <Text style={{ fontSize: 13, color: off ? '#8c8c8c' : undefined }}>{style.label}</Text>
    </div>
  )

  return chip
}
