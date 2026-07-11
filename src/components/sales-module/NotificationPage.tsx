import { useState, useMemo } from 'react'
import { Typography, Button, Badge, Tabs, Tag, Tooltip, Empty } from 'antd'
import {
  BellOutlined,
  FileTextOutlined,
  DollarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  SettingOutlined,
} from '@ant-design/icons'

const { Text, Title } = Typography

type NotifType = 'invoice' | 'payment' | 'overdue' | 'system' | 'alert'
type NotifStatus = 'unread' | 'read'

interface Notification {
  id: string
  type: NotifType
  title: string
  description: string
  timestamp: string
  timeAgo: string
  status: NotifStatus
  actionLabel?: string
  meta?: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'overdue',
    title: 'Invoice Overdue',
    description: 'Invoice ATA-2026-0011 (Daily Commuter Route - Jurong East to CBD) is overdue by 3 days. Outstanding balance: $3,456.00.',
    timestamp: '10 Jul 2026, 9:00am',
    timeAgo: '2 hours ago',
    status: 'unread',
    actionLabel: 'View Invoice',
    meta: 'CUST-0003',
  },
  {
    id: '2',
    type: 'payment',
    title: 'Payment Received',
    description: 'Payment of $9,720.00 received for invoice WTA-2026-0009 (Staff Shuttle - Marina Bay Financial). Transaction ref: MBS-0426.',
    timestamp: '10 Jul 2026, 8:30am',
    timeAgo: '2 hours ago',
    status: 'unread',
    actionLabel: 'View Invoice',
    meta: 'CUST-0038',
  },
  {
    id: '3',
    type: 'invoice',
    title: 'Invoice Due Soon',
    description: 'Invoice ATA-2026-0015 (Airport Shuttle Service - Terminal 1 & 2) is due in 3 days on 28 Jun 2026. Outstanding balance: $1,100.00.',
    timestamp: '10 Jul 2026, 7:15am',
    timeAgo: '3 hours ago',
    status: 'unread',
    actionLabel: 'View Invoice',
    meta: 'CUST-0042',
  },
  {
    id: '4',
    type: 'overdue',
    title: 'Invoice Overdue',
    description: 'Invoice WRA-2026-0005 (Weekend Tour Package - Sentosa Island Loop) has been overdue for 35 days. Outstanding: $8,640.00.',
    timestamp: '9 Jul 2026, 3:00pm',
    timeAgo: 'Yesterday',
    status: 'unread',
    actionLabel: 'View Invoice',
    meta: 'CUST-0019',
  },
  {
    id: '5',
    type: 'alert',
    title: 'Partial Payment Alert',
    description: 'Invoice WCA-2026-0008 (Corporate Event Transport - Annual Dinner 2026) received a partial payment of $600.00. Outstanding: $5,880.00.',
    timestamp: '9 Jul 2026, 1:00pm',
    timeAgo: 'Yesterday',
    status: 'unread',
    actionLabel: 'Log Payment',
    meta: 'CUST-0027',
  },
  {
    id: '6',
    type: 'system',
    title: 'New Invoice Generated',
    description: 'Invoice ATA-2026-0015 has been auto-generated for customer CUST-0042 based on contract CC-2026-0089. Review and send to customer.',
    timestamp: '8 Jul 2026, 10:00am',
    timeAgo: '2 days ago',
    status: 'read',
    actionLabel: 'Review Invoice',
    meta: 'System',
  },
  {
    id: '7',
    type: 'payment',
    title: 'Payment Received',
    description: 'Full payment of $4,104.00 received for invoice ATA-2026-0001 (Daily Commuter Route - Woodlands to Tanjong Pagar). Invoice marked as Paid.',
    timestamp: '22 Apr 2026, 8:30am',
    timeAgo: '2 months ago',
    status: 'read',
    meta: 'CUST-0003',
  },
  {
    id: '8',
    type: 'payment',
    title: 'Payment Received',
    description: 'Full payment of $6,696.00 received for invoice ATA-2026-0002 (Hotel Guest Shuttle - Orchard Road Circuit). Invoice marked as Paid.',
    timestamp: '10 Feb 2026, 3:00pm',
    timeAgo: '5 months ago',
    status: 'read',
    meta: 'CUST-0008',
  },
  {
    id: '9',
    type: 'invoice',
    title: 'Invoice Due Soon',
    description: 'Invoice WTA-2026-0012 (School Bus Service - Greenfield International School) is due in 5 days. Send reminder to customer.',
    timestamp: '15 Jun 2026, 9:00am',
    timeAgo: '3 weeks ago',
    status: 'read',
    actionLabel: 'Send Reminder',
    meta: 'CUST-0015',
  },
  {
    id: '10',
    type: 'system',
    title: 'Monthly Invoice Summary',
    description: 'June 2026 summary: 5 invoices generated, $42,360 total billed, $15,800 collected, $26,560 outstanding across 3 overdue invoices.',
    timestamp: '1 Jul 2026, 8:00am',
    timeAgo: '9 days ago',
    status: 'read',
    meta: 'System',
  },
  {
    id: '11',
    type: 'alert',
    title: 'Invoice Not Sent',
    description: 'Invoice ATA-2026-0014 (Employee Transport - Morning Shift) was generated 13 days ago but has not been sent to the customer.',
    timestamp: '28 May 2026, 10:00am',
    timeAgo: '6 weeks ago',
    status: 'read',
    actionLabel: 'Send Invoice',
    meta: 'CUST-0038',
  },
  {
    id: '12',
    type: 'system',
    title: 'Bank Account Updated',
    description: 'DBS Main Account details have been updated by Jasmine Tan. Please verify the new account number before processing payments.',
    timestamp: '1 Jun 2026, 2:00pm',
    timeAgo: '5 weeks ago',
    status: 'read',
    meta: 'System',
  },
]

