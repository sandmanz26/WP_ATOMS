// Personal Dashboard (epic MOVE-3412) — Claims details page.
//
// Rebuilt for the 12–13 Oct 2026 rewrite of the Personal Dashboard claims
// tickets, which now point every screen at the HR Claims module (MOVE-4021)
// instead of a model of their own:
//
//   MOVE-3943  Claims Details Page — own claims; plus an 'Approvals' tab for
//              claims approvers (no tabs at all for everyone else).
//   MOVE-3776  Submit Claim — "all fields and logic same as submit claim
//              drawer in claims module (MOVE-3799)… employee field not required".
//   MOVE-3964  Claim Details Drawer — "same details and format as claim details
//              drawer in claims module (MOVE-3801)"; own claim drops the
//              Employee field and gets a Cancel secondary CTA, someone else's
//              gets Approve / Reject under Actions.
//   MOVE-3958  Cancel Submitted Claim — pending approval only, reason required.
//   MOVE-3945  Approve/Reject Submitted Claim — same logic as MOVE-3920.
//
// So the data is `hrclaims/hrClaimsData.ts`'s HR_CLAIMS (MOVE-3943's note:
// own claims include those HR created on the employee's behalf in the claims
// module), and the drawers are the claims module's own, in their 'own' /
// 'approver' variants. The earlier Personal Dashboard claims model
// (`claims/claimsData.ts`: ERP / Taxi Claims types, an 'Approved' status) is
// no longer used here.

