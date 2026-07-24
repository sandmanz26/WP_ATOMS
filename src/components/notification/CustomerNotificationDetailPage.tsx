import { useState, useEffect, useRef } from 'react'
import { Typography, Button, Table, Dropdown, Tooltip, message } from 'antd'
import { DownOutlined, PlusOutlined, MoreOutlined, CheckCircleFilled, ExclamationCircleOutlined } from '@ant-design/icons'
import { NOTIFICATIONS, type TripNotification } from './notificationData'
import {
  NotificationStatusBadge, TripStatusBadge, computeContractNotificationStatus,
  canMarkAsNotRequired, canSendNotification, markAsNotRequiredTooltip, sendNotificationTooltip,
} from './notificationStatusLogic'
import EditRecipientsModal from './EditRecipientsModal'
import SendEmailModal from './SendEmailModal'
import SendSMSModal from './SendSMSModal'
import SendFeedbackModal from './SendFeedbackModal'

const { Text, Title } = Typography

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{value}</Text>
    </div>
  )
}

const ROW_ACTION_ITEMS = [
  { key: 'view', label: 'View trip details' },
  { key: 'track', label: 'Track trip' },
  { key: 'history', label: 'View send history' },
]

const TAB_ITEMS = [
  { key: 'basic', label: 'Basic Information' },
  { key: 'trips', label: 'Trips in Daily Schedule' },
  { key: 'additional', label: 'Additional Information' },
]

interface Props {
  notificationId: string
  onBack: () => void
}

