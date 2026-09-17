// Epic MOVE-3410 — every leave business rule lives here.
//
// Deliberately the only place these rules exist, the same way the roster module
// keeps `rosterStatusLogic` as its single source: the balances table, the apply
// drawer's live preview, the entitlement modals and the listing all have to
// agree on what an employee is entitled to, and they only can if they compute
// it from one function.
//
// The tickets these implement:
//   MOVE-3900  the 15 system types, their validity models, pro-ration, carry-forward
//   MOVE-3890  auto-created profile: which types an employee sees, and when
//   MOVE-3494  balance = entitlement − used − pending approval
//   MOVE-3777  §3.2 deduction rules, including the ≥5.5 working-days fork
//   MOVE-3500  manually added entitlements
//   MOVE-3775  per-year entitlement edits

import dayjs, { type Dayjs } from 'dayjs'
import {
  EMPLOYEE_ENTITLEMENTS,
  ENTITLEMENT_OVERRIDES,
  LEAVE_APPLICATIONS,
  LEAVE_TYPES,
  consumesBalance,
  type EntitlementUnit,
  type LeaveApplication,
  type LeaveEmployee,
  type LeaveType,
} from './leaveData'
import { ISO, deductionDays, type HalfDay } from './leaveDeduction'

export { ISO }

export const leaveTypeById = (id: string): LeaveType | undefined => LEAVE_TYPES.find((t) => t.id === id)

/** MOVE-1975 / MOVE-3890 — "active" for leave means active or suspended. */
export function isActiveForLeave(e: LeaveEmployee): boolean {
  return e.status === 'Active' || e.status === 'Suspended'
}

/**
 * MOVE-3890 §4 — recurrence stops the year after an employee goes inactive,
 * but history stays readable. So a year is "in service" if the contract had
 * started by its end and had not ended before its start.
 */
export function servesInYear(e: LeaveEmployee, year: number): boolean {
  const start = dayjs(e.contractStartDate)
  const end = e.contractEndDate ? dayjs(e.contractEndDate) : null
  if (start.year() > year) return false
  if (end && end.year() < year) return false
  return true
}

// ---------------------------------------------------------------------------
// Eligibility (MOVE-3900 / MOVE-3890 biz req 1)
// ---------------------------------------------------------------------------

/** Whether a type is auto-added to this employee's profile at all. */
export function isAutoAdded(type: LeaveType, e: LeaveEmployee): boolean {
  switch (type.eligibility) {
    case 'all':
      return true
    case 'drivers':
      return e.department === 'Driver'
    case 'non-drivers':
      return e.department !== 'Driver'
    case 'male-citizens':
      // MOVE-3900 §7 — gender = male AND employment eligibility = citizen.
      return e.gender === 'Male' && e.citizen
    case 'selected':
      // MOVE-3221 biz req 3 — no auto-add; HR adds it by hand (MOVE-3500).
      return false
  }
}

// ---------------------------------------------------------------------------
// Validity periods (MOVE-3900)
// ---------------------------------------------------------------------------

export interface Validity {
  effective: Dayjs | null
  end: Dayjs | null
  /** False when the type does not apply to this employee in this year at all. */
  applies: boolean
}

const NOT_APPLICABLE: Validity = { effective: null, end: null, applies: true }

/**
 * MOVE-3900 §5 — birthday leave is the fiddliest rule in the epic. The 17 Sep
 * 2026 rewrite split it into explicit branches, which this already satisfies:
 *
 *   - birth month falls after the three-month mark → 1st of the birth month
 *   - the three-month mark falls inside the birth month → that date
 *   - the birth month is already over by the three-month mark → nothing this
 *     year; the employee first qualifies on the 1st of their birth month next
 *     year, which the "subsequent years" branch below then produces
 *
 * and the end date is always the last day of that same birth month.
 */
