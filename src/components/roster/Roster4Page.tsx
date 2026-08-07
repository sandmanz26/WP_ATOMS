// Roster Calendar 4.0 — traditional month-grid layout.
//
// A third parallel variant, kept side by side with RosterPage.tsx and
// Roster3Page.tsx per the repo's original/2.0 convention.
//
// Note on scope: MOVE-3608 §2 specifies the *matrix* layout — "Employees are
// displayed as rows / Calendar dates are displayed as columns" with horizontal
// scrolling — which is what the other two variants implement. This variant
// answers a separate stakeholder request for a conventional month calendar
// (7 columns, weeks as rows). The two layouts cannot both be literal readings
// of the ticket, so this page follows the ticket wherever the calendar shape
// does not force a choice, and deviates only where it must:
//
//   - Weeks are rendered whole, so a month shows however many adjacent-month
//     days complete the first and last week, rather than the ticket's fixed
//     3 leading / 3 trailing days. Those days stay greyed out and read-only.
//   - One cell is one date shared by the whole team, so a cell shows the day's
//     coverage totals; the per-employee detail moves into a drawer on click.
//   - Bulk Edit Roster (MOVE-3658) is deliberately absent: its selection model
//     is per employee-cell, which this aggregate layout has no place for. Use
//     Roster Calendar or Roster 3.0 to edit. Manage Roster works here as normal.
//
// All status resolution still comes from rosterStatusLogic.tsx, shared with the
// other variants, so business rules cannot drift between them.

import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Drawer, Empty, Space, Tag, Tooltip, Typography } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  SettingOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { LEAVES, OPERATIONS_EMPLOYEES, PUBLIC_HOLIDAYS, ROSTER_RULES, ROSTER_OVERRIDES } from './rosterData'
import {
  DailyStatus,
  HIGHLIGHT_WINDOW_DAYS,
  ISO,
  STATUS_COLORS,
  computeDailyCoverage,
  computeRosterHighlights,
  employeesOnDuty,
  isoDayIndex,
  isWeekend,
  resolveDailyStatus,
  sortRosterEmployees,
  type DailyCoverage,
  type RosterContext,
} from './rosterStatusLogic'
import RosterHighlights from './RosterHighlights'
import ManageRosterDrawer from './ManageRosterDrawer'

const { Text, Title } = Typography

const MAX_MONTHS_AHEAD = 12
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface CalendarDay {
  date: Dayjs
  inSelectedMonth: boolean
}

