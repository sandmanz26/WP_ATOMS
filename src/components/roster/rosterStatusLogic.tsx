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
  ShiftCode,
  ShiftSelection,
} from './rosterData'

/**
 * 'NA' is Not Assigned — the resting state for anyone not on a shift. The
 * 18 Aug review removed Off Day, so "rostered but not working" and "not in any
 * rule" are now the same thing.
 */
export type DailyStatus = 'ON_LEAVE' | 'DASH' | 'NA' | 'PUBLIC_HOLIDAY' | 'AM' | 'AM_WEEKEND' | 'PM'

export interface DailyCellResult {
  status: DailyStatus
  standby: boolean
  /**
   * MOVE-3769 §3 — the roster rule assigns standby for this day, regardless of
   * whether the user has since unticked it. Drives the "Standby from Rule"
   * indicator, which stays visible either way.
   */
  standbyFromRule: boolean
  standbyReason?: string
  extend: boolean
  extendHours?: number
  extendReason?: string
  /** MOVE-3769 §3 — marked absent: shift is kept but locked, and not counted. */
  absent: boolean
  holidayName?: string
  leave?: LeaveRecord
  /** True when a manual override produced this cell's shift. */
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

/**
 * What the rule assigns an employee on one date.
 *
 * No shift means Not Assigned. Rule membership used to matter here, because it
 * separated Off Day (rostered, not working) from No Roster (not in the rule);
 * the 18 Aug review collapsed both into Not Assigned, so the question is simply
 * whether this employee is in a shift list for this day.
 */
export function ruleAssignmentFor(
  rule: RosterRule,
  employeeId: string,
  date: Dayjs
): { shift?: ShiftCode; standby: boolean } {
  const week = rule.weeks[weekIndexInCycle(rule, date)]
  const day = isoDayIndex(date)
  if (!week) return { standby: false }
  const shift: ShiftCode | undefined = week.am[day]?.includes(employeeId)
    ? 'AM'
    : week.pm[day]?.includes(employeeId)
      ? 'PM'
      : undefined
  return { shift, standby: week.standby[day]?.includes(employeeId) ?? false }
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
  const empty = { standby: false, standbyFromRule: false, extend: false, absent: false, edited: false }

  // Priority 2 — outside the employee's contract range.
  if (!isUnderContract(employee, dateStr)) return { ...empty, status: 'DASH' }

  const rule = findRuleForDate(ctx.rules, dateStr)
  const assignment = rule ? ruleAssignmentFor(rule, employee.id, date) : undefined
  const override = ctx.overrides.find((o) => o.employeeId === employee.id && o.date === dateStr)

  const standbyFromRule = assignment?.standby ?? false
  const base = {
    standby: override?.standby ?? standbyFromRule,
    standbyFromRule,
    standbyReason: override?.standbyReason,
    extend: override?.extend ?? false,
    extendHours: override?.extendHours,
    extendReason: override?.extendReason,
    absent: override?.absence ?? false,
    edited: override?.shift !== undefined,
  }

  const leave = findApprovedLeave(ctx.leaves, employee.id, dateStr)
  const holiday = ctx.holidays.find((h) => h.date === dateStr)

  // Priority 1 — approved leave overrides every other status. MOVE-3608 also
  // states employees on leave cannot be assigned to Standby, so it is cleared
  // here rather than left for each caller to remember.
  if (leave) {
    return { ...base, status: 'ON_LEAVE', standby: false, standbyReason: undefined, leave }
  }

  // MOVE-3608 — on a public holiday every employee's base roster becomes NA.
  // Kept ahead of the shift lookup: nobody is working, rostered or not.
  if (holiday) return { ...base, status: 'PUBLIC_HOLIDAY', holidayName: holiday.name }

  // The roster rule, or a manual override. An explicit "NA" pick wins over the
  // rule; anything with no shift at all is Not Assigned.
  const picked = override?.shift
  const shift: ShiftCode | undefined =
    picked === 'NA' ? undefined : (picked ?? assignment?.shift)

  if (!shift) return { ...base, status: 'NA' }

  // MOVE-3608 weekend rules — Saturday and Sunday may only show AM or NA.
  const weekend = isWeekend(date)
  if (weekend && shift === 'PM') return { ...base, status: 'NA' }

  return { ...base, status: weekend && shift === 'AM' ? 'AM_WEEKEND' : shift }
}

/**
 * The shift an employee would be on if they were not on leave.
 *
 * Review feedback 1 — On Leave rows in the Edit Roster drawer show their shift
 * disabled, so ops can see which shift the person was meant to cover. Resolving
 * it by re-running the normal rules with that employee's leave removed keeps a
 * single source of truth rather than a second copy of the priority chain.
 */
export function resolveShiftIgnoringLeave(
  employee: RosterEmployee,
  date: Dayjs,
  ctx: RosterContext
): ShiftSelection {
  const withoutLeave: RosterContext = {
    ...ctx,
    leaves: ctx.leaves.filter((l) => l.employeeId !== employee.id),
  }
  const r = resolveDailyStatus(employee, date, withoutLeave)
  if (r.status === 'AM' || r.status === 'AM_WEEKEND') return 'AM'
  if (r.status === 'PM') return 'PM'
  return 'NA'
}

/** Cells a user may select in Bulk Edit mode (MOVE-3658 §2). */
export function isCellSelectable(result: DailyCellResult): boolean {
  return result.status === 'AM' || result.status === 'AM_WEEKEND' || result.status === 'PM' || result.status === 'NA'
}

/**
 * Shift options available for a given day (MOVE-3769 §3).
 *
 * Weekdays offer AM, PM and NA; weekends drop PM, which is not permitted there.
 * NA is Not Assigned — the resting state, and an explicit pick.
 */
export function shiftOptionsForDay(date: Dayjs): ShiftSelection[] {
  return isWeekend(date) ? ['AM', 'NA'] : ['AM', 'PM', 'NA']
}

/** Shift options offered by the bulk action bar for the current selection. */
export function bulkShiftOptions(weekendSelection: boolean): ShiftCode[] {
  return weekendSelection ? ['AM'] : ['AM', 'PM']
}

// ---------------------------------------------------------------------------
// Coverage + highlights
// ---------------------------------------------------------------------------

export interface DailyCoverage {
  am: number
  pm: number
  leave: number
  na: number
  standby: number
}

export function computeDailyCoverage(employees: RosterEmployee[], date: Dayjs, ctx: RosterContext): DailyCoverage {
  const coverage: DailyCoverage = { am: 0, pm: 0, leave: 0, na: 0, standby: 0 }
  for (const employee of employees) {
    const r = resolveDailyStatus(employee, date, ctx)
    if (r.absent) continue // MOVE-3608 §2.2 — absent employees are not counted
    if (r.standby) coverage.standby++
    switch (r.status) {
      case 'AM':
      case 'AM_WEEKEND':
        coverage.am++
        break
      case 'PM':
        coverage.pm++
        break
      case 'ON_LEAVE':
        coverage.leave++
        break
      case 'NA':
      case 'PUBLIC_HOLIDAY':
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

export type DayGroupKey = 'STANDBY' | 'AM' | 'PM' | 'NOT_ASSIGNED' | 'ON_LEAVE'

/** One employee inside a day's group (MOVE-3659 §2). */
export interface DayGroupMember {
  employee: RosterEmployee
  /** Standby reason. Only carried by the STANDBY group. */
  reason?: string
  /** Listed but not counted — the name still shows, tagged Absent. */
  absent?: boolean
  /** Counted, and tagged Extended in the card alongside its reason. */
  extended?: boolean
  extendHours?: number
  extendReason?: string
  /** MOVE-3659 §2 — suspended staff stay in the list, tagged. */
  suspended?: boolean
}

/** MOVE-3659 §2 — the reason shown for standby that came from the rule. */
export const STANDBY_FROM_RULE_REASON = 'Assigned in pattern'

export interface DayGroup {
  key: DayGroupKey
  label: string
  /** Headcount shown on the bar. Excludes absent members. */
  count: number
  /** Everyone to list in the details card, absent members included. */
  members: DayGroupMember[]
}

/**
 * Bar order inside a day cell, fixed by the 18 Aug review:
 * Standby, AM, PM, Not Assigned, On Leave.
 *
 * Standby leads because it is the coverage question ops scans for first, then
 * the worked shifts, then the not-working groups. On Leave sits last because
 * nobody in it is available that day.
 */
export const DAY_GROUP_ORDER: DayGroupKey[] = ['STANDBY', 'AM', 'PM', 'NOT_ASSIGNED', 'ON_LEAVE']

/**
 * Group colours, set by the 18 Aug design swatches.
 *
 * bgHover is one step darker on the same hue, so a hovered bar reads as the
 * same status rather than a different one.
 */
export const DAY_GROUP_STYLE: Record<
  DayGroupKey,
  { bg: string; bgHover: string; fg: string; border?: string; borderHover?: string; label: string }
> = {
  STANDBY: { bg: '#2563eb', bgHover: '#1d4ed8', fg: '#ffffff', label: 'Standby' },
  AM: { bg: '#a5a0f5', bgHover: '#8a83f0', fg: '#1a1a1a', label: 'AM' },
  PM: { bg: '#aec2fa', bgHover: '#87a5f7', fg: '#1a1a1a', label: 'PM' },
  NOT_ASSIGNED: { bg: '#d4d4d4', bgHover: '#bdbdbd', fg: '#1a1a1a', label: 'Not Assigned' },
  ON_LEAVE: { bg: '#fbdc8a', bgHover: '#f7cb5c', fg: '#1a1a1a', label: 'On Leave' },
}

/**
 * Standby with nobody on it, which the 18 Aug review asks to keep on the
 * calendar in a different colour rather than hide. It is the one group where
 * zero is the thing worth seeing — a day with no standby cover is a gap.
 */
export const EMPTY_STANDBY_STYLE = { bg: '#ef4444', bgHover: '#dc2626', fg: '#ffffff' }

/**
 * Edit mode strips every group colour (MOVE-3658 §2, "All group color to be
 * remove"), so the calendar reads as a different mode at a glance rather than
 * relying on the Save/Cancel buttons to say so. One neutral grey for all
 * groups: the labels still name them, and the point is that nothing competes
 * with the day cell the user is picking.
 */
export const EDIT_MODE_GROUP_STYLE = { bg: '#f0f0f0', bgHover: '#e6e6e6', fg: '#8c8c8c' }

/**
 * Buckets a day's on-duty employees into the bars shown in one calendar cell.
 *
 * MOVE-3608: Standby is an *independent* assignment, not a replacement for the
 * employee's shift — someone rostered AM and put on standby appears in both
 * "AM (n)" and "Standby (n)". Only On Leave is exclusive: it overrides the
 * roster status, and employees on leave cannot be assigned standby at all.
 *
 * Employees within each group are listed A–Z (MOVE-3659 §2).
 *
 * Absent employees (18 Aug review §4): left out of the headcount, but still
 * listed in the details card so ops can see who was meant to be covering.
 * `count` and `members.length` therefore differ whenever someone is absent.
 */
export function computeDayGroups(employees: RosterEmployee[], date: Dayjs, ctx: RosterContext): DayGroup[] {
  const buckets = new Map<DayGroupKey, DayGroupMember[]>()
  const push = (key: DayGroupKey, member: DayGroupMember) => {
    const list = buckets.get(key)
    if (list) list.push(member)
    else buckets.set(key, [member])
  }

  for (const employee of employees) {
    const r = resolveDailyStatus(employee, date, ctx)
    if (r.status === 'DASH') continue // not yet joined / already left — not displayed

    if (r.status === 'ON_LEAVE') {
      push('ON_LEAVE', { employee })
      continue // leave is exclusive, and cannot carry standby
    }

    // MOVE-3659 §2 — the extension tag travels with its reason, and suspended
    // staff stay listed. (An earlier review reading kept reasons to the Standby
    // card alone; the 21 Aug ticket rewrite asks for them here too.)
    const member: DayGroupMember = {
      employee,
      absent: r.absent,
      extended: r.extend,
      extendHours: r.extendHours,
      extendReason: r.extendReason,
      suspended: employee.status === 'Suspended',
    }
    if (r.status === 'AM' || r.status === 'AM_WEEKEND') push('AM', member)
    else if (r.status === 'PM') push('PM', member)
    else push('NOT_ASSIGNED', member) // NA and PUBLIC_HOLIDAY both read as Not Assigned

    // Additive, on top of whichever shift group the employee just landed in.
    // Standby always carries a reason: the rule's own, or what the user typed.
    if (r.standby) {
      push('STANDBY', {
        ...member,
        reason: r.standbyReason ?? (r.standbyFromRule ? STANDBY_FROM_RULE_REASON : undefined),
      })
    }
  }

  const groups = DAY_GROUP_ORDER.map((key) => {
    const members = [...(buckets.get(key) ?? [])].sort((a, b) => a.employee.name.localeCompare(b.employee.name))
    return { key, label: DAY_GROUP_STYLE[key].label, count: members.filter((m) => !m.absent).length, members }
  })

  // 18 Aug review §6 — a group with nobody in it is dropped from the calendar,
  // except Standby, which stays visible precisely so an empty one is noticed.
  return groups.filter((g) => g.count > 0 || g.key === 'STANDBY')
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
  NA: { bg: '#fafafa', text: '#8c8c8c', label: 'Not Assigned' },
  // Feedback item 3 — a public holiday is not an error state, so it reads green
  // rather than red.
  PUBLIC_HOLIDAY: { bg: '#f6ffed', text: '#389e0d', label: 'Public Holiday (Not Assigned)' },
  AM: { bg: '#e6f4ff', text: '#0958d9', label: 'AM' },
  AM_WEEKEND: { bg: '#f9f0ff', text: '#722ed1', label: 'AM (Weekend)' },
  PM: { bg: '#f6ffed', text: '#389e0d', label: 'PM' },
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

export const SHIFT_LABEL: Record<ShiftCode, string> = { AM: 'AM', PM: 'PM' }

/** Adds the explicit "NA" pick offered by the Edit Roster drawer (MOVE-3769). */
export const SHIFT_SELECTION_LABEL: Record<ShiftSelection, string> = { ...SHIFT_LABEL, NA: 'NA' }