function birthMonthValidity(e: LeaveEmployee, year: number): Validity {
  const birth = dayjs(e.birthDate)
  const monthStart = dayjs(`${year}-${String(birth.month() + 1).padStart(2, '0')}-01`)
  const monthEnd = monthStart.endOf('month')
  const threeMonths = dayjs(e.contractStartDate).add(3, 'month')

  if (threeMonths.isAfter(monthEnd)) return { effective: null, end: null, applies: false }
  // The later of the two starts the period — so a mid-month qualifying date
  // becomes the effective date, exactly as the ticket's third example wants.
  const effective = threeMonths.isAfter(monthStart) ? threeMonths : monthStart
  return { effective, end: monthEnd, applies: true }
}

/** The validity period a type has for one employee in one year. */
export function validityFor(type: LeaveType, e: LeaveEmployee, year: number): Validity {
  const yearStart = dayjs(`${year}-01-01`)
  const yearEnd = dayjs(`${year}-12-31`)
  const contractStart = dayjs(e.contractStartDate)

  switch (type.validity) {
    case 'annual-leave': {
      // MOVE-3900 §1 — 3 months from contract start, or 1 Jan, whichever later.
      const qualifies = contractStart.add(3, 'month')
      const effective = qualifies.isAfter(yearStart) ? qualifies : yearStart
      // Worked example: a 1 Dec 2026 start has no annual leave in 2026 at all,
      // because the qualifying date lands past the year end.
      if (effective.isAfter(yearEnd)) return { effective: null, end: null, applies: false }
      return { effective, end: yearEnd, applies: true }
    }
    case 'calendar-year': {
      // MOVE-3900 §3 — contract start, or 1 Jan, whichever is later.
      const effective = contractStart.isAfter(yearStart) ? contractStart : yearStart
      if (effective.isAfter(yearEnd)) return { effective: null, end: null, applies: false }
      return { effective, end: yearEnd, applies: true }
    }
    case 'birth-month':
      return birthMonthValidity(e, year)
    case 'none':
      return NOT_APPLICABLE
    case 'custom': {
      const effective = type.effectiveDate ? dayjs(type.effectiveDate) : null
      const end = type.endDate ? dayjs(type.endDate) : null
      const applies = !!effective && !!end && !effective.isAfter(yearEnd) && !end.isBefore(yearStart)
      return { effective, end, applies }
    }
    case 'employee-specific':
      // Filled in from the stored entitlement — see `manualValidity` below.
      return { effective: null, end: null, applies: false }
  }
}

/**
 * MOVE-3500 / MOVE-3900 §14 — a manually added entitlement covers its own
 * dates, and childcare leave then repeats those dates over whole calendar years
 * for as many years as HR asked for.
 */
function manualValidity(
  ent: { effectiveDate: string; endDate: string; recurringYears?: number },
  year: number,
): Validity {
  const effective = dayjs(ent.effectiveDate)
  const end = dayjs(ent.endDate)

  if (ent.recurringYears && ent.recurringYears > 1) {
    const firstYear = effective.year()
    const lastYear = firstYear + ent.recurringYears - 1
    if (year < firstYear || year > lastYear) return { effective: null, end: null, applies: false }
    // Year 1 keeps the entered dates; later years run the full calendar year.
    return year === firstYear
      ? { effective, end, applies: true }
      : { effective: dayjs(`${year}-01-01`), end: dayjs(`${year}-12-31`), applies: true }
  }

  const yearStart = dayjs(`${year}-01-01`)
  const yearEnd = dayjs(`${year}-12-31`)
  const applies = !effective.isAfter(yearEnd) && !end.isBefore(yearStart)
  return { effective, end, applies }
}

// ---------------------------------------------------------------------------
// Entitlement (MOVE-3900 §1 pro-ration + carry-forward)
// ---------------------------------------------------------------------------

/** MOVE-3900 §10 — weeks become days at the employee's working-days rate. */
export function weeksToDays(weeks: number, e: LeaveEmployee): number {
  return Math.round(weeks * e.workingDaysPerWeek)
}

/** Entitlement expressed in days, whatever unit it was stored in. */
export function entitlementInDays(value: number | null, unit: EntitlementUnit, e: LeaveEmployee): number | null {
  if (value === null) return null
  return unit === 'weeks' ? weeksToDays(value, e) : value
}

