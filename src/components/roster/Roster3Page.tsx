// MOVE-3608 — Roster Calendar 3.0
//
// A parallel variant of RosterPage.tsx, kept side by side per the repo's
// original/2.0 convention — do not fold the two together. Both implement the
// same epic (MOVE-3429) and share every business rule via rosterStatusLogic.tsx
// and the same drawer/modals; what differs is presentation, aimed at the "see
// coverage at a glance" half of the user story:
//
//   - a per-day AM/PM headcount strip pinned under the date header
//   - employees grouped under status headers rather than a tag on every row
//   - name search + employee status filter
//   - denser solid-chip cells, with row/column crosshair highlighting

import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Input, Select, Space, Tag, Tooltip, Typography } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  SettingOutlined,
  EditOutlined,
  SearchOutlined,
  WarningOutlined,
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
  EMPLOYEE_STATUS_GROUPS,
  HIGHLIGHT_WINDOW_DAYS,
  ISO,
  SHIFT_LABEL,
  STATUS_COLORS,
  computeDailyCoverage,
  computeRosterHighlights,
  employeeStatusGroup,
  isCellSelectable,
  isEmployeeVisibleInMonth,
  isWeekend,
  resolveDailyStatus,
  sortRosterEmployees,
  type EmployeeStatusGroup,
  type RosterContext,
} from './rosterStatusLogic'
import RosterHighlights from './RosterHighlights'
import ManageRosterDrawer from './ManageRosterDrawer'
import ManageStandbyModal, { type StandbyTarget } from './ManageStandbyModal'
import LeaveDetailsPopover from './LeaveDetailsPopover'
import { PAST_MONTH_TOOLTIP, canEditMonth, useRosterEdit } from './useRosterEdit'

const { Text, Title } = Typography

const CELL_WIDTH = 48
const NAME_COL_WIDTH = 210
const MAX_MONTHS_AHEAD = 12

const CHIP: Record<DailyStatus, { bg: string; fg: string; border?: string; short: string }> = {
  AM: { bg: '#1677ff', fg: '#fff', short: 'AM' },
  AM_WEEKEND: { bg: '#722ed1', fg: '#fff', short: 'AM' },
  PM: { bg: '#52c41a', fg: '#fff', short: 'PM' },
  OFF: { bg: '#f0f0f0', fg: '#8c8c8c', short: 'Off' },
  ON_LEAVE: { bg: '#fa8c16', fg: '#fff', short: 'Lv' },
  PUBLIC_HOLIDAY: { bg: '#52c41a', fg: '#fff', short: 'PH' },
  NA: { bg: 'transparent', fg: '#bfbfbf', border: '1px dashed #d9d9d9', short: 'NA' },
  DASH: { bg: 'transparent', fg: '#d9d9d9', short: '—' },
}

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

