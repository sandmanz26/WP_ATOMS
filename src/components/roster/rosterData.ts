// Epic MOVE-3429 (WLA: HR - Roster) — shared types + mock dataset.
//
// The domain model follows the PRD's vocabulary deliberately: a *Roster Rule*
// (MOVE-3610) owns an effective period and a repeat cycle, and contains one or
// more *Patterns*. Each pattern carries its own weekly grid (one grid per week
// of the cycle, each with its own "standby for this week" flag) plus the set of
// employees assigned to it. An employee may belong to at most one pattern
// within a rule — that is what makes a single cell resolvable.
//
// No backend here: "writes" mutate these arrays in place so both roster pages
// observe the same state, per the repo's established mock-data convention.

export type EmployeeStatus =
  | 'Active'
  | 'Suspended'
  | 'Future Employee'
  | 'Terminated'
  | 'Resigned'
  | 'Retired'
  | 'Contract Expired'

/** A period an employee is suspended for. `endDate` omitted = open-ended. */
export interface SuspensionPeriod {
  startDate: string // ISO date
  endDate?: string // ISO date
}

export interface RosterEmployee {
  id: string
  name: string
  department: string
  /** The employee's HR status label. Not date-aware — see `suspensions`. */
  status: EmployeeStatus
  contractStartDate: string // ISO date
  contractEndDate?: string // ISO date; undefined = open-ended
  /**
   * MOVE-3608 and MOVE-3769 both ask whether an employee is suspended *on a
   * given date* — the ticket's own example runs "suspended from 10-20 Aug", so
   * a single static status cannot answer it. These periods are the date-aware
   * source of truth the roster honours; `status` above stays the plain HR label
   * the older matrix variants group by. In production this would sync from the
   * HR Employee module (MOVE-1607).
   */
  suspensions?: SuspensionPeriod[]
}

/**
 * A working shift. Off Day was removed by the 18 Aug review — an employee who
 * is not on a shift is simply Not Assigned, so there is no third code.
 */
export type ShiftCode = 'AM' | 'PM'

/**
 * One week of a rule, stored per day rather than per employee.
 *
 * The 18 Aug review replaced the old "pattern" shape (an employee group owning
 * a weekly grid) with this one: the week is grouped by shift, and each day of
 * each shift names the employees working it. Standby moved the same way — it
 * used to be one flag for the whole week, and is now assigned per day.
 *
 * Every array has exactly 7 entries, Monday(0)..Sunday(6).
 */
export interface RuleWeek {
  am: string[][]
  pm: string[][]
  standby: string[][]
}

export interface RosterRule {
  id: string
  effectiveDate: string // ISO date
  endDate?: string // ISO date; undefined = ongoing
  repeatEveryWeeks: number
  weeks: RuleWeek[] // length === repeatEveryWeeks
}

/** Everyone the rule touches, in any shift or standby slot of any week. */
export function ruleEmployeeIds(rule: RosterRule): Set<string> {
  const ids = new Set<string>()
  for (const week of rule.weeks)
    for (const slots of [week.am, week.pm, week.standby])
      for (const day of slots) for (const id of day) ids.add(id)
  return ids
}

export function emptyRuleWeek(): RuleWeek {
  return {
    am: Array.from({ length: 7 }, () => []),
    pm: Array.from({ length: 7 }, () => []),
    standby: Array.from({ length: 7 }, () => []),
  }
}

/**
 * A shift a user can pick in the Edit Roster drawer. "NA" (Not Assigned) is
 * both the explicit pick and the resting state — MOVE-3769 §3.
 */
export type ShiftSelection = ShiftCode | 'NA'

/** Manual per-day edit saved from the Edit Roster drawer (MOVE-3769). */
export interface RosterOverride {
  employeeId: string
  date: string // ISO date
  shift?: ShiftSelection
  standby?: boolean
  /** Required when a user ticks Standby by hand; cleared when unticked. */
  standbyReason?: string
  extend?: boolean
  extendHours?: number
  extendReason?: string
  /** Marked absent: keeps the shift but excludes the employee from group counts. */
  absence?: boolean
}

export interface LeaveRecord {
  id: string
  employeeId: string
  startDate: string // ISO date
  endDate: string // ISO date (inclusive; same as startDate for single-day leave)
  type: string
  /** "Leave Time (if applicable)" per MOVE-3659 — omitted for full-day leave. */
  timing?: string
  approved: boolean
}

export interface PublicHoliday {
  date: string // ISO date
  name: string
}

