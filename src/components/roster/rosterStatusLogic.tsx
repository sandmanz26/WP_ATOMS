// Epic MOVE-3429 — shared roster business rules.
//
// Every roster page variant resolves cells through this file, so a rule fix
// lands in all of them at once. Presentation lives in the pages themselves.

import dayjs, { type Dayjs } from 'dayjs'
import {
  EmployeeStatus,
  LeaveRecord,
  PublicHoliday,
  RosterEmployee,
  RosterOverride,
  RosterRule,
  RosterRulePattern,
  ShiftCode,
} from './rosterData'

export type DailyStatus = 'ON_LEAVE' | 'DASH' | 'NA' | 'PUBLIC_HOLIDAY' | 'AM' | 'AM_WEEKEND' | 'PM' | 'OFF'

export interface DailyCellResult {
  status: DailyStatus
  standby: boolean
  coverageGap: boolean
  holidayName?: string
  leave?: LeaveRecord
  /** True when a manual Bulk Edit override produced this cell's shift. */
  edited: boolean
}

export interface RosterContext {
  rules: RosterRule[]
  leaves: LeaveRecord[]
  holidays: PublicHoliday[]
  overrides: RosterOverride[]
}

export const ISO = 'YYYY-MM-DD'

// ---------------------------------------------------------------------------
// Employee visibility + ordering (MOVE-3608 §2)
// ---------------------------------------------------------------------------

const STATUS_ORDER: Record<EmployeeStatus, number> = {
  Active: 0,
  Suspended: 1,
  'Future Employee': 2,
  Terminated: 3,
  Resigned: 3,
  Retired: 3,
  'Contract Expired': 3,
}

export type EmployeeStatusGroup = 'Active' | 'Suspended' | 'Future Employee' | 'Inactive'

export const EMPLOYEE_STATUS_GROUPS: EmployeeStatusGroup[] = ['Active', 'Suspended', 'Future Employee', 'Inactive']

export function employeeStatusGroup(status: EmployeeStatus): EmployeeStatusGroup {
  if (status === 'Active' || status === 'Suspended' || status === 'Future Employee') return status
  return 'Inactive'
}

export function sortRosterEmployees(employees: RosterEmployee[]): RosterEmployee[] {
  return [...employees].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name)
  })
}

/** Operations employees active at any point during the given month. */
export function isEmployeeVisibleInMonth(employee: RosterEmployee, monthStart: Dayjs, monthEnd: Dayjs): boolean {
  if (employee.department !== 'Operations') return false
  const startsBeforeMonthEnds = employee.contractStartDate <= monthEnd.format(ISO)
  const endsAfterMonthStarts = !employee.contractEndDate || employee.contractEndDate >= monthStart.format(ISO)
  return startsBeforeMonthEnds && endsAfterMonthStarts
}

export function isUnderContract(employee: RosterEmployee, dateStr: string): boolean {
  if (dateStr < employee.contractStartDate) return false
  if (employee.contractEndDate && dateStr > employee.contractEndDate) return false
  return true
}

/** Operations employees whose contract covers the given date. */
export function employeesOnDuty(employees: RosterEmployee[], dateStr: string): RosterEmployee[] {
  return employees.filter((e) => e.department === 'Operations' && isUnderContract(e, dateStr))
}

// ---------------------------------------------------------------------------
// Rule lookup (MOVE-3609 §3, MOVE-3610 §2)
// ---------------------------------------------------------------------------

export function findRuleForDate(rules: RosterRule[], dateStr: string): RosterRule | undefined {
  return rules.find((r) => r.effectiveDate <= dateStr && (!r.endDate || r.endDate >= dateStr))
}

export function findPatternForEmployee(rule: RosterRule, employeeId: string): RosterRulePattern | undefined {
  return rule.patterns.find((p) => p.employeeIds.includes(employeeId))
}

export type RuleBucket = 'Current' | 'Upcoming' | 'Ended'

export function ruleBucket(rule: RosterRule, today: Dayjs): RuleBucket {
  const todayStr = today.format(ISO)
  if (rule.endDate && rule.endDate < todayStr) return 'Ended'
  if (rule.effectiveDate > todayStr) return 'Upcoming'
  return 'Current'
}

