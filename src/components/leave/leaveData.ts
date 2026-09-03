// MOVE-1975 (WLA: HR - Leave) — shared types + mock dataset for the leave
// listing. One row = one employee.
//
// No backend, matching the rest of this prototype: the arrays below are the
// source of truth and would come from the HR Employee module (MOVE-1607) and
// the leave module in production.

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
 * (biz req 1), so the other values exist here to prove that rule is doing
 * something rather than being asserted.
 */
export type LeaveEmployeeStatus =
  | 'Active'
  | 'Suspended'
  | 'Future Employee'
  | 'Terminated'
  | 'Resigned'
  | 'Retired'
  | 'Contract Expired'

/**
 * One leave type's position for the viewing year.
 *
 * MOVE-3494 biz req 2 defines the balance rather than storing it:
 * `balance = entitlement − used − pending approval`, and an entitlement of
 * "not applicable" makes the balance a dash no matter what has been taken.
 * Modelled the same way here so the listing cannot drift from the profile
 * page when that gets built.
 */
export interface LeaveTypeBalance {
  /** Days. `null` = not applicable, which renders as "-". */
  entitlementDays: number | null
  usedDays: number
  pendingDays: number
}

export interface LeaveEmployee {
  id: string
  /** Split because MOVE-3416 defines the full name as given + family. */
  givenName: string
  familyName: string
  department: Department
  status: LeaveEmployeeStatus
  /**
   * Hiring companies drawn from the employee's active/ending contracts and
   * addenda, **most recently created first** — biz req 1 shows the newest one
   * and hides the rest behind "+n".
   */
  hiringCompanies: HiringCompany[]
  annualLeave: LeaveTypeBalance
  medicalLeave: LeaveTypeBalance
  /** ISO datetime the leave profile was last updated. */
  lastUpdatedOn: string
}

/** MOVE-3494 biz req 2, row 6. `null` when entitlement is not applicable. */
export function balanceOf(b: LeaveTypeBalance): number | null {
  if (b.entitlementDays === null) return null
  return b.entitlementDays - b.usedDays - b.pendingDays
}

export function fullName(e: LeaveEmployee): string {
  return `${e.givenName} ${e.familyName}`
}

/** Biz req 1 — the listing shows active contracts only. */
export function isListedOnLeavePage(e: LeaveEmployee): boolean {
  return e.status === 'Active' || e.status === 'Suspended'
}

const al = (entitlementDays: number | null, usedDays: number, pendingDays = 0): LeaveTypeBalance => ({
  entitlementDays,
  usedDays,
  pendingDays,
})

/**
 * 22 employees, of which 19 are listed — the three that are not carry
 * Terminated / Resigned / Future Employee so the active-only rule is visible
 * in the count rather than taken on trust.
 */
