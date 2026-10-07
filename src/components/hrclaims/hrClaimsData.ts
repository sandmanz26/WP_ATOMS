// Epic MOVE-4021 (WLA: HR - Claims) — the HR-side Claims module's types and
// mock dataset.
//
// Deliberately a separate model from `claims/claimsData.ts` (Personal
// Dashboard, epic MOVE-3412): the two epics' tickets disagree on the basics —
// this one has "Pending Payment" where that one has "Approved", types
// Carpark / Taxi / Toll (ERP) / Others instead of ERP / Carpark / Taxi Claims /
// Others, Vehicle Licence Plate + Trip instead of Bus Number + Route, a
// CLYYYYXXXX claim number, and payment details. MOVE-3799 itself defers the
// link between the two ("[implement after personal dashboard] auto-update the
// claim submissions tables in the employee's personal dashboard"), so merging
// them now would mean guessing a reconciliation the PM hasn't made.
//
// Employees, departments and the acting user are the HR employee master the
// Leave module already uses — one employee list across HR, not two.

import dayjs from 'dayjs'
import { LEAVE_EMPLOYEES, fullName, type LeaveEmployee } from '../leave/leaveData'

export { CURRENT_USER, DEPARTMENTS, type Department } from '../leave/leaveData'

/** MOVE-3798 biz req 3 / MOVE-3799 biz req 2 — the claim type options. */
export const HR_CLAIM_TYPES = ['Carpark', 'Taxi', 'Toll (ERP)', 'Others'] as const
export type HrClaimType = (typeof HR_CLAIM_TYPES)[number]

/** MOVE-3798 biz req 1 — the full status set, in lifecycle order. */
export const HR_CLAIM_STATUSES = ['Pending Approval', 'Pending Payment', 'Paid', 'Rejected', 'Cancelled'] as const
export type HrClaimStatus = (typeof HR_CLAIM_STATUSES)[number]

export interface HrClaimAttachment {
  name: string
  /**
   * Object URL of the file picked in this browser session, so MOVE-3801's
   * "click on file name to preview and download" is real for anything
   * submitted here. Seed records were never uploaded, so they have none.
   */
  url?: string
}

export interface HrClaim {
  id: string
  /** MOVE-3798 biz req 1 — CLYYYYXXXX, sequence restarting each calendar year. */
  claimNo: string
  employeeId: string
  type: HrClaimType
  /** MOVE-3799 — the manual text entered when type = Others. */
  otherLabel?: string
  receiptDate: string
  /** Optional per MOVE-3799; "HH:mm". */
  receiptTime?: string
  amount: number
  /** Carpark / Toll (ERP) only. */
  vehiclePlate?: string
  /** Toll (ERP) only. */
  trip?: string
  /** The user's own remarks, before the plate/trip lines are appended. */
  remarks?: string
  attachments: HrClaimAttachment[]
  status: HrClaimStatus
  createdOn: string
  createdBy: string
  approvedOn?: string
  approvedBy?: string
  rejectedOn?: string
  rejectedBy?: string
  rejectionReason?: string
  cancelledOn?: string
  cancelledBy?: string
  cancellationReason?: string
  /** MOVE-3957 — set when the claim is marked as paid. */
  paymentDate?: string
  paymentRefNo?: string
  lastUpdatedOn: string
}

/** Who a system-made decision is attributed to — same wording as Leave's MOVE-3956. */
export const SYSTEM_NO_APPROVER = 'System (no approver assigned)'

/**
 * MOVE-3798 biz req 1 — Others shows its manual text in brackets, e.g.
 * "Others (air freshener)".
 */
export function hrClaimTypeLabel(c: Pick<HrClaim, 'type' | 'otherLabel'>): string {
  return c.type === 'Others' && c.otherLabel ? `Others (${c.otherLabel})` : c.type
}

