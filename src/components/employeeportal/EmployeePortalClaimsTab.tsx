// Personal Dashboard (epic MOVE-3412) — Claims tab.
//
// Independent of `personaldashboard/PersonalDashboardLeaveTab.tsx` and of
// any HR-side claims UI — same isolation rule as the Leave tab next to this
// file. Only `claims/claimsData.ts` and `claims/claimsLogic.ts` (data +
// business rules, no UI) are shared.
//
//   MOVE-3943  Submitted Claims Listing (Tab) — "My Claims" / "Pending My
//              Approval" sub-tabs, each sorted and filtered independently

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, DatePicker, Empty, Input, Select, Space, Table, Tabs, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { DEPARTMENTS, LEAVE_EMPLOYEES, fullName, type LeaveEmployee } from '../leave/leaveData'
import {
  CLAIM_CATEGORIES,
  CLAIM_SUBMISSIONS,
  claimTypeLabel,
  formatAmount,
  type ClaimCategory,
  type ClaimStatus,
  type ClaimSubmission,
} from '../claims/claimsData'
import { CreateClaimDrawer, ClaimDetailsDrawer, ClaimStatusTag } from './EmployeePortalClaimsDrawers'
import { PORTAL_SELF_ID } from './employeePortalIdentity'

const { RangePicker } = DatePicker

const STATUS_OPTIONS: ClaimStatus[] = ['Pending Approval', 'Approved', 'Rejected', 'Paid', 'Cancelled']

interface MyClaimsFilters {
  categories: ClaimCategory[]
  statuses: ClaimStatus[]
  appliedRange: [string, string] | null
  search: string
}

interface PendingFilters extends MyClaimsFilters {
  employeeIds: string[]
  departments: string[]
}

const EMPTY_MY: MyClaimsFilters = { categories: [], statuses: [], appliedRange: null, search: '' }
const EMPTY_PENDING: PendingFilters = { ...EMPTY_MY, employeeIds: [], departments: [] }

