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
  /** MOVE-1977 biz req 1.2 — the fixed wording the system table shows. */
  validityLabel: string
  lastUpdatedOn: string
  lastUpdatedBy: string
  /** MOVE-4019 — system types show "-" for created on and "system" for by. */
  createdOn?: string
  createdBy: string
}

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
): LeaveType => ({
  id,
  name,
  system: true,
  entitlement,
  unit,
  validity,
  autoRecur,
  supportingDocument,
  encashment,
  eligibility,
  validityLabel,
  lastUpdatedOn,
  lastUpdatedBy: 'System',
  createdBy: 'System',
})

/**
 * MOVE-3900 — the 15 types the system pre-creates, in the fixed order
 * MOVE-1977 biz req 1.2 lays out (that table is not sortable, so the order
 * here *is* the presentation order).
 */
export const LEAVE_TYPES: LeaveType[] = [
  SYS('lt-al', 'Annual Leave', 12, 'days', 'annual-leave', true, 'optional', 'upon-resignation', 'non-drivers', 'Every calendar year', '2026-01-02T09:00:00'),
  SYS('lt-al-drv', 'Annual Leave (Drivers)', 7, 'days', 'annual-leave', true, 'optional', 'upon-resignation', 'drivers', 'Every calendar year', '2026-01-02T09:00:00'),
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
}

// ---------------------------------------------------------------------------
// Leave applications
// ---------------------------------------------------------------------------

export type LeaveStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Cancelled'

/** MOVE-3777 biz req 2 — each end of the range is a half-day marker. */
export type HalfDay = 'AM' | 'PM'

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
// Public holidays — shared shape with the roster module's own list
// ---------------------------------------------------------------------------

/** MOVE-3777 biz req 3.2 — a weekday PH deducts nothing. */
export const LEAVE_PUBLIC_HOLIDAYS: { date: string; name: string }[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-08-17', name: 'Independence Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2027-01-01', name: "New Year's Day" },
]

// ---------------------------------------------------------------------------
// Mock dataset
// ---------------------------------------------------------------------------

/** The signed-in user, used as "updated by" on everything written here. */
export const CURRENT_USER = 'Heikke Ekkieh'

/**
 * 22 employees, of which 19 are listed — the three that are not carry
 * Terminated / Resigned / Future Employee so MOVE-1975's active-only rule is
 * visible in the count rather than taken on trust.
 */
