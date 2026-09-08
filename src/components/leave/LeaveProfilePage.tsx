// MOVE-3494 — Employee Leave Profile Details, with the profile MOVE-3890
// auto-creates. Two tables: leave balances by year, and leave applications.
//
// The year toggle drives everything — MOVE-3494 biz req 1 is emphatic that
// entitlement, used, pending and balance are all specific to the viewing year,
// and that an application spanning a year boundary shows in both years.

import { useMemo, useState } from 'react'
import {
  Button, DatePicker, Dropdown, Empty, Input, Segmented, Select, Space, Table, Tag, Tooltip, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { ArrowLeftOutlined, DownOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  LEAVE_APPLICATIONS,
  LEAVE_EMPLOYEES,
  fullName,
  type LeaveApplication,
  type LeaveStatus,
} from './leaveData'
import {
  balancesFor,
  formatDays,
  formatEntitlement,
  formatValidity,
  leaveTypeById,
  selectableYears,
  type BalanceRow,
} from './leaveLogic'
import { AddEntitlementModal, ChangeHistoryDrawer, EditEntitlementModal } from './EntitlementModals'
import { ApplyLeaveDrawer, LeaveApplicationDrawer, StatusTag } from './LeaveApplicationDrawers'
import type { AppPage } from '@/App'

const { Text, Title } = Typography

const STATUS_OPTIONS: { value: LeaveStatus; label: string }[] = [
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Cancelled', label: 'Cancelled' },
]

/** MOVE-3494 biz req 1 — an application shows in every year it touches. */
function touchesYear(app: LeaveApplication, year: number): boolean {
  return dayjs(app.startDate).year() <= year && dayjs(app.endDate).year() >= year
}

export default function LeaveProfilePage({
  employeeId,
  onNavigate,
}: {
  employeeId: string
  onNavigate: (page: AppPage) => void
}) {
  const [messageApi, contextHolder] = message.useMessage()
  const employee = LEAVE_EMPLOYEES.find((e) => e.id === employeeId)
  const [revision, setRevision] = useState(0)
  const [year, setYear] = useState(dayjs().year())
  const [addOpen, setAddOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<BalanceRow | null>(null)
  const [openAppId, setOpenAppId] = useState<string | null>(null)

  // MOVE-3494 biz req 3.2 — the applications table needs its own filters.
  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<LeaveStatus[]>([])
  const [periodRange, setPeriodRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [appliedRange, setAppliedRange] = useState<[Dayjs, Dayjs] | null>(null)

  if (!employee) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Employee not found." />
      </div>
    )
  }

  const years = useMemo(() => selectableYears(employee), [employee])
  const balances = useMemo(() => {
    void revision
    return balancesFor(employee, year)
  }, [employee, year, revision])

  const applications = useMemo(() => {
    void revision
    return LEAVE_APPLICATIONS
      .filter((a) => a.employeeId === employee.id && touchesYear(a, year))
      .filter((a) => (filterTypes.length ? filterTypes.includes(a.leaveTypeId) : true))
      .filter((a) => (filterStatuses.length ? filterStatuses.includes(a.status) : true))
      .filter((a) => {
        if (!periodRange) return true
        return (
          !dayjs(a.endDate).isBefore(periodRange[0], 'day') && !dayjs(a.startDate).isAfter(periodRange[1], 'day')
        )
      })
      .filter((a) => {
        if (!appliedRange) return true
        const d = dayjs(a.appliedOn)
        return d.isAfter(appliedRange[0].startOf('day')) && d.isBefore(appliedRange[1].endOf('day'))
      })
      // Biz req 3 — default sort is applied on, newest first.
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn))
  }, [employee, year, revision, filterTypes, filterStatuses, periodRange, appliedRange])

  const openApp = applications.find((a) => a.id === openAppId)
    ?? LEAVE_APPLICATIONS.find((a) => a.id === openAppId)
    ?? null

  const refresh = (msg: string) => {
    setRevision((r) => r + 1)
    messageApi.success(msg)
  }

  const balanceColumns: ColumnsType<BalanceRow> = [
    {
      title: 'Leave Type',
      key: 'type',
      render: (_, r) => (
        <Space size={6}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{r.leaveType.name}</Text>
          {/* Manually added rows are worth marking: they are the ones an HR
              user put there, and the only ones that can be missing next year. */}
          {r.manual && <Tag style={{ fontSize: 10, margin: 0 }}>Added</Tag>}
        </Space>
      ),
    },
    {
      title: 'Validity Period',
      key: 'validity',
      width: 220,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{formatValidity(r.validity)}</Text>,
    },
    {
      title: 'Entitlement',
      key: 'entitlement',
      width: 200,
      render: (_, r) => (
        <Tooltip title={r.carriedForward > 0 ? `Includes ${r.carriedForward} days carried forward from ${year - 1}` : undefined}>
          <Text style={{ fontSize: 13 }}>{formatEntitlement(r, employee)}</Text>
        </Tooltip>
      ),
    },
    { title: 'Used', key: 'used', width: 100, render: (_, r) => <Text style={{ fontSize: 13 }}>{formatDays(r.usedDays)}</Text> },
    {
      title: 'Pending Approval',
      key: 'pending',
      width: 140,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{formatDays(r.pendingDays)}</Text>,
    },
    {
      title: 'Balance',
      key: 'balance',
      width: 120,
      render: (_, r) => (
        <Text strong style={{ fontSize: 13, color: r.balance !== null && r.balance < 0 ? '#cf1322' : '#1a1a1a' }}>
          {r.balance === null ? '-' : formatDays(r.balance)}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, r) => (
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          title="Edit leave entitlement"
          onClick={() => setEditingRow(r)}
        />
      ),
    },
  ]

  const applicationColumns: ColumnsType<LeaveApplication> = [
    {
      title: 'Leave Type',
      key: 'type',
      render: (_, a) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{leaveTypeById(a.leaveTypeId)?.name ?? '-'}</Text>,
    },
    {
      title: 'Dates',
      key: 'dates',
      width: 240,
      render: (_, a) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>
            {dayjs(a.startDate).format('D MMM YYYY')} - {dayjs(a.endDate).format('D MMM YYYY')}
          </Text>
          {a.startTime && (
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
      // Biz req 3 — Time Off has no day count.
      render: (_, a) => <Text style={{ fontSize: 13 }}>{a.leaveTypeId === 'lt-timeoff' ? '-' : formatDays(a.days)}</Text>,
    },
    {
      title: 'Applied On',
      key: 'appliedOn',
      width: 160,
      render: (_, a) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{dayjs(a.appliedOn).format('D MMM YYYY')}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{dayjs(a.appliedOn).format('h:mm A')}</Text>
        </div>
      ),
    },
    { title: 'Status', key: 'status', width: 150, render: (_, a) => <StatusTag status={a.status} /> },
  ]

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <style>{`
        .leave-table .ant-table-thead > tr > th { position: relative; }
        .leave-table .ant-table-thead > tr > th:not(:last-child)::after {
          content: ''; position: absolute; right: 0; top: 50%;
          transform: translateY(-50%); width: 1px; height: 18px; background: #e8eaed;
        }
      `}</style>

      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        style={{ padding: 0, marginBottom: 8 }}
        onClick={() => onNavigate({ type: 'leave' })}
      >
        Return to Leave
      </Button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>{fullName(employee)}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {employee.department} · {employee.hiringCompanies[0]} · {employee.workingDaysPerWeek} working days per week
            {employee.leaveApprover
              ? ` · Approver: ${employee.leaveApprover}`
              : ' · No leave approver — applications are auto-approved'}
          </Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Add Leave Entitlement</Button>
          <Button type="primary" onClick={() => setApplyOpen(true)}>Apply Leave</Button>
          <Dropdown
            menu={{
              items: [{ key: 'history', label: 'Leave Entitlement Change History' }],
              onClick: () => setHistoryOpen(true),
            }}
            trigger={['click']}
          >
            <Button>Actions <DownOutlined /></Button>
          </Dropdown>
        </Space>
      </div>

      {/* Biz req 1 — the year toggle. Everything below reads from it. */}
      <div style={{ margin: '16px 0' }}>
        <Segmented
          value={year}
          onChange={(v) => setYear(v as number)}
          options={years.map((y) => ({ value: y, label: String(y) }))}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <Text strong style={{ fontSize: 14 }}>Leave Balances</Text>
        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
          Every leave type {employee.givenName} is eligible for in {year}. Balance = entitlement − used − pending approval.
        </Text>
      </div>
      <div className="leave-table" style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden', marginBottom: 28 }}>
        <Table<BalanceRow>
          columns={balanceColumns}
          dataSource={balances}
          rowKey={(r) => r.leaveType.id}
          size="middle"
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={`No leave types are valid for ${employee.givenName} in ${year}.`}
              />
            ),
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div>
          <Text strong style={{ fontSize: 14 }}>Leave Applications</Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            Sorted by applied on, newest first. An application spanning two years appears in both.
          </Text>
        </div>
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
            options={balances.map((r) => ({ value: r.leaveType.id, label: r.leaveType.name }))}
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
          <DatePicker.RangePicker
            size="small"
            value={periodRange}
            onChange={(v) => setPeriodRange(v as [Dayjs, Dayjs] | null)}
            placeholder={['Leave period', 'End']}
          />
          <DatePicker.RangePicker
            size="small"
            value={appliedRange}
            onChange={(v) => setAppliedRange(v as [Dayjs, Dayjs] | null)}
            placeholder={['Applied on', 'End']}
          />
        </Space>
      </div>
      <div className="leave-table" style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
        <Table<LeaveApplication>
          columns={applicationColumns}
          dataSource={applications}
          rowKey="id"
          size="middle"
          pagination={false}
          onRow={(rec) => ({ onClick: () => setOpenAppId(rec.id), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No leave applications in ${year}.`} />
            ),
          }}
        />
      </div>

      <AddEntitlementModal
        open={addOpen}
        employee={employee}
        onClose={() => setAddOpen(false)}
        onSaved={(msg) => { setAddOpen(false); refresh(msg) }}
      />
      <EditEntitlementModal
        row={editingRow}
        employee={employee}
        year={year}
        onClose={() => setEditingRow(null)}
        onSaved={(msg) => { setEditingRow(null); refresh(msg) }}
      />
      <ApplyLeaveDrawer
        open={applyOpen}
        employee={employee}
        year={year}
        onClose={() => setApplyOpen(false)}
        onSaved={(msg) => { setApplyOpen(false); refresh(msg) }}
      />
      <LeaveApplicationDrawer
        application={openApp}
        employee={employee}
        onClose={() => setOpenAppId(null)}
        onChanged={refresh}
      />
      <ChangeHistoryDrawer
        open={historyOpen}
        employee={employee}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  )
}
