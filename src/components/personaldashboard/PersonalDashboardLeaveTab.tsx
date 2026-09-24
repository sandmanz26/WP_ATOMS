// Personal Dashboard — Leave tab, under epic MOVE-3412 (WLA: HR - Personal
// Dashboard). This is the WEB self-service view: an employee looking at their
// *own* leave, as opposed to MOVE-3494/LeaveProfilePage where HR looks at
// someone else's. It sits alongside (not on top of) the driver mobile app
// built for MOVE-4113 — different epic, different surface, both real.
//
//   MOVE-3946  Create Leave Application (Drawer)      — "same as MOVE-3777"
//   MOVE-3947  View Leave Applications (Leave Tab)
//   MOVE-3948  View Leave Balances (Leave Tab)
//   MOVE-3950  Cancel Leave Application                — "same as MOVE-3779"
//   MOVE-3952  Approve/Reject Leave Applications (For Approvers)
//   MOVE-3956  Auto-approve Leave Applications (if Leave Approver = N/A)
//   MOVE-3965  Leave Application Details Drawer         — "same as MOVE-3889"
//
// MOVE-3946/3950/3965 each say, in as many words, that they are the same
// fields and the same logic as the HR module's equivalents. So this file does
// not reimplement Apply / Cancel / Approve / Reject / the details drawer at
// all — it reuses `ApplyLeaveDrawer` and `LeaveApplicationDrawer` from
// `leaveData`'s sibling module directly. What is actually new here is the
// self-service framing: which employee is "me", the Leave Tab's own two
// tables (their columns and filters differ from the HR page's), and the
// "Pending My Approval" section MOVE-3952 asks for — the same drawer, opened
// against someone else's application.