/**
 * MOVE-3900 §1.2 — annual leave is pro-rated in the first and last year of
 * service by the number of **completed** months of service. Part-months are
 * dropped, not rounded up: the 17 Sep 2026 rewrite of the ticket replaced
 * "by months, round up" with "no. of completed months", and moved its rounding
 * rule down to the resulting day count instead.
 *
 * The period is counted inclusively, so the end day is measured as the
 * following midnight. That is what makes the ticket's own examples come out:
 * 1 Jul – 31 Dec is 6 completed months, while 20 Jul – 31 Dec is 5 months and
 * 11 days, so 5.
 */
function monthsOfServiceIn(e: LeaveEmployee, year: number): number {
  const yearStart = dayjs(`${year}-01-01`)
  const yearEnd = dayjs(`${year}-12-31`)
  const start = dayjs(e.contractStartDate)
  const end = e.contractEndDate ? dayjs(e.contractEndDate) : null

  const from = start.isAfter(yearStart) ? start : yearStart
  const to = end && end.isBefore(yearEnd) ? end : yearEnd
  if (to.isBefore(from)) return 0

  return Math.min(12, to.add(1, 'day').diff(from, 'month'))
}

/** True when the year is the employee's first or last — the pro-rated ones. */
function isPartialYear(e: LeaveEmployee, year: number): boolean {
  const startsThisYear = dayjs(e.contractStartDate).year() === year
  const endsThisYear = !!e.contractEndDate && dayjs(e.contractEndDate).year() === year
  return startsThisYear || endsThisYear
}

/**
 * MOVE-3900 §1.2 / §2.2 — leftover annual leave carries into the next year, up
 * to a cap. As of 17 Sep 2026 the cap is no longer a flat 7 days: it is the
 * leave type's *own* default entitlement, doubled for Annual Leave (Drivers).
 * So Annual Leave caps at 12 and the drivers' type at 14, and the ticket is
 * explicit that editing the default entitlement has to move the cap with it —
 * which is why this reads the type rather than a constant.
 *
 * The balance it carries is computed from the previous year rather than stored,
 * so it cannot go stale when an application is cancelled.
 */
export function maxCarryForward(type: LeaveType, e: LeaveEmployee): number | null {
  if (type.validity !== 'annual-leave') return null
  const base = entitlementInDays(type.entitlement, type.unit, e)
  if (base === null) return null
  return base * (type.carryForwardMultiplier ?? 1)
}

function carryForwardInto(e: LeaveEmployee, type: LeaveType, year: number): number {
  const cap = maxCarryForward(type, e)
  if (cap === null) return 0
  const prev = year - 1
  if (!servesInYear(e, prev)) return 0
  const prevRow = balanceRowFor(e, type, prev, { withCarryForward: false })
  if (!prevRow || prevRow.balance === null || prevRow.balance <= 0) return 0
  return Math.min(cap, prevRow.balance)
}

// ---------------------------------------------------------------------------
// Balances (MOVE-3494 biz req 2)
// ---------------------------------------------------------------------------

export interface BalanceRow {
  leaveType: LeaveType
  validity: Validity
  /** Raw entitlement as stored, for display ("16 weeks / 80 days"). */
  entitlementValue: number | null
  entitlementUnit: EntitlementUnit
  /** Entitlement in days — what the balance arithmetic uses. */
  entitlementDays: number | null
  /** Days added by MOVE-3900's carry-forward rule, 0 when it does not apply. */
  carriedForward: number
  usedDays: number
  pendingDays: number
  /** `null` when entitlement is not applicable — MOVE-3494 says show "-". */
  balance: number | null
  /** True when this row came from MOVE-3500 rather than being auto-added. */
  manual: boolean
}

/**
 * Days consumed by an application, clipped to the year being viewed.
 *
 * MOVE-3494 biz req 1 — an application spanning a year boundary is counted in
 * each year for the part that falls in it. The slice is re-run through the
 * deduction rules rather than split proportionally by calendar days: the two
 * disagree whenever the split lands near a weekend or a public holiday, and
 * the ticket's own example (24 Dec – 5 Jan = 5 days then 2 days) is exactly
 * such a case.
 */
