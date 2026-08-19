// MOVE-3608 — Operations Roster Calendar.
//
// Wires the epic together: Roster Highlights (MOVE-3607), the Manage Roster
// drawer (MOVE-3609 + rule create/edit/delete), Bulk Edit Roster (MOVE-3658)
// with the Manage Standby modal, and the Leave Details popover (MOVE-3659).
// All business rules come from rosterStatusLogic.tsx, shared with Roster 3.0.

import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  SettingOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  LEAVES,
  OPERATIONS_EMPLOYEES,
  PUBLIC_HOLIDAYS,
  ROSTER_RULES,
  type RosterEmployee,
} from './rosterData'
import {
  DailyCellResult,
  DailyStatus,
  HIGHLIGHT_WINDOW_DAYS,
  ISO,
  SHIFT_LABEL,
  STATUS_COLORS,
  EMPLOYEE_STATUS_COLORS,
  computeRosterHighlights,
  isCellSelectable,
  isEmployeeVisibleInMonth,
  isWeekend,
  resolveDailyStatus,
  sortRosterEmployees,
  type RosterContext,
} from './rosterStatusLogic'
import RosterHighlights from './RosterHighlights'
import ManageRosterDrawer from './ManageRosterDrawer'
import ManageStandbyModal, { type StandbyTarget } from './ManageStandbyModal'
import LeaveDetailsPopover from './LeaveDetailsPopover'
import { PAST_MONTH_TOOLTIP, canEditMonth, useRosterEdit } from './useRosterEdit'

const { Text, Title } = Typography

const CELL_WIDTH = 56
const NAME_COL_WIDTH = 200
const MAX_MONTHS_AHEAD = 12

interface CalendarDay {
  date: Dayjs
  inSelectedMonth: boolean
}

function buildCalendarDays(month: Dayjs): CalendarDay[] {
  const monthStart = month.startOf('month')
  const monthEnd = month.endOf('month')
  const days: CalendarDay[] = []
  for (let i = 3; i >= 1; i--) days.push({ date: monthStart.subtract(i, 'day'), inSelectedMonth: false })
  for (let d = 0; d < monthEnd.date(); d++) days.push({ date: monthStart.add(d, 'day'), inSelectedMonth: true })
  for (let i = 1; i <= 3; i++) days.push({ date: monthEnd.add(i, 'day'), inSelectedMonth: false })
  return days
}

