// MOVE-3608 — Roster Calendar 3.0
//
// A parallel variant of RosterPage.tsx, kept side by side per the repo's
// original/2.0 convention — do not fold the two together. Both satisfy the
// same PRD and share every business rule via rosterStatusLogic.tsx; what
// differs here is presentation, aimed squarely at the "see coverage at a
// glance and plan around gaps" half of the user story:
//
//   - a per-day AM/PM headcount strip pinned under the date header, flagging
//     days that fall to zero AM cover
//   - employees grouped under status headers rather than a tag on every row
//   - name search + status filter + a "coverage gaps only" toggle
//   - denser solid-chip cells, with row/column crosshair highlighting

import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Input, Segmented, Select, Tooltip, Typography, message } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  SettingOutlined,
  EditOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  LEAVES,
  OPERATIONS_EMPLOYEES,
  PUBLIC_HOLIDAYS,
  ROSTER_PATTERNS,
  type RosterEmployee,
} from './rosterData'
import {
  DailyCellResult,
  DailyStatus,
  EMPLOYEE_STATUS_GROUPS,
  STATUS_COLORS,
  computeDailyCoverage,
  employeeStatusGroup,
  isEmployeeVisibleInMonth,
  resolveDailyStatus,
  sortRosterEmployees,
  type EmployeeStatusGroup,
} from './rosterStatusLogic'

const { Text, Title } = Typography

const CELL_WIDTH = 48
const NAME_COL_WIDTH = 210
const MAX_MONTHS_AHEAD = 12

const CTX = { patterns: ROSTER_PATTERNS, leaves: LEAVES, holidays: PUBLIC_HOLIDAYS }

