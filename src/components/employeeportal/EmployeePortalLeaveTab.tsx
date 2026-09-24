// Personal Dashboard (epic MOVE-3412) — Leave tab.
//
// Independent of `personaldashboard/PersonalDashboardLeaveTab.tsx` and of
// `leave/LeaveApplicationDrawers.tsx` — see the header note in
// `EmployeePortalLeaveDrawers.tsx` for why. This file only reuses the
// business-rule engine (`leave/leaveData.ts`, `leave/leaveLogic.ts`), not any
// UI component from either earlier build.
//
//   MOVE-3947  View Leave Applications (Leave Tab)
//   MOVE-3948  View Leave Balances (Leave Tab)
//   MOVE-3952  Approve/Reject Leave Applications (For Approvers) — the
//              "Pending My Approval" section

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, Empty, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import {
  LEAVE_APPLICATIONS,
  LEAVE_EMPLOYEES,
  LEAVE_TYPES,
  fullName,
  type LeaveApplication,
  type LeaveEmployee,
  type LeaveStatus,
} from '../leave/leaveData'
import { balancesFor, formatDays, formatEntitlement, formatValidity, type BalanceRow } from '../leave/leaveLogic'
import { CreateLeaveApplicationDrawer, LeaveApplicationDetailsDrawer, LeaveStatusTag } from './EmployeePortalLeaveDrawers'

const { Text } = Typography

// MOVE-3412's tickets do not say which employee is signed in — there is no
// login in this prototype — so "self" is fixed to one seed employee who has
// both her own applications and applications pending on her approval, giving
// both halves of this tab something real to show.
const SELF_ID = 'lv-3'

const STATUS_OPTIONS: LeaveStatus[] = ['Pending Approval', 'Approved', 'Rejected', 'Cancelled']

interface Filters {
  leaveTypeIds: string[]
  statuses: LeaveStatus[]
}