export default function CustomerNotificationDetailPage({ notificationId }: Props) {
  const notification = NOTIFICATIONS.find((n) => n.id === notificationId) ?? NOTIFICATIONS[0]

  // Local, session-only trips override — this page has no backend, so
  // Send Email/SMS and Mark as Not Required update state here.
  const [trips, setTrips] = useState<TripNotification[]>(notification.trips)

  // Contract-level status is always computed from trips, never stored —
  // see notificationStatusLogic.tsx / PRD §2.2.
  const contractStatus = computeContractNotificationStatus(trips)
  const sentCount = trips.filter((t) => t.notificationStatus === 'Sent').length

  const [activeTab, setActiveTab] = useState('basic')
  const sectionRefs = {
    basic: useRef<HTMLDivElement>(null),
    trips: useRef<HTMLDivElement>(null),
    additional: useRef<HTMLDivElement>(null),
  }
  const scrollTo = (key: string) => {
    sectionRefs[key as keyof typeof sectionRefs]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveTab(key)
  }

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

  // PRD §7.6 / Appendix B — enable/disable rules
  const ACTIONS_ITEMS = [
    { key: 'edit-recipients', label: 'Edit Recipients', onClick: () => setEditRecipientsOpen(true) },
    {
      key: 'mark-not-required',
      disabled: !canMarkAsNotRequired(contractStatus),
      label: markAsNotRequiredTooltip(contractStatus)
        ? <Tooltip title={markAsNotRequiredTooltip(contractStatus)} placement="left">Mark as Not Required</Tooltip>
        : 'Mark as Not Required',
      onClick: () => { setSendMode('notRequired'); setSelectedRowKeys([]) },
    },
  ]

  const sendDisabled = !canSendNotification(contractStatus)
  const SEND_MENU_ITEMS = [
    { key: 'email', label: 'Email', disabled: sendDisabled, onClick: () => { setSendMode('email'); setSelectedRowKeys([]) } },
    { key: 'sms',   label: 'SMS',   disabled: sendDisabled, onClick: () => { setSendMode('sms'); setSelectedRowKeys([]) } },
  ]

  // ── Multi-select modes (PRD §8.2/§8.3 for Email, §9 for SMS, §10.2 for Mark as Not Required) ──
  const [sendMode, setSendMode] = useState<'none' | 'email' | 'sms' | 'notRequired'>('none')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [sendEmailOpen, setSendEmailOpen] = useState(false)
  const [sendSmsOpen, setSendSmsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [notRequiredConfirmOpen, setNotRequiredConfirmOpen] = useState(false)

  const selectedTrips = selectedRowKeys.map((k) => trips[Number(k)]).filter(Boolean) as TripNotification[]

  const cancelSendMode = () => {
    setSendMode('none')
    setSelectedRowKeys([])
  }

  const handlePreviewEmail = () => {
    if (selectedTrips.length === 0) {
      message.error('Select at least one schedule to preview the email')
      return
    }
    const hasResendRequired = selectedTrips.some((t) => t.notificationStatus === 'Resend Required')
    const allResendRequired = selectedTrips.every((t) => t.notificationStatus === 'Resend Required')
    if (hasResendRequired && !allResendRequired) {
      message.error('"Resend Required" schedules cannot be sent together with other statuses — select only one group')
      return
    }
    setSendEmailOpen(true)
  }

  const handleSendEmail = () => {
    setSendEmailOpen(false)
    setFeedbackOpen(true)
    setFeedbackLoading(true)
    setTimeout(() => {
      // Sending an email always moves the trip to Sent, even if it was
      // Not Required — PRD §8.8 step 5.
      const selectedSet = new Set(selectedRowKeys.map(String))
      setTrips((prev) => prev.map((t, i) => (selectedSet.has(String(i)) ? { ...t, notificationStatus: 'Sent' } : t)))
      setFeedbackLoading(false)
    }, 700)
  }

  const handlePreviewSMS = () => {
    if (selectedTrips.length !== 1) {
      message.error('Select 1 schedule to preview the SMS')
      return
    }
    setSendSmsOpen(true)
  }

  const handleSendSMS = () => {
    setSendSmsOpen(false)
    setFeedbackOpen(true)
    setFeedbackLoading(true)
    setTimeout(() => {
      const selectedSet = new Set(selectedRowKeys.map(String))
      setTrips((prev) => prev.map((t, i) => (selectedSet.has(String(i)) ? { ...t, notificationStatus: 'Sent' } : t)))
      setFeedbackLoading(false)
    }, 700)
  }

  const handleReturnFromFeedback = () => {
    setFeedbackOpen(false)
    cancelSendMode()
  }

  const handleConfirmNotRequired = () => {
    // PRD §10.4 — update trips, recalculate contract status (computed
    // automatically from trips), capture in send history, then close.
    const selectedSet = new Set(selectedRowKeys.map(String))
    setTrips((prev) => prev.map((t, i) => (selectedSet.has(String(i)) ? { ...t, notificationStatus: 'Not Required' } : t)))
    setNotRequiredConfirmOpen(false)
    setToast('Notification marked as not required')
    cancelSendMode()
  }

  const tripColumns = [
    {
      title: 'Trip Date', dataIndex: 'date', key: 'date', width: 130,
      sorter: (a: TripNotification, b: TripNotification) => a.date.localeCompare(b.date),
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
      sorter: (a: TripNotification, b: TripNotification) => a.notificationStatus.localeCompare(b.notificationStatus),
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
    <div style={{ padding: 24, position: 'relative' }}>
      {/* ── Title (bare, no card) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{notification.contractNo}</Title>
          <NotificationStatusBadge status={contractStatus} />
        </div>
        {sendMode === 'email' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>{selectedTrips.length} schedule(s) selected</Text>
            <Button onClick={cancelSendMode} style={{ borderRadius: 6 }}>Cancel</Button>
            <Button type="primary" style={{ borderRadius: 6 }} onClick={handlePreviewEmail}>Preview Email</Button>
          </div>
        ) : sendMode === 'sms' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>{selectedTrips.length} schedule selected</Text>
            <Button onClick={cancelSendMode} style={{ borderRadius: 6 }}>Cancel</Button>
            <Button type="primary" style={{ borderRadius: 6 }} onClick={handlePreviewSMS}>Preview SMS</Button>
          </div>
        ) : sendMode === 'notRequired' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>{selectedTrips.length} schedule(s) selected</Text>
            <Button onClick={cancelSendMode} style={{ borderRadius: 6 }}>Cancel</Button>
            <Button
              type="primary"
              style={{ borderRadius: 6 }}
              disabled={selectedTrips.length === 0}
              onClick={() => setNotRequiredConfirmOpen(true)}
            >
              Notification Not Required
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Dropdown menu={{ items: ACTIONS_ITEMS }} trigger={['click']}>
              <Button style={{ borderRadius: 6 }}>
                Actions <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
            <Dropdown menu={{ items: SEND_MENU_ITEMS }} trigger={['click']}>
              <Tooltip title={sendNotificationTooltip(contractStatus) ?? ''}>
                <Button type="primary" style={{ borderRadius: 6 }}>
                  Send <DownOutlined style={{ fontSize: 10 }} />
                </Button>
              </Tooltip>
            </Dropdown>
          </div>
        )}
      </div>

      {/* ── Tab nav (own card, evenly spread, sticky) ── */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16, position: 'sticky', top: 48, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px', overflowX: 'auto' }}>
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => scrollTo(tab.key)}
              style={{
                padding: '18px 0', border: 'none', cursor: 'pointer', fontSize: 14,
                fontWeight: activeTab === tab.key ? 600 : 400, whiteSpace: 'nowrap',
                background: 'none',
                borderBottom: `2px solid ${activeTab === tab.key ? '#1677ff' : 'transparent'}`,
                color: activeTab === tab.key ? '#1677ff' : '#595959',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Basic Information ── */}
      <div ref={sectionRefs.basic} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={sectionPad}>
          {sectionTitle('Basic Information')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px 24px', marginBottom: 20 }}>
            <LabelValue label="Customer Code"   value={notification.customerCode} />
            <LabelValue label="Contract Period" value={notification.contractPeriod} />
            <LabelValue label="Contract Title"  value={notification.contractTitle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px 24px' }}>
            <LabelValue label="Mobile Number" value={phoneNumbers.length ? phoneNumbers.join(', ') : '-'} />
            <LabelValue label="Email"         value={emails.length ? emails.join(', ') : '-'} />
            <LabelValue label="Email Cc"      value={emailCc.length ? emailCc.join(', ') : '-'} />
          </div>
        </div>
      </div>

      {/* ── Trips in Daily Schedule ── */}
      <div ref={sectionRefs.trips} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>Trips in Daily Schedule</Text>
            <Text style={{ fontSize: 13, color: '#595959' }}>{sentCount}/{trips.length} Sent</Text>
          </div>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <Table<TripNotification>
            columns={tripColumns}
            dataSource={trips}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="middle"
            rowSelection={
              sendMode === 'email' ? {
                type: 'checkbox',
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                // Pending Assignment trips can't be sent an email — hide their checkbox entirely (PRD §8.2)
                renderCell: (_checked, record, _index, originNode) =>
                  record.notificationStatus === 'Pending Assignment' ? null : originNode,
              } : sendMode === 'notRequired' ? {
                type: 'checkbox',
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                // Only Pending Assignment / Ready to Sent trips can be marked not required (PRD §10.2)
                renderCell: (_checked, record, _index, originNode) =>
                  record.notificationStatus === 'Pending Assignment' || record.notificationStatus === 'Ready to Sent'
                    ? originNode
                    : null,
              } : sendMode === 'sms' ? {
                type: 'radio',
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                // SMS is single-trip only; same eligibility as email — Pending Assignment excluded (PRD §9/Appendix A)
                renderCell: (_checked, record, _index, originNode) =>
                  record.notificationStatus === 'Pending Assignment' ? null : originNode,
              } : undefined
            }
          />
        </div>
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
      <div ref={sectionRefs.additional} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
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

      <SendEmailModal
        open={sendEmailOpen}
        onClose={() => setSendEmailOpen(false)}
        contractNo={notification.contractNo}
        selectedTrips={selectedTrips}
        defaultEmails={emails}
        defaultEmailCc={emailCc}
        onSend={handleSendEmail}
      />

      <SendSMSModal
        open={sendSmsOpen}
        onClose={() => setSendSmsOpen(false)}
        selectedTrip={selectedTrips[0] ?? null}
        defaultPhoneNumbers={phoneNumbers}
        onSend={handleSendSMS}
      />

      <SendFeedbackModal
        open={feedbackOpen}
        loading={feedbackLoading}
        failedRecipients={[]}
        onReturn={handleReturnFromFeedback}
      />

      {/* ── Mark as Not Required confirm modal (PRD §10.3) ── */}
      {notRequiredConfirmOpen && (
        <div
          onClick={() => setNotRequiredConfirmOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 480, maxWidth: '100%', background: '#fff', borderRadius: 16, padding: '32px 32px 28px', boxShadow: '0 24px 60px rgba(15,23,42,.25)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <ExclamationCircleOutlined style={{ fontSize: 22, color: '#faad14' }} />
              <Text style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>Confirm Notification Not Required</Text>
            </div>
            <Text style={{ fontSize: 13.5, color: '#595959', display: 'block', marginLeft: 34, marginBottom: 26, lineHeight: 1.6 }}>
              {'{{refer to copy master list}}'}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button size="large" style={{ borderRadius: 8 }} onClick={() => setNotRequiredConfirmOpen(false)}>Cancel</Button>
              <Button size="large" type="primary" style={{ borderRadius: 8 }} onClick={handleConfirmNotRequired}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1100,
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid #f0f0f0', borderLeft: '3px solid #52c41a', borderRadius: 8,
          padding: '13px 16px', minWidth: 260, maxWidth: 360, boxShadow: '0 10px 28px rgba(15,23,42,.14)',
        }}>
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
          <Text style={{ fontSize: 13.5, color: '#1a1a1a' }}>{toast}</Text>
        </div>
      )}
    </div>
  )
}
