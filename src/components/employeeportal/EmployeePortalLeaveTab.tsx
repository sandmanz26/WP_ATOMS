// Personal Dashboard (epic MOVE-3412) — Leave details page.
//
// Independent of `personaldashboard/PersonalDashboardLeaveTab.tsx` and of
// `leave/LeaveApplicationDrawers.tsx` — see the header note in
// `EmployeePortalLeaveDrawers.tsx` for why. The business-rule engine
// (`leave/leaveData.ts`, `leave/leaveLogic.ts`) is shared, and so — since
// MOVE-4351 asks for "exact same details and format" — is the Leave module's
// read-only balance drawer and change history.
//
// Restructured for the 12–13 Oct 2026 rewrite of MOVE-3948:
//   3.1  Own leave. No tabs unless the user is someone's leave approver; an
//        approver sees it as the 'My Leave' tab.
//   3.2  Leave applications table · 3.3 Leave balances table (row → MOVE-4351
//        Leave Balance Details drawer, with View Change History).
//   4.1  'Approvals' tab, approvers only:
//   4.2  "Pending Approval" — 5 per page, filters Employee / Leave Type /
//        Leave Application Period / Applied On.
//   4.3  "History" — every non-pending application of the approver's
//        employees, 5 per page, same filters plus Status.
//   Rows open the MOVE-3965 details drawer: own → Cancel (MOVE-3950);
//   others → Approve / Reject under Actions (MOVE-3952).

import { useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Card, DatePicker, Empty, Segmented, Select, Space, Table, Tabs, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import {
  LEAVE_APPLICATIONS,
  LEAVE_EMPLOYEES,
  LEAVE_TYPES,
  fullName,
  isListedOnLeavePage,
  type LeaveApplication,
  type LeaveEmployee,
  type LeaveStatus,
} from '../leave/leaveData'
import { balancesFor, formatDays, formatEntitlement, formatValidity, type BalanceRow } from '../leave/leaveLogic'
import LeaveBalanceDrawer from '../leave/LeaveBalanceDrawer'
import { ChangeHistoryDrawer } from '../leave/EntitlementModals'
import { CreateLeaveApplicationDrawer, LeaveApplicationDetailsDrawer, LeaveStatusTag } from './EmployeePortalLeaveDrawers'

const { Text } = Typography
const { RangePicker } = DatePicker

const STATUS_OPTIONS: LeaveStatus[] = ['Pending Approval', 'Approved', 'Rejected', 'Cancelled']
const HISTORY_STATUSES: LeaveStatus[] = ['Approved', 'Rejected', 'Cancelled']
const TIME_OFF_ID = 'lt-timeoff'

const leaveTypeName = (a: LeaveApplication) => LEAVE_TYPES.find((t) => t.id === a.leaveTypeId)?.name ?? a.leaveTypeId

/** Employees who have `self` as their leave approver (MOVE-3948 4.1 note). */
export function leaveApproveeIds(self: LeaveEmployee): string[] {
  const me = fullName(self)
  return LEAVE_EMPLOYEES.filter((e) => e.id !== self.id && e.leaveApprover === me).map((e) => e.id)
}

function DatesCell({ a }: { a: LeaveApplication }) {
  return (
    <div>
      <Text style={{ fontSize: 13, display: 'block' }}>
        {dayjs(a.startDate).format('D MMM YYYY')} - {dayjs(a.endDate).format('D MMM YYYY')}
      </Text>
      {a.leaveTypeId === TIME_OFF_ID && a.startTime && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(a.startTime, 'HH:mm').format('h:mm A')} - {dayjs(a.endTime, 'HH:mm').format('h:mm A')}
        </Text>
      )}
    </div>
  )
}

/** "Used": days as deducted; time off in hours (MOVE-3948 4.2). */
function usedLabel(a: LeaveApplication): string {
  if (a.leaveTypeId !== TIME_OFF_ID) return formatDays(a.days)
  if (!a.startTime || !a.endTime) return '-'
  const hrs = dayjs(a.endTime, 'HH:mm').diff(dayjs(a.startTime, 'HH:mm'), 'minute') / 60
  return `${hrs} hr${hrs === 1 ? '' : 's'}`
}

const overlaps = (a: LeaveApplication, r: [Dayjs, Dayjs] | null) =>
  !r || (!dayjs(a.endDate).isBefore(r[0], 'day') && !dayjs(a.startDate).isAfter(r[1], 'day'))
const appliedIn = (a: LeaveApplication, r: [Dayjs, Dayjs] | null) =>
  !r || (!dayjs(a.appliedOn).isBefore(r[0].startOf('day')) && !dayjs(a.appliedOn).isAfter(r[1].endOf('day')))

/**
 * MOVE-3948 4.2 / 4.3 — one approvals table with its own filters, applied to
 * that table only ("any filter applied here affects only…").
 */
