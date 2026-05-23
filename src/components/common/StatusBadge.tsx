import { Tag } from 'antd'
import type { ContractStatus } from '@/types/contract'

const statusConfig: Record<ContractStatus, { color: string; bg: string; border: string }> = {
  Active: { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' },
  Upcoming: { color: '#0958d9', bg: '#e6f4ff', border: '#91caff' },
  Ended: { color: '#595959', bg: '#fafafa', border: '#d9d9d9' },
  Voided: { color: '#cf1322', bg: '#fff1f0', border: '#ffa39e' },
}

interface StatusBadgeProps {
  status: ContractStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status]
  return (
    <Tag
      style={{
        color: cfg.color,
        background: cfg.bg,
        borderColor: cfg.border,
        borderRadius: 4,
        fontWeight: 500,
        fontSize: 12,
        margin: 0,
        padding: '1px 8px',
      }}
    >
      {status}
    </Tag>
  )
}