export const OPERATIONS_EMPLOYEES: RosterEmployee[] = [
  { id: 'emp-1', name: 'Ahmad Fauzi', department: 'Operations', status: 'Active', contractStartDate: '2024-01-15' },
  { id: 'emp-2', name: 'Bella Santoso', department: 'Operations', status: 'Active', contractStartDate: '2023-06-01' },
  { id: 'emp-3', name: 'Citra Dewi', department: 'Operations', status: 'Active', contractStartDate: '2022-03-10' },
  { id: 'emp-4', name: 'Dedi Kurniawan', department: 'Operations', status: 'Active', contractStartDate: '2021-11-01' },
  { id: 'emp-5', name: 'Eka Wijaya', department: 'Operations', status: 'Active', contractStartDate: '2024-05-20' },
  // Suspended for part of August only — mirrors MOVE-3608's worked example, so
  // the count visibly drops during the period and recovers after it.
  {
    id: 'emp-6',
    name: 'Farhan Hakim',
    department: 'Operations',
    status: 'Suspended',
    contractStartDate: '2023-02-01',
    suspensions: [{ startDate: '2026-08-10', endDate: '2026-08-20' }],
  },
  {
    id: 'emp-7',
    name: 'Gita Permata',
    department: 'Operations',
    status: 'Suspended',
    contractStartDate: '2022-08-15',
    suspensions: [{ startDate: '2026-08-24', endDate: '2026-08-26' }],
  },
  { id: 'emp-8', name: 'Hendra Saputra', department: 'Operations', status: 'Future Employee', contractStartDate: '2026-08-20' },
  { id: 'emp-9', name: 'Indah Lestari', department: 'Operations', status: 'Future Employee', contractStartDate: '2026-09-01' },
  { id: 'emp-10', name: 'Joko Prasetyo', department: 'Operations', status: 'Resigned', contractStartDate: '2020-01-01', contractEndDate: '2026-08-10' },
  { id: 'emp-11', name: 'Kartika Sari', department: 'Operations', status: 'Terminated', contractStartDate: '2021-04-01', contractEndDate: '2026-08-05' },
  { id: 'emp-12', name: 'Lukman Hakim', department: 'Operations', status: 'Contract Expired', contractStartDate: '2023-01-01', contractEndDate: '2026-08-15' },
  { id: 'emp-13', name: 'Maya Anggraini', department: 'Operations', status: 'Active', contractStartDate: '2020-07-01' },
  // Non-Operations employee — must never appear on the roster calendar.
  { id: 'emp-14', name: 'Nadia Putri', department: 'Finance', status: 'Active', contractStartDate: '2022-01-01' },
]

/**
 * Mock-data helper. Describes a week the way a human reads it — employee by
 * employee — and inverts it into the stored per-day shape. 'NA' simply means
 * the employee is not in any shift list that day.
 */
function weekFrom(spec: {
  shifts: Record<string, ShiftSelection[]>
  /** employee id -> the day indexes they are on standby (Monday = 0). */
  standby?: Record<string, number[]>
}): RuleWeek {
  const week = emptyRuleWeek()
  for (const [id, days] of Object.entries(spec.shifts)) {
    days.forEach((shift, day) => {
      if (shift === 'AM') week.am[day].push(id)
      else if (shift === 'PM') week.pm[day].push(id)
    })
  }
  for (const [id, days] of Object.entries(spec.standby ?? {})) {
    for (const day of days) week.standby[day].push(id)
  }
  return week
}

// A weekday is always a working day for Operations, so every employee sits in
// AM or PM Monday–Friday and nobody falls into Not Assigned. Saturday runs a
// skeleton AM crew; Sunday nobody works. (18 Aug feedback — the fixtures were
// leaving several people unrostered on weekdays, which does not happen in real
// operations.)
const NA: ShiftSelection = 'NA'
const wk = (a: ShiftSelection, sat: ShiftSelection = NA): ShiftSelection[] => [a, a, a, a, a, sat, NA]

/** Everyone in Operations, split into the two shift teams. */
const AM_TEAM = ['emp-1', 'emp-3', 'emp-5', 'emp-7', 'emp-10', 'emp-12', 'emp-13']
const PM_TEAM = ['emp-2', 'emp-4', 'emp-6', 'emp-8', 'emp-9', 'emp-11']

/** Builds one week's shift map: the two teams swap between week 1 and week 2. */
function teamShifts(amFirst: boolean, satCrew: string[]): Record<string, ShiftSelection[]> {
  const shifts: Record<string, ShiftSelection[]> = {}
  for (const id of AM_TEAM) shifts[id] = wk(amFirst ? 'AM' : 'PM', satCrew.includes(id) ? 'AM' : NA)
  for (const id of PM_TEAM) shifts[id] = wk(amFirst ? 'PM' : 'AM', satCrew.includes(id) ? 'AM' : NA)
  return shifts
}

