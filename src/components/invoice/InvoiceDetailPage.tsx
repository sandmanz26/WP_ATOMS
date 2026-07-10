import { useState } from 'react'
import { Typography, Button, Tabs, Select, Table, Dropdown, Divider, Tag } from 'antd'
import {
  DownOutlined, LinkOutlined, EyeOutlined, FileTextOutlined,
  PlusOutlined, PaperClipOutlined, DownloadOutlined, HistoryOutlined,
} from '@ant-design/icons'
import { INVOICES, type InvoiceStatus, type TripRecord, type OtherChargeRecord, type AdjustmentRecord, type PaymentRecord } from './invoiceData'

const { Text, Title } = Typography

const STATUS_CONFIG: Record<InvoiceStatus, { color: string; bg: string; border: string }> = {
  Draft:          { color: '#595959', bg: '#fafafa',  border: '#d9d9d9' },
  Open:           { color: '#1677ff', bg: '#e6f4ff',  border: '#91caff' },
  Overdue:        { color: '#fff',    bg: '#ff4d4f',  border: '#ff4d4f' },
  Paid:           { color: '#fff',    bg: '#52c41a',  border: '#52c41a' },
  'Partially Paid': { color: '#fff', bg: '#fa8c16',  border: '#fa8c16' },
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
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{value}</Text>
    </div>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: bold ? '1px solid #f0f0f0' : undefined }}>
      <Text style={{ fontSize: 13, color: bold ? '#1a1a1a' : '#595959', fontWeight: bold ? 700 : 400 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: '#1a1a1a' }}>{value}</Text>
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

interface Props {
  invoiceId: string
  onBack: () => void
}

