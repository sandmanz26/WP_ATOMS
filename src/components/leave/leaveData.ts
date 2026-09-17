// Epic MOVE-3410 (WLA: HR - Leave) — shared types + mock dataset.
//
// The domain follows the epic's vocabulary: a *Leave Type* carries a default
// entitlement and a validity model; an *Employee Leave Profile* is the set of
// leave types an employee is eligible for in a given year, each with its own
// balance; a *Leave Application* consumes days from one of those balances.
//
// No backend, matching the rest of this prototype: the arrays below are the
// source of truth and mutate in place, so every page observes the same state.
// In production the employee half would come from the HR Employee module
// (MOVE-1607 / MOVE-3416).
//
// Every seed application computes its own `days` through the same function the
// apply drawer uses (see `leaveDeduction.ts`). Hand-typed day counts were free
// to drift from the rule, which is the kind of mock data that quietly makes a
// prototype lie about its own arithmetic.

import { LEAVE_PUBLIC_HOLIDAYS, deductionDays, type HalfDay } from './leaveDeduction'

export { LEAVE_PUBLIC_HOLIDAYS }
export type { HalfDay }

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

/** MOVE-1975 biz req 3 — the filter's fixed option set. */
export const HIRING_COMPANIES = ['Westpoint Transit', 'Westpoint Coach', 'Westpoint Tours'] as const
export type HiringCompany = (typeof HIRING_COMPANIES)[number]

/** MOVE-1975 biz req 3 — including "Not applicable", which is a real option. */
export const DEPARTMENTS = [
  'Digital',
  'Driver',
  'Facilities',
  'Finance',
  'Human Resources',
  'Operations',
  'Sales',
  'Workshop',
  'Not applicable',
] as const
export type Department = (typeof DEPARTMENTS)[number]

/**
 * The employee's HR status. The listing shows Active and Suspended only
 * (MOVE-1975 biz req 1), so the other values exist here to prove that rule is
 * doing something rather than being asserted.
 */
export type LeaveEmployeeStatus =
  | 'Active'
  | 'Suspended'
  | 'Future Employee'
  | 'Terminated'
  | 'Resigned'
  | 'Retired'
  | 'Contract Expired'

export interface LeaveEmployee {
  id: string
  /** Split because MOVE-3416 defines the full name as given + family. */
  givenName: string
  familyName: string
  department: Department
  status: LeaveEmployeeStatus
  /**
   * Hiring companies drawn from the employee's active/ending contracts and
   * addenda, **most recently created first** — MOVE-1975 biz req 1 shows the
   * newest and hides the rest behind "+n".
   */
  hiringCompanies: HiringCompany[]
  /** MOVE-3900 biz req 7 — NS Leave is for male citizens only. */
  gender: 'Male' | 'Female'
  citizen: boolean
  /** MOVE-3900 biz req 5 — birthday leave keys off the birth month. */
  birthDate: string
  contractStartDate: string
  contractEndDate?: string
  /**
   * MOVE-3777 biz req 3.2 — the deduction rules fork at 5.5, and MOVE-3900
   * biz req 10 converts a week-based entitlement into days with it.
   */
  workingDaysPerWeek: number
  /** MOVE-3777 biz req 4.1 — no approver means leave is created approved. */
  leaveApprover?: string
  /** ISO datetime the leave profile was last updated. */
  lastUpdatedOn: string
}

export function fullName(e: LeaveEmployee): string {
  return `${e.givenName} ${e.familyName}`
}

/** MOVE-1975 biz req 1 — the listing shows active contracts only. */
export function isListedOnLeavePage(e: LeaveEmployee): boolean {
  return e.status === 'Active' || e.status === 'Suspended'
}

// ---------------------------------------------------------------------------
// Leave types
// ---------------------------------------------------------------------------

export type EntitlementUnit = 'days' | 'weeks'

/** MOVE-3221 biz req 2 / MOVE-3900 — who a type is auto-added to. */
export type EmployeeEligibility = 'all' | 'drivers' | 'non-drivers' | 'male-citizens' | 'selected'

export const ELIGIBILITY_LABEL: Record<EmployeeEligibility, string> = {
  all: 'All employees',
  drivers: 'Drivers only',
  'non-drivers': 'Non-drivers only',
  'male-citizens': 'Male citizens only',
  selected: 'Selected employees',
}

export type SupportingDocumentRule = 'required' | 'optional'

export type Encashment = 'not-available' | 'upon-resignation' | 'annual-or-resignation'

export const ENCASHMENT_LABEL: Record<Encashment, string> = {
  'not-available': 'Not available',
  'upon-resignation': 'Upon resignation',
  'annual-or-resignation': 'Annual payout / upon resignation',
}

/**
 * How a type's validity period is derived for a given employee and year.
 * MOVE-3900 spells out four distinct shapes; naming them keeps the branching in
 * `leaveLogic` honest instead of a pile of per-type special cases.
 */
export type ValidityModel =
  /** MOVE-3900 §1 — 3 months from contract start, or 1 Jan, whichever is later. */
  | 'annual-leave'
  /** MOVE-3900 §3 — contract start, or 1 Jan, whichever is later. */
  | 'calendar-year'
  /** MOVE-3900 §5 — first day of birth month (or 3-month completion), to month end. */
  | 'birth-month'
  /** MOVE-3900 §6–9 — no validity period at all. */
  | 'none'
  /** MOVE-3900 §10–15 — blank until HR adds it to a profile. */
  | 'employee-specific'
  /** MOVE-3221 — a custom type carries its own fixed dates. */
  | 'custom'

export interface LeaveType {
  id: string
  name: string
  /** MOVE-3900 pre-creates these; MOVE-3221 creates the rest. */
  system: boolean
  /** `null` = not applicable, which renders as "-" everywhere. */
  entitlement: number | null
  unit: EntitlementUnit
  validity: ValidityModel
  /** Custom types only — the fixed dates entered at creation. */
  effectiveDate?: string
  endDate?: string
  /** MOVE-3900 — whether the type reappears every year by itself. */
  autoRecur: boolean
  supportingDocument: SupportingDocumentRule
  encashment: Encashment
  eligibility: EmployeeEligibility
  /**
   * MOVE-3900 biz req 1.2 / 2.2 — the carry-forward cap is the type's own
   * default entitlement times this. Annual Leave (Drivers) is the only type
   * that doubles it; everything else that carries forward uses 1. Stored as a
   * multiplier rather than a number of days so that editing the default
   * entitlement moves the cap with it, which is what the ticket asks for.
   */
  carryForwardMultiplier?: number
  /** MOVE-1977 biz req 1.2 — the fixed wording the system table shows. */
  validityLabel: string
  lastUpdatedOn: string
  lastUpdatedBy: string
  /** MOVE-4019 — system types show "-" for created on and "system" for by. */
  createdOn?: string
  createdBy: string
}

/** The signed-in user, used as "updated by" on everything written here. */
export const CURRENT_USER = 'Heikke Ekkieh'

const SYS = (
  id: string,
  name: string,
  entitlement: number | null,
  unit: EntitlementUnit,
  validity: ValidityModel,
  autoRecur: boolean,
  supportingDocument: SupportingDocumentRule,
  encashment: Encashment,
  eligibility: EmployeeEligibility,
  validityLabel: string,
  lastUpdatedOn: string,
  extra: Partial<LeaveType> = {},
): LeaveType => ({
  id, name, system: true, entitlement, unit, validity, autoRecur,
  supportingDocument, encashment, eligibility, validityLabel,
  lastUpdatedOn, lastUpdatedBy: 'System', createdBy: 'System',
  ...extra,
})

