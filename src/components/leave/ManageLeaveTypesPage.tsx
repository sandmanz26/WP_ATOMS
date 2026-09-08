// MOVE-1977 — Manage Leave Types.
//
// Two tables on one page: custom types (sortable, paginated at 10) and system
// types (fixed order, no pagination, no sort). Both open the same details
// drawer on a row click.

import { useMemo, useState } from 'react'
import { Button, Empty, Table, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons'
import { LEAVE_TYPES, ELIGIBILITY_LABEL, type LeaveType } from './leaveData'
import {
  CreateLeaveTypeDrawer,
  EditLeaveTypeDrawer,
  LeaveTypeDetailsDrawer,
  entitlementLabel,
  validityLabelOf,
} from './LeaveTypeDrawers'
import PaginationBar from './PaginationBar'
import type { AppPage } from '@/App'

const { Text, Title } = Typography

export default function ManageLeaveTypesPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const [messageApi, contextHolder] = message.useMessage()
  // Bumped after every mutation: LEAVE_TYPES is a module-level array, so React
  // needs telling that something inside it moved.
  const [revision, setRevision] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsOf, setDetailsOf] = useState<LeaveType | null>(null)
  const [editingOf, setEditingOf] = useState<LeaveType | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { custom, system } = useMemo(() => {
    void revision
    return {
      // Biz req 2 — custom types default to last updated, newest first.
      custom: LEAVE_TYPES.filter((t) => !t.system).sort((a, b) => b.lastUpdatedOn.localeCompare(a.lastUpdatedOn)),
      // Biz req 1.2 / 2 — the system table keeps the ticket's fixed order.
      system: LEAVE_TYPES.filter((t) => t.system),
    }
  }, [revision])

  const pagedCustom = useMemo(
    () => custom.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [custom, page, pageSize],
  )

  const baseColumns = (sortable: boolean): ColumnsType<LeaveType> => [
    {
      title: 'Leave Type',
      dataIndex: 'name',
      // Biz req 2 — only the custom table sorts, and only by name.
      sorter: sortable ? (a, b) => a.name.localeCompare(b.name) : undefined,
      render: (v: string) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Entitlement',
      key: 'entitlement',
      width: 140,
      render: (_, t) => <Text style={{ fontSize: 13 }}>{entitlementLabel(t)}</Text>,
    },
    {
      title: 'Validity Period',
      key: 'validity',
      width: 240,
      render: (_, t) => <Text style={{ fontSize: 13 }}>{validityLabelOf(t)}</Text>,
    },
    {
      title: 'Employee Eligibility',
      key: 'eligibility',
      width: 180,
      render: (_, t) => <Text style={{ fontSize: 13 }}>{ELIGIBILITY_LABEL[t.eligibility]}</Text>,
    },
    {
      title: 'Last Updated On',
      key: 'lastUpdatedOn',
      width: 180,
      render: (_, t) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{dayjs(t.lastUpdatedOn).format('D MMM YYYY')}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{dayjs(t.lastUpdatedOn).format('h:mm A')}</Text>
        </div>
      ),
    },
  ]

  const tableCard = (
    heading: string,
    subtitle: string,
    rows: LeaveType[],
    sortable: boolean,
    empty?: React.ReactNode,
  ) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 10 }}>
        <Text strong style={{ fontSize: 14 }}>{heading}</Text>
        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{subtitle}</Text>
      </div>
      <div className="leave-table" style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
        <Table<LeaveType>
          columns={baseColumns(sortable)}
          dataSource={rows}
          rowKey="id"
          size="middle"
          pagination={false}
          locale={empty ? { emptyText: empty } : undefined}
          // Biz req 3 — a row in either table opens the details drawer.
          onRow={(rec) => ({ onClick: () => setDetailsOf(rec), style: { cursor: 'pointer' } })}
        />
      </div>
    </div>
  )

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Manage Leave Types</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Create Leave Type
        </Button>
      </div>

      {tableCard(
        'Custom Leave Types',
        'Created by your team. Sorted by last updated, newest first.',
        pagedCustom,
        true,
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No custom leave types yet. Use Create Leave Type to add one."
        />,
      )}
      {/* The pagination bar only earns its space once there is a second page. */}
      {custom.length > pageSize && (
        <div style={{ marginTop: -12, marginBottom: 24 }}>
          <PaginationBar
            noun="Leave Type"
            page={page}
            pageSize={pageSize}
            total={custom.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
          />
        </div>
      )}

      {tableCard(
        'System Leave Types',
        'Pre-created by the system in a fixed order, following Singapore employment law. Their entitlement, supporting document and encashment can still be edited.',
        system,
        false,
      )}

      <CreateLeaveTypeDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(_, msg) => {
          setCreateOpen(false)
          setRevision((r) => r + 1)
          setPage(1)
          messageApi.success(msg)
        }}
      />

      <LeaveTypeDetailsDrawer
        leaveType={detailsOf}
        onClose={() => setDetailsOf(null)}
        onEdit={(t) => { setDetailsOf(null); setEditingOf(t) }}
      />

      <EditLeaveTypeDrawer
        leaveType={editingOf}
        onClose={() => setEditingOf(null)}
        onSaved={(_, msg) => {
          setEditingOf(null)
          setRevision((r) => r + 1)
          messageApi.success(msg)
        }}
      />
    </div>
  )
}