const TYPE_CONFIG: Record<NotifType, { icon: React.ReactNode; color: string; bg: string; tagLabel: string; tagColor: string }> = {
  invoice: {
    icon: <FileTextOutlined style={{ fontSize: 18 }} />,
    color: '#1677ff', bg: '#e6f4ff',
    tagLabel: 'Invoice', tagColor: 'blue',
  },
  payment: {
    icon: <DollarOutlined style={{ fontSize: 18 }} />,
    color: '#52c41a', bg: '#f6ffed',
    tagLabel: 'Payment', tagColor: 'green',
  },
  overdue: {
    icon: <WarningOutlined style={{ fontSize: 18 }} />,
    color: '#ff4d4f', bg: '#fff1f0',
    tagLabel: 'Overdue', tagColor: 'red',
  },
  system: {
    icon: <InfoCircleOutlined style={{ fontSize: 18 }} />,
    color: '#8c8c8c', bg: '#f5f5f5',
    tagLabel: 'System', tagColor: 'default',
  },
  alert: {
    icon: <CheckCircleOutlined style={{ fontSize: 18 }} />,
    color: '#fa8c16', bg: '#fff7e6',
    tagLabel: 'Alert', tagColor: 'orange',
  },
}

function NotifItem({
  notif,
  onRead,
  onDismiss,
}: {
  notif: Notification
  onRead: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const cfg = TYPE_CONFIG[notif.type]
  const isUnread = notif.status === 'unread'

  return (
    <div
      onClick={() => onRead(notif.id)}
      style={{
        display: 'flex', gap: 14, padding: '16px 20px',
        background: isUnread ? '#fafcff' : '#fff',
        borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer', transition: 'background .15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isUnread ? '#fafcff' : '#fff' }}
    >
      {/* Unread dot */}
      {isUnread && (
        <div style={{
          position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
          width: 7, height: 7, borderRadius: '50%', background: '#1677ff',
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: cfg.bg,
        color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: isUnread ? 700 : 600, color: '#1a1a1a' }}>
              {notif.title}
            </Text>
            <Tag color={cfg.tagColor} style={{ fontSize: 11, margin: 0, borderRadius: 4 }}>
              {cfg.tagLabel}
            </Tag>
            {notif.meta && (
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{notif.meta}</Text>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, color: '#bfbfbf', whiteSpace: 'nowrap' }}>{notif.timeAgo}</Text>
            <Tooltip title="Dismiss">
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(notif.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#bfbfbf', borderRadius: 4, lineHeight: 1 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#595959' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#bfbfbf' }}
              >
                <CloseOutlined style={{ fontSize: 11 }} />
              </button>
            </Tooltip>
          </div>
        </div>
        <Text style={{ fontSize: 13, color: '#595959', display: 'block', lineHeight: 1.5, marginBottom: notif.actionLabel ? 10 : 0 }}>
          {notif.description}
        </Text>
        {notif.actionLabel && (
          <Button
            size="small"
            type="link"
            style={{ padding: 0, fontSize: 12, height: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {notif.actionLabel} →
          </Button>
        )}
      </div>
    </div>
  )
}

type FilterTab = 'all' | 'unread' | 'read'

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  const filtered = useMemo(() => {
    if (activeFilter === 'unread') return notifications.filter((n) => n.status === 'unread')
    if (activeFilter === 'read')   return notifications.filter((n) => n.status === 'read')
    return notifications
  }, [notifications, activeFilter])

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, status: 'read' } : n))
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })))
  }

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const tabItems = [
    { key: 'all',    label: <span>All <span style={{ color: '#8c8c8c', fontWeight: 400 }}>({notifications.length})</span></span> },
    {
      key: 'unread',
      label: (
        <span>
          Unread{' '}
          {unreadCount > 0 && (
            <Badge count={unreadCount} size="small" style={{ marginLeft: 4 }} />
          )}
        </span>
      ),
    },
    { key: 'read',   label: <span>Read <span style={{ color: '#8c8c8c', fontWeight: 400 }}>({notifications.filter((n) => n.status === 'read').length})</span></span> },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Notifications</Title>
          {unreadCount > 0 && (
            <Badge
              count={unreadCount}
              style={{ background: '#1677ff', fontSize: 12, fontWeight: 600 }}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead} style={{ borderRadius: 6 }}>
              <CheckCircleOutlined /> Mark all as read
            </Button>
          )}
          <Button size="small" icon={<SettingOutlined />} style={{ borderRadius: 6 }}>
            Settings
          </Button>
        </div>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ padding: '0 20px', borderBottom: '1px solid #f0f0f0' }}>
          <Tabs
            activeKey={activeFilter}
            onChange={(k) => setActiveFilter(k as FilterTab)}
            items={tabItems}
            style={{ marginBottom: 0 }}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>

        {/* Notification list */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 0' }}>
            <Empty
              image={<BellOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />}
              imageStyle={{ height: 50 }}
              description={
                <Text style={{ color: '#8c8c8c', fontSize: 14 }}>
                  {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
                </Text>
              }
            />
          </div>
        ) : (
          <div>
            {filtered.map((notif) => (
              <NotifItem
                key={notif.id}
                notif={notif}
                onRead={markRead}
                onDismiss={dismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