/** MOVE-3609 §5 — a new rule may not overlap an existing rule's effective period. */
export function findOverlappingRule(
  rules: RosterRule[],
  candidate: { id?: string; effectiveDate: string; endDate?: string }
): RosterRule | undefined {
  const candEnd = candidate.endDate ?? '9999-12-31'
  return rules.find((r) => {
    if (r.id === candidate.id) return false
    const rEnd = r.endDate ?? '9999-12-31'
    return candidate.effectiveDate <= rEnd && r.effectiveDate <= candEnd
  })
}

/** MOVE-3610 — Effective Date defaults to the day after the latest rule's End Date. */
export function defaultNextEffectiveDate(rules: RosterRule[], today: Dayjs): Dayjs {
  const ends = rules.map((r) => r.endDate).filter((d): d is string => !!d)
  if (rules.some((r) => !r.endDate) || ends.length === 0) return today.add(1, 'day')
  const sorted = [...ends].sort()
  const latest = sorted[sorted.length - 1]
  const next = dayjs(latest).add(1, 'day')
  return next.isAfter(today) ? next : today.add(1, 'day')
}

function mondayOf(date: Dayjs): Dayjs {
  const dow = date.day() // Sunday = 0 .. Saturday = 6
  return date.subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day')
}

/** Monday=0 .. Sunday=6 */
export function isoDayIndex(date: Dayjs): number {
  const dow = date.day()
  return dow === 0 ? 6 : dow - 1
}

export function isWeekend(date: Dayjs): boolean {
  const dow = date.day()
  return dow === 0 || dow === 6
}

function weekIndexInCycle(rule: RosterRule, date: Dayjs): number {
  const effectiveMonday = mondayOf(dayjs(rule.effectiveDate))
  const weeksElapsed = mondayOf(date).diff(effectiveMonday, 'day') / 7
  const cycle = Math.max(1, rule.repeatEveryWeeks)
  return ((weeksElapsed % cycle) + cycle) % cycle
}

// ---------------------------------------------------------------------------
// Leave (MOVE-3608 priority 1, MOVE-3659)
// ---------------------------------------------------------------------------

export function findApprovedLeave(leaves: LeaveRecord[], employeeId: string, dateStr: string): LeaveRecord | undefined {
  return leaves.find(
    (l) => l.approved && l.employeeId === employeeId && l.startDate <= dateStr && l.endDate >= dateStr
  )
}

// ---------------------------------------------------------------------------
// Cell resolution (MOVE-3608 §5 + §6)
// ---------------------------------------------------------------------------

export function resolveDailyStatus(employee: RosterEmployee, date: Dayjs, ctx: RosterContext): DailyCellResult {
  const dateStr = date.format(ISO)
  const base = { standby: false, coverageGap: false, edited: false }

  // Priority 2 — outside the employee's contract range.
  if (!isUnderContract(employee, dateStr)) return { ...base, status: 'DASH' }

  const rule = findRuleForDate(ctx.rules, dateStr)
  const pattern = rule ? findPatternForEmployee(rule, employee.id) : undefined
  const override = ctx.overrides.find((o) => o.employeeId === employee.id && o.date === dateStr)

  const patternWeek = rule && pattern ? pattern.weeks[weekIndexInCycle(rule, date)] : undefined
  const hasRoster = !!patternWeek || override?.shift !== undefined
  const standby = override?.standby ?? patternWeek?.standby ?? false

  const leave = findApprovedLeave(ctx.leaves, employee.id, dateStr)
  const holiday = ctx.holidays.find((h) => h.date === dateStr)

  // Priority 1 — approved leave overrides every other status.
  // Standby that lands on leave is a Coverage Gap (MOVE-3608 §6.2).
  if (leave) return { ...base, status: 'ON_LEAVE', standby, coverageGap: standby, leave }

  // Priority 3 — active employee, but no roster covers this date.
  if (!hasRoster) return { ...base, status: 'NA' }

  // Priority 4 — a public holiday turns everyone's base roster into an Off Day.
  if (holiday) return { ...base, status: 'PUBLIC_HOLIDAY', standby, holidayName: holiday.name }

  // Priority 5 — the roster pattern, or a manual Bulk Edit override.
  let shift: ShiftCode = override?.shift ?? patternWeek!.days[isoDayIndex(date)]

  // Priority 6 — weekends may only show AM or Off Day; PM is not permitted.
  const weekend = isWeekend(date)
  if (weekend && shift === 'PM') shift = 'OFF'

  const status: DailyStatus = weekend && shift === 'AM' ? 'AM_WEEKEND' : (shift as DailyStatus)
  return { ...base, status, standby, edited: override?.shift !== undefined }
}