export const LEAVE_EMPLOYEES: LeaveEmployee[] = [
  {
    id: 'lv-1',
    givenName: 'Ahmad',
    familyName: 'Fauzi',
    department: 'Operations',
    status: 'Active',
    hiringCompanies: ['Westpoint Transit'],
    annualLeave: al(14, 3, 1),
    medicalLeave: al(14, 2),
    lastUpdatedOn: '2026-08-26T09:12:00',
  },
  {
    id: 'lv-2',
    givenName: 'Bella',
    familyName: 'Santoso',
    department: 'Operations',
    status: 'Active',
    // Three contracts — the newest shows, "+2" carries the rest.
    hiringCompanies: ['Westpoint Coach', 'Westpoint Transit', 'Westpoint Tours'],
    annualLeave: al(16, 8),
    medicalLeave: al(14, 0),
    lastUpdatedOn: '2026-08-25T16:40:00',
  },
  {
    id: 'lv-3',
    givenName: 'Citra',
    familyName: 'Dewi',
    department: 'Human Resources',
    status: 'Active',
    hiringCompanies: ['Westpoint Transit', 'Westpoint Coach'],
    annualLeave: al(18, 6, 2),
    medicalLeave: al(14, 5),
    lastUpdatedOn: '2026-08-24T11:05:00',
  },
  {
    id: 'lv-4',
    givenName: 'Dedi',
    familyName: 'Kurniawan',
    department: 'Workshop',
    status: 'Active',
    hiringCompanies: ['Westpoint Coach'],
    annualLeave: al(14, 14),
    medicalLeave: al(14, 1),
    lastUpdatedOn: '2026-08-21T08:30:00',
  },
  {
    id: 'lv-5',
    givenName: 'Eka',
    familyName: 'Wijaya',
    department: 'Driver',
    status: 'Active',
    hiringCompanies: ['Westpoint Tours'],
    // No medical-leave entitlement — the balance is a dash, not a zero.
    annualLeave: al(12, 4),
    medicalLeave: al(null, 0),
    lastUpdatedOn: '2026-08-20T14:22:00',
  },
  {
    id: 'lv-6',
    givenName: 'Farhan',
    familyName: 'Hakim',
    department: 'Operations',
    status: 'Suspended',
    hiringCompanies: ['Westpoint Transit'],
    annualLeave: al(14, 9, 1),
    medicalLeave: al(14, 11),
    lastUpdatedOn: '2026-08-19T17:55:00',
  },
  {
    id: 'lv-7',
    givenName: 'Gita',
    familyName: 'Permata',
    department: 'Finance',
    status: 'Suspended',
    hiringCompanies: ['Westpoint Coach', 'Westpoint Tours'],
    annualLeave: al(16, 2),
    medicalLeave: al(14, 0),
    lastUpdatedOn: '2026-08-18T10:10:00',
  },
  {
    id: 'lv-8',
    givenName: 'Hendra',
    familyName: 'Saputra',
    department: 'Digital',
    status: 'Active',
    hiringCompanies: ['Westpoint Transit'],
    annualLeave: al(18, 1),
    medicalLeave: al(14, 3),
    lastUpdatedOn: '2026-08-17T13:45:00',
  },
  {
    id: 'lv-9',
    givenName: 'Indah',
    familyName: 'Lestari',
    department: 'Sales',
    status: 'Active',
    hiringCompanies: ['Westpoint Tours'],
    annualLeave: al(14, 7, 3),
    medicalLeave: al(14, 4),
    lastUpdatedOn: '2026-08-15T09:00:00',
  },
  {
    id: 'lv-10',
    givenName: 'Joko',
    familyName: 'Prasetyo',
    department: 'Driver',
    status: 'Active',
    hiringCompanies: ['Westpoint Transit', 'Westpoint Coach', 'Westpoint Tours'],
    annualLeave: al(12, 0),
    medicalLeave: al(14, 0),
    lastUpdatedOn: '2026-08-14T15:30:00',
  },
  {
    id: 'lv-11',
    givenName: 'Kartika',
    familyName: 'Sari',
    department: 'Facilities',
    status: 'Active',
    hiringCompanies: ['Westpoint Coach'],
    annualLeave: al(14, 5),
    medicalLeave: al(14, 8, 2),
    lastUpdatedOn: '2026-08-12T12:18:00',
  },
  {
    id: 'lv-12',
    givenName: 'Lukman',
    familyName: 'Hakim',
    department: 'Workshop',
    status: 'Active',
    hiringCompanies: ['Westpoint Transit'],
    annualLeave: al(14, 11),
    medicalLeave: al(14, 6),
    lastUpdatedOn: '2026-08-11T07:40:00',
  },
  {
    id: 'lv-13',
    givenName: 'Maya',
    familyName: 'Anggraini',
    department: 'Human Resources',
    status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Transit'],
    annualLeave: al(20, 3),
    medicalLeave: al(14, 1),
    lastUpdatedOn: '2026-08-08T18:05:00',
  },
  {
    id: 'lv-14',
    givenName: 'Nadia',
    familyName: 'Rahmawati',
    department: 'Finance',
    status: 'Active',
    hiringCompanies: ['Westpoint Coach'],
    annualLeave: al(16, 12, 1),
    medicalLeave: al(14, 0),
    lastUpdatedOn: '2026-08-05T11:50:00',
  },
  {
    id: 'lv-15',
    givenName: 'Oscar',
    familyName: 'Tanuwijaya',
    department: 'Digital',
    status: 'Active',
    hiringCompanies: ['Westpoint Transit'],
    annualLeave: al(18, 0),
    medicalLeave: al(14, 2),
    lastUpdatedOn: '2026-08-03T16:20:00',
  },
  {
    id: 'lv-16',
    givenName: 'Putri',
    familyName: 'Handayani',
    department: 'Not applicable',
    status: 'Active',
    hiringCompanies: ['Westpoint Tours', 'Westpoint Coach'],
    annualLeave: al(14, 6),
    medicalLeave: al(14, 9),
    lastUpdatedOn: '2026-07-30T08:55:00',
  },
  {
    id: 'lv-17',
    givenName: 'Rizky',
    familyName: 'Pratama',
    department: 'Sales',
    status: 'Active',
    hiringCompanies: ['Westpoint Coach'],
    annualLeave: al(14, 4, 2),
    medicalLeave: al(14, 3),
    lastUpdatedOn: '2026-07-28T14:15:00',
  },
  {
    id: 'lv-18',
    givenName: 'Siti',
    familyName: 'Nurhaliza',
    department: 'Driver',
    status: 'Suspended',
    hiringCompanies: ['Westpoint Transit'],
    annualLeave: al(12, 8),
    medicalLeave: al(14, 7),
    lastUpdatedOn: '2026-07-24T10:35:00',
  },
  {
    id: 'lv-19',
    givenName: 'Toni',
    familyName: 'Wibowo',
    department: 'Facilities',
    status: 'Active',
    hiringCompanies: ['Westpoint Tours'],
    annualLeave: al(14, 2),
    medicalLeave: al(14, 0),
    lastUpdatedOn: '2026-07-20T09:25:00',
  },
  // --- Not listed: biz req 1 admits Active and Suspended only. ---
  {
    id: 'lv-20',
    givenName: 'Umar',
    familyName: 'Setiawan',
    department: 'Operations',
    status: 'Terminated',
    hiringCompanies: ['Westpoint Transit'],
    annualLeave: al(14, 14),
    medicalLeave: al(14, 14),
    lastUpdatedOn: '2026-08-27T09:00:00',
  },
  {
    id: 'lv-21',
    givenName: 'Vina',
    familyName: 'Kusuma',
    department: 'Sales',
    status: 'Resigned',
    hiringCompanies: ['Westpoint Coach'],
    annualLeave: al(16, 10),
    medicalLeave: al(14, 5),
    lastUpdatedOn: '2026-08-27T08:00:00',
  },
  {
    id: 'lv-22',
    givenName: 'Wawan',
    familyName: 'Sudrajat',
    department: 'Workshop',
    status: 'Future Employee',
    hiringCompanies: ['Westpoint Tours'],
    annualLeave: al(14, 0),
    medicalLeave: al(14, 0),
    lastUpdatedOn: '2026-08-27T07:00:00',
  },
]