import { useMemo, useState } from 'react'
import { Button, Card, DatePicker, Input, Popover, Select, Tabs, Tooltip, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { FilterOutlined, PlusOutlined } from '@ant-design/icons'
import DataTable from '../common/DataTable'
import PaginationBar from '../leave/PaginationBar'
import { LEAVE_EMPLOYEES, isListedOnLeavePage, type LeaveEmployee } from '../leave/leaveData'
import {
  HR_CLAIMS,
  HR_CLAIM_STATUSES,
  HR_CLAIM_TYPES,
  employeeName,
  formatClaimAmount,
  fullName,
  hrClaimTypeLabel,
  remarksLines,
  type HrClaim,
  type HrClaimStatus,
  type HrClaimType,
} from '../hrclaims/hrClaimsData'
import { HrClaimDetailsDrawer, HrClaimStatusTag, SubmitHrClaimDrawer } from '../hrclaims/HrClaimDrawers'
import { claimApproverOf } from '../claims/claimsLogic'

const { Text } = Typography
const { RangePicker } = DatePicker

const fmtDate = (iso: string) => dayjs(iso).format('DD MMM YYYY')

const inRange = (iso: string, range: [Dayjs, Dayjs] | null) =>
  !range || (!dayjs(iso).isBefore(range[0].startOf('day')) && !dayjs(iso).isAfter(range[1].endOf('day')))

/** Claims of employees who have `self` as their claims approver (MOVE-3943 3.1). */
export function claimsApproveeIds(self: LeaveEmployee): string[] {
  const me = fullName(self)
  return LEAVE_EMPLOYEES.filter((e) => e.id !== self.id && claimApproverOf(e) === me).map((e) => e.id)
}

type SortKey = 'employee' | 'claimNo' | 'createdOn' | 'type' | 'status' | 'lastUpdatedOn'
const SORTERS: Record<SortKey, (a: HrClaim, b: HrClaim) => number> = {
  employee: (a, b) => employeeName(a.employeeId).localeCompare(employeeName(b.employeeId)),
  claimNo: (a, b) => a.claimNo.localeCompare(b.claimNo),
  createdOn: (a, b) => a.createdOn.localeCompare(b.createdOn),
  type: (a, b) => hrClaimTypeLabel(a).localeCompare(hrClaimTypeLabel(b)),
  status: (a, b) => a.status.localeCompare(b.status),
  lastUpdatedOn: (a, b) => a.lastUpdatedOn.localeCompare(b.lastUpdatedOn),
}

/**
 * One claims table with its own search / filter / sort / paging state.
 * `withEmployee` = the Approvals table (MOVE-3943 3.2 / 3.3): an Employee
 * column, sortable, and an Employee filter.
 */
function ClaimsTable({
  rows,
  withEmployee,
  primaryAction,
  onOpen,
}: {
  rows: HrClaim[]
  withEmployee: boolean
  primaryAction?: React.ReactNode
  onOpen: (c: HrClaim) => void
}) {
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [fEmployees, setFEmployees] = useState<string[]>([])
  const [fTypes, setFTypes] = useState<HrClaimType[]>([])
  const [fStatuses, setFStatuses] = useState<HrClaimStatus[]>([])
  const [fSubmitted, setFSubmitted] = useState<[Dayjs, Dayjs] | null>(null)
  const [fUpdated, setFUpdated] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState<{ key: SortKey; order: 'ascend' | 'descend' } | null>(null)
  const resetPage = () => setPage(1)

  const employeeOptions = useMemo(() => {
    const ids = new Set(rows.map((r) => r.employeeId))
    // "Names of all active employees" — inactive employees' claims still list, they just can't be filtered by name.
    return LEAVE_EMPLOYEES.filter((e) => ids.has(e.id) && isListedOnLeavePage(e)).map((e) => ({ value: e.id, label: fullName(e) }))
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      // Search: Claim No., Claim Type (incl. the Others text) and Remarks.
      .filter((c) => !q || [c.claimNo, hrClaimTypeLabel(c), ...remarksLines(c)].some((s) => s.toLowerCase().includes(q)))
      .filter((c) => !fEmployees.length || fEmployees.includes(c.employeeId))
      .filter((c) => !fTypes.length || fTypes.includes(c.type))
      .filter((c) => !fStatuses.length || fStatuses.includes(c.status))
      .filter((c) => inRange(c.createdOn, fSubmitted))
      .filter((c) => inRange(c.lastUpdatedOn, fUpdated))
      .sort((a, b) => {
        // Default: last updated, newest first. Sorting runs over the whole
        // filtered list before paging (CLAUDE_SESSION_CONTEXT.md §4.6).
        if (!sort) return b.lastUpdatedOn.localeCompare(a.lastUpdatedOn)
        const d = SORTERS[sort.key](a, b)
        return sort.order === 'ascend' ? d : -d
      })
  }, [rows, search, fEmployees, fTypes, fStatuses, fSubmitted, fUpdated, sort])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const hasFilter = fEmployees.length + fTypes.length + fStatuses.length > 0 || !!fSubmitted

  const cell = (v: React.ReactNode) => <Text style={{ fontSize: 13 }}>{v}</Text>
  const sortable = (key: SortKey) => ({ key, sorter: true, sortOrder: sort?.key === key ? sort.order : null })

  const columns: ColumnsType<HrClaim> = [
    ...(withEmployee
      ? [{ title: 'Employee', width: 150, ...sortable('employee'), render: (_: unknown, c: HrClaim) => cell(employeeName(c.employeeId)) }]
      : []),
    {
      title: 'Claim No.',
      width: 120,
      ...sortable('claimNo'),
      render: (_, c) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{c.claimNo}</Text>,
    },
    { title: 'Submission Date', width: 155, ...sortable('createdOn'), render: (_, c) => cell(fmtDate(c.createdOn)) },
    { title: 'Claim Type', width: 150, ...sortable('type'), render: (_, c) => cell(hrClaimTypeLabel(c)) },
    {
      // MOVE-3943 still lists Remarks (incl. the appended plate / trip), unlike
      // the HR listing, which dropped the column on 14 Oct 2026.
      title: 'Remarks',
      key: 'remarks',
      width: 180,
      // Column-level ellipsis switches the table to fixed layout, so long
      // remarks truncate (full text on hover) instead of widening the table.
      ellipsis: { showTitle: false },
      render: (_, c) => {
        const lines = remarksLines(c)
        return lines.length
          ? <Tooltip title={lines.join(' | ')}><Text style={{ fontSize: 13 }}>{lines.join(' | ')}</Text></Tooltip>
          : <Text style={{ fontSize: 13, color: '#bfbfbf' }}>-</Text>
      },
    },
    { title: 'Amount', key: 'amount', width: 100, align: 'right', render: (_, c) => cell(formatClaimAmount(c.amount)) },
    { title: 'Status', width: 140, ...sortable('status'), render: (_, c) => <HrClaimStatusTag status={c.status} /> },
    { title: 'Last Updated On', width: 155, ...sortable('lastUpdatedOn'), render: (_, c) => cell(fmtDate(c.lastUpdatedOn)) },
  ]

  const label = (t: string) => <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{t}</Text>
  const multi = <T extends string>(value: T[], set: (v: T[]) => void, options: readonly T[] | { value: string; label: string }[]) => (
    <Select
      mode="multiple"
      showSearch
      optionFilterProp="label"
      allowClear
      style={{ width: '100%' }}
      maxTagCount="responsive"
      value={value}
      onChange={(v) => { set(v as T[]); resetPage() }}
      options={(options as (T | { value: string; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))}
    />
  )

  const filterContent = (
    <div style={{ width: 520 }}>
      <Text style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 16 }}>Filter</Text>
      {/* No placeholders inside the filter popover — the label says it all (FIGMA_DESIGN_SYSTEM.md §4.8). */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {withEmployee && <div>{label('Employee')}{multi(fEmployees, setFEmployees, employeeOptions)}</div>}
        <div>{label('Claim Type')}{multi(fTypes, setFTypes, HR_CLAIM_TYPES)}</div>
        <div>{label('Status')}{multi(fStatuses, setFStatuses, HR_CLAIM_STATUSES)}</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        {label('Submitted On')}
        <RangePicker
          style={{ width: '100%' }}
          placeholder={['', '']}
          value={fSubmitted}
          onChange={(v) => { setFSubmitted(v as [Dayjs, Dayjs] | null); resetPage() }}
        />
      </div>
      <Button
        size="small"
        style={{ borderRadius: 6 }}
        onClick={() => { setFEmployees([]); setFTypes([]); setFStatuses([]); setFSubmitted(null); resetPage() }}
      >
        Clear all filters
      </Button>
    </div>
  )

  return (
    <>
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
            <Popover content={filterContent} trigger="click" open={filterOpen} onOpenChange={setFilterOpen} placement="bottomRight" arrow={false}>
              <Button
                size="small"
                icon={<FilterOutlined />}
                style={{ borderRadius: 6, borderColor: hasFilter ? '#1677ff' : undefined, color: hasFilter ? '#1677ff' : undefined }}
              />
            </Popover>
            {primaryAction}
          </>
        }
        columns={columns}
        dataSource={paged}
        rowKey="id"
        pagination={false}
        // Fits the ~1090px body inside the page card; wider screens just stretch.
        scroll={{ x: withEmployee ? 1150 : 1000 }}
        onChange={(_, __, sorter) => {
          const s = Array.isArray(sorter) ? sorter[0] : sorter
          setSort(s?.order ? { key: s.columnKey as SortKey, order: s.order } : null)
          resetPage()
        }}
        onRow={(c) => ({ onClick: () => onOpen(c), style: { cursor: 'pointer' } })}
      />
      {/* MOVE-3943 — max 10 records per page. */}
      <PaginationBar
        noun="Claim"
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />
    </>
  )
}

