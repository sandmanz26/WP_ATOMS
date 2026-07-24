import { useState, useRef } from 'react'
import { Typography, Button, Select, Table, Dropdown, Divider, Tooltip } from 'antd'
import {
  DownOutlined, LinkOutlined, EyeOutlined,
  FileTextOutlined, PlusOutlined, PaperClipOutlined, DownloadOutlined, HistoryOutlined,
} from '@ant-design/icons'
import { INVOICES, type InvoiceStatus, type TripRecord, type OtherChargeRecord, type AdjustmentRecord, type PaymentRecord } from './invoiceData'
import LogPaymentModal from './LogPaymentModal'

const { Text, Title } = Typography

const STATUS_CONFIG: Record<InvoiceStatus, { color: string; bg: string; border: string }> = {
  Draft:            { color: '#595959', bg: '#fafafa',  border: '#d9d9d9' },
  Open:             { color: '#1677ff', bg: '#e6f4ff',  border: '#91caff' },
  Overdue:          { color: '#fff',    bg: '#ff4d4f',  border: '#ff4d4f' },
  Paid:             { color: '#fff',    bg: '#52c41a',  border: '#52c41a' },
  'Partially Paid': { color: '#fff',    bg: '#fa8c16',  border: '#fa8c16' },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {status}
    </span>
  )
}

function fmt(n: number) {
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{value}</Text>
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

// Field rows with a divider under each row, matching the reference layout
function FieldRows({ rows, columns = 3 }: { rows: { label: string; value: string }[][]; columns?: number }) {
  return (
    <div>
      {rows.map((row, i) => (
        <div key={i}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '4px 24px', padding: '16px 0' }}>
            {row.map((f, j) => <LabelValue key={j} label={f.label} value={f.value} />)}
          </div>
          <Divider style={{ margin: 0 }} />
        </div>
      ))}
    </div>
  )
}

// Stats rows with a divider under each row; Grand Total / Amount Received /
// Outstanding Balance are emphasized (bold), the rest are plain.
function StatRow({ label, value, bold, last }: { label: string; value: string; bold?: boolean; last?: boolean }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0' }}>
        <Text style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? 700 : 400, color: bold ? '#1a1a1a' : '#595959' }}>{label}</Text>
        <Text style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? 700 : 500, color: '#1a1a1a' }}>{value}</Text>
      </div>
      {!last && <Divider style={{ margin: 0 }} />}
    </div>
  )
}

const ACTIONS_ITEMS = [
  { key: 'sent',   label: 'Mark as Sent',          icon: <FileTextOutlined /> },
  { key: 'adj',    label: 'Add Adjustment',         icon: <PlusOutlined /> },
  { key: 'po',     label: 'Attach Purchase Order',  icon: <PaperClipOutlined /> },
  { key: 'dl',     label: 'Download',               icon: <DownloadOutlined /> },
  { key: 'hist',   label: 'View Change History',    icon: <HistoryOutlined /> },
]

const TAB_ITEMS = [
  { key: 'basic',      label: 'Basic Information' },
  { key: 'billing',    label: 'Billing Details' },
  { key: 'details',    label: 'Invoice Details' },
  { key: 'adjustment', label: 'Adjustment Details' },
  { key: 'payment',    label: 'Payment Received' },
  { key: 'additional', label: 'Additional Information' },
]

interface Props {
  invoiceId: string
  onBack: () => void
}

