import type { InvoiceStatus } from './invoiceData'

/* Pill/outline badge palette — shared by the list page, its drawer, and
   the detail page so status reads consistently everywhere. */
export const STATUS_CONFIG: Record<InvoiceStatus, { color: string; bg: string; border: string }> = {
  Draft:            { color: '#595959', bg: '#ffffff', border: '#d9d9d9' },
  Open:             { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  Overdue:          { color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' },
  Paid:             { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
  'Partially Paid': { color: '#faad14', bg: '#fff7e6', border: '#ffd591' },
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 16px', borderRadius: 8, fontSize: 14, fontWeight: 400,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {status}
    </span>
  )
}

/* Status matrix shared by Mark as Sent, Add Adjustment, and Log Payment
   (PRD MOVE-2398 §6.3/§8.3/§9.3 — same table in all three). */
export function computeStatusFromBalance(grandTotal: number, outstandingBalance: number, dueDate: Date, now: Date): InvoiceStatus {
  if (outstandingBalance <= 0) return 'Paid'
  const isOverdue = !Number.isNaN(dueDate.getTime()) && now > dueDate
  if (isOverdue) return 'Overdue'
  if (outstandingBalance < grandTotal) return 'Partially Paid'
  return 'Open'
}

// PRD §8.1 — Mark as Sent only enabled when status = draft
export function canMarkAsSent(status: InvoiceStatus) {
  return status === 'Draft'
}

// PRD §9.1 — Log Payment only enabled when status = open / partially paid / overdue
export function canLogPayment(status: InvoiceStatus) {
  return status === 'Open' || status === 'Partially Paid' || status === 'Overdue'
}
