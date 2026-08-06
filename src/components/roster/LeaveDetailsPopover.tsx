// MOVE-3659 — Leave Details popover, anchored to the leave cell that opened it.
// AntD's Popover with a controlled `open` gives us the ticket's two hard rules
// for free: click-outside dismisses, and only one popover can be open at a time
// because the page tracks a single open cell key.

import { Popover, Typography } from 'antd'
import dayjs from 'dayjs'
import type { LeaveRecord } from './rosterData'

const { Text } = Typography

function formatRange(leave: LeaveRecord): string {
  const start = dayjs(leave.startDate)
  const end = dayjs(leave.endDate)
  if (start.isSame(end, 'day')) return start.format('D MMM YYYY')
  const sameYear = start.isSame(end, 'year')
  return `${start.format(sameYear ? 'D MMM' : 'D MMM YYYY')} – ${end.format('D MMM YYYY')}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '4px 0' }}>
      <Text type="secondary" style={{ fontSize: 12, width: 92, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontSize: 12 }}>{value}</Text>
    </div>
  )
}

export default function LeaveDetailsPopover({
  leave,
  employeeName,
  open,
  onOpenChange,
  children,
}: {
  leave: LeaveRecord
  employeeName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger="click"
      placement="bottom"
      title={<span style={{ fontSize: 13 }}>Leave Details</span>}
      content={
        <div style={{ minWidth: 220 }}>
          <Row label="Employee" value={employeeName} />
          <Row label="Leave Date" value={formatRange(leave)} />
          {leave.timing && <Row label="Leave Time" value={leave.timing} />}
          <Row label="Leave Type" value={leave.type} />
        </div>
      }
    >
      {children}
    </Popover>
  )
}
