// MOVE-4137 — Leave Balance Details drawer.
//
// Opened by clicking a row in the leave balances table (MOVE-3494 biz req 2).
// It is also where Edit Leave Entitlement and the change history now live:
// the 17 Sep 2026 revision of MOVE-3494 struck both out of the page-level
// actions dropdown, because a page-level "edit entitlement" has no row context
// and so no answer to *which* leave type it edits. Here it does.

import { Button, Drawer, Empty, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { PaperClipOutlined } from '@ant-design/icons'
import type { LeaveApplication, LeaveEmployee } from './leaveData'
import {
  applicationsForType,
  deductionInYear,
  entitlementAudit,
  entitlementBreakdown,
  formatDays,
  formatEntitlement,
  formatValidity,
  monthlyUsage,
  type BalanceRow,
  type MonthUsage,
} from './leaveLogic'
import { StatusTag } from './LeaveApplicationDrawers'
import { Mark } from './WhatsNew'

const { Text } = Typography

function Section({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>{title}</Text>
        {extra}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '7px 0',
        borderBottom: '1px solid #f5f5f5',
      }}
    >
      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text strong={strong} style={{ fontSize: 12, textAlign: 'right' }}>{value}</Text>
      ) : (
        value
      )}
    </div>
  )
}

const stamp = (on: string | null) => (on ? dayjs(on).format('D MMM YYYY, h:mm A') : '-')

export default function LeaveBalanceDrawer({
  row,
  employee,
  year,
  onClose,
  onEdit,
  onHistory,
}: {
  row: BalanceRow | null
  employee: LeaveEmployee
  year: number
  onClose: () => void
  onEdit: (row: BalanceRow) => void
  onHistory: () => void
}) {
  if (!row) return null

  const type = row.leaveType
  const breakdown = entitlementBreakdown(row)
  const months = monthlyUsage(employee, type.id, year)
  const applications = applicationsForType(employee, type.id, year)
  const audit = entitlementAudit(employee, row, year)
  const isTimeOff = type.id === 'lt-timeoff'

  const monthColumns: ColumnsType<MonthUsage> = [
    {
      title: 'Month',
      key: 'month',
      render: (_, m) => <Text style={{ fontSize: 12 }}>{m.month.format('MMM YYYY')}</Text>,
    },
    {
      title: 'Days Used',
      key: 'days',
      width: 110,
      align: 'right',
      render: (_, m) => <Text style={{ fontSize: 12 }}>{formatDays(m.days)}</Text>,
    },
  ]

  const applicationColumns: ColumnsType<LeaveApplication> = [
    {
      title: 'Leave Period',
      key: 'dates',
      render: (_, a) => (
        <div>
          <Text style={{ fontSize: 12, display: 'block' }}>
            {dayjs(a.startDate).format('D MMM YYYY')} - {dayjs(a.endDate).format('D MMM YYYY')}
          </Text>
          <Space size={6} style={{ marginTop: 2 }}>
            <StatusTag status={a.status} />
            {/* Biz req 1.1 — remarks and the attachment belong to the
                application, so they read next to it rather than as drawer-level
                fields. Both fall back to "-" when absent. */}
            {a.remarks ? (
              <Tooltip title={a.remarks}>
                <Text style={{ fontSize: 11, color: '#8c8c8c', maxWidth: 150, display: 'inline-block' }} ellipsis>
                  {a.remarks}
                </Text>
              </Tooltip>
            ) : (
              <Text style={{ fontSize: 11, color: '#bfbfbf' }}>No remarks</Text>
            )}
            {a.documentName && (
              <Tooltip title={`Preview and download ${a.documentName}`}>
                <a style={{ fontSize: 11 }}>
                  <PaperClipOutlined /> {a.documentName}
                </a>
              </Tooltip>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: 'Days Used',
      key: 'days',
      width: 110,
      align: 'right',
      // Biz req 1.1 — time off has no day cost at all, and a cross-year
      // application is counted here for the part inside the viewing year, the
      // same way the balances table counts it.
      render: (_, a) =>
        isTimeOff ? (
          <Text style={{ fontSize: 12 }}>-</Text>
        ) : (
          <Text style={{ fontSize: 12 }}>
            {formatDays(deductionInYear(employee, a.startDate, a.endDate, a.startHalf, a.endHalf, year))}
          </Text>
        ),
    },
  ]

  return (
    <Drawer
      open
      onClose={onClose}
      width={520}
      title={
        <div>
          <Space size={8}>
            <span style={{ fontSize: 15 }}>{type.name}</span>
            <Mark id="balance-drawer" />
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', fontWeight: 400 }}>
            {formatValidity(row.validity)}
          </Text>
        </div>
      }
      extra={
        <Space size={8}>
          {/* Biz req 2 — Edit is the primary CTA, change history the secondary.
              Both moved here from the page's actions dropdown. */}
          <Mark id="drawer-actions" label="MOVED HERE" />
          <Button size="small" onClick={onHistory}>View Change History</Button>
          <Button size="small" type="primary" onClick={() => onEdit(row)}>Edit</Button>
        </Space>
      }
    >
      <Section title={`Balance in ${year}`}>
        <Row label="Entitlement" value={formatEntitlement(row, employee)} />
        <Row label="Used" value={formatDays(row.usedDays)} />
        <Row label="Pending Approval" value={formatDays(row.pendingDays)} />
        <Row
          label="Balance"
          strong
          value={
            <Text
              strong
              style={{ fontSize: 12, color: row.balance !== null && row.balance < 0 ? '#cf1322' : '#1a1a1a' }}
            >
              {row.balance === null ? '-' : formatDays(row.balance)}
            </Text>
          }
        />
      </Section>

      {/* Biz req 1.2 — this section exists only for the two annual leave types. */}
      {breakdown && (
        <Section title="Entitlement" extra={<Mark id="carry-forward" />}>
          <Row label={`Carried Forward from ${year - 1}`} value={formatDays(breakdown.carriedForward)} />
          <Row label="Entitlement This Year" value={formatDays(breakdown.thisYear)} />
          <Row label="Total Entitlement This Year" strong value={formatDays(breakdown.total)} />
        </Section>
      )}

      <Section title="Days Used by Month">
        <Table<MonthUsage>
          columns={monthColumns}
          dataSource={months}
          rowKey={(m) => m.month.format('YYYY-MM')}
          size="small"
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={`No approved ${type.name.toLowerCase()} in ${year}.`}
              />
            ),
          }}
        />
      </Section>

      <Section
        title="Leave Applications"
        extra={applications.length > 0 ? <Tag style={{ fontSize: 10, margin: 0 }}>{applications.length}</Tag> : undefined}
      >
        <Table<LeaveApplication>
          columns={applicationColumns}
          dataSource={applications}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No applications in ${year}.`} />
            ),
          }}
        />
      </Section>

      <Section title="Record">
        <Row label="Last Updated On" value={stamp(audit.lastUpdatedOn)} />
        <Row label="Last Updated By" value={audit.lastUpdatedBy} />
        <Row label="Added On" value={stamp(audit.addedOn)} />
        <Row
          label="Added By"
          value={
            <Space size={6}>
              <Text style={{ fontSize: 12 }}>{audit.addedBy}</Text>
              {audit.addedBy === 'System' && (
                <Tooltip title="Auto-added to this profile from the leave type's employee eligibility, so no user added it.">
                  <Tag style={{ fontSize: 10, margin: 0 }}>auto</Tag>
                </Tooltip>
              )}
            </Space>
          }
        />
      </Section>
    </Drawer>
  )
}