export default function EmployeePortalClaimsTab({
  self,
  dataRevision = 0,
  onDataChanged,
}: {
  self: LeaveEmployee
  /** Bumped by the page when another tab (e.g. Home) changed claims data. */
  dataRevision?: number
  onDataChanged?: () => void
}) {
  const [version, setVersion] = useState(0)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [viewing, setViewing] = useState<{ id: string; variant: 'own' | 'approver' } | null>(null)
  const [tab, setTab] = useState<'mine' | 'approvals'>('mine')

  const approveeIds = useMemo(() => claimsApproveeIds(self), [self])
  const isApprover = approveeIds.length > 0

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myClaims = useMemo(() => HR_CLAIMS.filter((c) => c.employeeId === self.id), [self.id, version, dataRevision])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const approvalClaims = useMemo(() => HR_CLAIMS.filter((c) => approveeIds.includes(c.employeeId)), [approveeIds, version, dataRevision])

  const changed = (msg: string) => {
    message.success(msg)
    setVersion((v) => v + 1)
    onDataChanged?.()
  }

  const submitButton = (
    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)}>
      Submit Claim
    </Button>
  )

  const mine = (
    <ClaimsTable
      key={`mine-${self.id}`}
      rows={myClaims}
      withEmployee={false}
      primaryAction={submitButton}
      onOpen={(c) => setViewing({ id: c.id, variant: 'own' })}
    />
  )

  const viewingClaim = viewing ? HR_CLAIMS.find((c) => c.id === viewing.id) ?? null : null

  return (
    <div>
      {/* MOVE-3943 2.1 / 3.1 — no tabs unless the user is someone's claims approver. */}
      {isApprover ? (
        <Card styles={{ body: { paddingTop: 4 } }}>
          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as 'mine' | 'approvals')}
            items={[
              { key: 'mine', label: 'My Claims', children: mine },
              {
                key: 'approvals',
                label: 'Approvals',
                children: (
                  <ClaimsTable
                    key={`approvals-${self.id}`}
                    rows={approvalClaims}
                    withEmployee
                    onOpen={(c) => setViewing({ id: c.id, variant: 'approver' })}
                  />
                ),
              },
            ]}
          />
        </Card>
      ) : (
        mine
      )}

      <SubmitHrClaimDrawer
        open={submitOpen}
        employees={[self]}
        selfEmployee={self}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={(msg) => {
          setSubmitOpen(false)
          changed(msg)
        }}
      />

      <HrClaimDetailsDrawer
        claim={viewingClaim}
        variant={viewing?.variant}
        actorName={fullName(self)}
        onClose={() => setViewing(null)}
        onChanged={changed}
      />
    </div>
  )
}