export default function RosterPage() {
  const today = useMemo(() => dayjs().startOf('day'), [])
  const [month, setMonth] = useState(() => today.startOf('month'))
  const [revision, setRevision] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openLeaveKey, setOpenLeaveKey] = useState<string | null>(null)
  const [standbyTarget, setStandbyTarget] = useState<StandbyTarget | null>(null)
  const todayColRef = useRef<HTMLDivElement>(null)

  const edit = useRosterEdit(() => setRevision((r) => r + 1))

  const ctx: RosterContext = useMemo(
    () => ({ rules: ROSTER_RULES, leaves: LEAVES, holidays: PUBLIC_HOLIDAYS, overrides: edit.previewOverrides }),
    // ROSTER_RULES is mutated in place by the drawer, so revision forces a rebuild.
    [edit.previewOverrides, revision]
  )

  const days = useMemo(() => buildCalendarDays(month), [month])
  const monthStart = month.startOf('month')
  const monthEnd = month.endOf('month')

  const visibleEmployees = useMemo(
    () =>
      sortRosterEmployees(
        OPERATIONS_EMPLOYEES.filter((e) => isEmployeeVisibleInMonth(e, monthStart, monthEnd))
      ),
    [monthStart, monthEnd]
  )

  const highlights = useMemo(
    () => computeRosterHighlights(OPERATIONS_EMPLOYEES, today, ctx, HIGHLIGHT_WINDOW_DAYS),
    [today, ctx]
  )

  const editableMonth = canEditMonth(month, today)
  const maxMonth = today.add(MAX_MONTHS_AHEAD, 'month').startOf('month')
  const canGoNext = month.isBefore(maxMonth) && !edit.editing

  const scrollToToday = () => {
    requestAnimationFrame(() => {
      todayColRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    })
  }

  useEffect(() => {
    scrollToToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToday = () => {
    if (edit.editing) return
    if (!month.isSame(today, 'month')) setMonth(today.startOf('month'))
    scrollToToday()
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Roster Calendar</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Operations department — monthly shift coverage
          </Text>
        </div>
        {!edit.editing && (
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setDrawerOpen(true)}>Manage Shift Patterns</Button>
            <Tooltip title={editableMonth ? undefined : PAST_MONTH_TOOLTIP}>
              <Button icon={<EditOutlined />} disabled={!editableMonth} onClick={edit.start}>
                Edit Roster
              </Button>
            </Tooltip>
          </Space>
        )}
      </div>

      {/* MOVE-3607 — highlights sit above the calendar. */}
      <div style={{ marginBottom: 16 }}>
        <RosterHighlights highlights={highlights} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Tooltip title={edit.editing ? 'Month navigation is disabled while editing' : undefined}>
          <Button icon={<LeftOutlined />} disabled={edit.editing} onClick={() => setMonth((m) => m.subtract(1, 'month'))} />
        </Tooltip>
        <Button icon={<RightOutlined />} disabled={!canGoNext} onClick={() => canGoNext && setMonth((m) => m.add(1, 'month'))} />
        <Text strong style={{ fontSize: 15, minWidth: 140 }}>{month.format('MMMM YYYY')}</Text>
        <Button icon={<CalendarOutlined />} disabled={edit.editing} onClick={handleToday}>Today</Button>
        {edit.editing && <Tag color="blue" style={{ marginLeft: 4 }}>Edit mode</Tag>}
      </div>

      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: NAME_COL_WIDTH + days.length * CELL_WIDTH }}>
            {/* Sticky date header */}
            <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
              <div
                style={{
                  width: NAME_COL_WIDTH,
                  flexShrink: 0,
                  position: 'sticky',
                  left: 0,
                  zIndex: 6,
                  background: '#fafafa',
                  borderRight: '1px solid #f0f0f0',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Text strong style={{ fontSize: 12, color: '#595959' }}>Employee</Text>
              </div>
              {days.map(({ date, inSelectedMonth }) => {
                const key = date.format(ISO)
                const isToday = date.isSame(today, 'day')
                const weekend = isWeekend(date)
                const holiday = PUBLIC_HOLIDAYS.find((h) => h.date === key)
                const header = (
                  <div
                    ref={isToday ? todayColRef : undefined}
                    style={{
                      width: CELL_WIDTH,
                      flexShrink: 0,
                      textAlign: 'center',
                      padding: '6px 2px',
                      opacity: inSelectedMonth ? 1 : 0.45,
                      background: isToday ? '#e6f4ff' : holiday ? '#fff1f0' : undefined,
                      borderLeft: isToday ? '2px solid #1677ff' : undefined,
                      borderRight: isToday ? '2px solid #1677ff' : undefined,
                    }}
                  >
                    <div style={{ fontSize: 11, color: weekend ? '#cf1322' : '#8c8c8c' }}>{date.format('ddd')}</div>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? '#1677ff' : '#1a1a1a' }}>
                      {date.format('D')}
                    </div>
                  </div>
                )
                return holiday ? (
                  <Tooltip key={key} title={`Public Holiday — ${holiday.name}`}>{header}</Tooltip>
                ) : (
                  <div key={key}>{header}</div>
                )
              })}
            </div>

            {/* Employee rows */}
            {visibleEmployees.map((emp) => (
              <div key={emp.id} style={{ display: 'flex', borderBottom: '1px solid #f5f5f5' }}>
                <div
                  style={{
                    width: NAME_COL_WIDTH,
                    flexShrink: 0,
                    position: 'sticky',
                    left: 0,
                    zIndex: 4,
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 13, color: '#1a1a1a' }}>{emp.name}</div>
                  <Tag
                    style={{ marginTop: 2, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}
                    color={EMPLOYEE_STATUS_COLORS[emp.status]}
                  >
                    {emp.status}
                  </Tag>
                </div>
                {days.map(({ date, inSelectedMonth }) => (
                  <RosterCell
                    key={date.format(ISO)}
                    employee={emp}
                    date={date}
                    result={resolveDailyStatus(emp, date, ctx)}
                    dimmed={!inSelectedMonth}
                    highlighted={date.isSame(today, 'day')}
                    editing={edit.editing && inSelectedMonth}
                    selected={edit.isSelected(emp.id, date.format(ISO))}
                    openLeaveKey={openLeaveKey}
                    onLeaveOpenChange={setOpenLeaveKey}
                    onToggleSelect={() => edit.toggleCell(emp.id, date.format(ISO), isWeekend(date))}
                    onManageStandby={() =>
                      setStandbyTarget({ employeeId: emp.id, employeeName: emp.name, date: date.format(ISO) })
                    }
                  />
                ))}
              </div>
            ))}

            {visibleEmployees.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <Text type="secondary">No Operations employees active during {month.format('MMMM YYYY')}.</Text>
              </div>
            )}
          </div>
        </div>
      </div>

      <RosterLegend />

      {edit.editing && (
        <BulkActionBar
          count={edit.selectedCount}
          weekend={edit.weekendSelection}
          shiftOptions={edit.shiftOptions}
          onApply={edit.applyShift}
          onClearSelection={edit.clearSelection}
          onSave={edit.save}
          onCancel={edit.cancel}
        />
      )}

      <ManageRosterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRulesChanged={() => setRevision((r) => r + 1)}
      />

      <ManageStandbyModal
        open={!!standbyTarget}
        target={standbyTarget}
        editMonth={month}
        onCancel={() => setStandbyTarget(null)}
        onApply={(overrides) => {
          edit.applyStandby(overrides)
          setStandbyTarget(null)
        }}
      />
    </div>
  )
}

