import { useState, useMemo, useEffect } from 'react'
import {
  Typography, Table, Tag, Button, Input, Select, DatePicker, Drawer, Dropdown, Divider, Popover, Tooltip,
} from 'antd'
import type { Dayjs } from 'dayjs'
import {
  FilterOutlined, EyeOutlined, DownOutlined, FileTextOutlined,
  PlusOutlined, PaperClipOutlined, DownloadOutlined, HistoryOutlined,
  LeftOutlined, RightOutlined, ExclamationCircleOutlined, CheckCircleFilled,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { INVOICES, type Invoice, type InvoiceStatus } from './invoiceData'
import { StatusBadge, computeStatusFromBalance, canMarkAsSent, canLogPayment } from './invoiceStatusLogic'
import LogPaymentModal, { type LogPaymentPayload } from './LogPaymentModal'
import type { AppPage } from '@/App'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

function fmt(n: number) {
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color: '#1a1a1a' }}>{value}</Text>
    </div>
  )
}

interface Props {
  onNavigate: (page: AppPage) => void
}

const STATUS_FILTER_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Open', label: 'Open' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Partially Paid', label: 'Partially Paid' },
]

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 20, label: '20 / page' },
  { value: 50, label: '50 / page' },
]

/* Pagination lives in its own card, detached from the table — matches the
   production layout where the table card ends and a separate bordered
   bar carries the "viewing X–Y of Z" summary + page controls. */
