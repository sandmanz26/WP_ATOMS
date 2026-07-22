import { useState, useMemo } from 'react'
import { Typography, Table, Button, Input, Select, DatePicker, Popover } from 'antd'
import type { Dayjs } from 'dayjs'
import { FilterOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { NOTIFICATIONS, type CustomerNotification, type ContractStatus, type NotificationStatus } from './notificationData'
import { ContractStatusBadge, NotificationStatusBadge } from './notificationStatusLogic'
import type { AppPage } from '@/App'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

interface Props {
  onNavigate: (page: AppPage) => void
}

const CONTRACT_STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Ending', label: 'Ending' },
  { value: 'Ended', label: 'Ended' },
  { value: 'Voided', label: 'Voided' },
]

const NOTIFICATION_STATUS_OPTIONS: { value: NotificationStatus; label: string }[] = [
  { value: 'Pending Assignment', label: 'Pending Assignment' },
  { value: 'Ready to Send', label: 'Ready to Send' },
  { value: 'Partially Sent', label: 'Partially Sent' },
  { value: 'Completed', label: 'Completed' },
]

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 20, label: '20 / page' },
  { value: 50, label: '50 / page' },
]

/* Pagination lives in its own card, detached from the table — same
   pattern as InvoiceTesting2Page.tsx's PaginationBar. */
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
        You are now viewing Notification {from} – {to} of {total}
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

export default function CustomerNotificationPage({ onNavigate }: Props) {
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterCustomer, setFilterCustomer] = useState<string | null>(null)
  const [filterContractPeriod, setFilterContractPeriod] = useState<[Dayjs, Dayjs] | null>(null)
  const [filterContractStatus, setFilterContractStatus] = useState<ContractStatus | null>(null)
  const [filterNotificationStatus, setFilterNotificationStatus] = useState<NotificationStatus | null>(null)
  const [lastUpdatedRange, setLastUpdatedRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const customerOptions = useMemo(() => {
    const codes = [...new Set(NOTIFICATIONS.map((n) => n.customerCode))]
    return codes.map((c) => ({ value: c, label: c }))
  }, [])

  const filtered = useMemo(() => {
    return NOTIFICATIONS.filter((n) => {
      if (search) {
        const q = search.toLowerCase()
        if (!n.contractNo.toLowerCase().includes(q) &&
            !n.customerCode.toLowerCase().includes(q) &&
            !n.contractTitle.toLowerCase().includes(q)) return false
      }
      if (filterCustomer && n.customerCode !== filterCustomer) return false
      if (filterContractStatus && n.contractStatus !== filterContractStatus) return false
      if (filterNotificationStatus && n.notificationStatus !== filterNotificationStatus) return false
      if (lastUpdatedRange) {
        const [from, to] = lastUpdatedRange
        const d = new Date(n.lastUpdatedOn).getTime()
        if (d < from.startOf('day').valueOf() || d > to.endOf('day').valueOf()) return false
      }
      return true
    })
  }, [search, filterCustomer, filterContractStatus, filterNotificationStatus, lastUpdatedRange])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const pendingAssignmentCount = NOTIFICATIONS.filter((n) => n.notificationStatus === 'Pending Assignment').length
  const toSendCount = NOTIFICATIONS.filter((n) => n.notificationStatus === 'Ready to Send').length

  const columns: ColumnsType<CustomerNotification> = [
    {
      title: 'Contract No.',
      dataIndex: 'contractNo',
      sorter: (a, b) => a.contractNo.localeCompare(b.contractNo),
      render: (v: string) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{v}</Text>,
      width: 140,
    },
    {
      title: 'Customer Code',
      dataIndex: 'customerCode',
      sorter: (a, b) => a.customerCode.localeCompare(b.customerCode),
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 130,
    },
    {
      title: 'Contract Period',
      dataIndex: 'contractPeriod',
      sorter: (a, b) => a.contractPeriod.localeCompare(b.contractPeriod),
      render: (v: string) => <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{v}</Text>,
      width: 190,
    },
    {
      title: 'Contract Title',
      dataIndex: 'contractTitle',
      sorter: (a, b) => a.contractTitle.localeCompare(b.contractTitle),
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Contract Status',
      dataIndex: 'contractStatus',
      sorter: (a, b) => a.contractStatus.localeCompare(b.contractStatus),
      render: (v: ContractStatus) => <ContractStatusBadge status={v} />,
      width: 130,
    },
    {
      title: 'Notification Status',
      dataIndex: 'notificationStatus',
      sorter: (a, b) => a.notificationStatus.localeCompare(b.notificationStatus),
      render: (v: NotificationStatus) => <NotificationStatusBadge status={v} />,
      width: 170,
    },
    {
      title: 'Progress',
      key: 'progress',
      sorter: (a, b) => (a.sentCount / a.totalCount) - (b.sentCount / b.totalCount),
      render: (_, rec) => <Text style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{rec.sentCount}/{rec.totalCount}</Text>,
      width: 90,
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
    setFilterContractPeriod(null)
    setFilterContractStatus(null)
    setFilterNotificationStatus(null)
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
          <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Contract Period</Text>
          <RangePicker
            style={{ width: '100%' }}
            value={filterContractPeriod}
            onChange={(v) => { setFilterContractPeriod(v as [Dayjs, Dayjs] | null); setPage(1) }}
            placeholder={['Start date', 'End date']}
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Contract Status</Text>
          <Select
            placeholder="Select status"
            allowClear
            style={{ width: '100%' }}
            options={CONTRACT_STATUS_OPTIONS}
            value={filterContractStatus}
            onChange={(v) => { setFilterContractStatus(v ?? null); setPage(1) }}
          />
        </div>
        <div>
          <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Notification Status</Text>
          <Select
            placeholder="Select status"
            allowClear
            style={{ width: '100%' }}
            options={NOTIFICATION_STATUS_OPTIONS}
            value={filterNotificationStatus}
            onChange={(v) => { setFilterNotificationStatus(v ?? null); setPage(1) }}
          />
        </div>
      </div>
      <Button size="small" onClick={clearAllFilters} style={{ borderRadius: 6 }}>
        Clear all filters
      </Button>
    </div>
  )

  const hasFilter = !!filterCustomer || !!filterContractPeriod || !!filterContractStatus || !!filterNotificationStatus || !!lastUpdatedRange

  return (
    <div style={{ padding: 24 }}>
      {/* Title */}
      <Title level={2} style={{ marginBottom: 20, fontWeight: 700 }}>Customer Notifications</Title>

      {/* KPI stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20, maxWidth: 720 }}>
        {[
          { label: 'Pending Assignment', count: pendingAssignmentCount },
          { label: 'To Send',            count: toSendCount },
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

      {/* Filter row — no card background, floats on the page itself, one
          right-aligned cluster, detached from the table below. */}
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
          placeholder="Search Customer Notification"
          style={{ width: 230, borderRadius: 6 }}
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
      <div className="notif-table" style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
        <style>{`
          .notif-table .ant-table-thead > tr > th {
            position: relative;
          }
          .notif-table .ant-table-thead > tr > th:not(:last-child)::after {
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
        <Table<CustomerNotification>
          columns={columns}
          dataSource={paged}
          rowKey="id"
          size="middle"
          pagination={false}
          onRow={(rec) => ({
            onClick: () => onNavigate({ type: 'customer-notification-detail', notificationId: rec.id }),
            style: { cursor: 'pointer' },
          })}
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
    </div>
  )
}