/** MOVE-3799 — Vehicle Licence Plate shows for Carpark and Toll (ERP). */
export function requiresVehiclePlate(type: HrClaimType | undefined): boolean {
  return type === 'Carpark' || type === 'Toll (ERP)'
}

/** MOVE-3799 — Trip shows for Toll (ERP) only. */
export function requiresTrip(type: HrClaimType | undefined): boolean {
  return type === 'Toll (ERP)'
}

/**
 * MOVE-3798 / MOVE-3801 — the Remarks shown in the listing and the details
 * drawer include the vehicle licence plate and/or trip appended after the
 * user's own text. Derived on read rather than stored composed, so the
 * separate Vehicle Licence Plate / Trip fields can never disagree with it.
 */
export function remarksLines(c: Pick<HrClaim, 'remarks' | 'vehiclePlate' | 'trip'>): string[] {
  const lines: string[] = []
  if (c.remarks?.trim()) lines.push(c.remarks.trim())
  if (c.vehiclePlate) lines.push(`Vehicle Licence Plate: ${c.vehiclePlate}`)
  if (c.trip) lines.push(`Trip: ${c.trip}`)
  return lines
}

/** MOVE-3798 / MOVE-3801 — "$5.00". */
export const formatClaimAmount = (n: number): string => `$${n.toFixed(2)}`

export function hrEmployeeById(id: string): LeaveEmployee | undefined {
  return LEAVE_EMPLOYEES.find((e) => e.id === id)
}

export function employeeName(id: string): string {
  const e = hrEmployeeById(id)
  return e ? fullName(e) : '-'
}

export function employeeDepartment(id: string): string {
  return hrEmployeeById(id)?.department ?? '-'
}

let idSeq = 100
export const nextHrClaimId = () => `hc-${++idSeq}`

/**
 * MOVE-3799 biz req 3 — CL + year + 4-digit running number, restarting at
 * 0001 every calendar year. Read off the existing records for that year
 * rather than a separate counter, so it can't drift from what's stored.
 */