export const LEAVE_EMPLOYEES: LeaveEmployee[] = [
  {
    id: 'lv-1', givenName: 'Ahmad', familyName: 'Fauzi', department: 'Operations', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1992-03-14', contractStartDate: '2024-01-15', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-26T09:12:00',
  },
  {
    id: 'lv-2', givenName: 'Bella', familyName: 'Santoso', department: 'Operations', status: 'Active',
    // Three contracts — the newest shows, "+2" carries the rest.
    hiringCompanies: ['Westpoint Coach', 'Westpoint Transit', 'Westpoint Tours'], gender: 'Female', citizen: true,
    birthDate: '1995-09-02', contractStartDate: '2023-06-01', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-25T16:40:00',
  },
  {
    id: 'lv-3', givenName: 'Citra', familyName: 'Dewi', department: 'Human Resources', status: 'Active',
    hiringCompanies: ['Westpoint Transit', 'Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1990-12-20', contractStartDate: '2022-03-10', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-24T11:05:00',
  },
  {
    id: 'lv-4', givenName: 'Dedi', familyName: 'Kurniawan', department: 'Workshop', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Male', citizen: true,
    birthDate: '1988-06-05', contractStartDate: '2021-11-01', workingDaysPerWeek: 5.5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-21T08:30:00',
  },
  {
    id: 'lv-5', givenName: 'Eka', familyName: 'Wijaya', department: 'Driver', status: 'Active',
    // A driver, so annual leave comes from the drivers' type at 7 days.
    hiringCompanies: ['Westpoint Tours'], gender: 'Male', citizen: false,
    birthDate: '1993-10-11', contractStartDate: '2024-05-20', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-20T14:22:00',
  },
  {
    id: 'lv-6', givenName: 'Farhan', familyName: 'Hakim', department: 'Operations', status: 'Suspended',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1991-08-30', contractStartDate: '2023-02-01', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-19T17:55:00',
  },
  {
    id: 'lv-7', givenName: 'Gita', familyName: 'Permata', department: 'Finance', status: 'Suspended',
    hiringCompanies: ['Westpoint Coach', 'Westpoint Tours'], gender: 'Female', citizen: true,
    birthDate: '1994-02-18', contractStartDate: '2022-08-15', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-18T10:10:00',
  },
  {
    id: 'lv-8', givenName: 'Hendra', familyName: 'Saputra', department: 'Digital', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1996-11-07', contractStartDate: '2026-06-01', workingDaysPerWeek: 5,
    // MOVE-3900 §5 — starts 1 Jun 2026, completes 3 months on 1 Sep, birth
    // month is Nov, so birthday leave IS available in 2026. Worth having one.
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-17T13:45:00',
  },
  {
    id: 'lv-9', givenName: 'Indah', familyName: 'Lestari', department: 'Sales', status: 'Active',
    hiringCompanies: ['Westpoint Tours'], gender: 'Female', citizen: true,
    // Birth month Jun with a 1 Jun 2026 start: 3 months completes 1 Sep, the
    // birth month has passed, so 2026 has no birthday leave — MOVE-3900 §5's
    // first worked example, kept live in the data.
    birthDate: '1997-06-12', contractStartDate: '2026-06-01', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-15T09:00:00',
  },
  {
    id: 'lv-10', givenName: 'Joko', familyName: 'Prasetyo', department: 'Driver', status: 'Active',
    hiringCompanies: ['Westpoint Transit', 'Westpoint Coach', 'Westpoint Tours'], gender: 'Male', citizen: true,
    birthDate: '1989-04-25', contractStartDate: '2020-02-17', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-14T15:30:00',
  },
  {
    id: 'lv-11', givenName: 'Kartika', familyName: 'Sari', department: 'Facilities', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1992-07-19', contractStartDate: '2023-09-04', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-12T12:18:00',
  },
  {
    id: 'lv-12', givenName: 'Lukman', familyName: 'Hakim', department: 'Workshop', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1987-01-08', contractStartDate: '2019-05-13', workingDaysPerWeek: 5.5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-11T07:40:00',
  },
  {
    id: 'lv-13', givenName: 'Maya', familyName: 'Anggraini', department: 'Human Resources', status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1985-05-27', contractStartDate: '2018-01-02', workingDaysPerWeek: 5,
    // MOVE-3777 biz req 4.1 — no approver, so her leave is created approved.
    lastUpdatedOn: '2026-08-08T18:05:00',
  },
  {
    id: 'lv-14', givenName: 'Nadia', familyName: 'Rahmawati', department: 'Finance', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1993-03-03', contractStartDate: '2021-07-01', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-08-05T11:50:00',
  },
  {
    id: 'lv-15', givenName: 'Oscar', familyName: 'Tanuwijaya', department: 'Digital', status: 'Active',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: false,
    birthDate: '1994-09-15', contractStartDate: '2022-11-21', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-08-03T16:20:00',
  },
  {
    id: 'lv-16', givenName: 'Putri', familyName: 'Handayani', department: 'Not applicable', status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1991-12-01', contractStartDate: '2020-08-10', workingDaysPerWeek: 5,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-07-30T08:55:00',
  },
  {
    id: 'lv-17', givenName: 'Rizky', familyName: 'Pratama', department: 'Sales', status: 'Active',
    hiringCompanies: ['Westpoint Coach'], gender: 'Male', citizen: true,
    birthDate: '1995-02-09', contractStartDate: '2024-03-18', workingDaysPerWeek: 5,
    leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-07-28T14:15:00',
  },
  {
    id: 'lv-18', givenName: 'Siti', familyName: 'Nurhaliza', department: 'Driver', status: 'Suspended',
    hiringCompanies: ['Westpoint Transit'], gender: 'Female', citizen: true,
    birthDate: '1990-10-22', contractStartDate: '2021-04-05', workingDaysPerWeek: 6,
    leaveApprover: 'Citra Dewi', lastUpdatedOn: '2026-07-24T10:35:00',
  },
  {
    id: 'lv-19', givenName: 'Toni', familyName: 'Wibowo', department: 'Facilities', status: 'Active',
    hiringCompanies: ['Westpoint Tours'], gender: 'Male', citizen: true,
    // Leaving mid-2026, so MOVE-3900 §1's last-year pro-ration applies.
    birthDate: '1986-08-16', contractStartDate: '2017-09-25', contractEndDate: '2026-05-20',
    workingDaysPerWeek: 5, leaveApprover: 'Maya Anggraini', lastUpdatedOn: '2026-07-20T09:25:00',
  },
  // --- Not listed: MOVE-1975 biz req 1 admits Active and Suspended only. ---
  {
    id: 'lv-20', givenName: 'Umar', familyName: 'Setiawan', department: 'Operations', status: 'Terminated',
    hiringCompanies: ['Westpoint Transit'], gender: 'Male', citizen: true,
    birthDate: '1990-01-30', contractStartDate: '2022-02-14', contractEndDate: '2026-06-30',
    workingDaysPerWeek: 5, lastUpdatedOn: '2026-08-27T09:00:00',
  },
  {
    id: 'lv-21', givenName: 'Vina', familyName: 'Kusuma', department: 'Sales', status: 'Resigned',
    hiringCompanies: ['Westpoint Coach'], gender: 'Female', citizen: true,
    birthDate: '1992-05-11', contractStartDate: '2021-10-01', contractEndDate: '2026-07-31',
    workingDaysPerWeek: 5, lastUpdatedOn: '2026-08-27T08:00:00',
  },
  {
    id: 'lv-22', givenName: 'Wawan', familyName: 'Sudrajat', department: 'Workshop', status: 'Future Employee',
    hiringCompanies: ['Westpoint Tours'], gender: 'Male', citizen: true,
    birthDate: '1998-07-04', contractStartDate: '2026-10-01', workingDaysPerWeek: 5.5,
    lastUpdatedOn: '2026-08-27T07:00:00',
  },
]

/** Manually added entitlements — MOVE-3500. Mutated in place by the modal. */
export const EMPLOYEE_ENTITLEMENTS: EmployeeEntitlement[] = [
  // Bella has maternity leave added for a year from 1 Mar 2026.
  {
    id: 'ent-1', employeeId: 'lv-2', leaveTypeId: 'lt-mat',
    effectiveDate: '2026-03-01', endDate: '2027-02-28', entitlement: 16, unit: 'weeks',
  },
  // Citra has childcare leave recurring for 3 years from 1 Apr 2026 — the
  // worked example in MOVE-3494 biz req 1, so the year toggle has something
  // real to show and stop showing in 2029.
  {
    id: 'ent-2', employeeId: 'lv-3', leaveTypeId: 'lt-ccl',
    effectiveDate: '2026-04-01', endDate: '2026-12-31', entitlement: 8, unit: 'days', recurringYears: 3,
  },
]

/** MOVE-3775 — per-year entitlement edits. */
export const ENTITLEMENT_OVERRIDES: EntitlementOverride[] = []

/** MOVE-3777 — leave applications. */
export const LEAVE_APPLICATIONS: LeaveApplication[] = [
  {
    id: 'la-1', employeeId: 'lv-1', leaveTypeId: 'lt-al',
    startDate: '2026-04-06', endDate: '2026-04-08', startHalf: 'AM', endHalf: 'PM', days: 3,
    remarks: 'Family trip', status: 'Approved',
    appliedOn: '2026-03-20T10:12:00', appliedBy: 'Ahmad Fauzi',
    approvedOn: '2026-03-21T09:02:00', approvedBy: 'Maya Anggraini',
  },
  {
    id: 'la-2', employeeId: 'lv-1', leaveTypeId: 'lt-ml',
    startDate: '2026-06-15', endDate: '2026-06-16', startHalf: 'AM', endHalf: 'PM', days: 2,
    documentName: 'mc-15jun2026.pdf', status: 'Approved',
    appliedOn: '2026-06-15T08:05:00', appliedBy: 'Ahmad Fauzi',
    approvedOn: '2026-06-15T11:40:00', approvedBy: 'Maya Anggraini',
  },
  {
    id: 'la-3', employeeId: 'lv-1', leaveTypeId: 'lt-al',
    startDate: '2026-09-14', endDate: '2026-09-14', startHalf: 'AM', endHalf: 'AM', days: 0.5,
    remarks: 'Morning appointment', status: 'Pending Approval',
    appliedOn: '2026-08-26T09:12:00', appliedBy: CURRENT_USER,
  },
  {
    id: 'la-4', employeeId: 'lv-2', leaveTypeId: 'lt-al',
    startDate: '2026-05-04', endDate: '2026-05-08', startHalf: 'AM', endHalf: 'PM', days: 5,
    status: 'Approved',
    appliedOn: '2026-04-10T14:30:00', appliedBy: 'Bella Santoso',
    approvedOn: '2026-04-11T09:15:00', approvedBy: 'Maya Anggraini',
  },
  {
    id: 'la-5', employeeId: 'lv-2', leaveTypeId: 'lt-al',
    startDate: '2026-07-20', endDate: '2026-07-22', startHalf: 'AM', endHalf: 'PM', days: 3,
    remarks: 'Cancelled — plans changed', status: 'Cancelled',
    appliedOn: '2026-07-01T11:00:00', appliedBy: 'Bella Santoso',
    cancelledOn: '2026-07-10T16:20:00', cancelledBy: CURRENT_USER,
  },
  {
    id: 'la-6', employeeId: 'lv-3', leaveTypeId: 'lt-bday',
    startDate: '2026-12-21', endDate: '2026-12-21', startHalf: 'AM', endHalf: 'PM', days: 1,
    status: 'Pending Approval',
    appliedOn: '2026-08-24T11:05:00', appliedBy: CURRENT_USER,
  },
  {
    id: 'la-7', employeeId: 'lv-3', leaveTypeId: 'lt-timeoff',
    startDate: '2026-08-11', endDate: '2026-08-11', startHalf: 'AM', endHalf: 'AM', days: 0,
    startTime: '10:00', endTime: '12:00', remarks: 'Bank appointment', status: 'Approved',
    appliedOn: '2026-08-10T09:30:00', appliedBy: 'Citra Dewi',
    approvedOn: '2026-08-10T13:00:00', approvedBy: 'Maya Anggraini',
  },
  {
    id: 'la-8', employeeId: 'lv-4', leaveTypeId: 'lt-al',
    // Sat–Sat, the worked example in MOVE-3777 biz req 3.2: Dedi works 5.5
    // days so the consecutive weekend at the start costs him a day.
    startDate: '2026-07-31', endDate: '2026-08-08', startHalf: 'AM', endHalf: 'PM', days: 6,
    status: 'Approved',
    appliedOn: '2026-07-01T08:45:00', appliedBy: 'Dedi Kurniawan',
    approvedOn: '2026-07-02T10:00:00', approvedBy: 'Citra Dewi',
  },
  {
    id: 'la-9', employeeId: 'lv-5', leaveTypeId: 'lt-al-drv',
    startDate: '2026-03-02', endDate: '2026-03-04', startHalf: 'AM', endHalf: 'PM', days: 3,
    status: 'Rejected',
    appliedOn: '2026-02-20T09:00:00', appliedBy: 'Eka Wijaya',
    rejectedOn: '2026-02-21T15:30:00', rejectedBy: 'Citra Dewi',
  },
  {
    id: 'la-10', employeeId: 'lv-5', leaveTypeId: 'lt-ml',
    startDate: '2026-05-11', endDate: '2026-05-12', startHalf: 'AM', endHalf: 'PM', days: 2,
    documentName: 'mc-11may2026.jpg', status: 'Approved',
    appliedOn: '2026-05-11T07:50:00', appliedBy: 'Eka Wijaya',
    approvedOn: '2026-05-11T10:05:00', approvedBy: 'Citra Dewi',
  },
]

/** MOVE-3888 — the audit trail. Seeded with the two manual adds above. */
export const ENTITLEMENT_CHANGES: EntitlementChange[] = [
  {
    id: 'ch-1', employeeId: 'lv-2', updatedOn: '2026-02-24T10:15:00', updatedBy: CURRENT_USER,
    editType: 'Add', fieldEdited: 'Maternity Leave', previousInput: '-', newInput: '-',
  },
  {
    id: 'ch-2', employeeId: 'lv-3', updatedOn: '2026-03-28T16:40:00', updatedBy: CURRENT_USER,
    editType: 'Add', fieldEdited: 'Childcare Leave', previousInput: '-', newInput: '-',
  },
]

let seq = 1000
export const nextId = (prefix: string) => `${prefix}-${++seq}`
