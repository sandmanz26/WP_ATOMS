// Personal Dashboard (epic MOVE-3412) — Claims domain: types + mock dataset.
//
// A correction, not a new request: the Claims tab was shipped as an honest
// "not specified" placeholder, on the reading that its tickets described a
// separate module with nothing build-able. Re-reading MOVE-3776, MOVE-3943,
// MOVE-3945, MOVE-3958 and MOVE-3964 in full shows that was wrong — all five
// carry complete field tables, statuses and acceptance criteria, the same
// shape as the Leave tickets this epic's Leave tab was built from. Only
// MOVE-3944 ([x], cancelled duplicate) and MOVE-3960/MOVE-3963 ([KIV],
// notifications) are genuinely empty — that part of the earlier read was
// right.
//
// This file plays the same role `leave/leaveData.ts` plays for Leave: types
// and the in-memory mock "database" the drawers/tables read and mutate.
// `claimsLogic.ts` next to it holds the field-visibility and remarks-compose
// rules (MOVE-3776 biz req 2/3).

export type ClaimCategory = 'ERP' | 'Carpark' | 'Taxi Claims' | 'Others'

export type ClaimStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Paid' | 'Cancelled'

export interface ClaimSubmission {
  id: string
  employeeId: string
  category: ClaimCategory
  /** Free text entered when category = 'Others' (MOVE-3776 biz req 2). */
  otherLabel?: string
  /** Taxi Claims only. */
  receiptDate?: string
  receiptTime?: string
  amount: number
  /** ERP/Carpark only — captured but not displayed separately (biz req 3). */
  busNumber?: string
  /** ERP only. */
  route?: string
  /** The composed value actually shown in the listing/details — user's own
   * remarks with Bus Number/Route auto-appended for ERP/Carpark, per biz req 3. */
  remarks?: string
  attachmentName: string
  status: ClaimStatus
  appliedOn: string
  appliedBy: string
  approvedOn?: string
  approvedBy?: string
  rejectedOn?: string
  rejectedBy?: string
  rejectionReason?: string
  cancelledOn?: string
  cancelledBy?: string
  cancellationReason?: string
  /** MOVE-3943/MOVE-3798's "Last Updated On" column and default sort. */
  lastUpdatedOn: string
}

/**
 * Mock fleet for the Bus Number dropdown (MOVE-3776: "populate all fleet;
 * owner == tenant"). This prototype has no fleet/contracts data reachable
 * from here, so it reuses the vehicle numbers already seeded in the
 * Notification module (`notificationStatusLogic.tsx`) rather than inventing a
 * second, disconnected set of plate numbers.
 */
export const CLAIM_BUS_FLEET = ['SBS1234A', 'SBS5678B', 'SBS9012C', 'SBS3456D', 'SBS7890E']

/**
 * Mock bus service routes for the Route dropdown (ERP only). No route data
 * exists anywhere else in this codebase, so this is a fresh, small, self-
 * contained list — not meant to represent a real route registry.
 */
export const CLAIM_ROUTES = ['12', '36', '857', '961', 'NR6']

export const CLAIM_CATEGORIES: ClaimCategory[] = ['ERP', 'Carpark', 'Taxi Claims', 'Others']

export function claimTypeLabel(claim: Pick<ClaimSubmission, 'category' | 'otherLabel'>): string {
  return claim.category === 'Others' ? `Others: ${claim.otherLabel}` : claim.category
}

export const formatAmount = (n: number): string => `$${n.toFixed(2)}`

let seq = 1000
export const nextClaimId = () => `cl-${++seq}`

/**
 * Seed data. "Me" (Citra Dewi, lv-3) gets one claim in every status so the
 * details drawer's every status-conditional block is exercised at least
 * once, including "Paid" — a status the field table lists but none of these
 * five tickets ever transitions a claim into (no payroll-integration ticket
 * exists in this batch), so it only ever appears here as seed data.
 *
 * The other rows belong to the same five employees who already have
 * `leaveApprover = 'Citra Dewi'` in `leave/leaveData.ts` (Hendra, Joko,
 * Lukman, Cahya, Krisna) — reusing that relationship as the claim approver
 * too (see `claimsLogic.ts`'s `claimApproverOf`) rather than inventing a
 * second, disconnected approver graph for a prototype with no separate
 * Employees module to source one from.
 */