/** Whole Monday-start weeks covering the month. */
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)

  const ctx: RosterContext = useMemo(
    () => ({ rules: ROSTER_RULES, leaves: LEAVES, holidays: PUBLIC_HOLIDAYS, overrides: ROSTER_OVERRIDES }),
    // The rules array is mutated in place by the Manage Roster drawer.
    [revision]
  )

  const weeks = useMemo(() => buildCalendarWeeks(month), [month])

  const highlights = useMemo(
    () => computeRosterHighlights(OPERATIONS_EMPLOYEES, today, ctx, HIGHLIGHT_WINDOW_DAYS),
    [today, ctx]
  )

  const canGoNext = month.isBefore(today.add(MAX_MONTHS_AHEAD, 'month').startOf('month'))

  // Reset the day drawer whenever the month changes out from under it.
  useEffect(() => {
    setSelectedDate(null)
  }, [month])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Roster Calendar 4.0</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Operations department — month grid with daily coverage totals
          </Text>
        </div>
        <Space>
          <Button icon={<SettingOutlined />} onClick={() => setDrawerOpen(true)}>Manage Roster</Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <RosterHighlights highlights={highlights} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Button icon={<LeftOutlined />} onClick={() => setMonth((m) => m.subtract(1, 'month'))} />
        <Button icon={<RightOutlined />} disabled={!canGoNext} onClick={() => canGoNext && setMonth((m) => m.add(1, 'month'))} />
        <Text strong style={{ fontSize: 15, minWidth: 140 }}>{month.format('MMMM YYYY')}</Text>
        <Button icon={<CalendarOutlined />} onClick={() => setMonth(today.startOf('month'))}>Today</Button>
      </div>

      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        {/* Weekday header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
          {DAY_HEADERS.map((label, i) => (
            <div key={label} style={{ padding: '8px 12px', textAlign: 'center' }}>
              <Text strong style={{ fontSize: 12, color: i >= 5 ? '#cf1322' : '#595959' }}>{label}</Text>
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              borderBottom: wi === weeks.length - 1 ? undefined : '1px solid #f0f0f0',
            }}
          >
            {week.map(({ date, inSelectedMonth }) => (
              <DayCell
                key={date.format(ISO)}
                date={date}
                inSelectedMonth={inSelectedMonth}
                isToday={date.isSame(today, 'day')}
                ctx={ctx}
                onClick={() => inSelectedMonth && setSelectedDate(date)}
              />
            ))}
          </div>
        ))}
      </div>

      <Legend />

      <DayDetailDrawer
        date={selectedDate}
        ctx={ctx}
        onClose={() => setSelectedDate(null)}
      />

      <ManageRosterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRulesChanged={() => setRevision((r) => r + 1)}
      />
    </div>
  )
}

function DayCell({
  date,
  inSelectedMonth,
  isToday,
  ctx,
  onClick,
}: {
  date: Dayjs
  inSelectedMonth: boolean
  isToday: boolean
  ctx: RosterContext
  onClick: () => void
}) {
  const dateStr = date.format(ISO)
  const onDuty = employeesOnDuty(OPERATIONS_EMPLOYEES, dateStr)
  const coverage = computeDailyCoverage(onDuty, date, ctx)
  const holiday = PUBLIC_HOLIDAYS.find((h) => h.date === dateStr)
  const weekend = isWeekend(date)
  const noAmCover = coverage.am === 0 && onDuty.length > 0

  return (
    <div
      onClick={onClick}
      style={{
        minHeight: 116,
        padding: '8px 10px',
        borderRight: '1px solid #f5f5f5',
        background: isToday ? '#e6f4ff' : holiday ? '#fff1f0' : weekend ? '#fcfcfc' : '#fff',
        opacity: inSelectedMonth ? 1 : 0.4,
        cursor: inSelectedMonth ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: isToday ? 700 : 500,
            color: isToday ? '#1677ff' : weekend ? '#cf1322' : '#1a1a1a',
          }}
        >
          {date.format('D')}
        </span>
        {noAmCover && (
          <Tooltip title="No AM shift assigned on this day">
            <WarningFilled style={{ fontSize: 12, color: '#cf1322' }} />
          </Tooltip>
        )}
      </div>

      {holiday && (
        <Tooltip title={holiday.name}>
          <div
            style={{
              fontSize: 10,
              color: '#cf1322',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {holiday.name}
          </div>
        </Tooltip>
      )}

      {inSelectedMonth && onDuty.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <CountChip label="AM" value={coverage.am} status="AM" />
          <CountChip label="PM" value={coverage.pm} status="PM" />
          <CountChip label="Off" value={coverage.off} status="OFF" />
          {coverage.leave > 0 && <CountChip label="Lv" value={coverage.leave} status="ON_LEAVE" />}
          {coverage.na > 0 && <CountChip label="NA" value={coverage.na} status="NA" />}
        </div>
      )}

      {inSelectedMonth && (coverage.standby > 0 || coverage.coverageGap > 0) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          {coverage.standby > 0 && (
            <Tooltip title={`${coverage.standby} on standby`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#d48806' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#faad14' }} />
                {coverage.standby}
              </span>
            </Tooltip>
          )}
          {coverage.coverageGap > 0 && (
            <Tooltip title={`${coverage.coverageGap} coverage gap — standby overlaps approved leave`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#cf1322' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#cf1322' }} />
                {coverage.coverageGap}
              </span>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}

function CountChip({ label, value, status }: { label: string; value: number; status: DailyStatus }) {
  const colors = STATUS_COLORS[status]
  const muted = value === 0
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        lineHeight: '18px',
        padding: '0 6px',
        borderRadius: 4,
        background: muted ? '#fafafa' : colors.bg,
        color: muted ? '#d9d9d9' : colors.text,
      }}
    >
      {label} {value}
    </span>
  )
}

function DayDetailDrawer({
  date,
  ctx,
  onClose,
}: {
  date: Dayjs | null
  ctx: RosterContext
  onClose: () => void
}) {
  if (!date) return <Drawer open={false} onClose={onClose} />

  const dateStr = date.format(ISO)
  const holiday = PUBLIC_HOLIDAYS.find((h) => h.date === dateStr)
  const onDuty = sortRosterEmployees(employeesOnDuty(OPERATIONS_EMPLOYEES, dateStr))
  const coverage: DailyCoverage = computeDailyCoverage(onDuty, date, ctx)

  return (
    <Drawer
      open
      onClose={onClose}
      width={460}
      title={date.format('dddd, D MMMM YYYY')}
    >
      {holiday && (
        <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: '#cf1322' }}>Public Holiday — {holiday.name}</Text>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <CountChip label="AM" value={coverage.am} status="AM" />
        <CountChip label="PM" value={coverage.pm} status="PM" />
        <CountChip label="Off" value={coverage.off} status="OFF" />
        <CountChip label="Leave" value={coverage.leave} status="ON_LEAVE" />
        <CountChip label="NA" value={coverage.na} status="NA" />
      </div>

      {onDuty.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Operations employees under contract on this date." />
      ) : (
        onDuty.map((employee) => {
          const result = resolveDailyStatus(employee, date, ctx)
          const colors = STATUS_COLORS[result.status]
          return (
            <div
              key={employee.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#1a1a1a' }}>{employee.name}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>{employee.status}</Text>
                {/* MOVE-3659 information, inline since there is no cell to anchor to here. */}
                {result.leave && (
                  <div style={{ fontSize: 11, color: '#d46b08' }}>
                    {result.leave.type}
                    {result.leave.timing ? ` · ${result.leave.timing}` : ''}
                    {result.leave.startDate !== result.leave.endDate
                      ? ` · ${dayjs(result.leave.startDate).format('D MMM')} – ${dayjs(result.leave.endDate).format('D MMM')}`
                      : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {result.coverageGap ? (
                  <Tag color="red" style={{ fontSize: 10, margin: 0 }}>Coverage Gap</Tag>
                ) : result.standby ? (
                  <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>Standby</Tag>
                ) : null}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: colors.bg,
                    color: colors.text,
                  }}
                >
                  {colors.label}
                </span>
              </div>
            </div>
          )
        })
      )}
    </Drawer>
  )
}

function Legend() {
  const entries: DailyStatus[] = ['AM', 'PM', 'OFF', 'ON_LEAVE', 'NA']
  return (
    <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Counts per day:</Text>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <WarningFilled style={{ fontSize: 12, color: '#cf1322' }} />
        <Text style={{ fontSize: 12, color: '#595959' }}>No AM cover</Text>
      </div>
    </div>
  )
}