export default function EmployeePortalLeaveTab() {
  const [revision, setRevision] = useState(0)
  const bump = () => setRevision((r) => r + 1)

  const self = LEAVE_EMPLOYEES.find((e) => e.id === SELF_ID) as LeaveEmployee

  const [balanceYear, setBalanceYear] = useState<'this' | 'next'>('this')
  const [filters, setFilters] = useState<Filters>({ leaveTypeIds: [], statuses: [] })
  const [applyOpen, setApplyOpen] = useState(false)
  const [viewing, setViewing] = useState<LeaveApplication | null>(null)
  const [viewingCanDecide, setViewingCanDecide] = useState(false)

  const thisYear = dayjs().year()
  const year = balanceYear === 'this' ? thisYear : thisYear + 1

  // ---------------------------------------------------------------------
  // MOVE-3947 — leave application history
  // ---------------------------------------------------------------------
  const myApplications = useMemo(() => {
    return LEAVE_APPLICATIONS
      .filter((a) => a.employeeId === self.id)
      .filter((a) => filters.leaveTypeIds.length === 0 || filters.leaveTypeIds.includes(a.leaveTypeId))
      .filter((a) => filters.statuses.length === 0 || filters.statuses.includes(a.status))
      // MOVE-3947 biz req 2 — default sort by applied on, newest to oldest.
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.id, filters, revision])

  const applicationColumns: ColumnsType<LeaveApplication> = [
    {
      title: 'Leave Type',
      key: 'leaveType',
      render: (_, a) => LEAVE_TYPES.find((t) => t.id === a.leaveTypeId)?.name ?? a.leaveTypeId,
    },
    {
      title: 'Leave Application Period',
      key: 'period',
      render: (_, a) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>
            {dayjs(a.startDate).format('D MMM YYYY')} - {dayjs(a.endDate).format('D MMM YYYY')}
          </Text>
          {a.leaveTypeId === 'lt-timeoff' && a.startTime && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(a.startTime, 'HH:mm').format('h:mm A')} - {dayjs(a.endTime, 'HH:mm').format('h:mm A')}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Days Used',
      key: 'days',
      align: 'right',
      render: (_, a) => (a.leaveTypeId === 'lt-timeoff' ? '-' : formatDays(a.days)),
    },
    {
      title: 'Applied On',
      key: 'appliedOn',
      render: (_, a) => dayjs(a.appliedOn).format('D MMM YYYY'),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, a) => <LeaveStatusTag status={a.status} />,
    },
  ]

  // ---------------------------------------------------------------------
  // MOVE-3948 — leave balances
  // ---------------------------------------------------------------------
  const balances = useMemo(() => balancesFor(self, year), [self, year, revision])

  const balanceColumns: ColumnsType<BalanceRow> = [
    { title: 'Leave Type', key: 'leaveType', render: (_, r) => r.leaveType.name },
    { title: 'Validity Period', key: 'validity', render: (_, r) => formatValidity(r.validity) },
    { title: 'Entitlement', key: 'entitlement', render: (_, r) => formatEntitlement(r, self) },
    { title: 'Used', key: 'used', align: 'right', render: (_, r) => formatDays(r.usedDays) },
    { title: 'Pending Approval', key: 'pending', align: 'right', render: (_, r) => formatDays(r.pendingDays) },
    {
      title: 'Remaining',
      key: 'remaining',
      align: 'right',
      render: (_, r) => (
        <Text strong style={{ color: r.balance !== null && r.balance < 0 ? '#cf1322' : undefined }}>
          {formatDays(r.balance)}
        </Text>
      ),
    },
  ]

  // ---------------------------------------------------------------------
  // MOVE-3952 — pending my approval
  // ---------------------------------------------------------------------
  const pendingMyApproval = useMemo(() => {
    return LEAVE_APPLICATIONS
      .filter((a) => a.status === 'Pending Approval')
      .filter((a) => {
        const applicant = LEAVE_EMPLOYEES.find((e) => e.id === a.employeeId)
        return applicant && applicant.leaveApprover === fullName(self)
      })
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self, revision])

  const pendingColumns: ColumnsType<LeaveApplication> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, a) => {
        const applicant = LEAVE_EMPLOYEES.find((e) => e.id === a.employeeId)
        return applicant ? fullName(applicant) : a.employeeId
      },
    },
    {
      title: 'Leave Type',
      key: 'leaveType',
      render: (_, a) => LEAVE_TYPES.find((t) => t.id === a.leaveTypeId)?.name ?? a.leaveTypeId,
    },
    {
      title: 'Leave Application Period',
      key: 'period',
      render: (_, a) => `${dayjs(a.startDate).format('D MMM YYYY')} - ${dayjs(a.endDate).format('D MMM YYYY')}`,
    },
    {
      title: 'Days Used',
      key: 'days',
      align: 'right',
      render: (_, a) => (a.leaveTypeId === 'lt-timeoff' ? '-' : formatDays(a.days)),
    },
    {
      title: 'Applied On',
      key: 'appliedOn',
      render: (_, a) => dayjs(a.appliedOn).format('D MMM YYYY'),
    },
    {
      title: '',
      key: 'action',
      render: (_, a) => (
        <Button size="small" onClick={() => { setViewingCanDecide(true); setViewing(a) }}>
          Review
        </Button>
      ),
    },
  ]

  const openMyApplication = (a: LeaveApplication) => {
    setViewingCanDecide(false)
    setViewing(a)
  }

  return (
    <div>
      <Card
        title="Leave Applications"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setApplyOpen(true)}>Apply for Leave</Button>}
        style={{ marginBottom: 20 }}
      >
        <Space wrap style={{ marginBottom: 14 }}>
          <Select
            mode="multiple"
            allowClear
            placeholder="Leave Type"
            style={{ minWidth: 220 }}
            options={LEAVE_TYPES.map((t) => ({ value: t.id, label: t.name }))}
            value={filters.leaveTypeIds}
            onChange={(v) => setFilters((f) => ({ ...f, leaveTypeIds: v }))}
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Status"
            style={{ minWidth: 200 }}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            value={filters.statuses}
            onChange={(v) => setFilters((f) => ({ ...f, statuses: v }))}
          />
        </Space>
        <Table<LeaveApplication>
          columns={applicationColumns}
          dataSource={myApplications}
          rowKey="id"
          pagination={false}
          onRow={(a) => ({ onClick: () => openMyApplication(a), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leave applications." /> }}
        />
      </Card>

      <Card
        title="Leave Balances"
        extra={
          <Segmented
            value={balanceYear}
            onChange={(v) => setBalanceYear(v as 'this' | 'next')}
            options={[{ label: `${thisYear}`, value: 'this' }, { label: `${thisYear + 1}`, value: 'next' }]}
          />
        }
        style={{ marginBottom: 20 }}
      >
        <Table<BalanceRow>
          columns={balanceColumns}
          dataSource={balances}
          rowKey={(r) => r.leaveType.id}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No eligible leave types." /> }}
        />
      </Card>

      <Card title={<Space>Pending My Approval <Tag>{pendingMyApproval.length}</Tag></Space>}>
        <Table<LeaveApplication>
          columns={pendingColumns}
          dataSource={pendingMyApproval}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing waiting on your approval." /> }}
        />
      </Card>

      <CreateLeaveApplicationDrawer
        open={applyOpen}
        employee={self}
        year={thisYear}
        onClose={() => setApplyOpen(false)}
        onCreated={() => { setApplyOpen(false); bump() }}
      />

      <LeaveApplicationDetailsDrawer
        application={viewing}
        employee={
          viewing ? (LEAVE_EMPLOYEES.find((e) => e.id === viewing.employeeId) as LeaveEmployee) : self
        }
        canDecide={viewingCanDecide}
        onClose={() => setViewing(null)}
        onChanged={() => { setViewing(null); bump() }}
      />
    </div>
  )
}
