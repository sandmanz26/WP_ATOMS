import { Typography, Button, Table, Dropdown } from 'antd'
import { DownOutlined, PlusOutlined, MoreOutlined } from '@ant-design/icons'
import { NOTIFICATIONS, type TripNotification } from './notificationData'
import { NotificationStatusBadge, TripStatusBadge } from './notificationStatusLogic'

const { Text, Title } = Typography

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{value}</Text>
    </div>
  )
}

const SENT_MENU_ITEMS = [
  { key: 'send-now', label: 'Send Now' },
  { key: 'resend-all', label: 'Resend All' },
  { key: 'cancel-send', label: 'Cancel Send' },
]

const ROW_ACTION_ITEMS = [
  { key: 'view', label: 'View trip details' },
  { key: 'track', label: 'Track trip' },
  { key: 'history', label: 'View send history' },
]

interface Props {
  notificationId: string
  onBack: () => void
}

export default function CustomerNotificationDetailPage({ notificationId }: Props) {
  const notification = NOTIFICATIONS.find((n) => n.id === notificationId) ?? NOTIFICATIONS[0]

  const sentCount = notification.trips.filter((t) => t.notificationStatus === 'Sent').length

  const tripColumns = [
    {
      title: 'Trip Date', dataIndex: 'date', key: 'date', width: 130,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Start Time', dataIndex: 'startTime', key: 'startTime', width: 110,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Driver', dataIndex: 'driver', key: 'driver',
      render: (v: string) => <Text style={{ fontSize: 13, color: v === '-' ? '#bfbfbf' : undefined }}>{v}</Text>,
    },
    {
      title: 'Vehicle', dataIndex: 'vehicle', key: 'vehicle',
      render: (v: string) => <Text style={{ fontSize: 13, color: v === '-' ? '#bfbfbf' : undefined }}>{v}</Text>,
    },
    {
      title: 'Notification Status', dataIndex: 'notificationStatus', key: 'notificationStatus', width: 170,
      render: (v: TripNotification['notificationStatus']) => <TripStatusBadge status={v} />,
    },
    {
      title: 'Action', key: 'action', width: 60, align: 'center' as const,
      render: () => (
        <Dropdown menu={{ items: ROW_ACTION_ITEMS }} trigger={['click']}>
          <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      ),
    },
  ]

  const sectionPad: React.CSSProperties = { padding: 24 }
  const sectionTitle = (label: string) => (
    <Text style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 20 }}>{label}</Text>
  )

  return (
    <div style={{ padding: 24 }}>
      {/* ── Header ── */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, marginBottom: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{notification.contractNo}</Title>
          <NotificationStatusBadge status={notification.notificationStatus} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Dropdown menu={{ items: [{ key: 'edit', label: 'Edit Notification Settings' }] }} trigger={['click']}>
            <Button style={{ borderRadius: 6 }}>
              Actions <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
          <Dropdown menu={{ items: SENT_MENU_ITEMS }} trigger={['click']}>
            <Button type="primary" style={{ borderRadius: 6 }}>
              Sent <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
        </div>
      </div>

      {/* ── All sections in one card ── */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>

        {/* ── Basic Information ── */}
        <div style={sectionPad}>
          {sectionTitle('Basic Information')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px 24px', marginBottom: 20 }}>
            <LabelValue label="Customer Code"   value={notification.customerCode} />
            <LabelValue label="Contract Period" value={notification.contractPeriod} />
            <LabelValue label="Contract Title"  value={notification.contractTitle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px 24px' }}>
            <LabelValue label="Phone Number" value={notification.phoneNumber} />
            <LabelValue label="Email"        value={notification.email} />
            <LabelValue label="Email CC"     value={notification.emailCc} />
          </div>
        </div>
      </div>

      {/* ── Trips in Daily Schedule ── */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>Trips in Daily Schedule</Text>
            <Text style={{ fontSize: 13, color: '#595959' }}>{sentCount}/{notification.trips.length} Sent</Text>
          </div>
        </div>
        <Table<TripNotification>
          columns={tripColumns}
          dataSource={notification.trips}
          rowKey={(_, i) => String(i)}
          pagination={false}
          size="middle"
        />
        <button
          style={{
            width: '100%', padding: '13px 0', border: 'none', borderTop: '1px solid #f0f0f0',
            background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13.5, color: '#1a1a1a', fontFamily: 'inherit',
          }}
        >
          <PlusOutlined style={{ fontSize: 12 }} /> Add Trips
        </button>
      </div>

      {/* ── Additional Information ── */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
        <div style={sectionPad}>
          {sectionTitle('Additional Information')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px 24px' }}>
            <div>
              <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>Created On</Text>
              <Text style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{notification.createdOn}</Text>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>1 month ago</Text>
            </div>
            <LabelValue label="Created By" value={notification.createdBy} />
            <div>
              <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>Last Updated On</Text>
              <Text style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{notification.lastUpdatedOn}</Text>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{notification.lastUpdatedAgo}</Text>
            </div>
            <LabelValue label="Last Updated By" value={notification.lastUpdatedBy} />
          </div>
        </div>
      </div>
    </div>
  )
}