function matchesCommon(c: ClaimSubmission, f: MyClaimsFilters, employee: LeaveEmployee | undefined): boolean {
  if (f.categories.length > 0 && !f.categories.includes(c.category)) return false
  if (f.statuses.length > 0 && !f.statuses.includes(c.status)) return false
  if (f.appliedRange) {
    const applied = dayjs(c.appliedOn)
    if (applied.isBefore(dayjs(f.appliedRange[0]), 'day') || applied.isAfter(dayjs(f.appliedRange[1]), 'day')) return false
  }
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase()
    const haystack = `${claimTypeLabel(c)} ${c.remarks ?? ''} ${employee ? fullName(employee) : ''}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

export default function EmployeePortalClaimsTab() {
  const [revision, setRevision] = useState(0)
  const bump = () => setRevision((r) => r + 1)

  const self = LEAVE_EMPLOYEES.find((e) => e.id === PORTAL_SELF_ID) as LeaveEmployee

  const [myFilters, setMyFilters] = useState<MyClaimsFilters>(EMPTY_MY)
  const [pendingFilters, setPendingFilters] = useState<PendingFilters>(EMPTY_PENDING)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewing, setViewing] = useState<ClaimSubmission | null>(null)
  const [viewingCanDecide, setViewingCanDecide] = useState(false)

  const myClaims = useMemo(
    () => CLAIM_SUBMISSIONS.filter((c) => c.employeeId === self.id && matchesCommon(c, myFilters, self)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [self.id, myFilters, revision],
  )

  const pendingMyApproval = useMemo(() => {
    return CLAIM_SUBMISSIONS.filter((c) => {
      if (c.status !== 'Pending Approval') return false
      const applicant = LEAVE_EMPLOYEES.find((e) => e.id === c.employeeId)
      if (!applicant || applicant.leaveApprover !== fullName(self)) return false
      if (pendingFilters.employeeIds.length > 0 && !pendingFilters.employeeIds.includes(applicant.id)) return false
      if (pendingFilters.departments.length > 0 && !pendingFilters.departments.includes(applicant.department)) return false
      return matchesCommon(c, pendingFilters, applicant)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self, pendingFilters, revision])

  const openMyClaim = (c: ClaimSubmission) => { setViewingCanDecide(false); setViewing(c) }
  const openForApproval = (c: ClaimSubmission) => { setViewingCanDecide(true); setViewing(c) }

  const myColumns: ColumnsType<ClaimSubmission> = [
    { title: 'Claims Type', key: 'type', render: (_, c) => claimTypeLabel(c) },
    {
      title: 'Applied On', key: 'appliedOn',
      sorter: (a, b) => a.appliedOn.localeCompare(b.appliedOn),
      render: (_, c) => dayjs(c.appliedOn).format('D MMM YYYY'),
    },
    { title: 'Claim Amount', key: 'amount', align: 'right', render: (_, c) => formatAmount(c.amount) },
    { title: 'Remarks', key: 'remarks', render: (_, c) => c.remarks || '-' },
    {
      title: 'Status', key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (_, c) => <ClaimStatusTag status={c.status} />,
    },
    {
      title: 'Last Updated On', key: 'lastUpdatedOn',
      sorter: (a, b) => a.lastUpdatedOn.localeCompare(b.lastUpdatedOn),
      defaultSortOrder: 'descend',
      render: (_, c) => dayjs(c.lastUpdatedOn).format('D MMM YYYY, h:mm A'),
    },
  ]

  const pendingColumns: ColumnsType<ClaimSubmission> = [
    {
      title: 'Employee', key: 'employee',
      render: (_, c) => {
        const applicant = LEAVE_EMPLOYEES.find((e) => e.id === c.employeeId)
        return applicant ? fullName(applicant) : c.employeeId
      },
    },
    {
      title: 'Department', key: 'department',
      render: (_, c) => LEAVE_EMPLOYEES.find((e) => e.id === c.employeeId)?.department ?? '-',
    },
    {
      title: 'Applied On', key: 'appliedOn',
      sorter: (a, b) => a.appliedOn.localeCompare(b.appliedOn),
      render: (_, c) => dayjs(c.appliedOn).format('D MMM YYYY'),
    },
    { title: 'Claims Type', key: 'type', render: (_, c) => claimTypeLabel(c) },
    { title: 'Amount', key: 'amount', align: 'right', render: (_, c) => formatAmount(c.amount) },
    { title: 'Remarks', key: 'remarks', render: (_, c) => c.remarks || '-' },
    {
      title: 'Last Updated On', key: 'lastUpdatedOn',
      sorter: (a, b) => a.lastUpdatedOn.localeCompare(b.lastUpdatedOn),
      defaultSortOrder: 'descend',
      render: (_, c) => dayjs(c.lastUpdatedOn).format('D MMM YYYY, h:mm A'),
    },
    {
      title: '', key: 'action',
      render: (_, c) => <Button size="small" onClick={() => openForApproval(c)}>Review</Button>,
    },
  ]

  return (
    <div>
      <Card
        title="Claims"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Submit Claim</Button>}
      >
        <Tabs
          defaultActiveKey="my-claims"
          items={[
            {
              key: 'my-claims',
              label: 'My Claims',
              children: (
                <div>
                  <Space wrap style={{ marginBottom: 14 }}>
                    <Input
                      placeholder="Search Claims"
                      prefix={<SearchOutlined />}
                      allowClear
                      style={{ width: 220 }}
                      value={myFilters.search}
                      onChange={(e) => setMyFilters((f) => ({ ...f, search: e.target.value }))}
                    />
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="Claim Type"
                      style={{ minWidth: 180 }}
                      options={CLAIM_CATEGORIES.map((c) => ({ value: c, label: c }))}
                      value={myFilters.categories}
                      onChange={(v) => setMyFilters((f) => ({ ...f, categories: v }))}
                    />
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="Status"
                      style={{ minWidth: 200 }}
                      options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                      value={myFilters.statuses}
                      onChange={(v) => setMyFilters((f) => ({ ...f, statuses: v }))}
                    />
                    <RangePicker
                      placeholder={['Applied From', 'Applied To']}
                      onChange={(_, strs) => setMyFilters((f) => ({ ...f, appliedRange: strs[0] && strs[1] ? [strs[0], strs[1]] : null }))}
                    />
                  </Space>
                  <Table<ClaimSubmission>
                    columns={myColumns}
                    dataSource={myClaims}
                    rowKey="id"
                    pagination={false}
                    onRow={(c) => ({ onClick: () => openMyClaim(c), style: { cursor: 'pointer' } })}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No claims submitted." /> }}
                  />
                </div>
              ),
            },
            {
              key: 'pending',
              label: <Space>Pending My Approval <Tag>{pendingMyApproval.length}</Tag></Space>,
              children: (
                <div>
                  <Space wrap style={{ marginBottom: 14 }}>
                    <Input
                      placeholder="Search Claims"
                      prefix={<SearchOutlined />}
                      allowClear
                      style={{ width: 220 }}
                      value={pendingFilters.search}
                      onChange={(e) => setPendingFilters((f) => ({ ...f, search: e.target.value }))}
                    />
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="Employee"
                      style={{ minWidth: 180 }}
                      options={LEAVE_EMPLOYEES.map((e) => ({ value: e.id, label: fullName(e) }))}
                      value={pendingFilters.employeeIds}
                      onChange={(v) => setPendingFilters((f) => ({ ...f, employeeIds: v }))}
                    />
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="Department"
                      style={{ minWidth: 180 }}
                      options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                      value={pendingFilters.departments}
                      onChange={(v) => setPendingFilters((f) => ({ ...f, departments: v }))}
                    />
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="Claim Type"
                      style={{ minWidth: 160 }}
                      options={CLAIM_CATEGORIES.map((c) => ({ value: c, label: c }))}
                      value={pendingFilters.categories}
                      onChange={(v) => setPendingFilters((f) => ({ ...f, categories: v }))}
                    />
                    <RangePicker
                      placeholder={['Applied From', 'Applied To']}
                      onChange={(_, strs) => setPendingFilters((f) => ({ ...f, appliedRange: strs[0] && strs[1] ? [strs[0], strs[1]] : null }))}
                    />
                  </Space>
                  <Table<ClaimSubmission>
                    columns={pendingColumns}
                    dataSource={pendingMyApproval}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing waiting on your approval." /> }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      <CreateClaimDrawer
        open={createOpen}
        employee={self}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); bump() }}
      />

      <ClaimDetailsDrawer
        claim={viewing}
        employee={viewing ? (LEAVE_EMPLOYEES.find((e) => e.id === viewing.employeeId) as LeaveEmployee) : self}
        canDecide={viewingCanDecide}
        onClose={() => setViewing(null)}
        onChanged={() => { setViewing(null); bump() }}
      />
    </div>
  )
}
