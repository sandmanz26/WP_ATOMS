import { Typography } from 'antd'

const { Text } = Typography

interface StatCardProps {
  count: number
  label: string
  onFilter?: () => void
}

export default function StatCard({ count, label, onFilter }: StatCardProps) {
  return (
    <div
      style={{
        flex: 1,
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Top: number + label */}
      <div style={{ padding: '20px 24px 16px' }}>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: '#1a1a1a' }}>
          {count}
        </div>
        <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>{label}</div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f0f0' }} />

      {/* Bottom: Filter link */}
      <div style={{ padding: '10px 24px' }}>
        <Text
          onClick={onFilter}
          style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer' }}
        >
          Filter
        </Text>
      </div>
    </div>
  )
}
