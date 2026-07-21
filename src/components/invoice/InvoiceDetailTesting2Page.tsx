import { useState, useRef, useEffect } from 'react'
import { Typography, Button, Select, Table, Dropdown, Divider } from 'antd'
import {
  DownOutlined, LinkOutlined, EyeOutlined, ExclamationCircleOutlined, CheckCircleFilled,
  FileTextOutlined, PlusOutlined, PaperClipOutlined, DownloadOutlined, HistoryOutlined,
} from '@ant-design/icons'
import { INVOICES, type InvoiceStatus, type TripRecord, type OtherChargeRecord, type AdjustmentRecord, type PaymentRecord } from './invoiceData'
import LogPaymentModal from './LogPaymentModal'

const { Text, Title } = Typography

/* Pill/outline badge palette — matches InvoiceTesting2Page so status
   reads consistently between the list and the detail view. */
const STATUS_CONFIG: Record<InvoiceStatus, { color: string; bg: string; border: string }> = {
  Draft:            { color: '#595959', bg: '#ffffff', border: '#d9d9d9' },
  Open:             { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  Overdue:          { color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' },
  Paid:             { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
  'Partially Paid': { color: '#faad14', bg: '#fff7e6', border: '#ffd591' },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 16px', borderRadius: 8, fontSize: 14, fontWeight: 400,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {status}
    </span>
  )
}

function fmt(n: number) {
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* Status matrix shared by Mark as Sent, Add Adjustment, and Log Payment
   (PRD MOVE-2398 §6.3/§8.3/§9.3 — same table in all three). */
function computeStatusFromBalance(grandTotal: number, outstandingBalance: number, dueDate: Date, now: Date): InvoiceStatus {
  if (outstandingBalance <= 0) return 'Paid'
  const isOverdue = !Number.isNaN(dueDate.getTime()) && now > dueDate
  if (isOverdue) return 'Overdue'
  if (outstandingBalance < grandTotal) return 'Partially Paid'
  return 'Open'
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{value}</Text>
    </div>
  )
}

function SummaryRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
      <Text style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? '#1a1a1a' : '#595959' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color ?? (bold ? '#1a1a1a' : '#595959') }}>{value}</Text>
    </div>
  )
}

const TAB_ITEMS = [
  { key: 'basic',      label: 'Basic Information' },
  { key: 'billing',    label: 'Billing Details' },
  { key: 'details',    label: 'Invoice Details' },
  { key: 'adjustment', label: 'Adjustment Details' },
  { key: 'payment',    label: 'Payment Received' },
  { key: 'additional', label: 'Additional Information' },
  { key: 'history',    label: 'Change History' },
]

interface HistoryEntry {
  text: string
  time: string
}

interface Props {
  invoiceId: string
  onBack: () => void
}