export const CLAIM_SUBMISSIONS: ClaimSubmission[] = [
  {
    id: 'cl-1', employeeId: 'lv-3', category: 'Taxi Claims',
    receiptDate: '2026-09-10', receiptTime: '21:30', amount: 18.4,
    remarks: 'Late return from client site visit', attachmentName: 'taxi-receipt-10sep2026.jpg',
    status: 'Pending Approval', appliedOn: '2026-09-11T08:20:00', appliedBy: 'Citra Dewi',
    lastUpdatedOn: '2026-09-11T08:20:00',
  },
  {
    id: 'cl-2', employeeId: 'lv-3', category: 'ERP',
    amount: 6.5, busNumber: 'SBS1234A', route: '12',
    remarks: 'Bus Number: SBS1234A\nRoute: 12', attachmentName: 'erp-statement-aug2026.pdf',
    status: 'Approved', appliedOn: '2026-08-05T09:00:00', appliedBy: 'Citra Dewi',
    approvedOn: '2026-08-06T10:15:00', approvedBy: 'Maya Anggraini',
    lastUpdatedOn: '2026-08-06T10:15:00',
  },
  {
    id: 'cl-3', employeeId: 'lv-3', category: 'Others', otherLabel: 'Client dinner (approved in advance)',
    amount: 84.0, remarks: 'Client dinner (approved in advance)', attachmentName: 'receipt-client-dinner.pdf',
    status: 'Rejected', appliedOn: '2026-07-22T19:05:00', appliedBy: 'Citra Dewi',
    rejectedOn: '2026-07-24T09:40:00', rejectedBy: 'Maya Anggraini',
    rejectionReason: 'Not within the approved client entertainment budget for this quarter.',
    lastUpdatedOn: '2026-07-24T09:40:00',
  },
  {
    id: 'cl-4', employeeId: 'lv-3', category: 'Carpark',
    amount: 12.0, busNumber: 'SBS5678B', remarks: 'Bus Number: SBS5678B', attachmentName: 'carpark-receipt-jun2026.jpg',
    status: 'Paid', appliedOn: '2026-06-14T08:00:00', appliedBy: 'Citra Dewi',
    approvedOn: '2026-06-15T09:00:00', approvedBy: 'Maya Anggraini',
    lastUpdatedOn: '2026-07-01T00:00:00',
  },
  {
    id: 'cl-5', employeeId: 'lv-3', category: 'Taxi Claims',
    receiptDate: '2026-05-30', receiptTime: '22:10', amount: 22.9,
    remarks: 'Cancelled — booked the wrong date', attachmentName: 'taxi-receipt-30may2026.jpg',
    status: 'Cancelled', appliedOn: '2026-05-31T08:00:00', appliedBy: 'Citra Dewi',
    cancelledOn: '2026-05-31T10:30:00', cancelledBy: 'Citra Dewi',
    cancellationReason: 'Submitted against the wrong receipt date.',
    lastUpdatedOn: '2026-05-31T10:30:00',
  },

  // ---- Pending Citra's approval ----
  {
    id: 'cl-6', employeeId: 'lv-8', category: 'ERP',
    amount: 4.2, busNumber: 'SBS9012C', route: '36',
    remarks: 'Bus Number: SBS9012C\nRoute: 36', attachmentName: 'erp-statement-hendra-sep2026.pdf',
    status: 'Pending Approval', appliedOn: '2026-09-20T09:10:00', appliedBy: 'Hendra Saputra',
    lastUpdatedOn: '2026-09-20T09:10:00',
  },
  {
    id: 'cl-7', employeeId: 'lv-10', category: 'Taxi Claims',
    receiptDate: '2026-09-18', receiptTime: '23:00', amount: 31.5,
    remarks: 'Depot changeover, last bus already gone', attachmentName: 'taxi-receipt-joko-18sep2026.jpg',
    status: 'Pending Approval', appliedOn: '2026-09-19T07:45:00', appliedBy: 'Joko Prasetyo',
    lastUpdatedOn: '2026-09-19T07:45:00',
  },
  {
    id: 'cl-8', employeeId: 'lv-12', category: 'Carpark',
    amount: 8.0, busNumber: 'SBS3456D', remarks: 'Bus Number: SBS3456D', attachmentName: 'carpark-receipt-lukman.jpg',
    status: 'Pending Approval', appliedOn: '2026-09-15T11:00:00', appliedBy: 'Lukman Hakim',
    lastUpdatedOn: '2026-09-15T11:00:00',
  },
  {
    id: 'cl-9', employeeId: 'lv-25', category: 'Others', otherLabel: 'Toll top-up for site visit',
    amount: 15.0, remarks: 'Toll top-up for site visit', attachmentName: 'toll-receipt-cahya.pdf',
    status: 'Pending Approval', appliedOn: '2026-09-12T14:20:00', appliedBy: 'Cahya Ramadhan',
    lastUpdatedOn: '2026-09-12T14:20:00',
  },
  {
    id: 'cl-10', employeeId: 'lv-33', category: 'ERP',
    amount: 5.6, busNumber: 'SBS7890E', route: '857',
    remarks: 'Bus Number: SBS7890E\nRoute: 857', attachmentName: 'erp-statement-krisna-sep2026.pdf',
    status: 'Pending Approval', appliedOn: '2026-09-08T09:30:00', appliedBy: 'Krisna Wibisono',
    lastUpdatedOn: '2026-09-08T09:30:00',
  },
]