const CUSTOM = (
  id: string,
  name: string,
  entitlement: number | null,
  unit: EntitlementUnit,
  effectiveDate: string,
  endDate: string,
  supportingDocument: SupportingDocumentRule,
  encashment: Encashment,
  eligibility: EmployeeEligibility,
  createdOn: string,
  createdBy: string,
  lastUpdatedOn: string,
  lastUpdatedBy: string,
): LeaveType => ({
  id, name, system: false, entitlement, unit, validity: 'custom',
  effectiveDate, endDate, autoRecur: false, supportingDocument, encashment, eligibility,
  validityLabel: `${effectiveDate} - ${endDate}`,
  lastUpdatedOn, lastUpdatedBy, createdOn, createdBy,
})

/**
 * MOVE-3900 — the 15 types the system pre-creates, in the fixed order
 * MOVE-1977 biz req 1.2 lays out (that table is not sortable, so the order
 * here *is* the presentation order), followed by the custom ones MOVE-3221
 * would have produced.
 */
export const LEAVE_TYPES: LeaveType[] = [
  SYS('lt-al', 'Annual Leave', 12, 'days', 'annual-leave', true, 'optional', 'upon-resignation', 'non-drivers', 'Every calendar year', '2026-01-02T09:00:00'),
  // MOVE-3900 biz req 2.2 — drivers carry forward 2x the default, so 14 days.
  SYS('lt-al-drv', 'Annual Leave (Drivers)', 7, 'days', 'annual-leave', true, 'optional', 'upon-resignation', 'drivers', 'Every calendar year', '2026-01-02T09:00:00',
    { carryForwardMultiplier: 2 }),
  SYS('lt-ml', 'Medical Leave', 14, 'days', 'calendar-year', true, 'required', 'not-available', 'all', 'Every calendar year', '2026-01-02T09:00:00'),
  SYS('lt-hosp', 'Hospitalisation Leave', 46, 'days', 'calendar-year', true, 'required', 'not-available', 'all', 'Every calendar year', '2026-01-02T09:00:00'),
  SYS('lt-bday', 'Birthday Leave', 1, 'days', 'birth-month', true, 'optional', 'not-available', 'all', 'Every calendar year, in birth month', '2026-01-02T09:00:00'),
  SYS('lt-comp', 'Compassionate Leave', 0, 'days', 'none', true, 'optional', 'not-available', 'all', '-', '2026-01-02T09:00:00'),
  SYS('lt-ns', 'NS Leave', 0, 'days', 'none', true, 'required', 'not-available', 'male-citizens', '-', '2026-01-02T09:00:00'),
  SYS('lt-timeoff', 'Time Off', null, 'days', 'none', true, 'optional', 'not-available', 'all', '-', '2026-01-02T09:00:00'),
  SYS('lt-unpaid', 'Unpaid Leave', null, 'days', 'none', true, 'optional', 'not-available', 'all', '-', '2026-01-02T09:00:00'),
  SYS('lt-mat', 'Maternity Leave', 16, 'weeks', 'employee-specific', false, 'required', 'not-available', 'selected', 'Specific to employee', '2026-01-02T09:00:00'),
  SYS('lt-pat', 'Paternity Leave', 4, 'weeks', 'employee-specific', false, 'required', 'not-available', 'selected', 'Specific to employee', '2026-01-02T09:00:00'),
  SYS('lt-spl', 'Shared Parental Leave', 10, 'weeks', 'employee-specific', false, 'optional', 'not-available', 'selected', 'Specific to employee', '2026-01-02T09:00:00'),
  SYS('lt-adopt', 'Adoption Leave', 12, 'weeks', 'employee-specific', false, 'optional', 'not-available', 'selected', 'Specific to employee', '2026-01-02T09:00:00'),
  // MOVE-3900 §14 — recurs, but only for the number of years HR sets when the
  // entitlement is added to a profile.
  SYS('lt-ccl', 'Childcare Leave', 8, 'days', 'employee-specific', true, 'optional', 'not-available', 'selected', 'Specific to employee', '2026-01-02T09:00:00'),
  SYS('lt-uicl', 'Unpaid Infant Care Leave', 12, 'days', 'employee-specific', false, 'optional', 'not-available', 'selected', 'Specific to employee', '2026-01-02T09:00:00'),

  // --- Custom types (MOVE-3221). Three, chosen to exercise MOVE-3559's
  // four-way edit rule: one wholly in the future, one already running, and one
  // whose end date has passed so its entitlement is locked. ---
  CUSTOM('lt-study', 'Study Leave', 5, 'days', '2026-01-01', '2026-12-31', 'required', 'not-available', 'all',
    '2025-12-18T10:20:00', 'Maya Anggraini', '2026-06-02T14:05:00', CURRENT_USER),
  CUSTOM('lt-volunteer', 'Volunteer Leave', 2, 'days', '2026-07-01', '2027-06-30', 'optional', 'not-available', 'non-drivers',
    '2026-05-11T09:40:00', CURRENT_USER, '2026-05-11T09:40:00', CURRENT_USER),
  CUSTOM('lt-marriage', 'Marriage Leave', 3, 'days', '2025-01-01', '2025-12-31', 'required', 'not-available', 'all',
    '2024-11-29T16:15:00', 'Maya Anggraini', '2025-02-03T11:30:00', 'Maya Anggraini'),
]

/** MOVE-3777 biz req 2 — these five always demand an attachment. */
export const DOC_REQUIRED_TYPE_IDS = ['lt-ml', 'lt-hosp', 'lt-mat', 'lt-pat', 'lt-ns']

// ---------------------------------------------------------------------------
// Per-employee entitlements (manually added, MOVE-3500)
// ---------------------------------------------------------------------------

/**
 * A leave type HR added to one employee's profile. Only types whose eligibility
 * is "selected" get here — everything else is derived, not stored.
 */
export interface EmployeeEntitlement {
  id: string
  employeeId: string
  leaveTypeId: string
  effectiveDate: string
  endDate: string
  entitlement: number | null
  unit: EntitlementUnit
  /** MOVE-3500 biz req 2 — childcare leave only. */
  recurringYears?: number
  /** MOVE-4137 biz req 1.4 — when this entitlement reached the profile. */
  addedOn: string
  addedBy: string
}

/**
 * MOVE-3775 — an edit to one year's entitlement. Kept separate from the
 * derivation so the defaults stay computable and an override is visibly an
 * override.
 */
export interface EntitlementOverride {
  employeeId: string
  leaveTypeId: string
  year: number
  entitlement: number | null
  unit: EntitlementUnit
  effectiveDate?: string
  endDate?: string
  /** Set when "apply to subsequent recurring years" was ticked. */
  appliesForward?: boolean
  /** MOVE-4137 biz req 1.4 — surfaces as "last updated" on the balance drawer. */
  updatedOn?: string
  updatedBy?: string
}

// ---------------------------------------------------------------------------
// Leave applications
// ---------------------------------------------------------------------------

export type LeaveStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Cancelled'