export function nextClaimNo(at = dayjs()): string {
  const prefix = `CL${at.year()}`
  const max = HR_CLAIMS.filter((c) => c.claimNo.startsWith(prefix)).reduce(
    (m, c) => Math.max(m, Number(c.claimNo.slice(prefix.length))),
    0,
  )
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/**
 * Seed. Covers every status at least once, so each of the details drawer's
 * status-conditional sections renders somewhere. The two CL2025 rows are
 * there to show the claim number restarting at 0001 in 2026. CL20260005 is
 * Maya Anggraini's — the one active employee with no approver on file — so it
 * went straight to Pending Payment (MOVE-3799 biz req 3's exception).
 */
export const HR_CLAIMS: HrClaim[] = [
  {
    id: 'hc-1', claimNo: 'CL20250041', employeeId: 'lv-5', type: 'Toll (ERP)',
    receiptDate: '2025-12-20', receiptTime: '08:15', amount: 3.2,
    vehiclePlate: 'SBS1234A', trip: 'WP 1 (8:00 AM)',
    attachments: [{ name: 'erp-receipt-20dec2025.jpg' }],
    status: 'Paid', createdOn: '2025-12-22T09:00:00', createdBy: 'Maya Anggraini',
    approvedOn: '2025-12-23T10:30:00', approvedBy: 'Maya Anggraini',
    paymentDate: '2026-01-05', paymentRefNo: 'PAY-2026-0005',
    lastUpdatedOn: '2026-01-05T10:00:00',
  },
  {
    id: 'hc-2', claimNo: 'CL20250042', employeeId: 'lv-12', type: 'Others', otherLabel: 'air freshener',
    receiptDate: '2025-12-28', amount: 12.9,
    attachments: [{ name: 'receipt-air-freshener.png' }],
    status: 'Rejected', createdOn: '2025-12-29T14:10:00', createdBy: 'Heikke Ekkieh',
    rejectedOn: '2026-01-02T09:20:00', rejectedBy: 'Maya Anggraini',
    rejectionReason: 'Vehicle consumables are purchased centrally by Workshop.',
    lastUpdatedOn: '2026-01-02T09:20:00',
  },
  {
    id: 'hc-3', claimNo: 'CL20260001', employeeId: 'lv-1', type: 'Carpark',
    receiptDate: '2026-01-14', receiptTime: '17:40', amount: 2.4, vehiclePlate: 'SBS5678B',
    remarks: 'Depot coordination meeting',
    attachments: [{ name: 'carpark-14jan2026.jpg' }],
    status: 'Paid', createdOn: '2026-01-15T08:45:00', createdBy: 'Heikke Ekkieh',
    approvedOn: '2026-01-16T11:00:00', approvedBy: 'Maya Anggraini',
    paymentDate: '2026-01-31', paymentRefNo: 'PAY-2026-0031',
    lastUpdatedOn: '2026-01-31T16:00:00',
  },
  {
    id: 'hc-4', claimNo: 'CL20260002', employeeId: 'lv-9', type: 'Taxi',
    receiptDate: '2026-03-03', receiptTime: '22:40', amount: 27.8,
    remarks: 'Client event ran past the last bus',
    attachments: [{ name: 'taxi-03mar2026.pdf' }],
    status: 'Paid', createdOn: '2026-03-04T09:05:00', createdBy: 'Heikke Ekkieh',
    approvedOn: '2026-03-05T14:00:00', approvedBy: 'Maya Anggraini',
    paymentDate: '2026-03-31', paymentRefNo: 'PAY-2026-0118',
    lastUpdatedOn: '2026-03-31T15:30:00',
  },
  {
    id: 'hc-5', claimNo: 'CL20260003', employeeId: 'lv-10', type: 'Toll (ERP)',
    receiptDate: '2026-05-19', receiptTime: '06:10', amount: 1.8,
    vehiclePlate: 'SBS9012C', trip: 'WP 12 (6:00 AM)',
    attachments: [{ name: 'erp-19may2026.jpg' }],
    status: 'Cancelled', createdOn: '2026-05-20T08:00:00', createdBy: 'Heikke Ekkieh',
    cancelledOn: '2026-05-20T10:15:00', cancelledBy: 'Heikke Ekkieh',
    cancellationReason: 'Duplicate of an earlier submission.',
    lastUpdatedOn: '2026-05-20T10:15:00',
  },
  {
    id: 'hc-6', claimNo: 'CL20260004', employeeId: 'lv-14', type: 'Others', otherLabel: 'printer toner',
    receiptDate: '2026-07-08', amount: 64.5, remarks: 'Urgent toner for the payroll run',
    attachments: [{ name: 'toner-invoice.pdf' }, { name: 'toner-delivery-note.jpg' }],
    status: 'Pending Payment', createdOn: '2026-07-08T15:20:00', createdBy: 'Heikke Ekkieh',
    approvedOn: '2026-07-10T09:40:00', approvedBy: 'Maya Anggraini',
    lastUpdatedOn: '2026-07-10T09:40:00',
  },
  {
    id: 'hc-7', claimNo: 'CL20260005', employeeId: 'lv-13', type: 'Taxi',
    receiptDate: '2026-08-21', receiptTime: '23:05', amount: 19.6,
    remarks: 'Late HR audit close-out',
    attachments: [{ name: 'taxi-21aug2026.jpg' }],
    status: 'Pending Payment', createdOn: '2026-08-22T08:30:00', createdBy: 'Heikke Ekkieh',
    approvedOn: '2026-08-22T08:30:00', approvedBy: SYSTEM_NO_APPROVER,
    lastUpdatedOn: '2026-08-22T08:30:00',
  },
  {
    id: 'hc-8', claimNo: 'CL20260006', employeeId: 'lv-2', type: 'Carpark',
    receiptDate: '2026-09-02', amount: 3.5, vehiclePlate: 'SBS3456D',
    attachments: [{ name: 'carpark-02sep2026.png' }],
    status: 'Pending Payment', createdOn: '2026-09-02T17:10:00', createdBy: 'Heikke Ekkieh',
    approvedOn: '2026-09-04T10:00:00', approvedBy: 'Maya Anggraini',
    lastUpdatedOn: '2026-09-04T10:00:00',
  },
  {
    id: 'hc-9', claimNo: 'CL20260007', employeeId: 'lv-25', type: 'Toll (ERP)',
    receiptDate: '2026-09-15', receiptTime: '07:30', amount: 2.1,
    vehiclePlate: 'SBS7890E', trip: 'WP 5 (7:00 AM)',
    attachments: [{ name: 'erp-15sep2026.jpg' }],
    status: 'Pending Approval', createdOn: '2026-09-16T08:20:00', createdBy: 'Heikke Ekkieh',
    lastUpdatedOn: '2026-09-16T08:20:00',
  },
  {
    id: 'hc-10', claimNo: 'CL20260008', employeeId: 'lv-4', type: 'Others', otherLabel: 'workshop gloves',
    receiptDate: '2026-09-22', amount: 18,
    attachments: [{ name: 'gloves-receipt.pdf' }],
    status: 'Pending Approval', createdOn: '2026-09-23T09:00:00', createdBy: 'Heikke Ekkieh',
    lastUpdatedOn: '2026-09-23T09:00:00',
  },
  {
    id: 'hc-11', claimNo: 'CL20260009', employeeId: 'lv-8', type: 'Taxi',
    receiptDate: '2026-09-28', amount: 14.2, remarks: 'Server room call-out',
    attachments: [{ name: 'taxi-28sep2026.jpg' }],
    status: 'Pending Approval', createdOn: '2026-09-29T08:50:00', createdBy: 'Heikke Ekkieh',
    lastUpdatedOn: '2026-09-29T08:50:00',
  },
  {
    id: 'hc-12', claimNo: 'CL20260010', employeeId: 'lv-11', type: 'Carpark',
    receiptDate: '2026-10-01', receiptTime: '10:20', amount: 4.8, vehiclePlate: 'SBS1234A',
    remarks: 'Site inspection at Tuas depot',
    attachments: [{ name: 'carpark-01oct2026.jpg' }],
    status: 'Pending Approval', createdOn: '2026-10-01T16:40:00', createdBy: 'Heikke Ekkieh',
    lastUpdatedOn: '2026-10-01T16:40:00',
  },
  {
    id: 'hc-13', claimNo: 'CL20260011', employeeId: 'lv-31', type: 'Toll (ERP)',
    receiptDate: '2026-10-05', receiptTime: '15:20', amount: 2.6,
    vehiclePlate: 'SBS5678B', trip: 'WP 3 (3:00 PM)', remarks: 'Detour for road closure',
    attachments: [{ name: 'erp-05oct2026.jpg' }, { name: 'road-closure-notice.pdf' }],
    status: 'Pending Approval', createdOn: '2026-10-05T18:00:00', createdBy: 'Heikke Ekkieh',
    lastUpdatedOn: '2026-10-05T18:00:00',
  },
  {
    id: 'hc-14', claimNo: 'CL20260012', employeeId: 'lv-12', type: 'Taxi',
    receiptDate: '2026-10-04', receiptTime: '23:50', amount: 21,
    attachments: [{ name: 'taxi-04oct2026.jpg' }],
    status: 'Rejected', createdOn: '2026-10-05T08:10:00', createdBy: 'Heikke Ekkieh',
    rejectedOn: '2026-10-06T09:00:00', rejectedBy: 'Maya Anggraini',
    rejectionReason: 'Receipt is illegible — please resubmit with a clearer copy.',
    lastUpdatedOn: '2026-10-06T09:00:00',
  },
]

export { fullName, type LeaveEmployee }
