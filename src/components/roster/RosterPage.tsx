// MOVE-3608 — Operations Roster Calendar

import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Tag, Tooltip, Typography, message } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  SettingOutlined,
  EditOutlined,
} from '@ant-design/icons'
import {
  LEAVES,
  OPERATIONS_EMPLOYEES,
  PUBLIC_HOLIDAYS,
  ROSTER_PATTERNS,
} from './rosterData'
import {
  DailyCellResult,
  DailyStatus,
  STATUS_COLORS,
  EMPLOYEE_STATUS_COLORS,
  isEmployeeVisibleInMonth,
  resolveDailyStatus,
  sortRosterEmployees,
} from './rosterStatusLogic'

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

  for (let i = 3; i >= 1; i--) {
    days.push({ date: monthStart.subtract(i, 'day'), inSelectedMonth: false })
  }
  for (let d = 0; d < monthEnd.date(); d++) {
    days.push({ date: monthStart.add(d, 'day'), inSelectedMonth: true })
  }
  for (let i = 1; i <= 3; i++) {
    days.push({ date: monthEnd.add(i, 'day'), inSelectedMonth: false })
  }
  return days
}

export default function RosterPage() {
  const today = useMemo(() => dayjs(), [])
  const [month, setMonth] = useState(() => today.startOf('month'))
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayColRef = useRef<HTMLDivElement>(null)

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

  const maxMonth = today.add(MAX_MONTHS_AHEAD, 'month').startOf('month')
  const canGoNext = month.isBefore(maxMonth)

  const scrollToToday = () => {
    requestAnimationFrame(() => {
      todayColRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    })
  }

  // Biz Req §3: on open, show current month, highlight + auto-scroll to today's column.
  useEffect(() => {
    scrollToToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToday = () => {
    if (!month.isSame(today, 'month')) {
      setMonth(today.startOf('month'))
    }
    scrollToToday()
  }

  const handlePrev = () => setMonth((m) => m.subtract(1, 'month'))
  const handleNext = () => {
    if (canGoNext) setMonth((m) => m.add(1, 'month'))
  }

  const notImplemented = (feature: string, ticket: string) => {
    message.info(`${feature} is scoped in ${ticket} — not yet implemented in this prototype.`)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Roster Calendar</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Operations department — monthly shift coverage
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Button icon={<LeftOutlined />} onClick={handlePrev} />
        <Button icon={<RightOutlined />} onClick={handleNext} disabled={!canGoNext} />
        <Text strong style={{ fontSize: 15, minWidth: 140 }}>{month.format('MMMM YYYY')}</Text>
        <Button icon={<CalendarOutlined />} onClick={handleToday}>
          Today
        </Button>
      </div>

      <div
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <div ref={scrollRef} style={{ overflowX: 'auto' }}>
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
                const isToday = date.isSame(today, 'day')
                const isWeekend = date.day() === 0 || date.day() === 6
                const holiday = PUBLIC_HOLIDAYS.find((h) => h.date === date.format('YYYY-MM-DD'))
                const header = (
                  <div
                    key={date.format('YYYY-MM-DD')}
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
                    <div style={{ fontSize: 11, color: isWeekend ? '#cf1322' : '#8c8c8c' }}>{date.format('ddd')}</div>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? '#1677ff' : '#1a1a1a' }}>
                      {date.format('D')}
                    </div>
                  </div>
                )
                return holiday ? (
                  <Tooltip key={date.format('YYYY-MM-DD')} title={holiday.name}>
                    {header}
                  </Tooltip>
                ) : (
                  header
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
                {days.map(({ date, inSelectedMonth }) => {
                  const result = resolveDailyStatus(emp, date, {
                    patterns: ROSTER_PATTERNS,
                    leaves: LEAVES,
                    holidays: PUBLIC_HOLIDAYS,
                  })
                  const isToday = date.isSame(today, 'day')
                  return (
                    <RosterCell
                      key={date.format('YYYY-MM-DD')}
                      result={result}
                      dimmed={!inSelectedMonth}
                      highlighted={isToday}
                    />
                  )
                })}
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
    </div>
  )
}

function RosterCell({
  result,
  dimmed,
  highlighted,
}: {
  result: DailyCellResult
  dimmed: boolean
  highlighted: boolean
}) {
  const colors = STATUS_COLORS[result.status]
  const tooltipParts: string[] = [colors.label]
  if (result.holidayName) tooltipParts.push(result.holidayName)
  if (result.leaveType) tooltipParts.push(result.leaveType)
  if (result.coverageGap) tooltipParts.push('Coverage Gap: Standby overlaps with approved leave')
  else if (result.standby) tooltipParts.push('Standby')

  return (
    <Tooltip title={tooltipParts.join(' — ')}>
      <div
        style={{
          width: CELL_WIDTH,
          flexShrink: 0,
          height: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: highlighted ? '#e6f4ff' : colors.bg,
          opacity: dimmed ? 0.45 : 1,
          position: 'relative',
          borderLeft: highlighted ? '2px solid #1677ff' : undefined,
          borderRight: highlighted ? '2px solid #1677ff' : undefined,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: colors.text }}>
          {result.status === 'DASH' ? '—' : result.status === 'AM_WEEKEND' ? 'AM' : shortLabel(result.status)}
        </span>
        {result.coverageGap ? (
          <span style={{ position: 'absolute', bottom: 3, width: 6, height: 6, borderRadius: '50%', background: '#cf1322' }} />
        ) : result.standby ? (
          <span style={{ position: 'absolute', bottom: 3, width: 6, height: 6, borderRadius: '50%', background: '#faad14' }} />
        ) : null}
      </div>
    </Tooltip>
  )
}

function shortLabel(status: DailyStatus): string {
  switch (status) {
    case 'ON_LEAVE':
      return 'Leave'
    case 'NA':
      return 'NA'
    case 'PUBLIC_HOLIDAY':
      return 'Off'
    case 'OFF':
      return 'Off'
    default:
      return status
  }
}

function RosterLegend() {
  const entries: DailyStatus[] = ['AM', 'AM_WEEKEND', 'PM', 'OFF', 'ON_LEAVE', 'PUBLIC_HOLIDAY', 'NA', 'DASH']
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cf1322', display: 'inline-block' }} />
        <Text style={{ fontSize: 12, color: '#595959' }}>Coverage Gap</Text>
      </div>
    </div>
  )
}
