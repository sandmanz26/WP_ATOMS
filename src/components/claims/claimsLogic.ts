// Personal Dashboard (epic MOVE-3412) — Claims business rules.
//
// Mirrors leave/leaveLogic.ts's role for the Leave module: the field-
// visibility rules and the remarks-compose rule live here once, so the
// create-claim drawer and anything else that touches them agree.

import dayjs, { type Dayjs } from 'dayjs'
import { LEAVE_EMPLOYEES, type LeaveEmployee } from '../leave/leaveData'
import type { ClaimCategory } from './claimsData'

/** MOVE-3776 biz req 2 — Receipt Date/Time only apply to Taxi Claims. */
export function requiresReceiptFields(category: ClaimCategory): boolean {
  return category === 'Taxi Claims'
}

/** MOVE-3776 biz req 2 — Bus Number is required for ERP and Carpark. */
export function requiresBusNumber(category: ClaimCategory): boolean {
  return category === 'ERP' || category === 'Carpark'
}

/** MOVE-3776 biz req 2 — Route is required for ERP only, not Carpark. */
export function requiresRoute(category: ClaimCategory): boolean {
  return category === 'ERP'
}

/**
 * MOVE-3776 biz req 3 — Bus Number/Route are drawer-only inputs; what the
 * listing and details drawer actually show is one composed Remarks string,
 * the user's own remarks (if any) followed by the auto-appended fields.
 * Carpark has no Route, so only ERP ever appends a "Route:" line.
 */
export function composeClaimRemarks(
  category: ClaimCategory,
  userRemarks: string | undefined,
  busNumber: string | undefined,
  route: string | undefined,
): string | undefined {
  if (!requiresBusNumber(category)) return userRemarks?.trim() || undefined
  const lines = [userRemarks?.trim() || undefined, `Bus Number: ${busNumber || '[blank]'}`]
  if (requiresRoute(category)) lines.push(`Route: ${route || '[blank]'}`)
  return lines.filter(Boolean).join('\n')
}

/**
 * MOVE-3776 biz req 4 — same "no approver on file → created already
 * approved" rule as Leave (MOVE-3956), for the same reason. This prototype
 * has no separate Employees-module approver field, so the claim approver
 * reuses `leaveApprover` — the same relationship that already seeds Leave's
 * "Pending My Approval" — rather than a second, disconnected approver graph.
 */
export function claimApproverOf(employee: LeaveEmployee): string | undefined {
  return employee.leaveApprover
}

export function employeeById(id: string): LeaveEmployee | undefined {
  return LEAVE_EMPLOYEES.find((e) => e.id === id)
}

/** MOVE-3776 biz req 2 — Receipt Date cannot be in the future. */
export function isSelectableReceiptDate(d: Dayjs): boolean {
  return d.isAfter(dayjs(), 'day')
}

/** MOVE-3776 biz req 2 — if Receipt Date = today, Receipt Time cannot be future. */
export function disabledReceiptTime(receiptDate: Dayjs | undefined) {
  if (!receiptDate || !receiptDate.isSame(dayjs(), 'day')) return {}
  const now = dayjs()
  return {
    disabledHours: () => Array.from({ length: 24 }, (_, h) => h).filter((h) => h > now.hour()),
    disabledMinutes: (selectedHour: number) =>
      selectedHour === now.hour() ? Array.from({ length: 60 }, (_, m) => m).filter((m) => m > now.minute()) : [],
  }
}