function daysInYear(app: LeaveApplication, employee: LeaveEmployee, year: number): number {
  const start = dayjs(app.startDate)
  const end = dayjs(app.endDate)
  if (start.year() === end.year()) return start.year() === year ? app.days : 0

  const yearStart = dayjs(`${year}-01-01`)
  const yearEnd = dayjs(`${year}-12-31`)
  if (end.isBefore(yearStart) || start.isAfter(yearEnd)) return 0

  const from = start.isAfter(yearStart) ? start : yearStart
  const to = end.isBefore(yearEnd) ? end : yearEnd
  // A half-day marker only belongs to the slice that actually holds that end.
  const fromHalf: HalfDay = from.isSame(start, 'day') ? app.startHalf : 'AM'
  const toHalf: HalfDay = to.isSame(end, 'day') ? app.endHalf : 'PM'
  return deductionFor(employee, from.format(ISO), to.format(ISO), fromHalf, toHalf)
}

function usageFor(employee: LeaveEmployee, leaveTypeId: string, year: number) {
  let usedDays = 0
  let pendingDays = 0
  for (const app of LEAVE_APPLICATIONS) {
    if (app.employeeId !== employee.id || app.leaveTypeId !== leaveTypeId) continue
    if (!consumesBalance(app.status)) continue
    const d = daysInYear(app, employee, year)
    if (app.status === 'Approved') usedDays += d
    else pendingDays += d
  }
  return { usedDays, pendingDays }
}

function overrideFor(employeeId: string, leaveTypeId: string, year: number) {
  // An edit applied "to subsequent recurring years" keeps applying until a
  // later edit supersedes it, so the newest override at or before this year
  // wins — a plain exact-year match would silently drop that checkbox's effect.
  const candidates = ENTITLEMENT_OVERRIDES.filter(
    (o) =>
      o.employeeId === employeeId &&
      o.leaveTypeId === leaveTypeId &&
      (o.year === year || (o.appliesForward && o.year < year)),
  ).sort((a, b) => b.year - a.year)
  return candidates[0]
}

function balanceRowFor(
  e: LeaveEmployee,
  type: LeaveType,
  year: number,
  opts: { withCarryForward?: boolean } = {},
): BalanceRow | null {
  const { withCarryForward = true } = opts
  const manualEnt = EMPLOYEE_ENTITLEMENTS.find((x) => x.employeeId === e.id && x.leaveTypeId === type.id)

  let validity: Validity
  let entitlementValue: number | null
  let entitlementUnit: EntitlementUnit

  if (manualEnt) {
    validity = manualValidity(manualEnt, year)
    entitlementValue = manualEnt.entitlement
    entitlementUnit = manualEnt.unit
  } else {
    if (!isAutoAdded(type, e)) return null
    validity = validityFor(type, e, year)
    entitlementValue = type.entitlement
    entitlementUnit = type.unit
  }

  if (!validity.applies) return null
  if (!servesInYear(e, year)) return null

  // MOVE-3775 — a saved edit replaces the derived value for this year.
  const override = overrideFor(e.id, type.id, year)
  if (override) {
    entitlementValue = override.entitlement
    entitlementUnit = override.unit
    if (override.effectiveDate) validity = { ...validity, effective: dayjs(override.effectiveDate) }
    if (override.endDate) validity = { ...validity, end: dayjs(override.endDate) }
  }

  let entitlementDays = entitlementInDays(entitlementValue, entitlementUnit, e)

  // MOVE-3900 §1 — pro-rate annual leave in a partial year, but never a value
  // HR has explicitly overridden: that number is the decision.
  if (entitlementDays !== null && !override && type.validity === 'annual-leave' && isPartialYear(e, year)) {
    const months = monthsOfServiceIn(e, year)
    // MOVE-3900 §1.2 — "fraction of a day < 0.5 → round down, ≥ 0.5 → round up",
    // which is exactly what Math.round does with a positive number.
    entitlementDays = Math.round((entitlementDays / 12) * months)
  }

  const carriedForward = withCarryForward && entitlementDays !== null ? carryForwardInto(e, type, year) : 0
  if (entitlementDays !== null) entitlementDays += carriedForward

  const { usedDays, pendingDays } = usageFor(e, type.id, year)

  return {
    leaveType: type,
    validity,
    entitlementValue,
    entitlementUnit,
    entitlementDays,
    carriedForward,
    usedDays,
    pendingDays,
    // MOVE-3494 biz req 2 row 6 — a null entitlement stays null however many
    // days have been taken.
    balance: entitlementDays === null ? null : entitlementDays - usedDays - pendingDays,
    manual: !!manualEnt,
  }
}