function RosterCell({
  employee,
  date,
  result,
  dimmed,
  highlighted,
  editing,
  selected,
  openLeaveKey,
  onLeaveOpenChange,
  onToggleSelect,
  onManageStandby,
}: {
  employee: RosterEmployee
  date: Dayjs
  result: DailyCellResult
  dimmed: boolean
  highlighted: boolean
  editing: boolean
  selected: boolean
  openLeaveKey: string | null
  onLeaveOpenChange: (key: string | null) => void
  onToggleSelect: () => void
  onManageStandby: () => void
}) {
  const colors = STATUS_COLORS[result.status]
  const key = `${employee.id}|${date.format(ISO)}`
  const selectable = editing && isCellSelectable(result)

  const tooltip: string[] = [colors.label]
  if (result.holidayName) tooltip.push(result.holidayName)
  if (result.edited) tooltip.push('Edited')
  if (result.standby) tooltip.push('Standby')
  if (editing && !selectable && result.status !== 'ON_LEAVE') tooltip.push('Not editable')

  const body = (
    <div
      onClick={selectable ? onToggleSelect : undefined}
      style={{
        width: CELL_WIDTH,
        flexShrink: 0,
        height: 52,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: selected ? '#bae0ff' : highlighted ? '#e6f4ff' : colors.bg,
        opacity: dimmed ? 0.45 : 1,
        position: 'relative',
        cursor: selectable ? 'pointer' : result.status === 'ON_LEAVE' ? 'pointer' : 'default',
        outline: selected ? '2px solid #1677ff' : undefined,
        outlineOffset: -2,
        borderLeft: highlighted && !selected ? '2px solid #1677ff' : undefined,
        borderRight: highlighted && !selected ? '2px solid #1677ff' : undefined,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: colors.text }}>
        {result.status === 'DASH' ? '—' : shortLabel(result.status)}
      </span>

      {result.standby && (
        <span style={{ position: 'absolute', bottom: 3, left: '50%', marginLeft: -3, width: 6, height: 6, borderRadius: '50%', background: '#faad14' }} />
      )}

      {result.edited && (
        <span style={{ position: 'absolute', top: 3, left: 4, width: 5, height: 5, borderRadius: '50%', background: '#1677ff' }} />
      )}

      {/* MOVE-3658 §3 — the "+" beneath a day cell opens Manage Standby. */}
      {editing && (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onManageStandby()
          }}
          style={{
            position: 'absolute',
            bottom: 1,
            right: 2,
            fontSize: 9,
            color: '#1677ff',
            cursor: 'pointer',
            lineHeight: 1,
            padding: 2,
          }}
        >
          <PlusOutlined />
        </span>
      )}
    </div>
  )

  // MOVE-3659 — clicking a leave cell opens its details popover.
  if (result.status === 'ON_LEAVE' && result.leave && !editing) {
    return (
      <LeaveDetailsPopover
        leave={result.leave}
        employeeName={employee.name}
        open={openLeaveKey === key}
        onOpenChange={(open) => onLeaveOpenChange(open ? key : null)}
      >
        {body}
      </LeaveDetailsPopover>
    )
  }

  return <Tooltip title={tooltip.join(' — ')}>{body}</Tooltip>
}