// Solid chips, in contrast to the pale washed cells of the original page.
const CHIP: Record<DailyStatus, { bg: string; fg: string; border?: string; short: string }> = {
  AM: { bg: '#1677ff', fg: '#fff', short: 'AM' },
  AM_WEEKEND: { bg: '#722ed1', fg: '#fff', short: 'AM' },
  PM: { bg: '#52c41a', fg: '#fff', short: 'PM' },
  OFF: { bg: '#f0f0f0', fg: '#8c8c8c', short: 'Off' },
  ON_LEAVE: { bg: '#fa8c16', fg: '#fff', short: 'Lv' },
  PUBLIC_HOLIDAY: { bg: '#ff4d4f', fg: '#fff', short: 'PH' },
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
  const today = useMemo(() => dayjs(), [])
  const [month, setMonth] = useState(() => today.startOf('month'))
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<EmployeeStatusGroup | 'All'>('All')
  const [gapsOnly, setGapsOnly] = useState(false)
  const [hover, setHover] = useState<{ employeeId?: string; dateKey?: string }>({})

  const todayColRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => buildCalendarDays(month), [month])
  const monthStart = month.startOf('month')
  const monthEnd = month.endOf('month')

  // Everyone the PRD says belongs on this month's calendar. Coverage counts are
  // always taken over this full set, never the searched/filtered subset — a
  // headcount that shrank as you typed in the search box would be misleading.
  const monthEmployees = useMemo(
    () =>
      sortRosterEmployees(
        OPERATIONS_EMPLOYEES.filter((e) => isEmployeeVisibleInMonth(e, monthStart, monthEnd))
      ),
    [monthStart, monthEnd]
  )

  const employeeHasGap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const emp of monthEmployees) {
      const hasGap = days.some(
        ({ date, inSelectedMonth }) =>
          inSelectedMonth && resolveDailyStatus(emp, date, CTX).coverageGap
      )
      map.set(emp.id, hasGap)
    }
    return map
  }, [monthEmployees, days])

  const displayedEmployees = useMemo(
    () =>
      monthEmployees.filter((e) => {
        if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
        if (groupFilter !== 'All' && employeeStatusGroup(e.status) !== groupFilter) return false
        if (gapsOnly && !employeeHasGap.get(e.id)) return false
        return true
      }),
    [monthEmployees, search, groupFilter, gapsOnly, employeeHasGap]
  )

  const coverageByDay = useMemo(
    () => days.map(({ date }) => computeDailyCoverage(monthEmployees, date, CTX)),
    [days, monthEmployees]
  )

  const monthStats = useMemo(() => {
    let leave = 0
    let standby = 0
    let gaps = 0
    let zeroAmDays = 0
    days.forEach(({ date, inSelectedMonth }, i) => {
      if (!inSelectedMonth) return
      const c = coverageByDay[i]
      leave += c.leave
      standby += c.standby
      gaps += c.coverageGap
      if (c.am === 0) zeroAmDays++
      void date
    })
    return { leave, standby, gaps, zeroAmDays }
  }, [days, coverageByDay])

  const maxMonth = today.add(MAX_MONTHS_AHEAD, 'month').startOf('month')
  const canGoNext = month.isBefore(maxMonth)

  const scrollToToday = () => {
    requestAnimationFrame(() => {
      todayColRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    })
  }

  // Biz Req §3: open on the current month, highlighted and scrolled to today.
  useEffect(() => {
    scrollToToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToday = () => {
    if (!month.isSame(today, 'month')) setMonth(today.startOf('month'))
    scrollToToday()
  }

  const notImplemented = (feature: string, ticket: string) => {
    message.info(`${feature} is scoped in ${ticket} — not yet implemented in this prototype.`)
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
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<SettingOutlined />} onClick={() => notImplemented('Manage Roster', 'MOVE-3609')}>
            Manage Roster
          </Button>
          <Button icon={<EditOutlined />} onClick={() => notImplemented('Edit Roster', 'MOVE-3658')}>
            Edit Roster
          </Button>
        </div>
      </div>

      {/* Month summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatChip label="Ops employees" value={monthEmployees.length} />
        <StatChip label="Leave days" value={monthStats.leave} tone="#fa8c16" />
        <StatChip label="Standby days" value={monthStats.standby} tone="#faad14" />
        <StatChip label="Coverage gaps" value={monthStats.gaps} tone="#cf1322" alert={monthStats.gaps > 0} />
        <StatChip label="Days with no AM cover" value={monthStats.zeroAmDays} tone="#cf1322" alert={monthStats.zeroAmDays > 0} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Button icon={<LeftOutlined />} onClick={() => setMonth((m) => m.subtract(1, 'month'))} />
        <Button icon={<RightOutlined />} onClick={() => canGoNext && setMonth((m) => m.add(1, 'month'))} disabled={!canGoNext} />
        <Text strong style={{ fontSize: 15, minWidth: 140 }}>{month.format('MMMM YYYY')}</Text>
        <Button icon={<CalendarOutlined />} onClick={handleToday}>Today</Button>

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
        <Segmented
          value={gapsOnly ? 'gaps' : 'all'}
          onChange={(v) => setGapsOnly(v === 'gaps')}
          options={[
            { value: 'all', label: 'All rows' },
            { value: 'gaps', label: 'Coverage gaps' },
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
                const key = date.format('YYYY-MM-DD')
                const isToday = date.isSame(today, 'day')
                const isWeekend = date.day() === 0 || date.day() === 6
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
                    <div style={{ fontSize: 10, color: isWeekend ? '#cf1322' : '#8c8c8c' }}>{date.format('ddd')}</div>
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
                const key = date.format('YYYY-MM-DD')
                const c = coverageByDay[i]
                const noAm = c.am === 0
                return (
                  <Tooltip
                    key={key}
                    title={`${date.format('ddd, D MMM')} — AM ${c.am}, PM ${c.pm}, Off ${c.off}, Leave ${c.leave}${
                      c.coverageGap ? `, Coverage gaps ${c.coverageGap}` : ''
                    }`}
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
                    hover={hover}
                    onHover={setHover}
                    onLeaveClick={() => notImplemented('Leave details', 'MOVE-3659')}
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

function EmployeeRow({
  employee,
  days,
  today,
  hover,
  onHover,
  onLeaveClick,
}: {
  employee: RosterEmployee
  days: CalendarDay[]
  today: Dayjs
  hover: { employeeId?: string; dateKey?: string }
  onHover: (h: { employeeId?: string; dateKey?: string }) => void
  onLeaveClick: () => void
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
          <Text style={{ fontSize: 13, color: '#1a1a1a' }} ellipsis>
            {employee.name}
          </Text>
        </Tooltip>
      </StickyNameCell>
      {days.map(({ date, inSelectedMonth }) => {
        const key = date.format('YYYY-MM-DD')
        const result = resolveDailyStatus(employee, date, CTX)
        return (
          <Cell
            key={key}
            result={result}
            dimmed={!inSelectedMonth}
            isToday={date.isSame(today, 'day')}
            columnHovered={hover.dateKey === key}
            rowHovered={rowHovered}
            onMouseEnter={() => onHover({ employeeId: employee.id, dateKey: key })}
            onClick={result.status === 'ON_LEAVE' ? onLeaveClick : undefined}
          />
        )
      })}
    </div>
  )
}

function Cell({
  result,
  dimmed,
  isToday,
  columnHovered,
  rowHovered,
  onMouseEnter,
  onClick,
}: {
  result: DailyCellResult
  dimmed: boolean
  isToday: boolean
  columnHovered: boolean
  rowHovered: boolean
  onMouseEnter: () => void
  onClick?: () => void
}) {
  const chip = CHIP[result.status]
  const parts: string[] = [STATUS_COLORS[result.status].label]
  if (result.holidayName) parts.push(result.holidayName)
  if (result.leaveType) parts.push(result.leaveType)
  if (result.coverageGap) parts.push('Coverage Gap — standby overlaps approved leave')
  else if (result.standby) parts.push('Standby')

  return (
    <Tooltip title={parts.join(' · ')}>
      <div
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        style={{
          width: CELL_WIDTH,
          flexShrink: 0,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          opacity: dimmed ? 0.4 : 1,
          cursor: onClick ? 'pointer' : 'default',
          background: isToday
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
        {result.coverageGap ? (
          <span style={{ position: 'absolute', top: 3, right: 5, width: 6, height: 6, borderRadius: '50%', background: '#cf1322' }} />
        ) : result.standby ? (
          <span style={{ position: 'absolute', top: 3, right: 5, width: 6, height: 6, borderRadius: '50%', background: '#faad14' }} />
        ) : null}
      </div>
    </Tooltip>
  )
}

function StatChip({
  label,
  value,
  tone = '#1677ff',
  alert = false,
}: {
  label: string
  value: number
  tone?: string
  alert?: boolean
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${alert ? `${tone}55` : '#f0f0f0'}`,
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 600, color: alert ? tone : '#1a1a1a', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{label}</div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cf1322', display: 'inline-block' }} />
        <Text style={{ fontSize: 12, color: '#595959' }}>Coverage Gap</Text>
      </div>
    </div>
  )
}