/**
 * MOVE-3494 biz req 2 — every leave type an employee is eligible for in a year,
 * in the ticket's stated default sort: system leave types first, in the fixed
 * order the manage-leave-types page uses, then custom leave types by their
 * effective date, most recent first.
 *
 * Note this sorts by *system vs custom*, not by auto-added vs manually added.
 * They are different splits — maternity leave is a system type that only ever
 * arrives manually — and an earlier reading of this rule conflated them.
 */
export function balancesFor(e: LeaveEmployee, year: number): BalanceRow[] {
  const rows: BalanceRow[] = []
  for (const type of LEAVE_TYPES) {
    const row = balanceRowFor(e, type, year)
    if (row) rows.push(row)
  }
  // LEAVE_TYPES is already in the manage page's order, so the system group only
  // has to keep it.
  const system = rows.filter((r) => r.leaveType.system)
  const custom = rows
    .filter((r) => !r.leaveType.system)
    .sort((a, b) => (b.leaveType.effectiveDate ?? '').localeCompare(a.leaveType.effectiveDate ?? ''))
  return [...system, ...custom]
}

export function balanceRow(e: LeaveEmployee, leaveTypeId: string, year: number): BalanceRow | undefined {
  return balancesFor(e, year).find((r) => r.leaveType.id === leaveTypeId)
}

// ---------------------------------------------------------------------------
// Leave balance details (MOVE-4137)
// ---------------------------------------------------------------------------

/** Every application of one leave type that touches the viewing year. */
export function applicationsForType(e: LeaveEmployee, leaveTypeId: string, year: number): LeaveApplication[] {
  return LEAVE_APPLICATIONS
    .filter((a) => a.employeeId === e.id && a.leaveTypeId === leaveTypeId)
    .filter((a) => dayjs(a.startDate).year() <= year && dayjs(a.endDate).year() >= year)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export interface MonthUsage {
  /** First of the month, for formatting as "Mar 2026". */
  month: Dayjs
  days: number
}

/**
 * MOVE-4137 biz req 1.3 — leave days used per month, for approved applications
 * of this type inside the viewing year.
 *
 * The ticket's example is a cross-month application (30 Mar – 3 Apr) that has
 * to land 2 days in March and 3 in April, so this walks the period day by day
 * through the same deduction rule rather than attributing the whole
 * application to its start month. A month with no usage is left out entirely.
 */
export function monthlyUsage(e: LeaveEmployee, leaveTypeId: string, year: number): MonthUsage[] {
  const perMonth = new Map<number, number>()

  for (const app of applicationsForType(e, leaveTypeId, year)) {
    if (app.status !== 'Approved') continue
    const start = dayjs(app.startDate)
    const end = dayjs(app.endDate)
    for (let d = start; !d.isAfter(end); d = d.add(1, 'day')) {
      if (d.year() !== year) continue
      // One day at a time, carrying this day's own half-day markers so a
      // half-day at either end still costs 0.5 in the month that holds it.
      const startHalf: HalfDay = d.isSame(start, 'day') ? app.startHalf : 'AM'
      const endHalf: HalfDay = d.isSame(end, 'day') ? app.endHalf : 'PM'
      const cost = deductionFor(e, d.format(ISO), d.format(ISO), startHalf, endHalf)
      if (cost === 0) continue
      perMonth.set(d.month(), (perMonth.get(d.month()) ?? 0) + cost)
    }
  }

  return [...perMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, days]) => ({ month: dayjs(`${year}-${String(month + 1).padStart(2, '0')}-01`), days }))
}

