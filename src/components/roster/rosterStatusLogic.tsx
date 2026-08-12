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
  const base = { standby: false, edited: false }

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

  // Priority 1 — approved leave overrides every other status. MOVE-3608 also
  // states employees on leave cannot be assigned to Standby, so it is cleared
  // here rather than left for each caller to remember.
  if (leave) return { ...base, status: 'ON_LEAVE', standby: false, leave }

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

/**
 * Shift options available for a given day (MOVE-3658 §3).
 *
 * Weekdays offer AM and PM only — Off Day cannot be assigned to an Operations
 * employee on a working day. Weekends offer AM and Off Day; PM is not permitted.
 */
export function shiftOptionsForDay(date: Dayjs): ShiftCode[] {
  return isWeekend(date) ? ['AM', 'OFF'] : ['AM', 'PM']
}

/** Shift options offered by the bulk action bar for the current selection. */
export function bulkShiftOptions(weekendSelection: boolean): ShiftCode[] {
  return weekendSelection ? ['AM', 'OFF'] : ['AM', 'PM']
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
}

export function computeDailyCoverage(employees: RosterEmployee[], date: Dayjs, ctx: RosterContext): DailyCoverage {
  const coverage: DailyCoverage = { am: 0, pm: 0, off: 0, leave: 0, na: 0, standby: 0 }
  for (const employee of employees) {
    const r = resolveDailyStatus(employee, date, ctx)
    if (r.standby) coverage.standby++
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

// ---------------------------------------------------------------------------
// Day grouping for the month-grid calendar
// ---------------------------------------------------------------------------

export type DayGroupKey = 'STANDBY' | 'ON_LEAVE' | 'AM' | 'PM' | 'OFF' | 'NO_ROSTER'

export interface DayGroup {
  key: DayGroupKey
  label: string
  employees: RosterEmployee[]
}

/** Bar order inside a day cell. */
export const DAY_GROUP_ORDER: DayGroupKey[] = ['STANDBY', 'ON_LEAVE', 'AM', 'PM', 'OFF', 'NO_ROSTER']

// bgHover is one step darker on the same AntD colour ramp, so a hovered bar
// reads as the same status rather than a different one.
export const DAY_GROUP_STYLE: Record<
  DayGroupKey,
  { bg: string; bgHover: string; fg: string; border?: string; borderHover?: string; label: string }
> = {
  STANDBY: { bg: '#2f54eb', bgHover: '#1d39c4', fg: '#ffffff', label: 'Standby' },
  ON_LEAVE: { bg: '#ffccc7', bgHover: '#ffa39e', fg: '#a8071a', label: 'On Leave' },
  AM: { bg: '#d9f7be', bgHover: '#b7eb8f', fg: '#237804', label: 'AM' },
  PM: { bg: '#fff1b8', bgHover: '#ffe58f', fg: '#ad6800', label: 'PM' },
  OFF: { bg: '#d6e4ff', bgHover: '#adc6ff', fg: '#2f4a8c', label: 'Off Day' },
  NO_ROSTER: {
    bg: 'transparent',
    // Transparent has nothing to darken, so this one fills in on hover instead.
    bgHover: '#f0f0f0',
    fg: '#bfbfbf',
    border: '1px dashed #d9d9d9',
    borderHover: '1px dashed #bfbfbf',
    label: 'No Roster',
  },
}

/**
 * Buckets a day's on-duty employees into the bars shown in one calendar cell.
 *
 * MOVE-3608: Standby is an *independent* assignment, not a replacement for the
 * employee's shift — someone rostered AM and put on standby appears in both
 * "AM (n)" and "Standby (n)". Only On Leave is exclusive: it overrides the
 * roster status, and employees on leave cannot be assigned standby at all.
 *
 * Employees within each group are listed A–Z (MOVE-3659 §2).
 */
export function computeDayGroups(employees: RosterEmployee[], date: Dayjs, ctx: RosterContext): DayGroup[] {
  const buckets = new Map<DayGroupKey, RosterEmployee[]>()
  const push = (key: DayGroupKey, employee: RosterEmployee) => {
    const list = buckets.get(key)
    if (list) list.push(employee)
    else buckets.set(key, [employee])
  }

  for (const employee of employees) {
    const r = resolveDailyStatus(employee, date, ctx)
    if (r.status === 'DASH') continue // not yet joined / already left — not displayed

    if (r.status === 'ON_LEAVE') {
      push('ON_LEAVE', employee)
      continue // leave is exclusive, and cannot carry standby
    }

    if (r.status === 'NA') push('NO_ROSTER', employee)
    else if (r.status === 'AM' || r.status === 'AM_WEEKEND') push('AM', employee)
    else if (r.status === 'PM') push('PM', employee)
    else push('OFF', employee) // OFF and PUBLIC_HOLIDAY both read as an off day

    // Additive, on top of whichever shift group the employee just landed in.
    if (r.standby) push('STANDBY', employee)
  }

  return DAY_GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: DAY_GROUP_STYLE[key].label,
    employees: [...buckets.get(key)!].sort((a, b) => a.name.localeCompare(b.name)),
  }))
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
 * assigned standby duty". An employee on approved leave is assigned but cannot
 * actually cover, so their standby does not count here. This mirrors the
 * ticket's own explicit rule for the AM/PM badge, which excludes employees on
 * approved leave.
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
  // Feedback item 3 — a public holiday is not an error state, so it reads green
  // rather than red.
  PUBLIC_HOLIDAY: { bg: '#f6ffed', text: '#389e0d', label: 'Public Holiday (Off Day)' },
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
