// Epic MOVE-4021 — HR Claims listing. MOVE-3798 (listing, sort, search,
// filters) and MOVE-3797 (highlights as quick filters).
//
// Same listing chrome as Leave (`leave/LeavePage.tsx`): DataTable with its
// toolbar glued on, Filter popover behind the funnel icon, detached
// pagination card. The highlight cards follow Customer Notification's KPI
// cards, the one existing page whose highlights are already quick filters.

import { useMemo, useState } from 'react'
import { Button, DatePicker, Input, Popover, Select, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { FilterOutlined, PlusOutlined } from '@ant-design/icons'
import DataTable from '../common/DataTable'
import PaginationBar from '../leave/PaginationBar'
import { LEAVE_EMPLOYEES, isListedOnLeavePage } from '../leave/leaveData'
import {
  DEPARTMENTS,
  HR_CLAIMS,
  HR_CLAIM_STATUSES,
  HR_CLAIM_TYPES,
  employeeDepartment,
  employeeName,
  formatClaimAmount,
  fullName,
  hrClaimTypeLabel,
  remarksLines,
  type Department,
  type HrClaim,
  type HrClaimStatus,
  type HrClaimType,
} from './hrClaimsData'
import { HrClaimDetailsDrawer, HrClaimStatusTag, SubmitHrClaimDrawer } from './HrClaimDrawers'

const { Text } = Typography
const { RangePicker } = DatePicker

const fmtDate = (iso: string) => dayjs(iso).format('DD MMM YYYY')

function agoLabel(iso: string, now: Dayjs): string {
  const days = now.startOf('day').diff(dayjs(iso).startOf('day'), 'day')
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

const inRange = (iso: string, range: [Dayjs, Dayjs] | null) =>
  !range || (!dayjs(iso).isBefore(range[0].startOf('day')) && !dayjs(iso).isAfter(range[1].endOf('day')))

/** MOVE-3797 — the two highlights, each a quick filter on one status. */
const HIGHLIGHTS: { label: string; status: HrClaimStatus }[] = [
  { label: 'Pending Approval', status: 'Pending Approval' },
  { label: 'Pending Payment', status: 'Pending Payment' },
]

/**
 * MOVE-3798 biz req 2 — alphabetical on Claim No., Claim Type, Employee,
 * Department, Status; chronological on Submission Date and Last Updated On.
 * Remarks and Amount are in neither list, so they don't sort. Applied to the
 * whole filtered list before paging — AntD's own client-side sort would only
 * reorder the rows already on the current page.
 */
type SortKey = 'claimNo' | 'createdOn' | 'type' | 'employee' | 'department' | 'status' | 'lastUpdatedOn'
const SORTERS: Record<SortKey, (a: HrClaim, b: HrClaim) => number> = {
  claimNo: (a, b) => a.claimNo.localeCompare(b.claimNo),
  createdOn: (a, b) => a.createdOn.localeCompare(b.createdOn),
  type: (a, b) => hrClaimTypeLabel(a).localeCompare(hrClaimTypeLabel(b)),
  employee: (a, b) => employeeName(a.employeeId).localeCompare(employeeName(b.employeeId)),
  department: (a, b) => employeeDepartment(a.employeeId).localeCompare(employeeDepartment(b.employeeId)),
  status: (a, b) => a.status.localeCompare(b.status),
  lastUpdatedOn: (a, b) => a.lastUpdatedOn.localeCompare(b.lastUpdatedOn),
}

export default function HrClaimsPage() {
  // Bumped after any mutation of HR_CLAIMS so the derived lists recompute.
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [fEmployees, setFEmployees] = useState<string[]>([])
  const [fDepartments, setFDepartments] = useState<Department[]>([])
  const [fSubmitted, setFSubmitted] = useState<[Dayjs, Dayjs] | null>(null)
  const [fTypes, setFTypes] = useState<HrClaimType[]>([])
  const [fStatuses, setFStatuses] = useState<HrClaimStatus[]>([])
  const [fUpdated, setFUpdated] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState<{ key: SortKey; order: 'ascend' | 'descend' } | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const now = dayjs()
  // MOVE-3798 biz req 3 / MOVE-3799 biz req 2 — "active employees" is
  // Active + Suspended, the same rule Leave's listing applies.
  const activeEmployees = useMemo(() => LEAVE_EMPLOYEES.filter(isListedOnLeavePage), [])

  const counts = useMemo(
    () => Object.fromEntries(HIGHLIGHTS.map((h) => [h.status, HR_CLAIMS.filter((c) => c.status === h.status).length])),
    [version],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (
      HR_CLAIMS
        // Biz req 3 — full-text search over Claim No., Claim Type and Remarks.
        .filter((c) =>
          !q ||
          [c.claimNo, hrClaimTypeLabel(c), ...remarksLines(c)].some((s) => s.toLowerCase().includes(q)),
        )
        .filter((c) => !fEmployees.length || fEmployees.includes(c.employeeId))
        .filter((c) => !fDepartments.length || fDepartments.includes(employeeDepartment(c.employeeId) as Department))
        .filter((c) => inRange(c.createdOn, fSubmitted))
        .filter((c) => !fTypes.length || fTypes.includes(c.type))
        .filter((c) => !fStatuses.length || fStatuses.includes(c.status))
        .filter((c) => inRange(c.lastUpdatedOn, fUpdated))
        // Biz req 2 — default sort is last updated, newest first.
        .sort((a, b) => {
          if (!sort) return b.lastUpdatedOn.localeCompare(a.lastUpdatedOn)
          const d = SORTERS[sort.key](a, b)
          return sort.order === 'ascend' ? d : -d
        })
    )
  }, [search, fEmployees, fDepartments, fSubmitted, fTypes, fStatuses, fUpdated, sort, version])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const resetPage = () => setPage(1)

  /** MOVE-3797 biz req 2 — a highlight overrides every search/filter already applied. */
  const applyHighlight = (status: HrClaimStatus) => {
    setSearch('')
    setFEmployees([])
    setFDepartments([])
    setFSubmitted(null)
    setFTypes([])
    setFUpdated(null)
    setFStatuses([status])
    setPage(1)
  }

  const clearAllFilters = () => {
    setFEmployees([])
    setFDepartments([])
    setFSubmitted(null)
    setFTypes([])
    setFStatuses([])
    resetPage()
  }

  const hasFilter = fEmployees.length + fDepartments.length + fTypes.length + fStatuses.length > 0 || !!fSubmitted
  const activeHighlight =
    fStatuses.length === 1 && !search && !fEmployees.length && !fDepartments.length && !fSubmitted && !fTypes.length && !fUpdated
      ? fStatuses[0]
      : null

  const cell = (v: React.ReactNode) => <Text style={{ fontSize: 13 }}>{v}</Text>
  const sortable = (key: SortKey) => ({ key, sorter: true, sortOrder: sort?.key === key ? sort.order : null })

  const columns: ColumnsType<HrClaim> = [
    {
      title: 'Claim No.',
      dataIndex: 'claimNo',
      width: 120,
      ...sortable('claimNo'),
      render: (v: string) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Submission Date',
      width: 130,
      ...sortable('createdOn'),
      render: (_, c) => cell(fmtDate(c.createdOn)),
    },
    {
      title: 'Claim Type',
      width: 160,
      ...sortable('type'),
      render: (_, c) => cell(hrClaimTypeLabel(c)),
    },
    {
      title: 'Employee',
      width: 160,
      ...sortable('employee'),
      render: (_, c) => cell(employeeName(c.employeeId)),
    },
    {
      title: 'Department',
      width: 140,
      ...sortable('department'),
      render: (_, c) => cell(employeeDepartment(c.employeeId)),
    },
    {
      title: 'Remarks',
      key: 'remarks',
      width: 260,
      render: (_, c) => {
        const lines = remarksLines(c)
        return lines.length ? (
          <Text style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{lines.join('\n')}</Text>
        ) : (
          <Text style={{ fontSize: 13, color: '#bfbfbf' }}>-</Text>
        )
      },
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 100,
      align: 'right',
      render: (_, c) => cell(formatClaimAmount(c.amount)),
    },
    {
      title: 'Status',
      width: 150,
      ...sortable('status'),
      render: (_, c) => <HrClaimStatusTag status={c.status} />,
    },
    {
      title: 'Last Updated On',
      width: 140,
      ...sortable('lastUpdatedOn'),
      render: (_, c) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{fmtDate(c.lastUpdatedOn)}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{agoLabel(c.lastUpdatedOn, now)}</Text>
        </div>
      ),
    },
  ]

  const label = (t: string) => (
    <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>{t}</Text>
  )

  const filterContent = (
    <div style={{ width: 520 }}>
      <Text style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 16 }}>Filter</Text>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          {label('Employee')}
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder="Select employee"
            style={{ width: '100%' }}
            maxTagCount="responsive"
            value={fEmployees}
            onChange={(v) => { setFEmployees(v); resetPage() }}
            options={activeEmployees.map((e) => ({ value: e.id, label: fullName(e) }))}
          />
        </div>
        <div>
          {label('Department')}
          <Select
            mode="multiple"
            allowClear
            placeholder="Select department"
            style={{ width: '100%' }}
            maxTagCount="responsive"
            value={fDepartments}
            onChange={(v) => { setFDepartments(v); resetPage() }}
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          />
        </div>
        <div>
          {label('Claim Type')}
          <Select
            mode="multiple"
            allowClear
            placeholder="Select claim type"
            style={{ width: '100%' }}
            maxTagCount="responsive"
            value={fTypes}
            onChange={(v) => { setFTypes(v); resetPage() }}
            options={HR_CLAIM_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </div>
        <div>
          {label('Status')}
          <Select
            mode="multiple"
            allowClear
            placeholder="Select status"
            style={{ width: '100%' }}
            maxTagCount="responsive"
            value={fStatuses}
            onChange={(v) => { setFStatuses(v); resetPage() }}
            options={HR_CLAIM_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        {label('Submitted On')}
        <RangePicker
          style={{ width: '100%' }}
          value={fSubmitted}
          onChange={(v) => { setFSubmitted(v as [Dayjs, Dayjs] | null); resetPage() }}
          placeholder={['Start date', 'End date']}
        />
      </div>
      <Button size="small" onClick={clearAllFilters} style={{ borderRadius: 6 }}>
        Clear all filters
      </Button>
    </div>
  )

  const selected = selectedId ? HR_CLAIMS.find((c) => c.id === selectedId) ?? null : null
  const changed = (msg: string) => {
    message.success(msg)
    setVersion((v) => v + 1)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16, maxWidth: 720 }}>
        {HIGHLIGHTS.map((h) => {
          const active = activeHighlight === h.status
          return (
            <div
              key={h.status}
              role="button"
              onClick={() => applyHighlight(h.status)}
              style={{
                background: '#fff',
                borderRadius: 8,
                border: `1px solid ${active ? '#1677ff' : '#f0f0f0'}`,
                padding: '20px 24px',
                cursor: 'pointer',
              }}
            >
              <Text style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', display: 'block', lineHeight: 1 }}>
                {counts[h.status]}
              </Text>
              <Text style={{ fontSize: 13, color: active ? '#1677ff' : '#8c8c8c', marginTop: 6, display: 'block' }}>
                {h.label}
              </Text>
            </div>
          )
        })}
      </div>

      <DataTable<HrClaim>
        toolbar={
          <>
            <Text style={{ fontSize: 13, color: '#1a1a1a', flexShrink: 0 }}>Last Updated On :</Text>
            <RangePicker
              size="small"
              style={{ borderRadius: 6 }}
              value={fUpdated}
              onChange={(v) => { setFUpdated(v as [Dayjs, Dayjs] | null); resetPage() }}
              placeholder={['Start of time', 'End date']}
            />
            <Input
              size="small"
              placeholder="Search Claims"
              style={{ width: 222, borderRadius: 6 }}
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
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
            {/* Biz req 4 — the listing's primary CTA. */}
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)}>
              Submit Claim
            </Button>
          </>
        }
        columns={columns}
        dataSource={paged}
        rowKey="id"
        pagination={false}
        scroll={{ x: 1360 }}
        onChange={(_, __, sorter) => {
          const s = Array.isArray(sorter) ? sorter[0] : sorter
          setSort(s?.order ? { key: s.columnKey as SortKey, order: s.order } : null)
          resetPage()
        }}
        onRow={(c) => ({ onClick: () => setSelectedId(c.id), style: { cursor: 'pointer' } })}
      />

      <PaginationBar
        noun="Claim"
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      <SubmitHrClaimDrawer
        open={submitOpen}
        employees={activeEmployees}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={(msg) => {
          setSubmitOpen(false)
          changed(msg)
        }}
      />

      <HrClaimDetailsDrawer claim={selected} onClose={() => setSelectedId(null)} onChanged={changed} />
    </div>
  )
}