function ApprovalsTable({
  title,
  rows,
  withStatus,
  emptyText,
  onOpen,
}: {
  title: string
  rows: LeaveApplication[]
  withStatus: boolean
  emptyText: string
  onOpen: (a: LeaveApplication) => void
}) {
  const [fEmployees, setFEmployees] = useState<string[]>([])
  const [fTypes, setFTypes] = useState<string[]>([])
  const [fStatuses, setFStatuses] = useState<LeaveStatus[]>([])
  const [fPeriod, setFPeriod] = useState<[Dayjs, Dayjs] | null>(null)
  const [fApplied, setFApplied] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)

  const filtered = rows
    .filter((a) => !fEmployees.length || fEmployees.includes(a.employeeId))
    .filter((a) => !fTypes.length || fTypes.includes(a.leaveTypeId))
    .filter((a) => !fStatuses.length || fStatuses.includes(a.status))
    .filter((a) => overlaps(a, fPeriod))
    .filter((a) => appliedIn(a, fApplied))
    // Default sort: applied on, newest first.
    .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn))

  const columns: ColumnsType<LeaveApplication> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, a) => {
        const e = LEAVE_EMPLOYEES.find((x) => x.id === a.employeeId)
        return e ? fullName(e) : a.employeeId
      },
    },
    { title: 'Leave Type', key: 'leaveType', render: (_, a) => leaveTypeName(a) },
    { title: 'Dates', key: 'dates', render: (_, a) => <DatesCell a={a} /> },
    { title: 'Used', key: 'used', align: 'right', render: (_, a) => usedLabel(a) },
    { title: 'Applied On', key: 'appliedOn', render: (_, a) => dayjs(a.appliedOn).format('D MMM YYYY') },
    { title: 'Status', key: 'status', render: (_, a) => <LeaveStatusTag status={a.status} /> },
  ]

  // "Options: names of all active employees" (Active / Suspended).
  const employeeOptions = LEAVE_EMPLOYEES.filter(isListedOnLeavePage).map((e) => ({ value: e.id, label: fullName(e) }))
  const reset = () => setPage(1)

  return (
    <Card title={title} style={{ marginBottom: 20 }}>
      <Space wrap style={{ marginBottom: 14 }}>
        <Select
          mode="multiple" allowClear showSearch optionFilterProp="label" maxTagCount="responsive"
          placeholder="Employee" style={{ minWidth: 200 }}
          options={employeeOptions} value={fEmployees} onChange={(v) => { setFEmployees(v); reset() }}
        />
        <Select
          mode="multiple" allowClear showSearch optionFilterProp="label" maxTagCount="responsive"
          placeholder="Leave Type" style={{ minWidth: 200 }}
          options={LEAVE_TYPES.map((t) => ({ value: t.id, label: t.name }))} value={fTypes} onChange={(v) => { setFTypes(v); reset() }}
        />
        {withStatus && (
          <Select
            mode="multiple" allowClear showSearch maxTagCount="responsive"
            placeholder="Status" style={{ minWidth: 180 }}
            options={HISTORY_STATUSES.map((s) => ({ value: s, label: s }))} value={fStatuses} onChange={(v) => { setFStatuses(v); reset() }}
          />
        )}
        <RangePicker
          placeholder={['Leave period from', 'to']}
          value={fPeriod}
          onChange={(v) => { setFPeriod(v as [Dayjs, Dayjs] | null); reset() }}
        />
        <RangePicker
          placeholder={['Applied on from', 'to']}
          value={fApplied}
          onChange={(v) => { setFApplied(v as [Dayjs, Dayjs] | null); reset() }}
        />
      </Space>
      <Table<LeaveApplication>
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        // Max 5 records per page.
        pagination={{ pageSize: 5, current: page, onChange: setPage, hideOnSinglePage: true, showSizeChanger: false }}
        onRow={(a) => ({ onClick: () => onOpen(a), style: { cursor: 'pointer' } })}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
      />
    </Card>
  )
}