/** Cells a user may select in Bulk Edit mode (MOVE-3658 §2). */
export function isCellSelectable(result: DailyCellResult): boolean {
  return result.status === 'AM' || result.status === 'AM_WEEKEND' || result.status === 'PM' || result.status === 'OFF'
}

/** Shift options offered by the bulk action bar for the current selection. */
export function bulkShiftOptions(weekendSelection: boolean): ShiftCode[] {
  return weekendSelection ? ['AM', 'OFF'] : ['AM', 'PM', 'OFF']
}

// ---------------------------------------------------------------------------
// Coverage + highlights
// ---------------------------------------------------------------------------

export interface DailyCoverage {
  am: number
  pm: number
  off: number
  leave: number
  na: number
  standby: number
  coverageGap: number
}

export function computeDailyCoverage(employees: RosterEmployee[], date: Dayjs, ctx: RosterContext): DailyCoverage {
  const coverage: DailyCoverage = { am: 0, pm: 0, off: 0, leave: 0, na: 0, standby: 0, coverageGap: 0 }
  for (const employee of employees) {
    const r = resolveDailyStatus(employee, date, ctx)
    if (r.coverageGap) coverage.coverageGap++
    else if (r.standby) coverage.standby++
    switch (r.status) {
      case 'AM':
      case 'AM_WEEKEND':
        coverage.am++
        break
      case 'PM':
        coverage.pm++
        break
      case 'OFF':
      case 'PUBLIC_HOLIDAY':
        coverage.off++
        break
      case 'ON_LEAVE':
        coverage.leave++
        break
      case 'NA':
        coverage.na++
        break
      default:
        break
    }
  }
  return coverage
}

export interface RosterHighlightsResult {
  noStandbyDays: number
  noShiftDays: number
  windowDays: number
  noStandbyDates: string[]
  noShiftDates: string[]
}

export const HIGHLIGHT_WINDOW_DAYS = 60

/**
 * MOVE-3607 — rolling 60-day highlight counts starting from today.
 *
 * Note on "No Standby Coverage": the ticket words the rule as "no employee is
 * assigned standby duty". An employee who is on approved leave is assigned but
 * cannot actually cover — the same situation the calendar already flags as a
 * Coverage Gap. Counting such a day as covered would hide precisely the day the
 * badge exists to surface, so standby held by an employee on approved leave does
 * not count as coverage here. This mirrors the ticket's own explicit rule for
 * the AM/PM badge, which excludes employees on approved leave.
 */
export function computeRosterHighlights(
  employees: RosterEmployee[],
  from: Dayjs,
  ctx: RosterContext,
  windowDays: number = HIGHLIGHT_WINDOW_DAYS
): RosterHighlightsResult {
  const noStandbyDates: string[] = []
  const noShiftDates: string[] = []

  for (let i = 0; i < windowDays; i++) {
    const date = from.add(i, 'day')
    const dateStr = date.format(ISO)
    const onDuty = employeesOnDuty(employees, dateStr)

    let hasStandby = false
    let hasShift = false

    for (const employee of onDuty) {
      const r = resolveDailyStatus(employee, date, ctx)
      // Employees on approved leave are excluded from coverage entirely.
      if (r.status === 'ON_LEAVE') continue
      if (r.standby) hasStandby = true
      if (r.status === 'AM' || r.status === 'AM_WEEKEND' || r.status === 'PM') hasShift = true
      if (hasStandby && hasShift) break
    }

    if (!hasStandby) noStandbyDates.push(dateStr)
    if (!hasShift) noShiftDates.push(dateStr)
  }

  return {
    noStandbyDays: noStandbyDates.length,
    noShiftDays: noShiftDates.length,
    windowDays,
    noStandbyDates,
    noShiftDates,
  }
}

// ---------------------------------------------------------------------------
// Presentation tokens shared by the legend and both page variants
// ---------------------------------------------------------------------------

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

export const SHIFT_LABEL: Record<ShiftCode, string> = { AM: 'AM', PM: 'PM', OFF: 'Off Day' }
