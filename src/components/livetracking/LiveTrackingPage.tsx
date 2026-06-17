import { Typography } from 'antd'
import { EnvironmentOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function LiveTrackingPage() {
  return (
    <div style={{ padding: '24px 32px' }}>
      <Title level={3} style={{ margin: '0 0 16px', fontSize: 26, fontWeight: 700, color: '#1a1a1a' }}>
        Live Tracking
      </Title>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 10,
          padding: '80px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <EnvironmentOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
        <Text style={{ fontSize: 14, color: '#595959' }}>Live Tracking is coming soon.</Text>
      </div>
    </div>
  )
}
