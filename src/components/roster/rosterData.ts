// MOVE-3608 — Roster Calendar mock data (Operations department only)

export type EmployeeStatus =
  | 'Active'
  | 'Suspended'
  | 'Future Employee'
  | 'Terminated'
  | 'Resigned'
  | 'Retired'
  | 'Contract Expired'

export interface RosterEmployee {
  id: string
  name: string
  department: string
  status: EmployeeStatus
  contractStartDate: string // ISO date
  contractEndDate?: string // ISO date, undefined = open-ended
}

export type ShiftCode = 'AM' | 'PM' | 'OFF'

export interface RosterPattern {
  id: string
  employeeId: string
  effectiveDate: string // ISO date
  endDate?: string // ISO date, undefined = still in effect
  // Repeat week cycle: each entry is one week, Monday(0)..Sunday(6).
  // The cycle repeats every `cycleWeeks.length` weeks from effectiveDate's week.
  cycleWeeks: ShiftCode[][]
  standby: boolean // "Manage Roster -> Roster Pattern -> Standby checkbox"
}

export interface LeaveRecord {
  id: string
  employeeId: string
  date: string // ISO date
  type: string
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
  { id: 'emp-6', name: 'Farhan Hakim', department: 'Operations', status: 'Suspended', contractStartDate: '2023-02-01' },
  { id: 'emp-7', name: 'Gita Permata', department: 'Operations', status: 'Suspended', contractStartDate: '2022-08-15' },
  { id: 'emp-8', name: 'Hendra Saputra', department: 'Operations', status: 'Future Employee', contractStartDate: '2026-08-20' },
  { id: 'emp-9', name: 'Indah Lestari', department: 'Operations', status: 'Future Employee', contractStartDate: '2026-09-01' },
  { id: 'emp-10', name: 'Joko Prasetyo', department: 'Operations', status: 'Resigned', contractStartDate: '2020-01-01', contractEndDate: '2026-08-10' },
  { id: 'emp-11', name: 'Kartika Sari', department: 'Operations', status: 'Terminated', contractStartDate: '2021-04-01', contractEndDate: '2026-08-05' },
  { id: 'emp-12', name: 'Lukman Hakim', department: 'Operations', status: 'Contract Expired', contractStartDate: '2023-01-01', contractEndDate: '2026-08-15' },
  { id: 'emp-13', name: 'Maya Anggraini', department: 'Operations', status: 'Active', contractStartDate: '2020-07-01' },
  // Non-Operations employee — must never appear in the roster calendar.
  { id: 'emp-14', name: 'Nadia Putri', department: 'Finance', status: 'Active', contractStartDate: '2022-01-01' },
]

const AM: ShiftCode = 'AM'
const PM: ShiftCode = 'PM'
const OFF: ShiftCode = 'OFF'

export const ROSTER_PATTERNS: RosterPattern[] = [
  // Simple 1-week rotating AM/PM/Off cycle.
  {
    id: 'pat-1',
    employeeId: 'emp-1',
    effectiveDate: '2024-01-15',
    cycleWeeks: [[AM, AM, AM, AM, AM, OFF, OFF]],
    standby: false,
  },
  // 2-week alternating cycle, with standby flag (used for the Coverage Gap demo).
  {
    id: 'pat-2',
    employeeId: 'emp-2',
    effectiveDate: '2024-06-03',
    cycleWeeks: [
      [AM, AM, PM, PM, AM, OFF, OFF],
      [PM, PM, AM, AM, PM, OFF, OFF],
    ],
    standby: true,
  },
  {
    id: 'pat-3',
    employeeId: 'emp-3',
    effectiveDate: '2022-03-14',
    cycleWeeks: [[PM, PM, PM, PM, OFF, OFF, AM]],
    standby: false,
  },
  // Pattern ends mid-month, remainder of month intentionally has no pattern -> NA.
  {
    id: 'pat-4',
    employeeId: 'emp-4',
    effectiveDate: '2021-11-01',
    endDate: '2026-08-15',
    cycleWeeks: [[AM, PM, AM, PM, AM, OFF, OFF]],
    standby: false,
  },
  {
    id: 'pat-5',
    employeeId: 'emp-5',
    effectiveDate: '2024-05-20',
    cycleWeeks: [[OFF, AM, AM, AM, AM, AM, OFF]],
    standby: true,
  },
  {
    id: 'pat-6',
    employeeId: 'emp-6',
    effectiveDate: '2023-02-06',
    cycleWeeks: [[AM, AM, AM, AM, AM, OFF, OFF]],
    standby: false,
  },
  {
    id: 'pat-13',
    employeeId: 'emp-13',
    effectiveDate: '2020-07-06',
    cycleWeeks: [
      [AM, AM, AM, PM, PM, OFF, OFF],
      [PM, PM, OFF, AM, AM, AM, OFF],
      [OFF, PM, PM, PM, AM, AM, OFF],
    ],
    standby: false,
  },
  // emp-7, emp-8, emp-9, emp-10, emp-11, emp-12 intentionally have no pattern.
]

export const LEAVES: LeaveRecord[] = [
  { id: 'lv-1', employeeId: 'emp-1', date: '2026-08-06', type: 'Annual Leave', approved: true },
  { id: 'lv-2', employeeId: 'emp-1', date: '2026-08-07', type: 'Annual Leave', approved: true },
  // Overlaps emp-2's standby pattern -> should render as Coverage Gap, not plain Standby.
  { id: 'lv-3', employeeId: 'emp-2', date: '2026-08-12', type: 'Medical Leave', approved: true },
  { id: 'lv-4', employeeId: 'emp-3', date: '2026-08-20', type: 'Annual Leave', approved: true },
  { id: 'lv-5', employeeId: 'emp-5', date: '2026-08-14', type: 'Emergency Leave', approved: true },
]

export const PUBLIC_HOLIDAYS: PublicHoliday[] = [
  { date: '2026-08-17', name: 'Independence Day' },
]