export interface LeaveApplication {
  id: string
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  startHalf: HalfDay
  endHalf: HalfDay
  /** Time Off only. */
  startTime?: string
  endTime?: string
  /** MOVE-3777 biz req 3.2 — days deducted, computed at submission. */
  days: number
  remarks?: string
  documentName?: string
  status: LeaveStatus
  appliedOn: string
  appliedBy: string
  approvedOn?: string
  approvedBy?: string
  rejectedOn?: string
  rejectedBy?: string
  cancelledOn?: string
  cancelledBy?: string
}

/** MOVE-3779 / MOVE-3893 — only these two consume balance. */
export function consumesBalance(status: LeaveStatus): boolean {
  return status === 'Approved' || status === 'Pending Approval'
}

// ---------------------------------------------------------------------------
// Entitlement change history (MOVE-3888)
// ---------------------------------------------------------------------------

export type ChangeEditType = 'Add' | 'Edit' | 'System'

export interface EntitlementChange {
  id: string
  employeeId: string
  updatedOn: string
  updatedBy: string
  editType: ChangeEditType
  /** For Add: the leave type name. For Edit: the field label. */
  fieldEdited: string
  previousInput: string
  newInput: string
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

/**
 * 37 employees, of which 33 are listed — the four that are not carry
 * Terminated / Resigned / Retired / Future Employee so MOVE-1975's active-only
 * rule is visible in the count rather than taken on trust.
 */
export const LEAVE_EMPLOYEES: LeaveEmployee[] = [
  { id: 'lv-1', givenName: 'Ahmad', familyName: 'Fauzi', department: 'Operations', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1992-03-14', contractStartDate: '2024-01-15', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-26T09:12:00' },
  { id: 'lv-2', givenName: 'Bella', familyName: 'Santoso', department: 'Operations', status: 'Active',
    // Three contracts — the newest shows, "+2" carries the rest.
    hiringCompanies: ['Westpoint Coach', 'Westpoint Transit', 'Westpoint Tours'], gender: 'Female', citizen: true,
    birthDate: '1995-09-02', contractStartDate: '2023-06-01', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-25T16:40:00' },
  { id: 'lv-3', givenName: 'Citra', familyName: 'Dewi', department: 'Human Resources', status: 'Active',
    hiringCompanies: ['Westpoint Transit', 'Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1990-12-20', contractStartDate: '2022-03-10', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-24T11:05:00' },
  { id: 'lv-4', givenName: 'Dedi', familyName: 'Kurniawan', department: 'Workshop', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Male', citizen: true,
    birthDate: '1988-06-05', contractStartDate: '2021-11-01', workingDaysPerWeek: 5.5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-21T08:30:00' },
  { id: 'lv-5', givenName: 'Eka', familyName: 'Wijaya', department: 'Driver', status: 'Active',
    // A driver, so annual leave comes from the drivers' type at 7 days.
    hiringCompanies: ['Westpoint Tours'], gender: 'Male', citizen: false,
    birthDate: '1993-10-11', contractStartDate: '2024-05-20', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-20T14:22:00' },
  { id: 'lv-6', givenName: 'Farhan', familyName: 'Hakim', department: 'Operations', status: 'Suspended',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1991-08-30', contractStartDate: '2023-02-01', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-19T17:55:00' },
  { id: 'lv-7', givenName: 'Gita', familyName: 'Permata', department: 'Finance', status: 'Suspended',
    hiringCompanies: ['Westpoint Coach', 'Westpoint Tours'], gender: 'Female', citizen: true,
    birthDate: '1994-02-18', contractStartDate: '2022-08-15', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-18T10:10:00' },
  { id: 'lv-8', givenName: 'Hendra', familyName: 'Saputra', department: 'Digital', status: 'Active',
    // Starts 1 Jun 2026, completes 3 months 1 Sep, birth month Nov — so he DOES
    // get birthday leave in his first year. The counterpart to Indah below.
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1996-11-07', contractStartDate: '2026-06-01', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-17T13:45:00' },
  { id: 'lv-9', givenName: 'Indah', familyName: 'Lestari', department: 'Sales', status: 'Active',
    // Birth month Jun with a 1 Jun 2026 start: 3 months completes 1 Sep, the
    // birth month has passed, so 2026 has no birthday leave — MOVE-3900 §5's
    // first worked example, kept live in the data.
    hiringCompanies: ['Westpoint Tours'], gender: 'Female', citizen: true,
    birthDate: '1997-06-12', contractStartDate: '2026-06-01', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-15T09:00:00' },
  { id: 'lv-10', givenName: 'Joko', familyName: 'Prasetyo', department: 'Driver', status: 'Active',
    hiringCompanies: ['Westpoint Transit', 'Westpoint Coach', 'Westpoint Tours'], gender: 'Male', citizen: true,
    birthDate: '1989-04-25', contractStartDate: '2020-02-17', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-14T15:30:00' },
  { id: 'lv-11', givenName: 'Kartika', familyName: 'Sari', department: 'Facilities', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1992-07-19', contractStartDate: '2023-09-04', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-12T12:18:00' },
  { id: 'lv-12', givenName: 'Lukman', familyName: 'Hakim', department: 'Workshop', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1987-01-08', contractStartDate: '2019-05-13', workingDaysPerWeek: 5.5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-11T07:40:00' },
  { id: 'lv-13', givenName: 'Maya', familyName: 'Anggraini', department: 'Human Resources', status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1985-05-27', contractStartDate: '2018-01-02', workingDaysPerWeek: 5,
    // MOVE-3777 biz req 4.1 — no approver, so her leave is created approved.
    lastUpdatedOn: '2026-08-08T18:05:00' },
  { id: 'lv-14', givenName: 'Nadia', familyName: 'Rahmawati', department: 'Finance', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1993-03-03', contractStartDate: '2021-07-01', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-05T11:50:00' },
  { id: 'lv-15', givenName: 'Oscar', familyName: 'Tanuwijaya', department: 'Digital', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: false,
    birthDate: '1994-09-15', contractStartDate: '2022-11-21', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-03T16:20:00' },
  { id: 'lv-16', givenName: 'Putri', familyName: 'Handayani', department: 'Not applicable', status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1991-12-01', contractStartDate: '2020-08-10', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-07-30T08:55:00' },
  { id: 'lv-17', givenName: 'Rizky', familyName: 'Pratama', department: 'Sales', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Male', citizen: true,
    birthDate: '1995-02-09', contractStartDate: '2024-03-18', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-07-28T14:15:00' },
  { id: 'lv-18', givenName: 'Siti', familyName: 'Nurhaliza', department: 'Driver', status: 'Suspended',
    hiringCompanies: ['Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1990-10-22', contractStartDate: '2021-04-05', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-07-24T10:35:00' },
  { id: 'lv-19', givenName: 'Toni', familyName: 'Wibowo', department: 'Facilities', status: 'Active',
    // Leaving mid-2026, so MOVE-3900 §1's last-year pro-ration applies.
    hiringCompanies: ['Westpoint Tours'], gender: 'Male', citizen: true,
    birthDate: '1986-08-16', contractStartDate: '2017-09-25', contractEndDate: '2026-05-20',
    workingDaysPerWeek: 5, leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-07-20T09:25:00' },
  { id: 'lv-23', givenName: 'Andi', familyName: 'Nugroho', department: 'Operations', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1990-05-04', contractStartDate: '2019-02-11', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-07-18T13:10:00' },
  { id: 'lv-24', givenName: 'Bunga', familyName: 'Melati', department: 'Sales', status: 'Active',
    hiringCompanies: ['Westpoint Coach', 'Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1996-01-23', contractStartDate: '2023-01-09', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-07-15T11:22:00' },
  { id: 'lv-25', givenName: 'Cahya', familyName: 'Ramadhan', department: 'Driver', status: 'Active',
    hiringCompanies: ['Westpoint Tours'], gender: 'Male', citizen: true,
    birthDate: '1988-11-30', contractStartDate: '2018-06-25', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-07-12T08:05:00' },
  { id: 'lv-26', givenName: 'Dewi', familyName: 'Anggraeni', department: 'Human Resources', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1994-04-17', contractStartDate: '2022-09-19', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-07-09T15:48:00' },
  { id: 'lv-27', givenName: 'Eko', familyName: 'Susanto', department: 'Workshop', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Male', citizen: true,
    birthDate: '1985-09-08', contractStartDate: '2016-03-14', workingDaysPerWeek: 5.5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-07-06T09:33:00' },
  { id: 'lv-28', givenName: 'Fitri', familyName: 'Wulandari', department: 'Finance', status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Coach', 'Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1993-07-02', contractStartDate: '2021-01-04', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-07-02T17:12:00' },
  { id: 'lv-29', givenName: 'Galih', familyName: 'Saputro', department: 'Digital', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1997-03-26', contractStartDate: '2025-02-03', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-06-28T10:40:00' },
  { id: 'lv-30', givenName: 'Hana', familyName: 'Safitri', department: 'Facilities', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: false,
    birthDate: '1992-10-14', contractStartDate: '2020-11-30', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-06-24T14:55:00' },
  { id: 'lv-31', givenName: 'Irfan', familyName: 'Maulana', department: 'Driver', status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1991-06-21', contractStartDate: '2019-08-05', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-06-20T07:50:00' },
  { id: 'lv-32', givenName: 'Jasmine', familyName: 'Kurnia', department: 'Operations', status: 'Suspended',
    hiringCompanies: ['Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1995-12-09', contractStartDate: '2023-04-24', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-06-16T12:05:00' },
  { id: 'lv-33', givenName: 'Krisna', familyName: 'Wibisono', department: 'Sales', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Male', citizen: true,
    birthDate: '1989-02-28', contractStartDate: '2017-10-16', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-06-11T16:30:00' },
  { id: 'lv-34', givenName: 'Laras', familyName: 'Puspita', department: 'Not applicable', status: 'Active',
    hiringCompanies: ['Westpoint Tours'], gender: 'Female', citizen: true,
    birthDate: '1998-08-11', contractStartDate: '2026-02-02', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-06-05T09:15:00' },
  { id: 'lv-35', givenName: 'Mahesa', familyName: 'Adiputra', department: 'Workshop', status: 'Active',
    hiringCompanies: ['Westpoint Transit', 'Westpoint Coach'], gender: 'Male', citizen: true,
    birthDate: '1986-04-06', contractStartDate: '2015-07-20', workingDaysPerWeek: 5.5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-05-29T11:44:00' },
  { id: 'lv-36', givenName: 'Nurul', familyName: 'Aini', department: 'Digital', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1994-11-19', contractStartDate: '2022-05-16', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-05-22T13:28:00' },

  // --- Not listed: MOVE-1975 biz req 1 admits Active and Suspended only. ---
  { id: 'lv-20', givenName: 'Umar', familyName: 'Setiawan', department: 'Operations', status: 'Terminated',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1990-01-30', contractStartDate: '2022-02-14', contractEndDate: '2026-06-30',
    workingDaysPerWeek: 5, lastUpdatedOn: '2026-08-27T09:00:00' },
  { id: 'lv-21', givenName: 'Vina', familyName: 'Kusuma', department: 'Sales', status: 'Resigned',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1992-05-11', contractStartDate: '2021-10-01', contractEndDate: '2026-07-31',
    workingDaysPerWeek: 5, lastUpdatedOn: '2026-08-27T08:00:00' },
  { id: 'lv-22', givenName: 'Wawan', familyName: 'Sudrajat', department: 'Workshop', status: 'Future Employee',
    hiringCompanies: ['Westpoint Tours'], gender: 'Male', citizen: true,
    birthDate: '1998-07-04', contractStartDate: '2026-10-01', workingDaysPerWeek: 5.5,
    lastUpdatedOn: '2026-08-27T07:00:00' },
  { id: 'lv-37', givenName: 'Yusuf', familyName: 'Hidayat', department: 'Driver', status: 'Retired',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1960-03-02', contractStartDate: '2010-01-11', contractEndDate: '2026-03-02',
    workingDaysPerWeek: 6, lastUpdatedOn: '2026-08-26T18:30:00' },
]

const WORKING_DAYS = new Map(LEAVE_EMPLOYEES.map((e) => [e.id, e.workingDaysPerWeek]))

// ---------------------------------------------------------------------------
// Manually added entitlements (MOVE-3500)
// ---------------------------------------------------------------------------

export const EMPLOYEE_ENTITLEMENTS: EmployeeEntitlement[] = [
  // Bella has maternity leave added for a year from 1 Mar 2026.
  { id: 'ent-1', employeeId: 'lv-2', leaveTypeId: 'lt-mat',
    effectiveDate: '2026-03-01', endDate: '2027-02-28', entitlement: 16, unit: 'weeks', addedOn: '2026-02-18T10:24:00', addedBy: 'Maya Anggraini' },
  // Citra has childcare leave recurring for 3 years from 1 Apr 2026 — the
  // worked example in MOVE-3494 biz req 1, so the year toggle has something
  // real to show and stop showing in 2029.
  { id: 'ent-2', employeeId: 'lv-3', leaveTypeId: 'lt-ccl',
    effectiveDate: '2026-04-01', endDate: '2026-12-31', entitlement: 8, unit: 'days', recurringYears: 3 , addedOn: '2026-03-20T14:02:00', addedBy: 'Heikke Ekkieh' },
  { id: 'ent-3', employeeId: 'lv-1', leaveTypeId: 'lt-pat',
    effectiveDate: '2026-09-01', endDate: '2027-08-31', entitlement: 4, unit: 'weeks', addedOn: '2026-08-12T09:15:00', addedBy: 'Heikke Ekkieh' },
  { id: 'ent-4', employeeId: 'lv-14', leaveTypeId: 'lt-adopt',
    effectiveDate: '2026-10-01', endDate: '2027-09-30', entitlement: 12, unit: 'weeks', addedOn: '2026-09-08T16:40:00', addedBy: 'Maya Anggraini' },
  { id: 'ent-5', employeeId: 'lv-24', leaveTypeId: 'lt-mat',
    effectiveDate: '2026-02-01', endDate: '2027-01-31', entitlement: 16, unit: 'weeks', addedOn: '2026-01-19T11:05:00', addedBy: 'Maya Anggraini' },
  { id: 'ent-6', employeeId: 'lv-26', leaveTypeId: 'lt-ccl',
    effectiveDate: '2025-05-01', endDate: '2025-12-31', entitlement: 8, unit: 'days', recurringYears: 2 , addedOn: '2025-04-14T08:52:00', addedBy: 'Maya Anggraini' },
  { id: 'ent-7', employeeId: 'lv-28', leaveTypeId: 'lt-uicl',
    effectiveDate: '2026-03-15', endDate: '2027-03-14', entitlement: 12, unit: 'days', addedOn: '2026-03-02T15:30:00', addedBy: 'Heikke Ekkieh' },
  { id: 'ent-8', employeeId: 'lv-30', leaveTypeId: 'lt-spl',
    effectiveDate: '2026-06-01', endDate: '2027-05-31', entitlement: 10, unit: 'weeks', addedOn: '2026-05-21T10:10:00', addedBy: 'Heikke Ekkieh' },
  { id: 'ent-9', employeeId: 'lv-36', leaveTypeId: 'lt-ccl',
    effectiveDate: '2026-01-01', endDate: '2026-12-31', entitlement: 8, unit: 'days', recurringYears: 4 , addedOn: '2025-12-15T13:45:00', addedBy: 'Maya Anggraini' },
  { id: 'ent-10', employeeId: 'lv-33', leaveTypeId: 'lt-pat',
    effectiveDate: '2025-04-01', endDate: '2026-03-31', entitlement: 4, unit: 'weeks', addedOn: '2025-03-17T09:00:00', addedBy: 'Maya Anggraini' },
]

/** MOVE-3775 — per-year entitlement edits, matching the Edit rows below. */
export const ENTITLEMENT_OVERRIDES: EntitlementOverride[] = [
  // Long-service goodwill: Maya's annual leave was raised for 2026 onwards.
  { employeeId: 'lv-13', leaveTypeId: 'lt-al', year: 2026, entitlement: 18, unit: 'days', appliesForward: true,
    updatedOn: '2026-01-08T11:32:00', updatedBy: 'Maya Anggraini' },
  // A one-year-only adjustment, so the checkbox's other setting is visible too.
  { employeeId: 'lv-27', leaveTypeId: 'lt-al', year: 2026, entitlement: 15, unit: 'days', appliesForward: false,
    updatedOn: '2026-02-24T15:48:00', updatedBy: CURRENT_USER },
]

// ---------------------------------------------------------------------------
// Leave applications (MOVE-3777)
// ---------------------------------------------------------------------------

interface AppOpts {
  startHalf?: HalfDay
  endHalf?: HalfDay
  startTime?: string
  endTime?: string
  remarks?: string
  documentName?: string
  appliedOn: string
  appliedBy?: string
  actedOn?: string
  actedBy?: string
}

/**
 * Builds a seed application with its `days` computed from the same rule the
 * apply drawer uses, so the mock data cannot disagree with the module's own
 * arithmetic. `actedOn`/`actedBy` land in the pair that matches the status.
 */
function app(
  id: string,
  employeeId: string,
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  status: LeaveStatus,
  o: AppOpts,
): LeaveApplication {
  const startHalf = o.startHalf ?? 'AM'
  const endHalf = o.endHalf ?? 'PM'
  const wdpw = WORKING_DAYS.get(employeeId) ?? 5
  return {
    id,
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    startHalf,
    endHalf,
    startTime: o.startTime,
    endTime: o.endTime,
    // MOVE-3889 biz req 1 — Time Off has no day count at all.
    days: leaveTypeId === 'lt-timeoff' ? 0 : deductionDays(wdpw, startDate, endDate, startHalf, endHalf),
    remarks: o.remarks,
    documentName: o.documentName,
    status,
    appliedOn: o.appliedOn,
    appliedBy: o.appliedBy ?? CURRENT_USER,
    approvedOn: status === 'Approved' ? o.actedOn : undefined,
    approvedBy: status === 'Approved' ? o.actedBy : undefined,
    rejectedOn: status === 'Rejected' ? o.actedOn : undefined,
    rejectedBy: status === 'Rejected' ? o.actedBy : undefined,
    cancelledOn: status === 'Cancelled' ? o.actedOn : undefined,
    cancelledBy: status === 'Cancelled' ? o.actedBy : undefined,
  }
}

const MAYA = 'Maya Anggraini'
const CITRA = 'Citra Dewi'

/**
 * Spread deliberately across employees, years and statuses. The 2025 rows are
 * what make carry-forward *vary* — without a prior year of usage every profile
 * would carry the full 7 days and the rule would look like a constant.
 */
export const LEAVE_APPLICATIONS: LeaveApplication[] = [
  // ---- Ahmad Fauzi ----
  app('la-1', 'lv-1', 'lt-al', '2025-03-10', '2025-03-14', 'Approved', { appliedOn: '2025-02-18T10:00:00', appliedBy: 'Ahmad Fauzi', actedOn: '2025-02-19T09:10:00', actedBy: MAYA }),
  app('la-2', 'lv-1', 'lt-al', '2026-04-06', '2026-04-08', 'Approved', { remarks: 'Family trip', appliedOn: '2026-03-20T10:12:00', appliedBy: 'Ahmad Fauzi', actedOn: '2026-03-21T09:02:00', actedBy: MAYA }),
  app('la-3', 'lv-1', 'lt-ml', '2026-06-15', '2026-06-16', 'Approved', { documentName: 'mc-15jun2026.pdf', appliedOn: '2026-06-15T08:05:00', appliedBy: 'Ahmad Fauzi', actedOn: '2026-06-15T11:40:00', actedBy: MAYA }),
  // A half-day: AM to AM on a single weekday.
  app('la-4', 'lv-1', 'lt-al', '2026-09-14', '2026-09-14', 'Pending Approval', { startHalf: 'AM', endHalf: 'AM', remarks: 'Morning appointment', appliedOn: '2026-08-26T09:12:00' }),
  app('la-5', 'lv-1', 'lt-bday', '2026-03-13', '2026-03-13', 'Approved', { appliedOn: '2026-03-01T09:00:00', appliedBy: 'Ahmad Fauzi', actedOn: '2026-03-02T10:15:00', actedBy: MAYA }),

  // ---- Bella Santoso ----
  app('la-6', 'lv-2', 'lt-al', '2025-07-14', '2025-07-25', 'Approved', { appliedOn: '2025-06-10T09:20:00', appliedBy: 'Bella Santoso', actedOn: '2025-06-11T08:40:00', actedBy: MAYA }),
  app('la-7', 'lv-2', 'lt-al', '2026-05-04', '2026-05-08', 'Approved', { appliedOn: '2026-04-10T14:30:00', appliedBy: 'Bella Santoso', actedOn: '2026-04-11T09:15:00', actedBy: MAYA }),
  app('la-8', 'lv-2', 'lt-al', '2026-07-20', '2026-07-22', 'Cancelled', { remarks: 'Plans changed', appliedOn: '2026-07-01T11:00:00', appliedBy: 'Bella Santoso', actedOn: '2026-07-10T16:20:00', actedBy: CURRENT_USER }),
  app('la-9', 'lv-2', 'lt-mat', '2026-09-07', '2026-12-25', 'Approved', { documentName: 'maternity-cert.pdf', appliedOn: '2026-08-01T10:00:00', appliedBy: 'Bella Santoso', actedOn: '2026-08-02T09:30:00', actedBy: MAYA }),

  // ---- Citra Dewi ----
  app('la-10', 'lv-3', 'lt-al', '2025-11-24', '2025-11-28', 'Approved', { appliedOn: '2025-10-30T13:00:00', appliedBy: CITRA, actedOn: '2025-10-31T09:00:00', actedBy: MAYA }),
  app('la-11', 'lv-3', 'lt-bday', '2026-12-21', '2026-12-21', 'Pending Approval', { appliedOn: '2026-08-24T11:05:00' }),
  // Time Off carries times and no day count.
  app('la-12', 'lv-3', 'lt-timeoff', '2026-08-11', '2026-08-11', 'Approved', { startTime: '10:00', endTime: '12:00', remarks: 'Bank appointment', appliedOn: '2026-08-10T09:30:00', appliedBy: CITRA, actedOn: '2026-08-10T13:00:00', actedBy: MAYA }),
  app('la-13', 'lv-3', 'lt-ccl', '2026-06-08', '2026-06-10', 'Approved', { appliedOn: '2026-05-20T15:00:00', appliedBy: CITRA, actedOn: '2026-05-21T08:20:00', actedBy: MAYA }),
  app('la-14', 'lv-3', 'lt-study', '2026-10-05', '2026-10-07', 'Pending Approval', { documentName: 'course-enrolment.pdf', remarks: 'Payroll certification', appliedOn: '2026-08-20T10:45:00' }),

  // ---- Dedi Kurniawan (5.5 working days) ----
  // MOVE-3777 §3.2's worked example: Sat–Sat, so the consecutive weekend at the
  // start costs a day and the lone Saturday at the end costs nothing.
  app('la-15', 'lv-4', 'lt-al', '2026-07-31', '2026-08-08', 'Approved', { appliedOn: '2026-07-01T08:45:00', appliedBy: 'Dedi Kurniawan', actedOn: '2026-07-02T10:00:00', actedBy: CITRA }),
  app('la-16', 'lv-4', 'lt-al', '2025-05-05', '2025-05-09', 'Approved', { appliedOn: '2025-04-14T09:00:00', appliedBy: 'Dedi Kurniawan', actedOn: '2025-04-15T10:00:00', actedBy: CITRA }),
  app('la-17', 'lv-4', 'lt-hosp', '2026-02-16', '2026-02-27', 'Approved', { documentName: 'discharge-summary.pdf', appliedOn: '2026-02-16T07:30:00', appliedBy: 'Dedi Kurniawan', actedOn: '2026-02-16T14:00:00', actedBy: CITRA }),

  // ---- Eka Wijaya (driver, 6 days) ----
  app('la-18', 'lv-5', 'lt-al-drv', '2026-03-02', '2026-03-04', 'Rejected', { appliedOn: '2026-02-20T09:00:00', appliedBy: 'Eka Wijaya', actedOn: '2026-02-21T15:30:00', actedBy: CITRA }),
  app('la-19', 'lv-5', 'lt-ml', '2026-05-11', '2026-05-12', 'Approved', { documentName: 'mc-11may2026.jpg', appliedOn: '2026-05-11T07:50:00', appliedBy: 'Eka Wijaya', actedOn: '2026-05-11T10:05:00', actedBy: CITRA }),
  app('la-20', 'lv-5', 'lt-al-drv', '2025-09-15', '2025-09-19', 'Approved', { appliedOn: '2025-08-25T08:00:00', appliedBy: 'Eka Wijaya', actedOn: '2025-08-26T09:00:00', actedBy: CITRA }),

  // ---- Farhan Hakim ----
  app('la-21', 'lv-6', 'lt-al', '2026-01-19', '2026-01-23', 'Approved', { appliedOn: '2025-12-20T10:00:00', appliedBy: 'Farhan Hakim', actedOn: '2025-12-21T09:00:00', actedBy: MAYA }),
  app('la-22', 'lv-6', 'lt-unpaid', '2026-04-13', '2026-04-17', 'Approved', { remarks: 'Personal matters', appliedOn: '2026-03-30T11:00:00', appliedBy: 'Farhan Hakim', actedOn: '2026-03-31T10:00:00', actedBy: MAYA }),

  // ---- Gita Permata ----
  app('la-23', 'lv-7', 'lt-al', '2025-12-22', '2025-12-31', 'Approved', { appliedOn: '2025-11-25T14:00:00', appliedBy: 'Gita Permata', actedOn: '2025-11-26T09:00:00', actedBy: CITRA }),
  app('la-24', 'lv-7', 'lt-ml', '2026-07-06', '2026-07-07', 'Approved', { documentName: 'mc-06jul2026.pdf', appliedOn: '2026-07-06T08:00:00', appliedBy: 'Gita Permata', actedOn: '2026-07-06T12:00:00', actedBy: CITRA }),

  // ---- Hendra Saputra (starts 1 Jun 2026) ----
  app('la-25', 'lv-8', 'lt-ml', '2026-07-13', '2026-07-14', 'Approved', { documentName: 'mc-13jul2026.png', appliedOn: '2026-07-13T08:15:00', appliedBy: 'Hendra Saputra', actedOn: '2026-07-13T11:00:00', actedBy: CITRA }),
  app('la-26', 'lv-8', 'lt-bday', '2026-11-06', '2026-11-06', 'Pending Approval', { appliedOn: '2026-08-18T09:00:00' }),

  // ---- Indah Lestari ----
  app('la-27', 'lv-9', 'lt-timeoff', '2026-08-19', '2026-08-19', 'Approved', { startTime: '14:00', endTime: '16:00', remarks: 'Clinic', appliedOn: '2026-08-18T17:00:00', appliedBy: 'Indah Lestari', actedOn: '2026-08-19T08:30:00', actedBy: MAYA }),

  // ---- Joko Prasetyo (driver, 6 days) ----
  app('la-28', 'lv-10', 'lt-al-drv', '2025-06-16', '2025-06-20', 'Approved', { appliedOn: '2025-05-20T09:00:00', appliedBy: 'Joko Prasetyo', actedOn: '2025-05-21T08:00:00', actedBy: CITRA }),
  app('la-29', 'lv-10', 'lt-al-drv', '2026-09-21', '2026-09-26', 'Pending Approval', { remarks: 'Hometown visit', appliedOn: '2026-08-13T10:00:00' }),
  app('la-30', 'lv-10', 'lt-ns', '2026-04-06', '2026-04-17', 'Approved', { documentName: 'ns-callup.pdf', appliedOn: '2026-03-10T09:00:00', appliedBy: 'Joko Prasetyo', actedOn: '2026-03-11T09:00:00', actedBy: CITRA }),

  // ---- Kartika Sari ----
  app('la-31', 'lv-11', 'lt-al', '2026-06-01', '2026-06-05', 'Approved', { appliedOn: '2026-05-05T10:00:00', appliedBy: 'Kartika Sari', actedOn: '2026-05-06T09:00:00', actedBy: MAYA }),
  app('la-32', 'lv-11', 'lt-ml', '2026-08-03', '2026-08-11', 'Approved', { documentName: 'mc-03aug2026.pdf', remarks: 'Extended illness', appliedOn: '2026-08-03T08:00:00', appliedBy: 'Kartika Sari', actedOn: '2026-08-03T13:00:00', actedBy: MAYA }),
  app('la-33', 'lv-11', 'lt-al', '2025-08-11', '2025-08-15', 'Approved', { appliedOn: '2025-07-14T09:00:00', appliedBy: 'Kartika Sari', actedOn: '2025-07-15T09:00:00', actedBy: MAYA }),

  // ---- Lukman Hakim (5.5 days) ----
  app('la-34', 'lv-12', 'lt-al', '2026-10-12', '2026-10-18', 'Pending Approval', { appliedOn: '2026-08-22T15:00:00' }),
  app('la-35', 'lv-12', 'lt-al', '2025-02-10', '2025-02-21', 'Approved', { appliedOn: '2025-01-15T09:00:00', appliedBy: 'Lukman Hakim', actedOn: '2025-01-16T09:00:00', actedBy: CITRA }),

  // ---- Maya Anggraini (no approver — her leave is auto-approved) ----
  app('la-36', 'lv-13', 'lt-al', '2026-05-25', '2026-05-29', 'Approved', { appliedOn: '2026-05-01T09:00:00', appliedBy: MAYA, actedOn: '2026-05-01T09:00:00', actedBy: 'System (no approver assigned)' }),
  app('la-37', 'lv-13', 'lt-bday', '2026-05-27', '2026-05-27', 'Cancelled', { remarks: 'Overlapped with annual leave', appliedOn: '2026-04-28T10:00:00', appliedBy: MAYA, actedOn: '2026-05-01T08:55:00', actedBy: CURRENT_USER }),

  // ---- Nadia Rahmawati ----
  app('la-38', 'lv-14', 'lt-al', '2026-02-09', '2026-02-13', 'Approved', { appliedOn: '2026-01-12T11:00:00', appliedBy: 'Nadia Rahmawati', actedOn: '2026-01-13T09:00:00', actedBy: CITRA }),
  app('la-39', 'lv-14', 'lt-comp', '2026-06-22', '2026-06-24', 'Approved', { remarks: 'Bereavement', appliedOn: '2026-06-22T07:00:00', appliedBy: 'Nadia Rahmawati', actedOn: '2026-06-22T09:00:00', actedBy: CITRA }),

  // ---- Oscar Tanuwijaya ----
  app('la-40', 'lv-15', 'lt-al', '2026-03-16', '2026-03-27', 'Approved', { appliedOn: '2026-02-16T10:00:00', appliedBy: 'Oscar Tanuwijaya', actedOn: '2026-02-17T09:00:00', actedBy: MAYA }),
  app('la-41', 'lv-15', 'lt-al', '2026-11-02', '2026-11-06', 'Pending Approval', { appliedOn: '2026-08-25T13:00:00' }),

  // ---- Putri Handayani ----
  app('la-42', 'lv-16', 'lt-ml', '2026-01-26', '2026-01-27', 'Approved', { documentName: 'mc-26jan2026.jpg', appliedOn: '2026-01-26T08:00:00', appliedBy: 'Putri Handayani', actedOn: '2026-01-26T12:00:00', actedBy: CITRA }),
  app('la-43', 'lv-16', 'lt-al', '2025-10-06', '2025-10-17', 'Approved', { appliedOn: '2025-09-08T09:00:00', appliedBy: 'Putri Handayani', actedOn: '2025-09-09T09:00:00', actedBy: CITRA }),

  // ---- Rizky Pratama ----
  app('la-44', 'lv-17', 'lt-al', '2026-08-24', '2026-08-28', 'Pending Approval', { remarks: 'Wedding', appliedOn: '2026-07-27T10:00:00' }),
  app('la-45', 'lv-17', 'lt-timeoff', '2026-05-13', '2026-05-13', 'Rejected', { startTime: '09:00', endTime: '11:00', appliedOn: '2026-05-12T16:00:00', appliedBy: 'Rizky Pratama', actedOn: '2026-05-12T17:30:00', actedBy: MAYA }),

  // ---- Siti Nurhaliza (driver, 6 days) ----
  app('la-46', 'lv-18', 'lt-al-drv', '2026-04-20', '2026-04-25', 'Approved', { appliedOn: '2026-03-23T09:00:00', appliedBy: 'Siti Nurhaliza', actedOn: '2026-03-24T09:00:00', actedBy: CITRA }),

  // ---- Toni Wibowo (contract ends 20 May 2026) ----
  app('la-47', 'lv-19', 'lt-al', '2026-05-11', '2026-05-15', 'Approved', { remarks: 'Clearing leave before last day', appliedOn: '2026-04-20T09:00:00', appliedBy: 'Toni Wibowo', actedOn: '2026-04-21T09:00:00', actedBy: MAYA }),

  // ---- Andi Nugroho ----
  app('la-48', 'lv-23', 'lt-al', '2025-04-07', '2025-04-11', 'Approved', { appliedOn: '2025-03-10T09:00:00', appliedBy: 'Andi Nugroho', actedOn: '2025-03-11T09:00:00', actedBy: MAYA }),
  app('la-49', 'lv-23', 'lt-al', '2026-06-15', '2026-06-19', 'Approved', { appliedOn: '2026-05-18T09:00:00', appliedBy: 'Andi Nugroho', actedOn: '2026-05-19T09:00:00', actedBy: MAYA }),
  // Cross-year: MOVE-3494 biz req 1's example, so the year toggle shows the
  // same application in 2026 and 2027 with a different day count in each.
  app('la-50', 'lv-23', 'lt-al', '2026-12-24', '2027-01-05', 'Pending Approval', { remarks: 'Year-end break', appliedOn: '2026-08-27T09:30:00' }),

  // ---- Bunga Melati ----
  app('la-51', 'lv-24', 'lt-mat', '2026-02-02', '2026-05-22', 'Approved', { documentName: 'maternity-cert-bunga.pdf', appliedOn: '2026-01-05T10:00:00', appliedBy: 'Bunga Melati', actedOn: '2026-01-06T09:00:00', actedBy: CITRA }),
  app('la-52', 'lv-24', 'lt-al', '2026-08-17', '2026-08-21', 'Approved', { appliedOn: '2026-07-20T09:00:00', appliedBy: 'Bunga Melati', actedOn: '2026-07-21T09:00:00', actedBy: CITRA }),

  // ---- Cahya Ramadhan (driver, 6 days) ----
  app('la-53', 'lv-25', 'lt-al-drv', '2026-01-05', '2026-01-10', 'Approved', { appliedOn: '2025-12-08T09:00:00', appliedBy: 'Cahya Ramadhan', actedOn: '2025-12-09T09:00:00', actedBy: CITRA }),
  app('la-54', 'lv-25', 'lt-ml', '2026-09-07', '2026-09-08', 'Pending Approval', { documentName: 'mc-07sep2026.pdf', appliedOn: '2026-08-24T08:00:00' }),

  // ---- Dewi Anggraeni ----
  app('la-55', 'lv-26', 'lt-ccl', '2025-07-07', '2025-07-09', 'Approved', { appliedOn: '2025-06-16T09:00:00', appliedBy: 'Dewi Anggraeni', actedOn: '2025-06-17T09:00:00', actedBy: MAYA }),
  app('la-56', 'lv-26', 'lt-al', '2026-03-09', '2026-03-13', 'Approved', { appliedOn: '2026-02-09T09:00:00', appliedBy: 'Dewi Anggraeni', actedOn: '2026-02-10T09:00:00', actedBy: MAYA }),

  // ---- Eko Susanto (5.5 days, entitlement edited for 2026 only) ----
  app('la-57', 'lv-27', 'lt-al', '2026-04-27', '2026-05-08', 'Approved', { appliedOn: '2026-03-30T09:00:00', appliedBy: 'Eko Susanto', actedOn: '2026-03-31T09:00:00', actedBy: CITRA }),

  // ---- Fitri Wulandari ----
  app('la-58', 'lv-28', 'lt-uicl', '2026-04-06', '2026-04-10', 'Approved', { appliedOn: '2026-03-16T09:00:00', appliedBy: 'Fitri Wulandari', actedOn: '2026-03-17T09:00:00', actedBy: MAYA }),
  app('la-59', 'lv-28', 'lt-al', '2025-03-03', '2025-03-14', 'Approved', { appliedOn: '2025-02-03T09:00:00', appliedBy: 'Fitri Wulandari', actedOn: '2025-02-04T09:00:00', actedBy: MAYA }),

  // ---- Galih Saputro (started Feb 2025, so 2025 is his pro-rated year) ----
  app('la-60', 'lv-29', 'lt-al', '2026-07-13', '2026-07-17', 'Approved', { appliedOn: '2026-06-15T09:00:00', appliedBy: 'Galih Saputro', actedOn: '2026-06-16T09:00:00', actedBy: CITRA }),

  // ---- Hana Safitri ----
  app('la-61', 'lv-30', 'lt-spl', '2026-08-03', '2026-10-09', 'Approved', { appliedOn: '2026-07-06T09:00:00', appliedBy: 'Hana Safitri', actedOn: '2026-07-07T09:00:00', actedBy: MAYA }),

  // ---- Irfan Maulana (driver, 6 days) ----
  app('la-62', 'lv-31', 'lt-al-drv', '2026-02-23', '2026-02-28', 'Cancelled', { remarks: 'Trip postponed', appliedOn: '2026-01-26T09:00:00', appliedBy: 'Irfan Maulana', actedOn: '2026-02-10T14:00:00', actedBy: CURRENT_USER }),
  app('la-63', 'lv-31', 'lt-al-drv', '2026-06-08', '2026-06-13', 'Approved', { appliedOn: '2026-05-11T09:00:00', appliedBy: 'Irfan Maulana', actedOn: '2026-05-12T09:00:00', actedBy: CITRA }),

  // ---- Jasmine Kurnia ----
  app('la-64', 'lv-32', 'lt-al', '2026-07-06', '2026-07-10', 'Rejected', { remarks: 'Peak period', appliedOn: '2026-06-08T09:00:00', appliedBy: 'Jasmine Kurnia', actedOn: '2026-06-09T11:00:00', actedBy: MAYA }),

  // ---- Krisna Wibisono ----
  app('la-65', 'lv-33', 'lt-pat', '2025-06-02', '2025-06-27', 'Approved', { documentName: 'birth-cert.pdf', appliedOn: '2025-05-05T09:00:00', appliedBy: 'Krisna Wibisono', actedOn: '2025-05-06T09:00:00', actedBy: CITRA }),
  app('la-66', 'lv-33', 'lt-al', '2026-09-28', '2026-10-02', 'Pending Approval', { appliedOn: '2026-08-26T14:00:00' }),

  // ---- Laras Puspita (started Feb 2026) ----
  app('la-67', 'lv-34', 'lt-ml', '2026-06-29', '2026-06-30', 'Approved', { documentName: 'mc-29jun2026.jpg', appliedOn: '2026-06-29T08:00:00', appliedBy: 'Laras Puspita', actedOn: '2026-06-29T12:00:00', actedBy: MAYA }),

  // ---- Mahesa Adiputra (5.5 days) ----
  app('la-68', 'lv-35', 'lt-al', '2026-05-16', '2026-05-24', 'Approved', { appliedOn: '2026-04-18T09:00:00', appliedBy: 'Mahesa Adiputra', actedOn: '2026-04-19T09:00:00', actedBy: CITRA }),

  // ---- Nurul Aini ----
  app('la-69', 'lv-36', 'lt-ccl', '2026-05-04', '2026-05-06', 'Approved', { appliedOn: '2026-04-13T09:00:00', appliedBy: 'Nurul Aini', actedOn: '2026-04-14T09:00:00', actedBy: MAYA }),
  app('la-70', 'lv-36', 'lt-volunteer', '2026-09-15', '2026-09-16', 'Pending Approval', { remarks: 'Community clean-up', appliedOn: '2026-08-21T10:00:00' }),
]

// ---------------------------------------------------------------------------
// Entitlement change history (MOVE-3888)
// ---------------------------------------------------------------------------

/** Seeded so the drawer's User / Edit Type / Field Edited filters have range. */
export const ENTITLEMENT_CHANGES: EntitlementChange[] = [
  { id: 'ch-1', employeeId: 'lv-2', updatedOn: '2026-02-24T10:15:00', updatedBy: CURRENT_USER, editType: 'Add', fieldEdited: 'Maternity Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-2', employeeId: 'lv-3', updatedOn: '2026-03-28T16:40:00', updatedBy: CURRENT_USER, editType: 'Add', fieldEdited: 'Childcare Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-3', employeeId: 'lv-1', updatedOn: '2026-08-14T09:05:00', updatedBy: MAYA, editType: 'Add', fieldEdited: 'Paternity Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-4', employeeId: 'lv-14', updatedOn: '2026-09-02T11:20:00', updatedBy: CURRENT_USER, editType: 'Add', fieldEdited: 'Adoption Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-5', employeeId: 'lv-24', updatedOn: '2026-01-20T14:00:00', updatedBy: CITRA, editType: 'Add', fieldEdited: 'Maternity Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-6', employeeId: 'lv-26', updatedOn: '2025-04-22T09:30:00', updatedBy: MAYA, editType: 'Add', fieldEdited: 'Childcare Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-7', employeeId: 'lv-28', updatedOn: '2026-03-10T15:45:00', updatedBy: CURRENT_USER, editType: 'Add', fieldEdited: 'Unpaid Infant Care Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-8', employeeId: 'lv-30', updatedOn: '2026-05-26T10:10:00', updatedBy: MAYA, editType: 'Add', fieldEdited: 'Shared Parental Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-9', employeeId: 'lv-36', updatedOn: '2025-12-15T13:00:00', updatedBy: CITRA, editType: 'Add', fieldEdited: 'Childcare Leave', previousInput: '-', newInput: '-' },
  { id: 'ch-10', employeeId: 'lv-33', updatedOn: '2025-03-19T08:50:00', updatedBy: MAYA, editType: 'Add', fieldEdited: 'Paternity Leave', previousInput: '-', newInput: '-' },
  // The two Edit rows below match ENTITLEMENT_OVERRIDES, so the history and the
  // balances table tell the same story.
  { id: 'ch-11', employeeId: 'lv-13', updatedOn: '2026-01-08T09:40:00', updatedBy: CURRENT_USER, editType: 'Edit', fieldEdited: 'Entitlement', previousInput: '12 days', newInput: '18 days, change applied to subsequent recurring years' },
  { id: 'ch-12', employeeId: 'lv-27', updatedOn: '2026-02-11T16:05:00', updatedBy: CITRA, editType: 'Edit', fieldEdited: 'Entitlement', previousInput: '12 days', newInput: '15 days, change not applied to subsequent recurring years' },
  { id: 'ch-13', employeeId: 'lv-3', updatedOn: '2026-04-02T10:30:00', updatedBy: MAYA, editType: 'Edit', fieldEdited: 'End Date', previousInput: '30 Nov 2026', newInput: '31 Dec 2026' },
  { id: 'ch-14', employeeId: 'lv-2', updatedOn: '2026-03-05T11:15:00', updatedBy: CURRENT_USER, editType: 'Edit', fieldEdited: 'Effective Date', previousInput: '01 Feb 2026', newInput: '01 Mar 2026' },
]

let seq = 1000
export const nextId = (prefix: string) => `${prefix}-${++seq}`
