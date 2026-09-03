// MOVE-1975 — Leave listing. One row = one employee.
//
// Built on the listing chrome the rest of the app already uses (Invoice 2.0 /
// Inspection): right-aligned toolbar, a Filter popover behind the funnel icon,
// and a detached pagination card under the table. Nothing here is a new
// pattern; the point is that Leave looks like every other listing.

import { useMemo, useState } from 'react'
import { Typography, Table, Button, Input, Select, DatePicker, Popover, Tag, Tooltip, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { FilterOutlined, LeftOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons'
import {
  DEPARTMENTS,
  HIRING_COMPANIES,
  LEAVE_EMPLOYEES,
  balanceOf,
  fullName,
  isListedOnLeavePage,
  type Department,
  type HiringCompany,
  type LeaveEmployee,
} from './leaveData'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 20, label: '20 / page' },
  { value: 50, label: '50 / page' },
]

/** "26 Aug 2026" — the format every other listing in the app prints. */
const fmtDate = (iso: string) => dayjs(iso).format('DD MMM YYYY')

/**
 * "1 day ago". The other listings store this as a second hard-coded string,
 * which drifts from the date beside it; deriving it means the two cannot
 * disagree.
 */
function agoLabel(iso: string, now: Dayjs): string {
  const then = dayjs(iso)
  const days = now.startOf('day').diff(then.startOf('day'), 'day')
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

/** Detached pagination card, same as Invoice 2.0. */
function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    height: 32,
    padding: '0 6px',
    borderRadius: 6,
    border: `1px solid ${active ? '#1677ff' : '#e8eaed'}`,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    color: active ? '#1677ff' : '#1a1d23',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 10,
        marginTop: 16,
        padding: '13px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 13, color: '#595959' }}>
        You are now viewing Employee {from} – {to} of {total}
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
          <button key={p} onClick={() => onPageChange(p)} style={btnStyle(p === page)}>
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          style={{
            ...btnStyle(false),
            color: '#8c8c8c',
            opacity: page === totalPages ? 0.5 : 1,
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
          }}
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

export default function LeavePage() {
  const [messageApi, contextHolder] = message.useMessage()
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterCompanies, setFilterCompanies] = useState<HiringCompany[]>([])
  const [filterDepartments, setFilterDepartments] = useState<Department[]>([])
  const [lastUpdatedRange, setLastUpdatedRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Fixed per render so every row's "x days ago" is measured from one instant.
  const now = dayjs()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (
      LEAVE_EMPLOYEES
        // Biz req 1 — active contracts only. Terminated, resigned and future
        // employees are in the dataset but never reach the table.
        .filter(isListedOnLeavePage)
        // Biz req 3 — the search bar is a full-text match on Employee alone.
        .filter((e) => (q ? fullName(e).toLowerCase().includes(q) : true))
        .filter((e) => (filterCompanies.length ? e.hiringCompanies.some((c) => filterCompanies.includes(c)) : true))
        .filter((e) => (filterDepartments.length ? filterDepartments.includes(e.department) : true))
        .filter((e) => {
          if (!lastUpdatedRange) return true
          const d = dayjs(e.lastUpdatedOn)
          return (
            d.isAfter(lastUpdatedRange[0].startOf('day')) && d.isBefore(lastUpdatedRange[1].endOf('day'))
          )
        })
        // Biz req 2 — default sort is last updated, newest first. AntD's own
        // sorters take over from here once a column header is clicked.
        .sort((a, b) => b.lastUpdatedOn.localeCompare(a.lastUpdatedOn))
    )
  }, [search, filterCompanies, filterDepartments, lastUpdatedRange])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  /** MOVE-3494 biz req 2 row 6 — a null entitlement reads as a dash. */
  const balanceCell = (days: number | null) =>
    days === null ? (
      <Text style={{ fontSize: 13, color: '#bfbfbf' }}>-</Text>
    ) : (
      <Text style={{ fontSize: 13 }}>
        {days} <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{days === 1 ? 'day' : 'days'}</Text>
      </Text>
    )

  const columns: ColumnsType<LeaveEmployee> = [
    {
      title: 'Employee',
      key: 'employee',
      // Biz req 2 — alphabetical, and MOVE-3416 defines the name as given +
      // family, so that is what sorts.
      sorter: (a, b) => fullName(a).localeCompare(fullName(b)),
      render: (_, rec) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{fullName(rec)}</Text>,
    },
    {
      title: 'Hiring Company',
      key: 'hiringCompany',
      // Biz req 1 — the most recently created contract shows; the rest hide
      // behind "+n", with the full list on hover so nothing is lost.
      sorter: (a, b) => a.hiringCompanies[0].localeCompare(b.hiringCompanies[0]),
      render: (_, rec) => {
        const [first, ...rest] = rec.hiringCompanies
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13 }}>{first}</Text>
            {rest.length > 0 && (
              <Tooltip title={rest.join(', ')}>
                <Tag style={{ fontSize: 11, margin: 0, cursor: 'default' }}>+{rest.length}</Tag>
              </Tooltip>
            )}
          </div>
        )
      },
      width: 210,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      sorter: (a, b) => a.department.localeCompare(b.department),
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 160,
    },
    {
      // Biz req 2 / acceptance criteria — the two balance columns are the ones
      // that deliberately do NOT sort.
      title: 'AL Balance',
      key: 'al',
      render: (_, rec) => balanceCell(balanceOf(rec.annualLeave)),
      width: 120,
    },
    {
      title: 'ML Balance',
      key: 'ml',
      render: (_, rec) => balanceCell(balanceOf(rec.medicalLeave)),
      width: 120,
    },
    {
      title: 'Last Updated On',
      key: 'lastUpdatedOn',
      sorter: (a, b) => a.lastUpdatedOn.localeCompare(b.lastUpdatedOn),
      render: (_, rec) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{fmtDate(rec.lastUpdatedOn)}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{agoLabel(rec.lastUpdatedOn, now)}</Text>
        </div>
      ),
      width: 160,
    },
  ]

  const clearAllFilters = () => {
    setFilterCompanies([])
    setFilterDepartments([])
    setLastUpdatedRange(null)
    setPage(1)
  }

  const filterContent = (
    <div style={{ width: 500 }}>
      <Text style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 16 }}>Filter</Text>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Hiring Company</Text>
          <Select
            mode="multiple"
            placeholder="Select hiring company"
            allowClear
            style={{ width: '100%' }}
            options={HIRING_COMPANIES.map((c) => ({ value: c, label: c }))}
            value={filterCompanies}
            onChange={(v) => {
              setFilterCompanies(v)
              setPage(1)
            }}
            maxTagCount="responsive"
          />
        </div>
        <div>
          <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Department</Text>
          {/* Biz req 3 — this one is the auto-complete search variant. */}
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder="Search department"
            allowClear
            style={{ width: '100%' }}
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
            value={filterDepartments}
            onChange={(v) => {
              setFilterDepartments(v)
              setPage(1)
            }}
            maxTagCount="responsive"
          />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>Last Updated On</Text>
        <RangePicker
          style={{ width: '100%' }}
          value={lastUpdatedRange}
          onChange={(v) => {
            setLastUpdatedRange(v as [Dayjs, Dayjs] | null)
            setPage(1)
          }}
          placeholder={['Start date', 'End date']}
        />
      </div>
      <Button size="small" onClick={clearAllFilters} style={{ borderRadius: 6 }}>
        Clear all filters
      </Button>
    </div>
  )

  const hasFilter = filterCompanies.length > 0 || filterDepartments.length > 0 || !!lastUpdatedRange

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={2} style={{ marginBottom: 20, fontWeight: 700 }}>Leave</Title>

      {/* Toolbar. The date range sits out here rather than in the popover
          because it is the listing's only date field and the reference layout
          keeps "Last Updated On" beside the search. */}
      <div
        style={{
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 13, color: '#1a1a1a', flexShrink: 0 }}>Last Updated On :</Text>
        <RangePicker
          size="small"
          style={{ borderRadius: 6 }}
          value={lastUpdatedRange}
          onChange={(v) => {
            setLastUpdatedRange(v as [Dayjs, Dayjs] | null)
            setPage(1)
          }}
          placeholder={['Start of time', 'End date']}
        />
        <Input
          size="small"
          placeholder="Search Employees"
          style={{ width: 200, borderRadius: 6 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
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
        {/* Biz req 4 — the listing's primary CTA. MOVE-1977 is not built, so
            the button says so rather than opening an empty page. */}
        <Button
          type="primary"
          size="small"
          icon={<SettingOutlined />}
          onClick={() =>
            messageApi.info('Manage Leave Types (MOVE-1977) is not built yet — this listing is MOVE-1975.')
          }
        >
          Manage Leave Types
        </Button>
      </div>

      <div className="leave-table" style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
        <style>{`
          .leave-table .ant-table-thead > tr > th { position: relative; }
          .leave-table .ant-table-thead > tr > th:not(:last-child)::after {
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
        <Table<LeaveEmployee>
          columns={columns}
          dataSource={paged}
          rowKey="id"
          size="middle"
          pagination={false}
          onRow={(rec) => ({
            // Biz req 4 — a row opens the employee's leave profile (MOVE-3494),
            // which is its own ticket and not built here.
            onClick: () =>
              messageApi.info(
                `${fullName(rec)} — Employee Leave Profile (MOVE-3494) is not built yet.`,
              ),
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n)
          setPage(1)
        }}
      />
    </div>
  )
}