import { useMemo, useState } from 'react'
import { Button, DatePicker, Empty, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { PlusOutlined } from '@ant-design/icons'
import {
  LEAVE_APPLICATIONS,
  LEAVE_EMPLOYEES,
  LEAVE_TYPES,
  fullName,
  type LeaveApplication,
  type LeaveStatus,
} from '../leave/leaveData'
import { balancesFor, formatDays, formatEntitlement, formatValidity, leaveTypeById, type BalanceRow } from '../leave/leaveLogic'
import { ApplyLeaveDrawer, LeaveApplicationDrawer, StatusTag } from '../leave/LeaveApplicationDrawers'

const { Text, Title } = Typography

// MOVE-3947/3948 §"Permissions" note the same "manage own dashboard"
// restriction repeated on every ticket in this epic: this page can only ever
// be one employee's own view. Citra Dewi (lv-3) is who "I" am here — she
// carries her own applications and balances *and* is the leave approver for
// five other employees, so both halves of the page (My Leave, Pending My
// Approval) have something real to show without inventing a new record.
const SELF_ID = 'lv-3'

const STATUS_OPTIONS: { value: LeaveStatus; label: string }[] = [
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Cancelled', label: 'Cancelled' },
]

function SectionCard({
  title,
  subtitle,
  extra,
  children,
}: {
  title: string
  subtitle?: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div>
          <Text strong style={{ fontSize: 14 }}>{title}</Text>
          {subtitle && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{subtitle}</Text>}
        </div>
        {extra}
      </div>
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

export default function PersonalDashboardLeaveTab() {
  const self = LEAVE_EMPLOYEES.find((e) => e.id === SELF_ID)!
  const selfName = fullName(self)

  const [revision, setRevision] = useState(0)
  const [applyOpen, setApplyOpen] = useState(false)
  const [openAppId, setOpenAppId] = useState<string | null>(null)
  const [openApprovalId, setOpenApprovalId] = useState<string | null>(null)
  const [year, setYear] = useState(dayjs().year())
  const thisYear = dayjs().year()

  // MOVE-3947 §3 — the applications table's own filters.
  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<LeaveStatus[]>([])
  const [periodRange, setPeriodRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [appliedRange, setAppliedRange] = useState<[Dayjs, Dayjs] | null>(null)

  const bump = () => setRevision((r) => r + 1)

  const myApplications = useMemo(() => {
    void revision
    return LEAVE_APPLICATIONS
      .filter((a) => a.employeeId === self.id)
      .filter((a) => (filterTypes.length ? filterTypes.includes(a.leaveTypeId) : true))
      .filter((a) => (filterStatuses.length ? filterStatuses.includes(a.status) : true))
      .filter((a) => {
        if (!periodRange) return true
        return !dayjs(a.endDate).isBefore(periodRange[0], 'day') && !dayjs(a.startDate).isAfter(periodRange[1], 'day')
      })
      .filter((a) => {
        if (!appliedRange) return true
        const d = dayjs(a.appliedOn)
        return d.isAfter(appliedRange[0].startOf('day')) && d.isBefore(appliedRange[1].endOf('day'))
      })
      // MOVE-3947 §2 — default sort is applied on, newest first.
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn))
  }, [self.id, revision, filterTypes, filterStatuses, periodRange, appliedRange])

  const myBalances = useMemo(() => {
    void revision
    return balancesFor(self, year)
  }, [self, year, revision])

  // MOVE-3952 — every OTHER employee's still-pending application whose
  // approver is me. Oldest first: an approval queue reads oldest-first
  // everywhere else in this app (Manage Leave Types, the listing's default
  // sort direction aside), and nothing in MOVE-3952/3893 specifies an order,
  // so this is a judgment call rather than a quoted rule.
  const pendingMyApproval = useMemo(() => {
    void revision
    return LEAVE_APPLICATIONS
      .filter((a) => a.employeeId !== self.id && a.status === 'Pending Approval')
      .filter((a) => LEAVE_EMPLOYEES.find((e) => e.id === a.employeeId)?.leaveApprover === selfName)
      .sort((a, b) => a.appliedOn.localeCompare(b.appliedOn))
  }, [self.id, selfName, revision])

  const openApp = LEAVE_APPLICATIONS.find((a) => a.id === openAppId) ?? null
  const openApproval = LEAVE_APPLICATIONS.find((a) => a.id === openApprovalId) ?? null
  const openApprovalEmployee = openApproval ? LEAVE_EMPLOYEES.find((e) => e.id === openApproval.employeeId) ?? null : null

  const applicationColumns: ColumnsType<LeaveApplication> = [
    { title: 'Leave Type', key: 'type', render: (_, a) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{leaveTypeById(a.leaveTypeId)?.name ?? '-'}</Text> },
    {
      title: 'Leave Application Period',
      key: 'period',
      width: 240,
      render: (_, a) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>
            {dayjs(a.startDate).format('D MMM YYYY')} - {dayjs(a.endDate).format('D MMM YYYY')}
          </Text>
          {a.leaveTypeId === 'lt-timeoff' && a.startTime && (
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
              {dayjs(a.startTime, 'HH:mm').format('h:mm A')} - {dayjs(a.endTime, 'HH:mm').format('h:mm A')}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Days Used',
      key: 'days',
      width: 110,
      render: (_, a) => <Text style={{ fontSize: 13 }}>{a.leaveTypeId === 'lt-timeoff' ? '-' : formatDays(a.days)}</Text>,
    },
    { title: 'Applied On', key: 'appliedOn', width: 140, render: (_, a) => <Text style={{ fontSize: 13 }}>{dayjs(a.appliedOn).format('D MMM YYYY')}</Text> },
    { title: 'Status', key: 'status', width: 150, render: (_, a) => <StatusTag status={a.status} /> },
  ]

  const balanceColumns: ColumnsType<BalanceRow> = [
    { title: 'Leave Type', key: 'type', render: (_, r) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{r.leaveType.name}</Text> },
    { title: 'Validity Period', key: 'validity', width: 220, render: (_, r) => <Text style={{ fontSize: 13 }}>{formatValidity(r.validity)}</Text> },
    { title: 'Entitlement', key: 'entitlement', width: 170, render: (_, r) => <Text style={{ fontSize: 13 }}>{formatEntitlement(r, self)}</Text> },
    { title: 'Used', key: 'used', width: 100, render: (_, r) => <Text style={{ fontSize: 13 }}>{formatDays(r.usedDays)}</Text> },
    { title: 'Pending Approval', key: 'pending', width: 140, render: (_, r) => <Text style={{ fontSize: 13 }}>{formatDays(r.pendingDays)}</Text> },
    {
      // MOVE-3948 names this column "Remaining", not "Balance" — the HR page's
      // wording. Same figure (`entitlement - used - pending`), different label.
      title: 'Remaining',
      key: 'remaining',
      width: 110,
      render: (_, r) => (
        <Text strong style={{ fontSize: 13, color: r.balance !== null && r.balance < 0 ? '#cf1322' : '#1a1a1a' }}>
          {r.balance === null ? '-' : formatDays(r.balance)}
        </Text>
      ),
    },
  ]

  const approvalColumns: ColumnsType<LeaveApplication> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, a) => {
        const e = LEAVE_EMPLOYEES.find((x) => x.id === a.employeeId)
        return <Text style={{ fontSize: 13, fontWeight: 500 }}>{e ? fullName(e) : '-'}</Text>
      },
    },
    { title: 'Leave Type', key: 'type', render: (_, a) => <Text style={{ fontSize: 13 }}>{leaveTypeById(a.leaveTypeId)?.name ?? '-'}</Text> },
    {
      title: 'Leave Application Period',
      key: 'period',
      width: 220,
      render: (_, a) => <Text style={{ fontSize: 13 }}>{dayjs(a.startDate).format('D MMM YYYY')} - {dayjs(a.endDate).format('D MMM YYYY')}</Text>,
    },
    { title: 'Days Used', key: 'days', width: 100, render: (_, a) => <Text style={{ fontSize: 13 }}>{a.leaveTypeId === 'lt-timeoff' ? '-' : formatDays(a.days)}</Text> },
    { title: 'Applied On', key: 'appliedOn', width: 140, render: (_, a) => <Text style={{ fontSize: 13 }}>{dayjs(a.appliedOn).format('D MMM YYYY')}</Text> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Leave</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Signed in as {selfName} — {self.department}, {self.workingDaysPerWeek} working days per week.
          </Text>
        </div>
        {/* MOVE-3946 §1 — "apply for leave" from the home tab or the leave
            tab; only the leave tab exists here, so the CTA lives here. */}
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setApplyOpen(true)}>
          Apply for Leave
        </Button>
      </div>

      <SectionCard
        title="Leave Applications"
        subtitle="Every leave application I've made, whatever its status."
        extra={
          <Space wrap>
            <Select
              size="small"
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Leave type"
              style={{ minWidth: 170 }}
              value={filterTypes}
              onChange={setFilterTypes}
              maxTagCount="responsive"
              options={LEAVE_TYPES.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Select
              size="small"
              mode="multiple"
              allowClear
              placeholder="Status"
              style={{ minWidth: 150 }}
              value={filterStatuses}
              onChange={setFilterStatuses}
              maxTagCount="responsive"
              options={STATUS_OPTIONS}
            />
            <DatePicker.RangePicker size="small" value={periodRange} onChange={(v) => setPeriodRange(v as [Dayjs, Dayjs] | null)} placeholder={['Leave period', 'End']} />
            <DatePicker.RangePicker size="small" value={appliedRange} onChange={(v) => setAppliedRange(v as [Dayjs, Dayjs] | null)} placeholder={['Applied on', 'End']} />
          </Space>
        }
      >
        {/* MOVE-3947 §1 — no pagination, every application shows. */}
        <Table<LeaveApplication>
          columns={applicationColumns}
          dataSource={myApplications}
          rowKey="id"
          size="middle"
          pagination={false}
          onRow={(rec) => ({ onClick: () => setOpenAppId(rec.id), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leave applications match these filters." /> }}
        />
      </SectionCard>

      <SectionCard
        title="Leave Balances"
        subtitle="Every leave type I'm eligible for. Remaining = entitlement − used − pending approval."
        extra={
          // MOVE-3948 §2 — this toggle only ever offers this year and next.
          <Space size={4}>
            {[thisYear, thisYear + 1].map((y) => (
              <Button key={y} size="small" type={y === year ? 'primary' : 'default'} onClick={() => setYear(y)}>
                {y}
              </Button>
            ))}
          </Space>
        }
      >
        <Table<BalanceRow>
          columns={balanceColumns}
          dataSource={myBalances}
          rowKey={(r) => r.leaveType.id}
          size="middle"
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No leave types are valid for me in ${year}.`} /> }}
        />
      </SectionCard>

      <SectionCard
        title="Pending My Approval"
        subtitle="Other employees' leave applications waiting on me as their leave approver."
        extra={pendingMyApproval.length > 0 ? <Tag style={{ margin: 0 }}>{pendingMyApproval.length}</Tag> : undefined}
      >
        <Table<LeaveApplication>
          columns={approvalColumns}
          dataSource={pendingMyApproval}
          rowKey="id"
          size="middle"
          pagination={false}
          onRow={(rec) => ({ onClick: () => setOpenApprovalId(rec.id), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing is waiting on my approval." /> }}
        />
      </SectionCard>

      <ApplyLeaveDrawer
        open={applyOpen}
        employee={self}
        year={thisYear}
        onClose={() => setApplyOpen(false)}
        onSaved={() => { setApplyOpen(false); bump() }}
      />

      {/* MOVE-3965 — my own application, opened from Leave Applications.
          The shared drawer's Cancel action is the one MOVE-3950 asks for;
          Approve/Reject stay disabled since a pending application is never
          approved by the person who applied for it. */}
      <LeaveApplicationDrawer
        application={openApp}
        employee={self}
        onClose={() => setOpenAppId(null)}
        onChanged={bump}
      />

      {/* MOVE-3952 — someone else's application, opened from Pending My
          Approval. Same drawer, same component: Approve/Reject is what this
          section exists for, and Cancel stays available for the same reason
          it does on the HR side — an approver can act on either. */}
      {openApprovalEmployee && (
        <LeaveApplicationDrawer
          application={openApproval}
          employee={openApprovalEmployee}
          onClose={() => setOpenApprovalId(null)}
          onChanged={bump}
        />
      )}
    </div>
  )
}