function PaginationBar({
  page, pageSize, total, onPageChange, onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (n: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 32, height: 32, padding: '0 6px', borderRadius: 6,
    border: `1px solid ${active ? '#1677ff' : '#e8eaed'}`,
    background: '#fff', cursor: 'pointer', fontSize: 13,
    color: active ? '#1677ff' : '#1a1d23', fontWeight: active ? 600 : 400,
  })

  return (
    <div style={{
      background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10,
      marginTop: 16, padding: '13px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
    }}>
      <Text style={{ fontSize: 13, color: '#595959' }}>
        You are now viewing Invoice {from} – {to} of {total}
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          style={{ ...btnStyle(false), color: '#8c8c8c', opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
        >
          <LeftOutlined style={{ fontSize: 11 }} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onPageChange(p)} style={btnStyle(p === page)}>{p}</button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          style={{ ...btnStyle(false), color: '#8c8c8c', opacity: page === totalPages ? 0.5 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
        >
          <RightOutlined style={{ fontSize: 11 }} />
        </button>
        <Select
          size="small"
          value={pageSize}
          onChange={onPageSizeChange}
          options={PAGE_SIZE_OPTIONS}
          style={{ marginLeft: 8, width: 100 }}
        />
      </div>
    </div>
  )
}

export default function InvoiceTesting2Page({ onNavigate }: Props) {
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterCustomer, setFilterCustomer] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | null>(null)
  const [filterDueDate, setFilterDueDate] = useState<[Dayjs, Dayjs] | null>(null)
  const [lastUpdatedRange, setLastUpdatedRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Local, session-only overrides — this "2.0" page has no backend, so
  // Mark as Sent / Log Payment update state here rather than persisting.
  // Keyed by invoice id so the table, KPI counts, and drawer all stay
  // in sync no matter which row triggered the change.
  interface InvoiceOverride {
    status: InvoiceStatus
    amountReceived: number
    outstandingBalance: number
  }
  const [overrides, setOverrides] = useState<Record<string, InvoiceOverride>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [logPaymentOpen, setLogPaymentOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const effective = (inv: Invoice): Invoice => {
    const o = overrides[inv.id]
    return o ? { ...inv, status: o.status, amountReceived: o.amountReceived, outstandingBalance: o.outstandingBalance } : inv
  }

  const drawerInvoice = useMemo(() => {
    if (!drawerInvoiceId) return null
    const base = INVOICES.find((i) => i.id === drawerInvoiceId)
    return base ? effective(base) : null
  }, [drawerInvoiceId, overrides])

  const customerOptions = useMemo(() => {
    const codes = [...new Set(INVOICES.map((i) => i.customerCode))]
    return codes.map((c) => ({ value: c, label: c }))
  }, [])

  const filtered = useMemo(() => {
    return INVOICES.map(effective).filter((inv) => {
      if (search) {
        const q = search.toLowerCase()
        if (!inv.invoiceNo.toLowerCase().includes(q) &&
            !inv.customerCode.toLowerCase().includes(q) &&
            !inv.contractTitles[0].toLowerCase().includes(q)) return false
      }
      if (filterCustomer && inv.customerCode !== filterCustomer) return false
      if (filterStatus && inv.status !== filterStatus) return false
      if (filterDueDate) {
        const [from, to] = filterDueDate
        const d = new Date(inv.dueDate).getTime()
        if (d < from.startOf('day').valueOf() || d > to.endOf('day').valueOf()) return false
      }
      if (lastUpdatedRange) {
        const [from, to] = lastUpdatedRange
        const d = new Date(inv.lastUpdatedOn).getTime()
        if (d < from.startOf('day').valueOf() || d > to.endOf('day').valueOf()) return false
      }
      return true
    })
  }, [search, filterCustomer, filterStatus, filterDueDate, lastUpdatedRange, overrides])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const effectiveInvoices = useMemo(() => INVOICES.map(effective), [overrides])
  const toSendCount   = effectiveInvoices.filter((i) => i.status === 'Draft').length
  const pendingCount  = effectiveInvoices.filter((i) => i.status === 'Open' || i.status === 'Partially Paid').length
  const overdueCount  = effectiveInvoices.filter((i) => i.status === 'Overdue').length

  const handleConfirmMarkAsSent = () => {
    if (!drawerInvoice) return
    const now = new Date()
    const dueDate = new Date(drawerInvoice.dueDate)
    const nextStatus = computeStatusFromBalance(drawerInvoice.grandTotal, drawerInvoice.outstandingBalance, dueDate, now)
    setOverrides((prev) => ({
      ...prev,
      [drawerInvoice.id]: {
        status: nextStatus,
        amountReceived: drawerInvoice.amountReceived,
        outstandingBalance: drawerInvoice.outstandingBalance,
      },
    }))
    setConfirmOpen(false)
    setToast('Invoice marked as sent')
  }

  const handleLogPayment = (payload: LogPaymentPayload) => {
    if (!drawerInvoice) return
    const now = new Date()
    const newOutstanding = Math.max(0, drawerInvoice.outstandingBalance - payload.amount)
    const newReceived = drawerInvoice.amountReceived + payload.amount
    const dueDate = new Date(drawerInvoice.dueDate)
    const nextStatus = computeStatusFromBalance(drawerInvoice.grandTotal, newOutstanding, dueDate, now)
    setOverrides((prev) => ({
      ...prev,
      [drawerInvoice.id]: {
        status: nextStatus,
        amountReceived: newReceived,
        outstandingBalance: newOutstanding,
      },
    }))
    setToast('Payment logged successfully')
  }

  const ACTIONS_ITEMS = [
    { key: 'sent',   label: 'Mark as Sent',          icon: <FileTextOutlined />, disabled: !drawerInvoice || !canMarkAsSent(drawerInvoice.status), onClick: () => setConfirmOpen(true) },
    { key: 'adjust', label: 'Add Adjustment',        icon: <PlusOutlined /> },
    { key: 'po',     label: 'Attach Purchase Order', icon: <PaperClipOutlined /> },
    { key: 'dl',     label: 'Download',              icon: <DownloadOutlined /> },
    { key: 'hist',   label: 'View Change History',   icon: <HistoryOutlined /> },
  ]

  const logPaymentEnabled = !!drawerInvoice && canLogPayment(drawerInvoice.status)

  const columns: ColumnsType<Invoice> = [
    {
      title: 'Invoice No.',
      dataIndex: 'invoiceNo',
      sorter: (a, b) => a.invoiceNo.localeCompare(b.invoiceNo),
      render: (v: string) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{v}</Text>,
      width: 150,
    },
    {
      title: 'Customer Code',
      dataIndex: 'customerCode',
      sorter: (a, b) => a.customerCode.localeCompare(b.customerCode),
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 130,
    },
    {
      title: 'Contract Title',
      key: 'contractTitle',
      sorter: (a, b) => a.contractTitles[0].localeCompare(b.contractTitles[0]),
      render: (_, rec) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13 }}>{rec.contractTitles[0]}</Text>
          {rec.contractTitles.length > 1 && (
            <Tag style={{ fontSize: 11, margin: 0, borderRadius: 4, padding: '0 6px' }}>
              +{rec.contractTitles.length - 1}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      sorter: (a, b) => a.dueDate.localeCompare(b.dueDate),
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: InvoiceStatus) => <StatusBadge status={v} />,
      width: 130,
    },
    {
      title: 'Last Updated On',
      key: 'lastUpdatedOn',
      sorter: (a, b) => a.lastUpdatedOn.localeCompare(b.lastUpdatedOn),
      render: (_, rec) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{rec.lastUpdatedOn}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{rec.lastUpdatedAgo}</Text>
        </div>
      ),
      width: 160,
    },
  ]

  const clearAllFilters = () => {
    setFilterCustomer(null)
    setFilterStatus(null)
    setFilterDueDate(null)
  }

  const filterContent = (
    <div style={{ width: 500 }}>
      <Text style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 16 }}>Filter</Text>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Customer Code</Text>
          <Select
            placeholder="Select customer"
            allowClear
            style={{ width: '100%' }}
            options={customerOptions}
            value={filterCustomer}
            onChange={(v) => { setFilterCustomer(v ?? null); setPage(1) }}
          />
        </div>
        <div>
          <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Status</Text>
          <Select
            placeholder="Select status"
            allowClear
            style={{ width: '100%' }}
            options={STATUS_FILTER_OPTIONS}
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v ?? null); setPage(1) }}
          />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Due Date</Text>
        <RangePicker
          style={{ width: '100%' }}
          value={filterDueDate}
          onChange={(v) => { setFilterDueDate(v as [Dayjs, Dayjs] | null); setPage(1) }}
          placeholder={['Start date', 'End date']}
        />
      </div>
      <Button
        size="small"
        onClick={clearAllFilters}
        style={{ borderRadius: 6 }}
      >
        Clear all filters
      </Button>
    </div>
  )

  const hasFilter = !!filterCustomer || !!filterStatus || !!filterDueDate || !!lastUpdatedRange

  return (
    <div style={{ padding: 24 }}>
      {/* Title */}
      <Title level={2} style={{ marginBottom: 20, fontWeight: 700 }}>Invoice</Title>

      {/* KPI stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'To Send',         count: toSendCount },
          { label: 'Pending Payment', count: pendingCount },
          { label: 'Overdue',         count: overdueCount },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0',
            padding: '20px 24px',
          }}>
            <Text style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', display: 'block', lineHeight: 1 }}>
              {kpi.count}
            </Text>
            <Text style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6, display: 'block' }}>{kpi.label}</Text>
          </div>
        ))}
      </div>

      {/* Filter row — no card background, floats on the page itself,
          detached from the table below by just a margin. Everything
          (label, date range, search, filter) sits as one right-aligned
          cluster instead of being split to opposite ends. */}
      <div style={{
        padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 12, marginBottom: 16,
      }}>
        <Text style={{ fontSize: 13, color: '#1a1a1a', flexShrink: 0 }}>Last updated on :</Text>
        <RangePicker
          size="small"
          style={{ borderRadius: 6 }}
          value={lastUpdatedRange}
          onChange={(v) => { setLastUpdatedRange(v as [Dayjs, Dayjs] | null); setPage(1) }}
          placeholder={['Start of Date', 'End Date']}
        />
        <Input
          size="small"
          placeholder="Search Invoices"
          style={{ width: 200, borderRadius: 6 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          allowClear
        />
        <Popover
          content={filterContent}
          trigger="click"
          open={filterOpen}
          onOpenChange={setFilterOpen}
          placement="bottomRight"
          arrow={false}
        >
          <Button
            size="small"
            icon={<FilterOutlined />}
            style={{
              borderRadius: 6,
              borderColor: hasFilter ? '#1677ff' : undefined,
              color: hasFilter ? '#1677ff' : undefined,
            }}
          />
        </Popover>
      </div>

      {/* Table card */}
      <div className="invoice2-table" style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
        <style>{`
          .invoice2-table .ant-table-thead > tr > th {
            position: relative;
          }
          .invoice2-table .ant-table-thead > tr > th:not(:last-child)::after {
            content: '';
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 1px;
            height: 18px;
            background: #e8eaed;
          }
        `}</style>
        <Table<Invoice>
          columns={columns}
          dataSource={paged}
          rowKey="id"
          size="middle"
          pagination={false}
          onRow={(rec) => ({
            onClick: () => setDrawerInvoiceId(rec.id),
            style: { cursor: 'pointer' },
          })}
          rowClassName={(rec) => rec.id === drawerInvoiceId ? 'ant-table-row-selected' : ''}
          style={{ borderRadius: 0 }}
        />
      </div>

      {/* Pagination — its own card, detached from the table */}
      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      {/* Quick-view Drawer */}
      <Drawer
        open={!!drawerInvoice}
        onClose={() => setDrawerInvoiceId(null)}
        width={560}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
      >
        {drawerInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Drawer header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  style={{ padding: 0, fontSize: 13 }}
                  onClick={() => {
                    setDrawerInvoiceId(null)
                    onNavigate({ type: 'invoice-detail-testing-2', invoiceId: drawerInvoice.id })
                  }}
                >
                  See full details
                </Button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{drawerInvoice.invoiceNo}</Text>
                  <StatusBadge status={drawerInvoice.status} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Dropdown menu={{ items: ACTIONS_ITEMS }} trigger={['click']}>
                    <Button size="small" style={{ borderRadius: 6 }}>
                      Actions <DownOutlined style={{ fontSize: 10 }} />
                    </Button>
                  </Dropdown>
                  <Tooltip title={logPaymentEnabled ? '' : 'Log Payment is only available once the invoice has been marked as sent'}>
                    <Button
                      size="small"
                      type="primary"
                      style={{ borderRadius: 6 }}
                      disabled={!logPaymentEnabled}
                      onClick={() => setLogPaymentOpen(true)}
                    >
                      Log Payment
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {/* Basic Information */}
              <Text style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 16 }}>Basic Information</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
                <InfoRow label="Customer Code"  value={drawerInvoice.customerCode} />
                <InfoRow label="Billing Company" value={drawerInvoice.billingCompany} />
                <InfoRow label="Invoice Date"   value={drawerInvoice.invoiceDate} />
                <InfoRow label="Due Date"       value={drawerInvoice.dueDate} />
                <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 10 }}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 2 }}>Adjustments</Text>
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>
                    {drawerInvoice.adjustment > 0 ? fmt(drawerInvoice.adjustment) : '-'}
                  </Text>
                </div>
                <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 10 }}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 2 }}>Grand Total</Text>
                  <Text style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{fmt(drawerInvoice.grandTotal)}</Text>
                </div>
                <div>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 2 }}>Amount Received</Text>
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>{fmt(drawerInvoice.amountReceived)}</Text>
                </div>
                <div>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 2 }}>Outstanding Balance</Text>
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmt(drawerInvoice.outstandingBalance)}
                  </Text>
                </div>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* Billing Details */}
              <Text style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 16 }}>Billing Details</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
                <InfoRow label="Company Name" value={drawerInvoice.billingCompanyName} />
                <InfoRow label="Attention"    value={drawerInvoice.attention} />
                <InfoRow label="Email"        value={drawerInvoice.email} />
                <InfoRow label="Email Cc"     value={drawerInvoice.emailCc} />
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* Source Contracts */}
              <Text style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 12 }}>Source Contracts</Text>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '116px 1fr 88px 28px', gap: 8, padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  {['Contract No', 'Contract Title', 'Price', ''].map((h) => (
                    <Text key={h} style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600 }}>{h}</Text>
                  ))}
                </div>
                {drawerInvoice.sourceContracts.map((sc) => (
                  <div key={sc.no} style={{ display: 'grid', gridTemplateColumns: '116px 1fr 88px 28px', gap: 8, padding: '10px 12px', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13 }}>{sc.no}</Text>
                    <Text style={{ fontSize: 13 }}>{sc.title}</Text>
                    <Text style={{ fontSize: 13 }}>{fmt(sc.price)}</Text>
                    <EyeOutlined style={{ color: '#bfbfbf', cursor: 'pointer' }} />
                  </div>
                ))}
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* Additional Information */}
              <Text style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 16 }}>Additional Information</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <div>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 2 }}>Created On</Text>
                  <Text style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{drawerInvoice.createdOn}</Text>
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>1 month ago</Text>
                </div>
                <InfoRow label="Created By"      value={drawerInvoice.createdBy} />
                <div>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 2 }}>Last Updated On</Text>
                  <Text style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{drawerInvoice.lastUpdatedOn}</Text>
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{drawerInvoice.lastUpdatedAgo}</Text>
                </div>
                <InfoRow label="Last Updated By" value={drawerInvoice.lastUpdatedBy} />
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {drawerInvoice && (
        <LogPaymentModal
          open={logPaymentOpen}
          onClose={() => setLogPaymentOpen(false)}
          grandTotal={drawerInvoice.grandTotal}
          outstandingBalance={drawerInvoice.outstandingBalance}
          onSave={handleLogPayment}
        />
      )}

      {/* Mark as Sent confirm modal */}
      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20,
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

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2100,
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
