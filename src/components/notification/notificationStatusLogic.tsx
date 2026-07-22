import type { ContractStatus, NotificationStatus, TripNotificationStatus } from './notificationData'

const badgeStyle = (cfg: { color: string; bg: string; border: string }): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '4px 16px', borderRadius: 8, fontSize: 14, fontWeight: 400,
  color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
  whiteSpace: 'nowrap',
})

const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { color: string; bg: string; border: string }> = {
  Voided:   { color: '#595959', bg: '#ffffff', border: '#d9d9d9' },
  Upcoming: { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  Active:   { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
  Ending:   { color: '#faad14', bg: '#fff7e6', border: '#ffd591' },
  Ended:    { color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' },
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <span style={badgeStyle(CONTRACT_STATUS_CONFIG[status])}>{status}</span>
}

const NOTIFICATION_STATUS_CONFIG: Record<NotificationStatus, { color: string; bg: string; border: string }> = {
  'Pending Assignment': { color: '#595959', bg: '#ffffff', border: '#d9d9d9' },
  'Ready to Send':      { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  'Partially Sent':     { color: '#faad14', bg: '#fff7e6', border: '#ffd591' },
  Completed:            { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
}

export function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  return <span style={badgeStyle(NOTIFICATION_STATUS_CONFIG[status])}>{status}</span>
}

const TRIP_STATUS_CONFIG: Record<TripNotificationStatus, { color: string; bg: string; border: string }> = {
  'Pending Assignment': { color: '#595959', bg: '#ffffff', border: '#d9d9d9' },
  'Ready to Sent':       { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  'Resend Required':    { color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' },
  Sent:                  { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
  'Not Required':        { color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9' },
}

export function TripStatusBadge({ status }: { status: TripNotificationStatus }) {
  return (
    <span style={{ ...badgeStyle(TRIP_STATUS_CONFIG[status]), padding: '2px 10px', fontSize: 12.5, borderRadius: 6 }}>
      {status}
    </span>
  )
}

/* Contract-level status is always derived from its trips' statuses, per
   the aggregation rule (customernotificationvibecoding.md §2.2) — never
   stored/edited directly, so it can't drift out of sync as trips change. */
export function computeContractNotificationStatus(trips: { notificationStatus: TripNotificationStatus }[]): NotificationStatus {
  const total = trips.length
  if (total === 0) return 'Pending Assignment'

  const allPending = trips.every((t) => t.notificationStatus === 'Pending Assignment')
  if (allPending) return 'Pending Assignment'

  const progressCount = trips.filter((t) => t.notificationStatus === 'Sent' || t.notificationStatus === 'Not Required').length
  if (progressCount === total) return 'Completed'
  if (progressCount >= 1) return 'Partially Sent'

  // No trip sent or marked not required yet, but not all pending either
  // (i.e. at least one is ready to send / resend required).
  return 'Ready to Send'
}

// Enable/disable rules from Appendix B
export function canMarkAsNotRequired(contractStatus: NotificationStatus) {
  return contractStatus !== 'Completed'
}

export function canSendNotification(contractStatus: NotificationStatus) {
  return contractStatus !== 'Pending Assignment'
}

export const markAsNotRequiredTooltip = (contractStatus: NotificationStatus): string | null =>
  canMarkAsNotRequired(contractStatus) ? null : 'All trips have already been sent or marked as not required'

export const sendNotificationTooltip = (contractStatus: NotificationStatus): string | null =>
  canSendNotification(contractStatus) ? null : 'Assign a driver and vehicle before sending notifications'