export default function Roster3Page() {
  const today = useMemo(() => dayjs().startOf('day'), [])
  const [month, setMonth] = useState(() => today.startOf('month'))
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<EmployeeStatusGroup | 'All'>('All')
  const [hover, setHover] = useState<{ employeeId?: string; dateKey?: string }>({})
  const [revision, setRevision] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openLeaveKey, setOpenLeaveKey] = useState<string | null>(null)
  const [standbyTarget, setStandbyTarget] = useState<StandbyTarget | null>(null)
  const todayColRef = useRef<HTMLDivElement>(null)

  const edit = useRosterEdit(() => setRevision((r) => r + 1))

  const ctx: RosterContext = useMemo(
    () => ({ rules: ROSTER_RULES, leaves: LEAVES, holidays: PUBLIC_HOLIDAYS, overrides: edit.previewOverrides }),
    [edit.previewOverrides, revision]
  )

  const days = useMemo(() => buildCalendarDays(month), [month])
  const monthStart = month.startOf('month')
  const monthEnd = month.endOf('month')

  // Coverage counts are always taken over every Operations employee on the
  // calendar, never the searched/filtered subset — a headcount that shrank as
  // the user typed would be misleading.
  const monthEmployees = useMemo(
    () =>
      sortRosterEmployees(
        OPERATIONS_EMPLOYEES.filter((e) => isEmployeeVisibleInMonth(e, monthStart, monthEnd))
      ),
    [monthStart, monthEnd]
  )

  const displayedEmployees = useMemo(
    () =>
      monthEmployees.filter((e) => {
        if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
        if (groupFilter !== 'All' && employeeStatusGroup(e.status) !== groupFilter) return false
        return true
      }),
    [monthEmployees, search, groupFilter]
  )

  const coverageByDay = useMemo(
    () => days.map(({ date }) => computeDailyCoverage(monthEmployees, date, ctx)),
    [days, monthEmployees, ctx]
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

  const grouped = EMPLOYEE_STATUS_GROUPS.map((group) => ({
    group,
    employees: displayedEmployees.filter((e) => employeeStatusGroup(e.status) === group),
  })).filter((g) => g.employees.length > 0)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Roster Calendar 3.0</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Operations department — coverage-first monthly view
          </Text>
        </div>
        {!edit.editing && (
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setDrawerOpen(true)}>Manage Roster</Button>
            <Tooltip title={editableMonth ? undefined : PAST_MONTH_TOOLTIP}>
              <Button icon={<EditOutlined />} disabled={!editableMonth} onClick={edit.start}>
                Edit Roster
              </Button>
            </Tooltip>
          </Space>
        )}
      </div>

      {/* MOVE-3607 */}
      <div style={{ marginBottom: 16 }}>
        <RosterHighlights highlights={highlights} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Tooltip title={edit.editing ? 'Month navigation is disabled while editing' : undefined}>
          <Button icon={<LeftOutlined />} disabled={edit.editing} onClick={() => setMonth((m) => m.subtract(1, 'month'))} />
        </Tooltip>
        <Button icon={<RightOutlined />} disabled={!canGoNext} onClick={() => canGoNext && setMonth((m) => m.add(1, 'month'))} />
        <Text strong style={{ fontSize: 15, minWidth: 140 }}>{month.format('MMMM YYYY')}</Text>
        <Button icon={<CalendarOutlined />} disabled={edit.editing} onClick={handleToday}>Today</Button>
        {edit.editing && <Tag color="blue">Edit mode</Tag>}

        <div style={{ flex: 1 }} />

        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Search employee"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200 }}
        />
        <Select
          value={groupFilter}
          onChange={setGroupFilter}
          style={{ width: 170 }}
          options={[
            { value: 'All', label: 'All employee status' },
            ...EMPLOYEE_STATUS_GROUPS.map((g) => ({ value: g, label: g })),
          ]}
        />
      </div>

      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: NAME_COL_WIDTH + days.length * CELL_WIDTH }}>
            {/* Sticky date header */}
            <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
              <StickyNameCell background="#fafafa" zIndex={6}>
                <Text strong style={{ fontSize: 12, color: '#595959' }}>Employee</Text>
              </StickyNameCell>
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
                      opacity: inSelectedMonth ? 1 : 0.4,
                      background: isToday ? '#e6f4ff' : holiday ? '#fff1f0' : hover.dateKey === key ? '#f5f5f5' : undefined,
                      borderTop: isToday ? '2px solid #1677ff' : '2px solid transparent',
                    }}
                  >
                    <div style={{ fontSize: 10, color: weekend ? '#cf1322' : '#8c8c8c' }}>{date.format('ddd')}</div>
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

            {/* Coverage strip */}
            <div style={{ display: 'flex', background: '#fcfcfc', borderBottom: '1px solid #f0f0f0' }}>
              <StickyNameCell background="#fcfcfc" zIndex={4}>
                <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Coverage (AM / PM)</Text>
              </StickyNameCell>
              {days.map(({ date, inSelectedMonth }, i) => {
                const key = date.format(ISO)
                const c = coverageByDay[i]
                const noAm = c.am === 0
                return (
                  <Tooltip
                    key={key}
                    title={`${date.format('ddd, D MMM')} — AM ${c.am}, PM ${c.pm}, Off ${c.off}, Leave ${c.leave}, Standby ${c.standby}`}
                  >
                    <div
                      style={{
                        width: CELL_WIDTH,
                        flexShrink: 0,
                        textAlign: 'center',
                        padding: '4px 2px',
                        opacity: inSelectedMonth ? 1 : 0.4,
                        background: hover.dateKey === key ? '#f5f5f5' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: noAm ? '#cf1322' : '#1677ff' }}>
                        {noAm ? <WarningOutlined /> : c.am}
                      </div>
                      <div style={{ fontSize: 11, color: '#52c41a' }}>{c.pm}</div>
                    </div>
                  </Tooltip>
                )
              })}
            </div>

            {/* Employee rows, grouped by status */}
            {grouped.map(({ group, employees }) => (
              <div key={group}>
                <div style={{ display: 'flex', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <StickyNameCell background="#fafafa" zIndex={4} padding="6px 12px">
                    <Text strong style={{ fontSize: 11, color: '#595959', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {group} · {employees.length}
                    </Text>
                  </StickyNameCell>
                  <div style={{ flex: 1 }} />
                </div>

                {employees.map((emp) => (
                  <EmployeeRow
                    key={emp.id}
                    employee={emp}
                    days={days}
                    today={today}
                    ctx={ctx}
                    hover={hover}
                    onHover={setHover}
                    edit={edit}
                    openLeaveKey={openLeaveKey}
                    onLeaveOpenChange={setOpenLeaveKey}
                    onManageStandby={setStandbyTarget}
                  />
                ))}
              </div>
            ))}

            {displayedEmployees.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <Text type="secondary">
                  {monthEmployees.length === 0
                    ? `No Operations employees active during ${month.format('MMMM YYYY')}.`
                    : 'No employees match the current filters.'}
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>

      <Legend />

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

function StickyNameCell({
  children,
  background,
  zIndex,
  padding = '8px 12px',
}: {
  children: React.ReactNode
  background: string
  zIndex: number
  padding?: string
}) {
  return (
    <div
      style={{
        width: NAME_COL_WIDTH,
        flexShrink: 0,
        position: 'sticky',
        left: 0,
        zIndex,
        background,
        borderRight: '1px solid #f0f0f0',
        padding,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  )
}

type EditApi = ReturnType<typeof useRosterEdit>

function EmployeeRow({
  employee,
  days,
  today,
  ctx,
  hover,
  onHover,
  edit,
  openLeaveKey,
  onLeaveOpenChange,
  onManageStandby,
}: {
  employee: RosterEmployee
  days: CalendarDay[]
  today: Dayjs
  ctx: RosterContext
  hover: { employeeId?: string; dateKey?: string }
  onHover: (h: { employeeId?: string; dateKey?: string }) => void
  edit: EditApi
  openLeaveKey: string | null
  onLeaveOpenChange: (key: string | null) => void
  onManageStandby: (target: StandbyTarget) => void
}) {
  const rowHovered = hover.employeeId === employee.id
  return (
    <div
      style={{ display: 'flex', borderBottom: '1px solid #f5f5f5', background: rowHovered ? '#fafcff' : '#fff' }}
      onMouseLeave={() => onHover({})}
    >
      <StickyNameCell background={rowHovered ? '#fafcff' : '#fff'} zIndex={3} padding="0 12px">
        <Tooltip
          title={`${employee.status} · Contract ${employee.contractStartDate}${
            employee.contractEndDate ? ` → ${employee.contractEndDate}` : ' → open-ended'
          }`}
        >
          <Text style={{ fontSize: 13, color: '#1a1a1a' }} ellipsis>{employee.name}</Text>
        </Tooltip>
      </StickyNameCell>
      {days.map(({ date, inSelectedMonth }) => {
        const key = date.format(ISO)
        return (
          <Cell
            key={key}
            employee={employee}
            date={date}
            result={resolveDailyStatus(employee, date, ctx)}
            dimmed={!inSelectedMonth}
            isToday={date.isSame(today, 'day')}
            columnHovered={hover.dateKey === key}
            rowHovered={rowHovered}
            editing={edit.editing && inSelectedMonth}
            selected={edit.isSelected(employee.id, key)}
            openLeaveKey={openLeaveKey}
            onLeaveOpenChange={onLeaveOpenChange}
            onMouseEnter={() => onHover({ employeeId: employee.id, dateKey: key })}
            onToggleSelect={() => edit.toggleCell(employee.id, key, isWeekend(date))}
            onManageStandby={() =>
              onManageStandby({ employeeId: employee.id, employeeName: employee.name, date: key })
            }
          />
        )
      })}
    </div>
  )
}

function Cell({
  employee,
  date,
  result,
  dimmed,
  isToday,
  columnHovered,
  rowHovered,
  editing,
  selected,
  openLeaveKey,
  onLeaveOpenChange,
  onMouseEnter,
  onToggleSelect,
  onManageStandby,
}: {
  employee: RosterEmployee
  date: Dayjs
  result: DailyCellResult
  dimmed: boolean
  isToday: boolean
  columnHovered: boolean
  rowHovered: boolean
  editing: boolean
  selected: boolean
  openLeaveKey: string | null
  onLeaveOpenChange: (key: string | null) => void
  onMouseEnter: () => void
  onToggleSelect: () => void
  onManageStandby: () => void
}) {
  const chip = CHIP[result.status]
  const key = `${employee.id}|${date.format(ISO)}`
  const selectable = editing && isCellSelectable(result)

  const parts: string[] = [STATUS_COLORS[result.status].label]
  if (result.holidayName) parts.push(result.holidayName)
  if (result.edited) parts.push('Edited')
  if (result.standby) parts.push('Standby')
  if (editing && !selectable && result.status !== 'ON_LEAVE') parts.push('Not editable')

  const body = (
    <div
      onMouseEnter={onMouseEnter}
      onClick={selectable ? onToggleSelect : undefined}
      style={{
        width: CELL_WIDTH,
        flexShrink: 0,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        opacity: dimmed ? 0.4 : 1,
        cursor: selectable || result.status === 'ON_LEAVE' ? 'pointer' : 'default',
        outline: selected ? '2px solid #1677ff' : undefined,
        outlineOffset: -2,
        background: selected
          ? '#bae0ff'
          : isToday
            ? 'rgba(22,119,255,0.06)'
            : columnHovered || rowHovered
              ? 'rgba(0,0,0,0.02)'
              : undefined,
      }}
    >
      <span
        style={{
          minWidth: 30,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: '20px',
          borderRadius: 5,
          padding: '0 6px',
          background: chip.bg,
          color: chip.fg,
          border: chip.border,
        }}
      >
        {chip.short}
      </span>

      {result.standby && (
        <span style={{ position: 'absolute', top: 3, right: 5, width: 6, height: 6, borderRadius: '50%', background: '#faad14' }} />
      )}

      {result.edited && (
        <span style={{ position: 'absolute', top: 3, left: 4, width: 5, height: 5, borderRadius: '50%', background: '#1677ff' }} />
      )}

      {editing && (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onManageStandby()
          }}
          style={{ position: 'absolute', bottom: 0, right: 2, fontSize: 8, color: '#1677ff', cursor: 'pointer', lineHeight: 1, padding: 2 }}
        >
          <PlusOutlined />
        </span>
      )}
    </div>
  )

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

  return <Tooltip title={parts.join(' · ')}>{body}</Tooltip>
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
  shiftOptions: readonly ('AM' | 'PM' | 'OFF')[]
  onApply: (shift: 'AM' | 'PM' | 'OFF') => void
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
          <Text strong style={{ fontSize: 13 }}>{count} cell{count === 1 ? '' : 's'} selected</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{weekend ? 'Weekend selection' : 'Weekday selection'}</Text>
          <Space size={4}>
            {shiftOptions.map((shift) => (
              <Button key={shift} size="small" onClick={() => onApply(shift)}>Set {SHIFT_LABEL[shift]}</Button>
            ))}
          </Space>
          <Button size="small" type="text" onClick={onClearSelection}>Clear selection</Button>
        </>
      ) : (
        <Text type="secondary" style={{ fontSize: 13 }}>
          Select AM, PM or Off Day cells to apply a bulk change. Use + on a cell to manage standby.
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

function Legend() {
  const entries: DailyStatus[] = ['AM', 'AM_WEEKEND', 'PM', 'OFF', 'ON_LEAVE', 'PUBLIC_HOLIDAY', 'NA', 'DASH']
  return (
    <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      {entries.map((status) => {
        const chip = CHIP[status]
        return (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                minWidth: 26,
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 600,
                lineHeight: '18px',
                borderRadius: 5,
                padding: '0 5px',
                background: chip.bg,
                color: chip.fg,
                border: chip.border,
              }}
            >
              {chip.short}
            </span>
            <Text style={{ fontSize: 12, color: '#595959' }}>{STATUS_COLORS[status].label}</Text>
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
