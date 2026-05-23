import { Typography } from 'antd'

const { Text } = Typography

interface StatCardProps {
  count: number
  label: string
  onFilter?: () => void
}

export default function StatCard({ count, label, onFilter }: StatCardProps) {
  return (
    <div style={{ flex: 1, padding: '20px 24px' }}>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: '#1a1a1a' }}>{count}</div>
      <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 2, marginBottom: 12 }}>{label}</div>
      <Text
        onClick={onFilter}
        style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer' }}
      >
        Filter
      </Text>
    </div>
  )
}