export default function InvoiceDetailPage({ invoiceId }: Props) {
  const invoice = INVOICES.find((i) => i.id === invoiceId) ?? INVOICES[0]

  const [activeTab,        setActiveTab]        = useState('basic')
  const [selectedContract, setSelectedContract] = useState(invoice.contractDetails[0]?.contractNo ?? '')
  const [logPaymentOpen,   setLogPaymentOpen]   = useState(false)

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    basic:      useRef<HTMLDivElement>(null),
    billing:    useRef<HTMLDivElement>(null),
    details:    useRef<HTMLDivElement>(null),
    adjustment: useRef<HTMLDivElement>(null),
    payment:    useRef<HTMLDivElement>(null),
    additional: useRef<HTMLDivElement>(null),
  }

  const scrollTo = (key: string) => {
    sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveTab(key)
  }

  const contractDetail = invoice.contractDetails.find((c) => c.contractNo === selectedContract) ?? invoice.contractDetails[0]
  // PRD §16.1 — only group invoices get a switchable dropdown; individual
  // invoices show Contract No. as plain, disabled text.
  const isGroupInvoice = invoice.invoiceType === 'group'
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

  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }
  const sectionPad: React.CSSProperties = { padding: 24 }
  const sectionTitle = (label: string) => (
    <Text style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 20 }}>{label}</Text>
  )

  return (
    <div style={{ padding: 24 }}>
      {/* ── Invoice title (bare, no card) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{invoice.invoiceNo}</Title>
          <StatusBadge status={invoice.status} />
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

      {/* ── Tab nav (own card, evenly spread, sticky) ── */}
      <div style={{ ...cardStyle, marginBottom: 16, position: 'sticky', top: 48, zIndex: 10 }}>
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

      {/* ── Basic Information + Summary (two separate cards, side by side) ── */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div ref={sectionRefs.basic} id="basic" style={{ ...cardStyle, ...sectionPad, flex: 1 }}>
          {sectionTitle('Basic Information')}
          <FieldRows rows={[
            [{ label: 'Customer Code', value: invoice.customerCode }, { label: 'Contract Group', value: invoice.contractGroup }, { label: 'Invoice Date', value: invoice.invoiceDate }],
            [{ label: 'Payment Terms', value: invoice.paymentTerms }, { label: 'Due Date', value: invoice.dueDate }, { label: 'Purchase Order', value: invoice.purchaseOrder }],
            [{ label: 'Billing Company', value: invoice.billingCompany }, { label: 'Account Payable', value: invoice.accountPayable }],
          ]} />
        </div>

        <div style={{ ...cardStyle, padding: '0 24px', width: 340, flexShrink: 0 }}>
          <StatRow label="Sub-total"            value={fmt(invoice.subTotal)} />
          <StatRow label="Adjustment"           value={fmt(invoice.adjustment)} />
          <StatRow label="GST"                  value={fmt(invoice.gst)} />
          <StatRow label="Grand Total"           value={fmt(invoice.grandTotal)} bold />
          <StatRow label="Amount Received"      value={fmt(invoice.amountReceived)} bold />
          <StatRow label="Outstanding Balance"  value={fmt(invoice.outstandingBalance)} bold last />
        </div>
      </div>

      {/* ── Billing Details ── */}
      <div ref={sectionRefs.billing} id="billing" style={{ ...cardStyle, ...sectionPad, marginTop: 16 }}>
        {sectionTitle('Billing Details')}
        <FieldRows columns={4} rows={[
          [
            { label: 'Company Name', value: invoice.billingCompanyName },
            { label: 'Attention',    value: invoice.attention },
            { label: 'Email',        value: invoice.email },
            { label: 'Email CC',     value: invoice.emailCc },
          ],
        ]} />
      </div>

      {/* ── Invoice Details ── */}
      <div ref={sectionRefs.details} id="details" style={{ ...cardStyle, ...sectionPad, marginTop: 16 }}>
        {sectionTitle('Invoice Details')}

          <div style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>Contract No.</Text>
            {isGroupInvoice ? (
              <Select
                style={{ width: '100%' }}
                options={contractOptions}
                value={selectedContract}
                onChange={setSelectedContract}
                showSearch
              />
            ) : (
              <Tooltip title="This invoice is linked to a single contract">
                <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', cursor: 'default' }}>
                  {invoice.contractDetails[0]?.contractNo ?? '-'}
                </Text>
              </Tooltip>
            )}
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

      {/* ── Adjustment Details ── */}
      <div ref={sectionRefs.adjustment} id="adjustment" style={{ ...cardStyle, ...sectionPad, marginTop: 16 }}>
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

      {/* ── Payment Received ── */}
      <div ref={sectionRefs.payment} id="payment" style={{ ...cardStyle, ...sectionPad, marginTop: 16 }}>
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

      {/* ── Additional Information ── */}
      <div ref={sectionRefs.additional} id="additional" style={{ ...cardStyle, ...sectionPad, marginTop: 16 }}>
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

      <LogPaymentModal
        open={logPaymentOpen}
        onClose={() => setLogPaymentOpen(false)}
        grandTotal={invoice.grandTotal}
        outstandingBalance={invoice.outstandingBalance}
      />
    </div>
  )
}