export default function InvoiceDetailTesting2Page({ invoiceId }: Props) {
  const invoice = INVOICES.find((i) => i.id === invoiceId) ?? INVOICES[0]

  const [activeTab,        setActiveTab]        = useState('basic')
  const [selectedContract, setSelectedContract] = useState(invoice.contractDetails[0]?.contractNo ?? '')
  const [logPaymentOpen,   setLogPaymentOpen]   = useState(false)

  // Local, session-only status + change history — this "2.0" page has no
  // backend, so Mark as Sent updates state here rather than persisting.
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const ACTIONS_ITEMS = [
    { key: 'sent',   label: 'Mark as Sent',          icon: <FileTextOutlined />, onClick: () => setConfirmOpen(true) },
    { key: 'adj',    label: 'Add Adjustment',         icon: <PlusOutlined /> },
    { key: 'po',     label: 'Attach Purchase Order',  icon: <PaperClipOutlined /> },
    { key: 'dl',     label: 'Download',               icon: <DownloadOutlined /> },
    { key: 'hist',   label: 'View Change History',    icon: <HistoryOutlined />, onClick: () => scrollTo('history') },
  ]

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    basic:      useRef<HTMLDivElement>(null),
    billing:    useRef<HTMLDivElement>(null),
    details:    useRef<HTMLDivElement>(null),
    adjustment: useRef<HTMLDivElement>(null),
    payment:    useRef<HTMLDivElement>(null),
    additional: useRef<HTMLDivElement>(null),
    history:    useRef<HTMLDivElement>(null),
  }

  const scrollTo = (key: string) => {
    sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveTab(key)
  }

  const handleConfirmMarkAsSent = () => {
    const now = new Date()
    const stamp = now.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')
    const previousStatus = status

    // 1. Modal closes
    setConfirmOpen(false)

    // 2. Success toast
    setToast('Invoice marked as sent')

    // 3. Status update — dependent on outstanding balance and due date
    // (PRD MOVE-2901 §8.3 status matrix)
    const dueDate = new Date(invoice.dueDate)
    const nextStatus = computeStatusFromBalance(invoice.grandTotal, invoice.outstandingBalance, dueDate, now)
    setStatus(nextStatus)

    // 4. Capture the action + status change in change history
    setHistory((prev) => {
      const entries: HistoryEntry[] = [{ text: 'Invoice marked as Sent', time: stamp }]
      if (nextStatus !== previousStatus) {
        entries.push({ text: `Status changed from ${previousStatus} to ${nextStatus}`, time: stamp })
      }
      return [...entries, ...prev]
    })
  }

  const contractDetail = invoice.contractDetails.find((c) => c.contractNo === selectedContract) ?? invoice.contractDetails[0]
  const contractOptions = invoice.contractDetails.map((c) => ({ value: c.contractNo, label: c.contractNo }))

  /* ── Trip table columns ── */
  const tripColumns = [
    {
      title: 'Active Days', dataIndex: 'activeDays', key: 'activeDays', width: 320,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Start Time', dataIndex: 'startTime', key: 'startTime', width: 100,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Trip Description', dataIndex: 'description', key: 'description',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Capacity', dataIndex: 'capacity', key: 'capacity', width: 80, align: 'center' as const,
      render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Trip Price', dataIndex: 'tripPrice', key: 'tripPrice', width: 100, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
    },
    {
      title: 'Action', key: 'action', width: 56, align: 'center' as const,
      render: () => <EyeOutlined style={{ color: '#bfbfbf', cursor: 'pointer' }} />,
    },
  ]

  /* ── Other charges columns ── */
  const chargesColumns = [
    {
      title: 'Item Description', dataIndex: 'description', key: 'description',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Unit Price', dataIndex: 'unitPrice', key: 'unitPrice', width: 110, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
    },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
    },
  ]

  /* ── Adjustment columns ── */
  const adjustmentColumns = [
    {
      title: 'Adjustment Type', dataIndex: 'type', key: 'type', width: 180,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Reason for Adjustment', dataIndex: 'reason', key: 'reason',
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 13 }}>{fmt(v)}</Text>,
    },
  ]

  /* ── Payment columns ── */
  const paymentColumns = [
    {
      title: 'Payment Date', dataIndex: 'date', key: 'date', width: 130,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Transaction Reference', dataIndex: 'transactionRef', key: 'transactionRef', width: 180,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Payment Method', dataIndex: 'method', key: 'method', width: 140,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Bank Account', dataIndex: 'bankAccount', key: 'bankAccount',
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Amount Received', dataIndex: 'amount', key: 'amount', width: 140, align: 'right' as const,
      render: (v: number) => <Text style={{ fontSize: 13 }}>{fmt(v)}</Text>,
    },
  ]

  const adjTotal  = invoice.adjustments.reduce((s, a) => a.type === 'Additional Payment' ? s + a.amount : s - a.amount, 0)
  const payTotal  = invoice.payments.reduce((s, p) => s + p.amount, 0)

  const sectionPad: React.CSSProperties = { padding: 24 }
  const sectionTitle = (label: string) => (
    <Text style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 20 }}>{label}</Text>
  )

  return (
    <div style={{ padding: 24, position: 'relative' }}>
      {/* ── Invoice header ── */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{invoice.invoiceNo}</Title>
            <StatusBadge status={status} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Dropdown menu={{ items: ACTIONS_ITEMS }} trigger={['click']}>
              <Button style={{ borderRadius: 6 }}>
                Actions <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
            <Button type="primary" style={{ borderRadius: 6 }} onClick={() => setLogPaymentOpen(true)}>
              Log Payment
            </Button>
          </div>
        </div>

        {/* ── Tab nav (sticky) ── */}
        <div style={{
          display: 'flex', borderTop: '1px solid #f0f0f0',
          position: 'sticky', top: 48, background: '#fff', zIndex: 10,
          overflowX: 'auto',
        }}>
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => scrollTo(tab.key)}
              style={{
                padding: '11px 18px', border: 'none', cursor: 'pointer', fontSize: 14,
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

      {/* ── All sections in one card ── */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>

        {/* ── Basic Information ── */}
        <div ref={sectionRefs.basic} id="basic" style={sectionPad}>
          {sectionTitle('Basic Information')}
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px 24px' }}>
              <LabelValue label="Customer Code"   value={invoice.customerCode} />
              <LabelValue label="Contract Group"  value={invoice.contractGroup} />
              <LabelValue label="Invoice Date"    value={invoice.invoiceDate} />
              <LabelValue label="Payment Terms"   value={invoice.paymentTerms} />
              <LabelValue label="Due Date"        value={invoice.dueDate} />
              <LabelValue label="Purchase Order"  value={invoice.purchaseOrder} />
              <LabelValue label="Billing Company" value={invoice.billingCompany} />
              <LabelValue label="Account Payable" value={invoice.accountPayable} />
            </div>

            {/* Right summary */}
            <div style={{ width: 256, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#595959' }}>Sub Total</Text>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{fmt(invoice.subTotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#595959' }}>Adjustment</Text>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{fmt(invoice.adjustment)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#595959' }}>GST</Text>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{fmt(invoice.gst)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1.5px solid #1a1a1a', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: 700 }}>Grand Total</Text>
                <Text style={{ fontSize: 14, fontWeight: 700 }}>{fmt(invoice.grandTotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#595959' }}>Amount Received</Text>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{fmt(invoice.amountReceived)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#595959' }}>Outstanding Balance</Text>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{fmt(invoice.outstandingBalance)}</Text>
              </div>
            </div>
          </div>
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Billing Details ── */}
        <div ref={sectionRefs.billing} id="billing" style={sectionPad}>
          {sectionTitle('Billing Details')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px 24px' }}>
            <LabelValue label="Company Name" value={invoice.billingCompanyName} />
            <LabelValue label="Attention"    value={invoice.attention} />
            <LabelValue label="Email"        value={invoice.email} />
            <LabelValue label="Email CC"     value={invoice.emailCc} />
          </div>
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Invoice Details ── */}
        <div ref={sectionRefs.details} id="details" style={sectionPad}>
          {sectionTitle('Invoice Details')}

          <div style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Contract No</Text>
            <Select
              style={{ width: '100%', maxWidth: 420 }}
              options={contractOptions.length > 0 ? contractOptions : [{ value: 'CC-2024-291224848', label: 'CC-2024-291224848' }]}
              value={selectedContract}
              onChange={setSelectedContract}
              showSearch
            />
          </div>

          {contractDetail && (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
              {/* Contract header */}
              <div style={{ padding: '13px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: 700 }}>{contractDetail.title}</Text>
                <LinkOutlined style={{ color: '#1677ff', cursor: 'pointer', fontSize: 13 }} />
              </div>

              {/* Trips */}
              <div style={{ padding: '12px 16px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>Trips</Text>
                  <Text style={{ fontSize: 13, color: '#595959' }}>Trips Sub-total: {fmt(contractDetail.tripsSubtotal)}</Text>
                </div>
                <Table<TripRecord>
                  columns={tripColumns}
                  dataSource={contractDetail.trips}
                  rowKey={(_, i) => String(i)}
                  pagination={false}
                  size="small"
                  style={{ marginBottom: 12 }}
                />
              </div>

              {/* Other Charges */}
              <div style={{ padding: '12px 16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>Other Charges</Text>
                  <Text style={{ fontSize: 13, color: '#595959' }}>Other Charges Sub-total: {fmt(contractDetail.otherChargesSubtotal)}</Text>
                </div>
                <Table<OtherChargeRecord>
                  columns={chargesColumns}
                  dataSource={contractDetail.otherCharges}
                  rowKey={(_, i) => String(i)}
                  pagination={false}
                  size="small"
                  style={{ marginBottom: 12 }}
                />
              </div>

              {/* Contract totals */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 260 }}>
                  <SummaryRow label="Sub Total" value={fmt(contractDetail.subTotal)} />
                  <SummaryRow label="Discount"  value={`- ${fmt(contractDetail.discount)}`} color="#ff4d4f" />
                  <SummaryRow label="Surcharge" value={fmt(contractDetail.surcharge)} />
                  <Divider style={{ margin: '8px 0' }} />
                  <SummaryRow label="Total" value={fmt(contractDetail.total)} bold />
                </div>
              </div>
            </div>
          )}
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Adjustment Details ── */}
        <div ref={sectionRefs.adjustment} id="adjustment" style={sectionPad}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>Adjustment Details</Text>
            <Text style={{ fontSize: 13, color: '#595959' }}>Sub-total: {fmt(Math.abs(adjTotal))}</Text>
          </div>
          <Table<AdjustmentRecord>
            columns={adjustmentColumns}
            dataSource={invoice.adjustments}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="middle"
            locale={{ emptyText: 'No adjustments' }}
          />
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Payment Received ── */}
        <div ref={sectionRefs.payment} id="payment" style={sectionPad}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>Payment Received</Text>
            <Text style={{ fontSize: 13, color: '#595959' }}>Sub-total: {fmt(payTotal)}</Text>
          </div>
          <Table<PaymentRecord>
            columns={paymentColumns}
            dataSource={invoice.payments}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="middle"
            locale={{ emptyText: 'No payments recorded' }}
          />
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Additional Information ── */}
        <div ref={sectionRefs.additional} id="additional" style={sectionPad}>
          {sectionTitle('Additional Information')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px 24px' }}>
            <div>
              <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>Created On</Text>
              <Text style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{invoice.createdOn}</Text>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>1 month ago</Text>
            </div>
            <LabelValue label="Created By"      value={invoice.createdBy} />
            <div>
              <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>Last Updated On</Text>
              <Text style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{invoice.lastUpdatedOn}</Text>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{invoice.lastUpdatedAgo}</Text>
            </div>
            <LabelValue label="Last Updated By" value={invoice.lastUpdatedBy} />
          </div>
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Change History ── */}
        <div ref={sectionRefs.history} id="history" style={sectionPad}>
          {sectionTitle('Change History')}
          {history.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#8c8c8c' }}>No changes recorded yet.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i === history.length - 1 ? 'none' : '1px solid #f5f5f5' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1677ff', marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <Text style={{ fontSize: 13.5, color: '#1a1a1a', display: 'block' }}>{h.text}</Text>
                    <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{h.time}</Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <LogPaymentModal
        open={logPaymentOpen}
        onClose={() => setLogPaymentOpen(false)}
        grandTotal={invoice.grandTotal}
        outstandingBalance={invoice.outstandingBalance}
      />

      {/* ── Mark as Sent confirm modal ── */}
      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
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
              <Text style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>{'{{refer to copy master list}}'}</Text>
            </div>
            <Text style={{ fontSize: 13.5, color: '#595959', display: 'block', marginLeft: 34, marginBottom: 26, lineHeight: 1.6 }}>
              {'{{refer to copy master list}}'}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button size="large" style={{ borderRadius: 8 }} onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button size="large" type="primary" style={{ borderRadius: 8 }} onClick={handleConfirmMarkAsSent}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1100,
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid #f0f0f0', borderLeft: '3px solid #52c41a', borderRadius: 8,
          padding: '13px 16px', minWidth: 300, boxShadow: '0 10px 28px rgba(15,23,42,.14)',
        }}>
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
          <Text style={{ fontSize: 13.5, color: '#1a1a1a' }}>{toast}</Text>
        </div>
      )}
    </div>
  )
}
