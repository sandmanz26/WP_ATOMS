// MOVE-3608 — Roster Calendar status resolution (pure functions + badge/legend UI)

import dayjs, { type Dayjs } from 'dayjs'
import {
  EmployeeStatus,
  LeaveRecord,
  PublicHoliday,
  RosterEmployee,
  RosterPattern,
  ShiftCode,
} from './rosterData'

export type DailyStatus = 'ON_LEAVE' | 'DASH' | 'NA' | 'PUBLIC_HOLIDAY' | 'AM' | 'AM_WEEKEND' | 'PM' | 'OFF'

export interface DailyCellResult {
  status: DailyStatus
  standby: boolean
  coverageGap: boolean
  holidayName?: string
  leaveType?: string
}

// Biz Req §5.2 employee ordering: Active -> Suspended -> Future Employee -> Terminated/Resigned/Retired/Contract Expired,
// alphabetical (A-Z) within each group.
const STATUS_ORDER: Record<EmployeeStatus, number> = {
  Active: 0,
  Suspended: 1,
  'Future Employee': 2,
  Terminated: 3,
  Resigned: 3,
  Retired: 3,
  'Contract Expired': 3,
}

export function sortRosterEmployees(employees: RosterEmployee[]): RosterEmployee[] {
  return [...employees].sort((a, b) => {
    const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (orderDiff !== 0) return orderDiff
    return a.name.localeCompare(b.name)
  })
}

// Biz Req §2: only Operations employees active at any point during the selected month.
export function isEmployeeVisibleInMonth(employee: RosterEmployee, monthStart: Dayjs, monthEnd: Dayjs): boolean {
  if (employee.department !== 'Operations') return false
  const start = employee.contractStartDate
  const end = employee.contractEndDate
  const startsBeforeMonthEnds = start <= monthEnd.format('YYYY-MM-DD')
  const endsAfterMonthStarts = !end || end >= monthStart.format('YYYY-MM-DD')
  return startsBeforeMonthEnds && endsAfterMonthStarts
}

function findApplicablePattern(patterns: RosterPattern[], employeeId: string, dateStr: string): RosterPattern | undefined {
  return patterns
    .filter((p) => p.employeeId === employeeId && p.effectiveDate <= dateStr && (!p.endDate || p.endDate >= dateStr))
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1))[0]
}

function mondayOf(date: Dayjs): Dayjs {
  const dow = date.day() // Sunday = 0 .. Saturday = 6
  const isoOffset = dow === 0 ? 6 : dow - 1 // days since Monday
  return date.subtract(isoOffset, 'day').startOf('day')
}

function resolvePatternShift(pattern: RosterPattern, date: Dayjs): ShiftCode {
  const effectiveMonday = mondayOf(dayjs(pattern.effectiveDate))
  const targetMonday = mondayOf(date)
  const weeksSinceEffective = targetMonday.diff(effectiveMonday, 'day') / 7
  const cycleLength = pattern.cycleWeeks.length
  const cycleIndex = ((weeksSinceEffective % cycleLength) + cycleLength) % cycleLength
  const dow = date.day()
  const dayIndex = dow === 0 ? 6 : dow - 1 // Monday=0 .. Sunday=6
  return pattern.cycleWeeks[cycleIndex][dayIndex]
}

export function resolveDailyStatus(
  employee: RosterEmployee,
  date: Dayjs,
  ctx: { patterns: RosterPattern[]; leaves: LeaveRecord[]; holidays: PublicHoliday[] }
): DailyCellResult {
  const dateStr = date.format('YYYY-MM-DD')

  // Priority 2: "-" outside contract range.
  if (dateStr < employee.contractStartDate || (employee.contractEndDate && dateStr > employee.contractEndDate)) {
    return { status: 'DASH', standby: false, coverageGap: false }
  }

  const pattern = findApplicablePattern(ctx.patterns, employee.id, dateStr)
  const standby = !!pattern?.standby
  const leave = ctx.leaves.find((l) => l.employeeId === employee.id && l.date === dateStr && l.approved)
  const holiday = ctx.holidays.find((h) => h.date === dateStr)

  // Priority 1: On Leave overrides everything else.
  if (leave) {
    return { status: 'ON_LEAVE', standby, coverageGap: standby, leaveType: leave.type }
  }

  // Priority 3: NA — active employee but no roster pattern covers this date.
  if (!pattern) {
    return { status: 'NA', standby: false, coverageGap: false }
  }

  // Priority 4: Public Holiday forces every employee's base roster to Off Day.
  if (holiday) {
    return { status: 'PUBLIC_HOLIDAY', standby, coverageGap: false, holidayName: holiday.name }
  }

  // Priority 5 + 6: Roster pattern, with weekend rules applied.
  let shift = resolvePatternShift(pattern, date)
  const dow = date.day()
  const isWeekend = dow === 0 || dow === 6
  if (isWeekend) {
    if (shift === 'PM') shift = 'OFF' // PM shifts are not permitted on weekends.
  }

  const status: DailyStatus = isWeekend && shift === 'AM' ? 'AM_WEEKEND' : (shift as DailyStatus)
  return { status, standby, coverageGap: false }
}

export const STATUS_COLORS: Record<DailyStatus, { bg: string; text: string; label: string }> = {
  ON_LEAVE: { bg: '#fff7e6', text: '#d46b08', label: 'On Leave' },
  DASH: { bg: '#fafafa', text: '#bfbfbf', label: '—' },
  NA: { bg: '#fafafa', text: '#8c8c8c', label: 'NA' },
  PUBLIC_HOLIDAY: { bg: '#fff1f0', text: '#cf1322', label: 'Public Holiday (Off Day)' },
  AM: { bg: '#e6f4ff', text: '#0958d9', label: 'AM' },
  AM_WEEKEND: { bg: '#f9f0ff', text: '#722ed1', label: 'AM (Weekend)' },
  PM: { bg: '#f6ffed', text: '#389e0d', label: 'PM' },
  OFF: { bg: '#f5f5f5', text: '#8c8c8c', label: 'Off Day' },
}

export const EMPLOYEE_STATUS_COLORS: Record<EmployeeStatus, string> = {
  Active: '#389e0d',
  Suspended: '#d48806',
  'Future Employee': '#0958d9',
  Terminated: '#8c8c8c',
  Resigned: '#8c8c8c',
  Retired: '#8c8c8c',
  'Contract Expired': '#8c8c8c',
}