function shortLabel(status: DailyStatus): string {
  switch (status) {
    case 'ON_LEAVE':
      return 'Leave'
    case 'AM_WEEKEND':
      return 'AM'
    case 'PUBLIC_HOLIDAY':
    case 'NA':
      return 'Not Assigned'
    default:
      return status
  }
}

function BulkActionBar({
  count,
  weekend,
  shiftOptions,
  onApply,
  onClearSelection,
  onSave,
  onCancel,
}: {
  count: number
  weekend: boolean
  shiftOptions: readonly ('AM' | 'PM')[]
  onApply: (shift: 'AM' | 'PM') => void
  onClearSelection: () => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div
      // Sticky rather than fixed: the sidebar sits at a higher stacking level,
      // so a viewport-fixed bar would be hidden behind it on the left.
      style={{
        position: 'sticky',
        bottom: 0,
        margin: '16px -24px -24px',
        background: '#fff',
        borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        zIndex: 50,
      }}
    >
      {count > 0 ? (
        <>
          <Text strong style={{ fontSize: 13 }}>
            {count} cell{count === 1 ? '' : 's'} selected
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {weekend ? 'Weekend selection' : 'Weekday selection'}
          </Text>
          <Space size={4}>
            {shiftOptions.map((shift) => (
              <Button key={shift} size="small" onClick={() => onApply(shift)}>
                Set {SHIFT_LABEL[shift]}
              </Button>
            ))}
          </Space>
          <Button size="small" type="text" onClick={onClearSelection}>Clear selection</Button>
        </>
      ) : (
        <Text type="secondary" style={{ fontSize: 13 }}>
          Select AM or PM cells to apply a bulk change. Use + on a cell to manage standby.
        </Text>
      )}
      <div style={{ flex: 1 }} />
      <Space>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={onSave}>Save</Button>
      </Space>
    </div>
  )
}

function RosterLegend() {
  const entries: DailyStatus[] = ['AM', 'AM_WEEKEND', 'PM', 'ON_LEAVE', 'PUBLIC_HOLIDAY', 'NA', 'DASH']
  return (
    <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
      {entries.map((status) => {
        const c = STATUS_COLORS[status]
        return (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: c.bg, border: `1px solid ${c.text}22`, display: 'inline-block' }} />
            <Text style={{ fontSize: 12, color: '#595959' }}>{c.label}</Text>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#faad14', display: 'inline-block' }} />
        <Text style={{ fontSize: 12, color: '#595959' }}>Standby</Text>
      </div>
    </div>
  )
}
