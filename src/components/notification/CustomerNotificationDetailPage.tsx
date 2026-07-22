import { useState, useEffect } from 'react'
import { Typography, Button, Table, Dropdown } from 'antd'
import { DownOutlined, PlusOutlined, MoreOutlined, CheckCircleFilled } from '@ant-design/icons'
import { NOTIFICATIONS, type TripNotification } from './notificationData'
import { NotificationStatusBadge, TripStatusBadge } from './notificationStatusLogic'
import EditRecipientsModal from './EditRecipientsModal'

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

  // Local, session-only recipients override + toast — this page has no
  // backend, so Edit Recipients updates state here rather than persisting.
  const [phoneNumbers, setPhoneNumbers] = useState(notification.phoneNumbers)
  const [emails, setEmails] = useState(notification.emails)
  const [emailCc, setEmailCc] = useState(notification.emailCc)
  const [editRecipientsOpen, setEditRecipientsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const ACTIONS_ITEMS = [
    { key: 'edit-recipients', label: 'Edit Recipients', onClick: () => setEditRecipientsOpen(true) },
    { key: 'mark-required', label: 'Mark as Required', onClick: () => setToast('Marked as required') },
  ]

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
          <Dropdown menu={{ items: ACTIONS_ITEMS }} trigger={['click']}>
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
            <LabelValue label="Phone Number" value={phoneNumbers.join(', ')} />
            <LabelValue label="Email"        value={emails.join(', ')} />
            <LabelValue label="Email CC"     value={emailCc.join(', ')} />
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

      <EditRecipientsModal
        open={editRecipientsOpen}
        onClose={() => setEditRecipientsOpen(false)}
        initial={{ phoneNumbers, emails, emailCc }}
        onSave={(payload) => {
          setPhoneNumbers(payload.phoneNumbers)
          setEmails(payload.emails)
          setEmailCc(payload.emailCc)
          setToast('Recipients updated')
        }}
      />

      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1100,
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid #f0f0f0', borderLeft: '3px solid #52c41a', borderRadius: 8,
          padding: '13px 16px', minWidth: 260, boxShadow: '0 10px 28px rgba(15,23,42,.14)',
        }}>
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
          <Text style={{ fontSize: 13.5, color: '#1a1a1a' }}>{toast}</Text>
        </div>
      )}
    </div>
  )
}