export default function EmployeePortalLeaveTab({
  self,
  dataRevision = 0,
  onDataChanged,
}: {
  self: LeaveEmployee
  /** Bumped by the page when another tab (e.g. Home) changed leave data. */
  dataRevision?: number
  onDataChanged?: () => void
}) {
  const [revision, setRevision] = useState(0)
  const bump = () => { setRevision((r) => r + 1); onDataChanged?.() }

  const [balanceYear, setBalanceYear] = useState<'this' | 'next'>('this')
  const [fTypes, setFTypes] = useState<string[]>([])
  const [fStatuses, setFStatuses] = useState<LeaveStatus[]>([])
  const [applyOpen, setApplyOpen] = useState(false)
  const [viewing, setViewing] = useState<{ app: LeaveApplication; others: boolean } | null>(null)
  const [balanceTypeId, setBalanceTypeId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [tab, setTab] = useState<'mine' | 'approvals'>('mine')

  const thisYear = dayjs().year()
  const year = balanceYear === 'this' ? thisYear : thisYear + 1

  const approveeIds = useMemo(() => leaveApproveeIds(self), [self])
  const isApprover = approveeIds.length > 0

  // ---- 3.2 own leave applications ------------------------------------------
  const myApplications = useMemo(
    () =>
      LEAVE_APPLICATIONS
        .filter((a) => a.employeeId === self.id)
        .filter((a) => !fTypes.length || fTypes.includes(a.leaveTypeId))
        .filter((a) => !fStatuses.length || fStatuses.includes(a.status))
        .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [self.id, fTypes, fStatuses, revision, dataRevision],
  )

  const applicationColumns: ColumnsType<LeaveApplication> = [
    { title: 'Leave Type', key: 'leaveType', render: (_, a) => leaveTypeName(a) },
    { title: 'Leave Application Period', key: 'period', render: (_, a) => <DatesCell a={a} /> },
    { title: 'Days Used', key: 'days', align: 'right', render: (_, a) => (a.leaveTypeId === TIME_OFF_ID ? '-' : formatDays(a.days)) },
    { title: 'Applied On', key: 'appliedOn', render: (_, a) => dayjs(a.appliedOn).format('D MMM YYYY') },
    { title: 'Status', key: 'status', render: (_, a) => <LeaveStatusTag status={a.status} /> },
  ]

  // ---- 3.3 own leave balances ----------------------------------------------
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const balances = useMemo(() => balancesFor(self, year), [self, year, revision, dataRevision])
  const balanceRow = balanceTypeId ? balances.find((r) => r.leaveType.id === balanceTypeId) ?? null : null

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
        <Text strong style={{ color: r.balance !== null && r.balance < 0 ? '#cf1322' : undefined }}>{formatDays(r.balance)}</Text>
      ),
    },
  ]

  // ---- 4.2 / 4.3 approvals ---------------------------------------------------
  const teamApps = useMemo(
    () => LEAVE_APPLICATIONS.filter((a) => approveeIds.includes(a.employeeId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approveeIds, revision, dataRevision],
  )
  const pending = teamApps.filter((a) => a.status === 'Pending Approval')
  const history = teamApps.filter((a) => a.status !== 'Pending Approval')

  const myLeave = (
    <div>
      <Card
        title="Leave Applications"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setApplyOpen(true)}>Apply Leave</Button>}
        style={{ marginBottom: 20 }}
      >
        <Space wrap style={{ marginBottom: 14 }}>
          <Select
            mode="multiple" allowClear placeholder="Leave Type" style={{ minWidth: 220 }}
            options={LEAVE_TYPES.map((t) => ({ value: t.id, label: t.name }))}
            value={fTypes} onChange={setFTypes}
          />
          <Select
            mode="multiple" allowClear placeholder="Status" style={{ minWidth: 200 }}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            value={fStatuses} onChange={setFStatuses}
          />
        </Space>
        <Table<LeaveApplication>
          columns={applicationColumns}
          dataSource={myApplications}
          rowKey="id"
          pagination={false}
          onRow={(a) => ({ onClick: () => setViewing({ app: a, others: false }), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leave applications." /> }}
        />
      </Card>

      {/* id is the Home page's "View more" scroll target (MOVE-3949 biz req 3). */}
      <div id="pd-leave-balances">
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
            onRow={(r) => ({ onClick: () => setBalanceTypeId(r.leaveType.id), style: { cursor: 'pointer' } })}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No eligible leave types." /> }}
          />
        </Card>
      </div>
    </div>
  )

  const approvals = (
    <div>
      <ApprovalsTable
        key={`pending-${self.id}`}
        title="Pending Approval"
        rows={pending}
        withStatus={false}
        emptyText="There are currently no leave applications pending your approval"
        onOpen={(a) => setViewing({ app: a, others: true })}
      />
      <ApprovalsTable
        key={`history-${self.id}`}
        title="History"
        rows={history}
        withStatus
        emptyText="You have not rejected or approved any leave applications"
        onOpen={(a) => setViewing({ app: a, others: true })}
      />
    </div>
  )

  return (
    <div>
      {/* MOVE-3948 3.1 / 4.1 — tabs only for leave approvers. */}
      {isApprover ? (
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'mine' | 'approvals')}
          items={[
            { key: 'mine', label: 'My Leave', children: myLeave },
            { key: 'approvals', label: `Approvals (${pending.length})`, children: approvals },
          ]}
        />
      ) : (
        myLeave
      )}

      <CreateLeaveApplicationDrawer
        open={applyOpen}
        employee={self}
        year={thisYear}
        onClose={() => setApplyOpen(false)}
        onCreated={(msg) => { setApplyOpen(false); message.success(msg); bump() }}
      />

      <LeaveApplicationDetailsDrawer
        application={viewing?.app ?? null}
        employee={viewing ? (LEAVE_EMPLOYEES.find((e) => e.id === viewing.app.employeeId) as LeaveEmployee) : self}
        canDecide={!!viewing?.others}
        actorName={fullName(self)}
        onClose={() => setViewing(null)}
        onChanged={(msg) => { message.success(msg); setViewing(null); bump() }}
      />

      {/* MOVE-4351 — the Leave module's balance drawer, read-only: View Change History only. */}
      <LeaveBalanceDrawer
        row={balanceRow}
        employee={self}
        year={year}
        showMarks={false}
        onClose={() => setBalanceTypeId(null)}
        onHistory={() => setHistoryOpen(true)}
      />
      <ChangeHistoryDrawer open={historyOpen} employee={self} onClose={() => setHistoryOpen(false)} />
    </div>
  )
}