export default function InvoiceDetailPage({ invoiceId, onBack }: Props) {
  const invoice = INVOICES.find((i) => i.id === invoiceId) ?? INVOICES[0]
  const [activeTab, setActiveTab] = useState('basic')
  const [selectedContract, setSelectedContract] = useState(
    invoice.contractDetails[0]?.contractNo ?? null
  )

  const contractDetail = invoice.contractDetails.find((c) => c.contractNo === selectedContract) ?? invoice.contractDetails[0]

  const contractOptions = invoice.contractDetails.map((c) => ({ value: c.contractNo, label: c.contractNo }))

  /* ── Basic Information tab ── */
  const basicTab = (
    <div style={{ display: 'flex', gap: 24 }}>
      {/* Left: fields */}
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
      {/* Right: summary card */}
      <div style={{ width: 260, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: '16px 20px', flexShrink: 0, alignSelf: 'flex-start' }}>
        <SummaryRow label="Sub Total"          value={fmt(invoice.subTotal)} />
        <SummaryRow label="Adjustment"         value={fmt(invoice.adjustment)} />
        <SummaryRow label="GST"                value={fmt(invoice.gst)} />
        <div style={{ borderTop: '2px solid #1a1a1a', margin: '6px 0' }} />
        <SummaryRow label="Grand Total"        value={fmt(invoice.grandTotal)}        bold />
        <div style={{ margin: '6px 0' }} />
        <SummaryRow label="Amount Received"    value={fmt(invoice.amountReceived)} />
        <SummaryRow label="Outstanding Balance" value={fmt(invoice.outstandingBalance)} />
      </div>
    </div>
  )

  /* ── Billing Details tab ── */
  const billingTab = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px 24px' }}>
      <LabelValue label="Company Name" value={invoice.billingCompanyName} />
      <LabelValue label="Attention"    value={invoice.attention} />
      <LabelValue label="Email"        value={invoice.email} />
      <LabelValue label="Email CC"     value={invoice.emailCc} />
    </div>
  )

  /* ── Invoice Details tab ── */
  const tripColumns = [
    { title: 'Active Days', dataIndex: 'activeDays', key: 'activeDays', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Start Time', dataIndex: 'startTime', key: 'startTime', width: 100, render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Trip Description', dataIndex: 'description', key: 'description', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Capacity', dataIndex: 'capacity', key: 'capacity', width: 80, render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Trip Price', dataIndex: 'tripPrice', key: 'tripPrice', width: 100, render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text> },
    { title: 'Action', key: 'action', width: 60, render: () => <EyeOutlined style={{ color: '#bfbfbf', cursor: 'pointer' }} /> },
  ]

  const otherChargesColumns = [
    { title: 'Item Description', dataIndex: 'description', key: 'description', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    {
      title: <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Text>Quantity</Text></div>,
      dataIndex: 'quantity', key: 'quantity', width: 90,
      render: (v: number) => <div style={{ textAlign: 'right' }}><Text style={{ fontSize: 12 }}>{v}</Text></div>,
    },
    {
      title: <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Text>Unit Price</Text></div>,
      dataIndex: 'unitPrice', key: 'unitPrice', width: 110,
      render: (v: number) => <div style={{ textAlign: 'right' }}><Text style={{ fontSize: 12 }}>{fmt(v)}</Text></div>,
    },
    {
      title: <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Text>Amount</Text></div>,
      dataIndex: 'amount', key: 'amount', width: 110,
      render: (v: number) => <div style={{ textAlign: 'right' }}><Text style={{ fontSize: 12 }}>{fmt(v)}</Text></div>,
    },
  ]

  const invoiceDetailsTab = contractDetail ? (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Contract No</Text>
        <Select
          style={{ width: '100%' }}
          options={contractOptions.length > 0 ? contractOptions : [{ value: 'CC-2024-291224848', label: 'CC-2024-291224848' }]}
          value={selectedContract}
          onChange={setSelectedContract}
          showSearch
        />
      </div>

      {/* Contract section */}
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        {/* Contract header */}
        <div style={{ padding: '14px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 700 }}>{contractDetail.title}</Text>
          <LinkOutlined style={{ color: '#1677ff', cursor: 'pointer' }} />
        </div>

        {/* Trips section */}
        <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #f0f0f0' }}>
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
            style={{ fontSize: 12 }}
          />
        </div>

        {/* Other Charges section */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: 600 }}>Other Charges</Text>
            <Text style={{ fontSize: 13, color: '#595959' }}>Other Charges Sub-total: {fmt(contractDetail.otherChargesSubtotal)}</Text>
          </div>
          <Table<OtherChargeRecord>
            columns={otherChargesColumns}
            dataSource={contractDetail.otherCharges}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="small"
          />
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 260 }}>
          <SummaryRow label="Sub Total"  value={fmt(contractDetail.subTotal)} />
          <SummaryRow label="Discount"   value={`- ${fmt(contractDetail.discount)}`} />
          <SummaryRow label="Surcharge"  value={fmt(contractDetail.surcharge)} />
          <Divider style={{ margin: '8px 0' }} />
          <SummaryRow label="Total"      value={fmt(contractDetail.total)} bold />
        </div>
      </div>
    </div>
  ) : null

  /* ── Adjustment Details tab ── */
  const adjustmentColumns = [
    { title: 'Adjustment Type', dataIndex: 'type', key: 'type', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>, width: 180 },
    { title: 'Reason for Adjustment', dataIndex: 'reason', key: 'reason', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text> },
    {
      title: <div style={{ textAlign: 'right' }}>Amount</div>,
      dataIndex: 'amount', key: 'amount', width: 110,
      render: (v: number) => <div style={{ textAlign: 'right' }}><Text style={{ fontSize: 13 }}>{fmt(v)}</Text></div>,
    },
  ]

  const adjTotal = invoice.adjustments.reduce((s, a) => {
    return a.type === 'Additional Payment' ? s + a.amount : s - a.amount
  }, 0)

  const adjustmentTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
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
  )

  /* ── Payment Received tab ── */
  const paymentColumns = [
    { title: 'Payment Date', dataIndex: 'date', key: 'date', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>, width: 130 },
    { title: 'Transaction Reference', dataIndex: 'transactionRef', key: 'transactionRef', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>, width: 180 },
    { title: 'Payment Method', dataIndex: 'method', key: 'method', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>, width: 140 },
    { title: 'Bank Account', dataIndex: 'bankAccount', key: 'bankAccount', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text> },
    {
      title: <div style={{ textAlign: 'right' }}>Amount Received</div>,
      dataIndex: 'amount', key: 'amount', width: 140,
      render: (v: number) => <div style={{ textAlign: 'right' }}><Text style={{ fontSize: 13 }}>{fmt(v)}</Text></div>,
    },
  ]

  const payTotal = invoice.payments.reduce((s, p) => s + p.amount, 0)

  const paymentTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
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
  )

  /* ── Additional Information tab ── */
  const additionalTab = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px 24px' }}>
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
  )

  const tabs = [
    { key: 'basic',      label: 'Basic Information',     children: basicTab },
    { key: 'billing',    label: 'Billing Details',       children: billingTab },
    { key: 'details',    label: 'Invoice Details',       children: invoiceDetailsTab },
    { key: 'adjustment', label: 'Adjustment Details',    children: adjustmentTab },
    { key: 'payment',    label: 'Payment Received',      children: paymentTab },
    { key: 'additional', label: 'Additional Information',children: additionalTab },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Invoice header */}
      <div style={{
        background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10,
        padding: '20px 24px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <Button type="primary" style={{ borderRadius: 6 }}>Log Payment</Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabs}
          style={{ padding: '0 24px' }}
          tabBarStyle={{ marginBottom: 0, borderBottom: '1px solid #f0f0f0' }}
        />
        <div style={{ padding: 24 }}>
          {tabs.find((t) => t.key === activeTab)?.children}
        </div>
      </div>
    </div>
  )
}