// Rules never overlap — MOVE-3609 §5 forbids two rules covering the same period.
export const ROSTER_RULES: RosterRule[] = [
  // Ended: retained for history, deliberately hidden from the drawer.
  {
    id: 'rule-1',
    effectiveDate: '2026-01-01',
    endDate: '2026-07-31',
    repeatEveryWeeks: 1,
    weeks: [
      weekFrom({
        shifts: teamShifts(true, ['emp-1', 'emp-2']),
        standby: { 'emp-1': [0, 1, 2, 3, 4, 5, 6] },
      }),
    ],
  },
  // Current rule. Two-week cycle: the AM and PM teams swap each week.
  {
    id: 'rule-2',
    effectiveDate: '2026-08-01',
    endDate: '2026-09-30',
    repeatEveryWeeks: 2,
    weeks: [
      weekFrom({
        shifts: teamShifts(true, ['emp-1', 'emp-2', 'emp-3']),
        // Standby rotates through the week rather than sitting on one person.
        standby: { 'emp-5': [0, 1, 2], 'emp-2': [3, 4], 'emp-1': [5], 'emp-3': [6] },
      }),
      weekFrom({
        shifts: teamShifts(false, ['emp-4', 'emp-5', 'emp-6']),
        standby: { 'emp-13': [0, 1, 2, 3], 'emp-4': [4, 5], 'emp-6': [6] },
      }),
    ],
  },
  // Upcoming: shows in the Upcoming tab, fully editable and deletable.
  {
    id: 'rule-3',
    effectiveDate: '2026-10-01',
    endDate: '2026-12-31',
    repeatEveryWeeks: 1,
    weeks: [
      weekFrom({
        shifts: teamShifts(true, ['emp-2', 'emp-13']),
        standby: { 'emp-1': [0, 1, 2], 'emp-13': [3, 4], 'emp-5': [5, 6] },
      }),
    ],
  },
]

/** Manual cell/standby edits saved from Bulk Edit Roster. Session-only. */
export const ROSTER_OVERRIDES: RosterOverride[] = []

// Scattered across the month so On Leave turns up on a variety of days rather
// than clustering. lv-4 deliberately lands on a standby day (Eka is the week-1
// Mon-Wed standby), which is how a red "Standby (0)" arises in real life:
// somebody was rostered to cover and then went on leave.
export const LEAVES: LeaveRecord[] = [
  { id: 'lv-1', employeeId: 'emp-10', startDate: '2026-08-03', endDate: '2026-08-03', type: 'Annual Leave', approved: true },
  { id: 'lv-2', employeeId: 'emp-12', startDate: '2026-08-04', endDate: '2026-08-05', type: 'Medical Leave', approved: true },
  { id: 'lv-3', employeeId: 'emp-1', startDate: '2026-08-06', endDate: '2026-08-07', type: 'Annual Leave', approved: true },
  { id: 'lv-4', employeeId: 'emp-5', startDate: '2026-08-10', endDate: '2026-08-11', type: 'Medical Leave', approved: true },
  { id: 'lv-5', employeeId: 'emp-2', startDate: '2026-08-12', endDate: '2026-08-12', type: 'Medical Leave', timing: 'Half Day (AM)', approved: true },
  { id: 'lv-6', employeeId: 'emp-4', startDate: '2026-08-13', endDate: '2026-08-14', type: 'Annual Leave', approved: true },
  { id: 'lv-7', employeeId: 'emp-7', startDate: '2026-08-18', endDate: '2026-08-19', type: 'Emergency Leave', approved: true },
  { id: 'lv-8', employeeId: 'emp-3', startDate: '2026-08-20', endDate: '2026-08-21', type: 'Annual Leave', approved: true },
  { id: 'lv-9', employeeId: 'emp-8', startDate: '2026-08-24', endDate: '2026-08-24', type: 'Annual Leave', approved: true },
  { id: 'lv-10', employeeId: 'emp-13', startDate: '2026-08-26', endDate: '2026-08-27', type: 'Annual Leave', approved: true },
  { id: 'lv-11', employeeId: 'emp-6', startDate: '2026-08-28', endDate: '2026-08-28', type: 'Emergency Leave', approved: true },
  { id: 'lv-12', employeeId: 'emp-9', startDate: '2026-09-02', endDate: '2026-09-04', type: 'Annual Leave', approved: true },
  // Not approved — must be ignored by the calendar.
  { id: 'lv-13', employeeId: 'emp-6', startDate: '2026-08-25', endDate: '2026-08-25', type: 'Annual Leave', approved: false },
]

export const PUBLIC_HOLIDAYS: PublicHoliday[] = [
  { date: '2026-08-17', name: 'Independence Day' },
  { date: '2026-09-16', name: 'Malaysia Day' },
]

// ---------------------------------------------------------------------------
// Mutations. No store exists, so these edit the arrays above in place and the
// calling page bumps a local counter to re-render (see useRosterRevision).
// ---------------------------------------------------------------------------

export function upsertRosterRule(rule: RosterRule) {
  const i = ROSTER_RULES.findIndex((r) => r.id === rule.id)
  if (i >= 0) ROSTER_RULES[i] = rule
  else ROSTER_RULES.push(rule)
  ROSTER_RULES.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
}

export function deleteRosterRule(ruleId: string) {
  const i = ROSTER_RULES.findIndex((r) => r.id === ruleId)
  if (i >= 0) ROSTER_RULES.splice(i, 1)
}

export function applyOverrides(next: RosterOverride[]) {
  for (const override of next) {
    const existing = ROSTER_OVERRIDES.find(
      (o) => o.employeeId === override.employeeId && o.date === override.date
    )
    if (existing) Object.assign(existing, override)
    else ROSTER_OVERRIDES.push({ ...override })
  }
}