export interface EntitlementAudit {
  addedOn: string | null
  addedBy: string
  lastUpdatedOn: string | null
  lastUpdatedBy: string
}

/**
 * MOVE-4137 biz req 1.4 — who put this entitlement on the profile and who
 * touched it last.
 *
 * A manually added entitlement carries its own stamps. An auto-added one was
 * never "added" by anyone, so the ticket's "display 'system'" applies and the
 * date shown is the day the entitlement became effective. An MOVE-3775 edit,
 * where one exists, supplies the last-updated pair.
 */
export function entitlementAudit(e: LeaveEmployee, row: BalanceRow, year: number): EntitlementAudit {
  const manualEnt = EMPLOYEE_ENTITLEMENTS.find(
    (x) => x.employeeId === e.id && x.leaveTypeId === row.leaveType.id,
  )
  const addedOn = manualEnt ? manualEnt.addedOn : row.validity.effective?.format(ISO) ?? null
  const addedBy = manualEnt ? manualEnt.addedBy : 'System'

  const override = overrideFor(e.id, row.leaveType.id, year)
  return {
    addedOn,
    addedBy,
    lastUpdatedOn: override?.updatedOn ?? addedOn,
    lastUpdatedBy: override?.updatedBy ?? addedBy,
  }
}

/**
 * MOVE-4137 biz req 1.2 — the entitlement breakdown shown for annual leave:
 * what carried in, what this year grants on its own, and the total.
 * `null` for every other leave type, which has no such section.
 */
export function entitlementBreakdown(
  row: BalanceRow,
): { carriedForward: number; thisYear: number; total: number } | null {
  if (row.leaveType.validity !== 'annual-leave' || row.entitlementDays === null) return null
  return {
    carriedForward: row.carriedForward,
    thisYear: row.entitlementDays - row.carriedForward,
    total: row.entitlementDays,
  }
}

/** MOVE-1975 — the listing's two balance columns. */
export function listingBalance(e: LeaveEmployee, kind: 'AL' | 'ML', year: number): number | null {
  const id = kind === 'ML' ? 'lt-ml' : e.department === 'Driver' ? 'lt-al-drv' : 'lt-al'
  return balanceRow(e, id, year)?.balance ?? null
}

// ---------------------------------------------------------------------------
// Deduction (MOVE-3777 biz req 3.2)
// ---------------------------------------------------------------------------

/**
 * How many leave days an application period costs.
 *
 * The rule forks on the employee's contracted working days per week. Under 5.5,
 * only weekdays count and public holidays are free. At 5.5 and above, weekends
 * start costing: a *consecutive* Sat+Sun pair costs one day, a lone weekend day
 * costs nothing, and any weekend pair containing a public holiday costs nothing.
 */
export function deductionFor(
  employee: LeaveEmployee,
  startDate: string,
  endDate: string,
  startHalf: HalfDay,
  endHalf: HalfDay,
): number {
  return deductionDays(employee.workingDaysPerWeek, startDate, endDate, startHalf, endHalf)
}

/**
 * MOVE-3777 biz req 2 vs biz req 3 — the two read as contradictory at first:
 * dates outside the validity period are disabled, yet the ticket's own worked
 * example applies 24 Dec 2026 – 5 Jan 2027 against annual leave whose period
 * ends 31 Dec 2026. The resolution is that a recurring type has a *separate*
 * window in each year it recurs, and the application simply spans two of them.
 * So selectability is checked against the viewing year and the next one, not
 * against a single window.
 */
export function isSelectableDate(
  e: LeaveEmployee,
  type: LeaveType,
  year: number,
  d: Dayjs,
): boolean {
  const windows: Validity[] = [balanceRowFor(e, type, year)?.validity].filter(Boolean) as Validity[]
  if (type.autoRecur) {
    const next = balanceRowFor(e, type, year + 1)?.validity
    if (next) windows.push(next)
  }
  // A type with no validity period at all (Time Off, Unpaid, Compassionate,
  // NS) constrains nothing — every date is fair game.
  if (windows.length === 0 || windows.every((w) => !w.effective || !w.end)) return true
  return windows.some(
    (w) => !!w.effective && !!w.end && !d.isBefore(w.effective, 'day') && !d.isAfter(w.end, 'day'),
  )
}

