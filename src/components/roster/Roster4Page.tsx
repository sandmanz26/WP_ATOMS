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
//   MOVE-3607 — the two highlight badges, here as pills that also filter.
//   MOVE-3659 — clicking a bar opens the view-only Details Card, staff A–Z.
//   MOVE-3609/3610/3611/3705 — via the shared Manage Roster drawer.
//   MOVE-3658 — edit mode: pick a day, edit it in a drawer with its own
//     Save/Cancel, then commit or discard the whole session.
//
// Status resolution comes from the shared rosterStatusLogic.tsx, so rules
// cannot drift between the variants.

import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Checkbox, Drawer, Empty, Popover, Segmented, Space, Tooltip, Typography, message } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  SettingOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  WarningFilled,
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
  type ShiftCode,
} from './rosterData'
import {
  DAY_GROUP_ORDER,
  DAY_GROUP_STYLE,
  HIGHLIGHT_WINDOW_DAYS,
  ISO,
  SHIFT_LABEL,
  computeDayGroups,
  computeRosterHighlights,
  employeesOnDuty,
  isoDayIndex,
  isWeekend,
  resolveDailyStatus,
  shiftOptionsForDay,
  type DayGroup,
  type DayGroupKey,
  type RosterContext,
} from './rosterStatusLogic'
import ManageRosterDrawer from './ManageRosterDrawer'
import RosterVariantSwitcher, {
  CALENDAR_STYLE_METRICS,
  DEFAULT_VARIANTS,
  type CalendarStyle,
  type RosterVariantState,
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
    // The rules array is mutated in place by the Manage Roster drawer.
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
      {/* Title row — highlights sit here as compact pills (feedback item 4). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Roster Calendar 4.0</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Operations department — month grid with daily coverage
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <HighlightPill
            icon={<ExclamationCircleFilled />}
            count={highlights.noStandbyDays}
            label="days with no standby coverage"
            windowDays={highlights.windowDays}
            tone="#d46b08"
            active={highlightFilter === 'noStandby'}
            onClick={() => setHighlightFilter((f) => (f === 'noStandby' ? 'none' : 'noStandby'))}
          />
          <HighlightPill
            icon={<WarningFilled />}
            count={highlights.noShiftDays}
            label="days with no AM/PM shift assigned"
            windowDays={highlights.windowDays}
            tone="#cf1322"
            active={highlightFilter === 'noShift'}
            onClick={() => setHighlightFilter((f) => (f === 'noShift' ? 'none' : 'noShift'))}
          />
        </div>
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
              <Button icon={<SettingOutlined />} onClick={() => setManageOpen(true)}>Manage Roster</Button>
              <Tooltip title={editableMonth ? undefined : PAST_MONTH_TOOLTIP}>
                <Button type="primary" icon={<EditOutlined />} disabled={!editableMonth} onClick={startEdit}>
                  Edit Roster
                </Button>
              </Tooltip>
            </Space>
          )}
        </div>

        {/* Legend above the calendar, Ops Calendar chip styling (feedback item 1). */}
        <Legend
          filtersEnabled={variants.legendFilters}
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

        {/* Only edit mode carries a helper line; the view mode is self-explanatory. */}
        {editing ? (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', margin: '10px 0 12px' }}>
            Edit mode — click a day to open its roster and set AM / PM / Off / Standby for each employee.
            "On Leave" staff are view-only and excluded from the other sections.
          </Text>
        ) : (
          <div style={{ height: 12 }} />
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
                hiddenGroups={variants.legendFilters ? hiddenGroups : EMPTY_HIDDEN}
              />
            ))}
          </div>
        ))}
      </div>

      {editing && (
        <EditDayDrawer
          date={editDate}
          ctx={ctx}
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

function HighlightPill({
  icon,
  count,
  label,
  windowDays,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode
  count: number
  label: string
  windowDays: number
  tone: string
  active: boolean
  onClick: () => void
}) {
  const clear = count === 0
  return (
    <Tooltip title={clear ? 'Nothing to filter' : active ? 'Click to clear the filter' : 'Click to filter the calendar to these days'}>
      <div
        onClick={() => !clear && onClick()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 18,
          border: `1px solid ${clear ? '#f0f0f0' : `${tone}66`}`,
          background: active ? `${tone}1a` : clear ? '#fff' : `${tone}0d`,
          cursor: clear ? 'default' : 'pointer',
          boxShadow: active ? `0 0 0 2px ${tone}33` : undefined,
        }}
      >
        <span style={{ fontSize: 14, color: clear ? '#52c41a' : tone, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 13, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
          <strong style={{ color: clear ? '#1a1a1a' : tone }}>{count}</strong> {label}{' '}
          <Text type="secondary" style={{ fontSize: 12 }}>(next {windowDays} days)</Text>
        </span>
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
  // In chip mode the label shrinks to its initial so a whole day fits on one line.
  const text = chip
    ? `${group.label === 'No Roster' ? 'NR' : group.label === 'On Leave' ? 'L' : group.label.charAt(0)}${group.employees.length}`
    : `${group.label} (${group.employees.length})`

  const bar = (
    <div
      title={chip ? `${group.label} (${group.employees.length})` : undefined}
      style={{
        background: style.bg,
        color: style.fg,
        border: style.border ?? '1px solid transparent',
        borderRadius: 4,
        padding: metrics.barPadding,
        fontSize: metrics.barFontSize,
        fontWeight: 500,
        cursor: interactive ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(chip ? { minWidth: 26, textAlign: 'center' as const } : {}),
      }}
    >
      {text}
      {metrics.showNames && (
        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, whiteSpace: 'normal' }}>
          {group.employees.map((e) => e.name.split(' ')[0]).join(', ')}
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
        <div style={{ minWidth: 180 }}>
          {group.employees.map((employee) => (
            <div key={employee.id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
              {employee.name}
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
  onClose,
  onCommitDay,
}: {
  date: Dayjs | null
  ctx: RosterContext
  onClose: () => void
  onCommitDay: (overrides: RosterOverride[]) => void
}) {
  // Pending edits for this day, keyed by employee id.
  const [pending, setPending] = useState<Record<string, Partial<RosterOverride>>>({})

  useEffect(() => {
    setPending({})
  }, [date])

  if (!date) return <Drawer open={false} onClose={onClose} />

  const dateStr = date.format(ISO)
  // MOVE-3658 §3 — eligible employees are listed A–Z by name.
  const onDuty = employeesOnDuty(OPERATIONS_EMPLOYEES, dateStr).sort((a, b) => a.name.localeCompare(b.name))
  const resolved = onDuty.map((employee) => ({ employee, result: resolveDailyStatus(employee, date, ctx) }))
  const onLeave = resolved.filter((r) => r.result.status === 'ON_LEAVE')
  const editable = resolved.filter((r) => r.result.status !== 'ON_LEAVE')

  // Weekdays: AM/PM. Weekends: AM/Off Day.
  const dayHoliday = PUBLIC_HOLIDAYS.find((h) => h.date === dateStr)
  // MOVE-3658 §3 — on a public holiday the shift is fixed to Off Day and the
  // control is read-only. The options still render so the row reads the same,
  // they just cannot be changed. Standby stays editable.
  const dayShiftOptions: ShiftCode[] = dayHoliday
    ? Array.from(new Set<ShiftCode>([...shiftOptionsForDay(date), 'OFF']))
    : shiftOptionsForDay(date)

  const resolvedShift = (status: string): ShiftCode | undefined => {
    if (status === 'AM' || status === 'AM_WEEKEND') return 'AM'
    if (status === 'PM') return 'PM'
    if (status === 'OFF' || status === 'PUBLIC_HOLIDAY') return 'OFF'
    return undefined // No Roster — nothing set yet
  }

  const shiftOf = (employeeId: string, status: string) =>
    (pending[employeeId]?.shift as ShiftCode | undefined) ?? resolvedShift(status)

  const standbyOf = (employeeId: string, standby: boolean) => pending[employeeId]?.standby ?? standby

  const stage = (employeeId: string, patch: Partial<RosterOverride>) =>
    setPending((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }))

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

  return (
    <Drawer
      open
      onClose={onClose}
      width={480}
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
            onLeave.map(({ employee, result }) => (
              <Tooltip
                key={employee.id}
                title={`${result.leave?.type}${result.leave?.timing ? ` · ${result.leave.timing}` : ''}`}
              >
                <span
                  style={{
                    fontSize: 12,
                    padding: '2px 10px',
                    borderRadius: 12,
                    background: '#ffccc7',
                    color: '#a8071a',
                  }}
                >
                  {employee.name}
                </span>
              </Tooltip>
            ))
          )}
        </div>
      </div>

      <Text strong style={{ fontSize: 13 }}>{editable.length} Employees</Text>

      {editable.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No employees to roster on this date." />
      ) : (
        editable.map(({ employee, result }) => (
          <div key={employee.id} style={{ padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>{employee.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Segmented
                size="small"
                disabled={!!dayHoliday}
                value={dayHoliday ? 'OFF' : shiftOf(employee.id, result.status) ?? ''}
                onChange={(v) => stage(employee.id, { shift: v as ShiftCode })}
                options={dayShiftOptions.map((s) => ({ value: s, label: SHIFT_LABEL[s] }))}
              />
              {/* Standby is independent of the shift above (MOVE-3608). */}
              <Checkbox
                checked={standbyOf(employee.id, result.standby)}
                onChange={(e) => stage(employee.id, { standby: e.target.checked })}
                style={{ fontSize: 12 }}
              >
                Standby
              </Checkbox>
            </div>
          </div>
        ))
      )}
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

      <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
        “No Roster” = joined, no roster set
      </Text>
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
          background: style.bg === 'transparent' ? '#fafafa' : style.bg,
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

  if (!filtersEnabled) return chip
  return <Tooltip title={hidden ? `Show ${style.label} in the calendar` : `Hide ${style.label} from the calendar`}>{chip}</Tooltip>
}