/** The years an application period touches, in order. */
export function yearsSpanned(startDate: string, endDate: string): number[] {
  const a = dayjs(startDate).year()
  const b = dayjs(endDate).year()
  const out: number[] = []
  for (let y = a; y <= b; y++) out.push(y)
  return out
}

/**
 * MOVE-3777 biz req 3 — when an application spans two years the drawer shows a
 * balance per year, so the deduction has to be sliced the same way the balances
 * table slices it. Shares `daysInYear`'s rule by construction.
 */
export function deductionInYear(
  e: LeaveEmployee,
  startDate: string,
  endDate: string,
  startHalf: HalfDay,
  endHalf: HalfDay,
  year: number,
): number {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  const yearStart = dayjs(`${year}-01-01`)
  const yearEnd = dayjs(`${year}-12-31`)
  if (end.isBefore(yearStart) || start.isAfter(yearEnd)) return 0
  const from = start.isAfter(yearStart) ? start : yearStart
  const to = end.isBefore(yearEnd) ? end : yearEnd
  const fromHalf: HalfDay = from.isSame(start, 'day') ? startHalf : 'AM'
  const toHalf: HalfDay = to.isSame(end, 'day') ? endHalf : 'PM'
  return deductionFor(e, from.format(ISO), to.format(ISO), fromHalf, toHalf)
}

/** MOVE-3777 biz req 3.1 — the sentence shown under "Available". */
export function availabilityNote(v: Validity, today = dayjs()): string {
  if (!v.effective || !v.end) return ''
  if (v.end.isBefore(today, 'day')) return 'Validity period has passed'
  if (v.effective.isAfter(today, 'day')) return `valid from ${v.effective.format('D MMM YYYY')}`
  return `valid until ${v.end.format('D MMM YYYY')}`
}

/** MOVE-3777 biz req 2 — which types demand an attachment. */
export function requiresDocument(type: LeaveType): boolean {
  return type.supportingDocument === 'required'
}

/**
 * MOVE-3494 biz req 1 — the years worth offering in the profile's year toggle:
 * from the employee's first year of service to the later of this year and any
 * year their data reaches into.
 */
export function selectableYears(e: LeaveEmployee, today = dayjs()): number[] {
  const first = dayjs(e.contractStartDate).year()
  const appYears = LEAVE_APPLICATIONS.filter((a) => a.employeeId === e.id).map((a) => dayjs(a.endDate).year())
  const entYears = EMPLOYEE_ENTITLEMENTS.filter((x) => x.employeeId === e.id).map((x) => {
    const base = dayjs(x.endDate).year()
    return x.recurringYears ? dayjs(x.effectiveDate).year() + x.recurringYears - 1 : base
  })
  const last = Math.max(today.year() + 1, ...appYears, ...entYears, first)
  const years: number[] = []
  for (let y = first; y <= last; y++) years.push(y)
  return years
}

/** Formats an entitlement for display, including the weeks/days pairing. */
export function formatEntitlement(row: BalanceRow, e: LeaveEmployee): string {
  if (row.entitlementValue === null) return '-'
  if (row.entitlementUnit === 'weeks') {
    return `${row.entitlementValue} weeks / ${weeksToDays(row.entitlementValue, e)} days`
  }
  const base = `${row.entitlementDays} ${row.entitlementDays === 1 ? 'day' : 'days'}`
  return row.carriedForward > 0 ? `${base} (incl. ${row.carriedForward} carried forward)` : base
}

/** MOVE-3494 — "1 Jan 2026 - 31 Dec 2026", or "-" when there is no period. */
export function formatValidity(v: Validity): string {
  if (!v.effective || !v.end) return '-'
  return `${v.effective.format('D MMM YYYY')} - ${v.end.format('D MMM YYYY')}`
}

export const formatDays = (n: number | null): string =>
  n === null ? '-' : `${n} ${n === 1 ? 'day' : 'days'}`
