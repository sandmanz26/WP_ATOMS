import { useState } from 'react'
import { Table, Input, Select, Button, Typography, message, Dropdown } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import EditPageLayout from './EditPageLayout'
import { mockContracts } from '@/data/mockData'
import type { Contract } from '@/types/contract'
import StatusBadge from '@/components/common/StatusBadge'

const { Text } = Typography

interface Props {
  contractId: string
  onBack: () => void
}

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8e8e8',
  borderRadius: 10,
  padding: '24px',
  marginBottom: 20,
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#1a1a1a',
  marginBottom: 20,
  display: 'block',
}

const DISABLED_INPUT: React.CSSProperties = {
  background: '#fafafa',
  color: '#595959',
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 13, color: '#8c8c8c' }}>{children}</Text>
    </div>
  )
}

const dayOptions = [
  ...Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
  { label: 'Last day of month', value: 'last' },
]

const paymentTermsOptions = [
  { value: 'net7', label: 'Net 7 days' },
  { value: 'net14', label: 'Net 14 days' },
  { value: 'net30', label: 'Net 30 days' },
  { value: 'net60', label: 'Net 60 days' },
  { value: 'net90', label: 'Net 90 days' },
]

// Sample hardcoded "previously in group" contracts for Ungrouped section
const sampleUngroupedContracts = [
  { id: 'ug1', contractNo: 'CC-2023-100000001', contractTitle: 'Legacy Service Agreement', contractPeriodStart: '1 Jan 2023', contractPeriodEnd: '31 Dec 2023', status: 'Ended', ungroupDate: '15 Dec 2023' },
  { id: 'ug2', contractNo: 'CC-2023-100000002', contractTitle: 'Annual Freight Contract', contractPeriodStart: '1 Mar 2023', contractPeriodEnd: '28 Feb 2024', status: 'Ended', ungroupDate: '20 Jan 2024' },
  { id: 'ug3', contractNo: 'CC-2024-100000003', contractTitle: 'Pilot Shuttle Program', contractPeriodStart: '1 Jun 2024', contractPeriodEnd: '31 May 2025', status: 'Ended', ungroupDate: '10 May 2025' },
]

export default function EditGroupPage({ contractId, onBack }: Props) {
  const contract = mockContracts.find(c => c.id === contractId)!
  const groupName = contract.contractGroup || ''

  // Find all contracts in the same group
  const groupedContracts = mockContracts.filter(c => c.contractGroup && c.contractGroup === groupName)

  const isRecurring = contract.bookingType === 'Term'
  const invoiceSchedule = isRecurring ? 'Recurring Monthly' : 'Once-off'

  // Form state
  const [editGroupName, setEditGroupName] = useState(groupName)
  const [invoiceGenDate, setInvoiceGenDate] = useState(contract.invoiceGenerationDate ?? '')
  const [invoiceDate, setInvoiceDate] = useState(contract.invoiceDate ?? '')
  const [paymentTerms, setPaymentTerms] = useState('')

  // Track contracts to remove (visual state)
  const [toRemove, setToRemove] = useState<Set<string>>(new Set())

  const handleRemove = (id: string) => {
    setToRemove(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    message.success('Group saved successfully')
    onBack()
  }

  // Grouped contracts table columns
  const groupedCols: ColumnsType<Contract> = [
    {
      title: 'Contract No',
      dataIndex: 'contractNo',
      key: 'cn',
      width: 160,
      render: (v: string, record) => (
        <Text style={{ fontSize: 13, color: toRemove.has(record.id) ? '#bfbfbf' : '#1677ff', textDecoration: toRemove.has(record.id) ? 'line-through' : 'none' }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Contract Title',
      dataIndex: 'contractTitle',
      key: 'ct',
      render: (v: string, record) => (
        <Text style={{ fontSize: 13, color: toRemove.has(record.id) ? '#bfbfbf' : undefined, textDecoration: toRemove.has(record.id) ? 'line-through' : 'none' }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Contract Period',
      key: 'cp',
      width: 200,
      render: (_: unknown, record) => (
        <Text style={{ fontSize: 13, color: toRemove.has(record.id) ? '#bfbfbf' : undefined }}>
          {record.contractPeriodStart} – {record.contractPeriodEnd ?? 'no end date'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string, record) => toRemove.has(record.id) ? (
        <Text style={{ fontSize: 12, color: '#bfbfbf', fontStyle: 'italic' }}>to be removed</Text>
      ) : (
        <StatusBadge status={v as Contract['status']} />
      ),
    },
    {
      title: 'Effective Month',
      key: 'em',
      width: 130,
      render: (_: unknown, record) => (
        <Text style={{ fontSize: 13, color: toRemove.has(record.id) ? '#bfbfbf' : undefined }}>
          {record.effectiveMonth ?? '—'}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 60,
      render: (_: unknown, record) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view', label: 'View' },
              {
                key: 'remove',
                label: toRemove.has(record.id)
                  ? <span style={{ color: '#1677ff' }}>Undo Remove</span>
                  : <span style={{ color: '#ff4d4f' }}>Remove</span>,
              },
            ],
            onClick: ({ key }) => {
              if (key === 'remove') handleRemove(record.id)
            },
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} size="small" />
        </Dropdown>
      ),
    },
  ]

  // Ungrouped (sample) contracts table columns
  const ungroupedCols: ColumnsType<typeof sampleUngroupedContracts[0]> = [
    {
      title: 'Contract No',
      dataIndex: 'contractNo',
      key: 'cn',
      width: 160,
      render: (v: string) => <Text style={{ fontSize: 13, color: '#1677ff' }}>{v}</Text>,
    },
    {
      title: 'Contract Title',
      dataIndex: 'contractTitle',
      key: 'ct',
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Contract Period',
      key: 'cp',
      width: 200,
      render: (_: unknown, r: typeof sampleUngroupedContracts[0]) => (
        <Text style={{ fontSize: 13 }}>{r.contractPeriodStart} – {r.contractPeriodEnd}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <StatusBadge status={v as Contract['status']} />,
    },
    {
      title: 'Ungroup Date',
      dataIndex: 'ungroupDate',
      key: 'ud',
      width: 130,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Action',
      key: 'action',
      width: 60,
      render: () => (
        <Button type="text" size="small" style={{ color: '#1677ff', fontSize: 12 }}>
          View
        </Button>
      ),
    },
  ]

  return (
    <EditPageLayout
      title={`Edit ${groupName || 'Group'}`}
      breadcrumb="Edit Customer Contract"
      onBack={onBack}
      onSave={handleSave}
    >
      {/* Section 1: Basic Information */}
      <div style={CARD}>
        <Text style={SECTION_TITLE}>Basic Information</Text>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <FieldLabel>Group Name</FieldLabel>
            <Input
              value={editGroupName}
              onChange={e => setEditGroupName(e.target.value)}
              maxLength={50}
              showCount
              placeholder="Enter group name"
            />
          </div>
          <div>
            <FieldLabel>Customer Code</FieldLabel>
            <Select
              value={contract.customerCode}
              disabled
              style={{ width: '100%' }}
              options={[{ label: contract.customerCode, value: contract.customerCode }]}
            />
          </div>
          <div>
            <FieldLabel>Invoice Generate Schedule</FieldLabel>
            <Input value={invoiceSchedule} disabled style={DISABLED_INPUT} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <FieldLabel>Invoice Generation Date</FieldLabel>
            <Select
              value={invoiceGenDate || undefined}
              onChange={setInvoiceGenDate}
              placeholder="Select day"
              options={dayOptions}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <FieldLabel>Invoice Date</FieldLabel>
            <Select
              value={invoiceDate || undefined}
              onChange={setInvoiceDate}
              placeholder="Select day"
              options={dayOptions}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <FieldLabel>Payment Terms</FieldLabel>
            <Select
              value={paymentTerms || undefined}
              onChange={setPaymentTerms}
              placeholder="Select payment terms"
              options={paymentTermsOptions}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Grouped Customer Contracts */}
      <div style={CARD}>
        <Text style={SECTION_TITLE}>Grouped Customer Contracts</Text>
        <Table<Contract>
          dataSource={groupedContracts}
          columns={groupedCols}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5, size: 'small' }}
          scroll={{ x: 900 }}
          rowClassName={(record) => toRemove.has(record.id) ? 'row-to-remove' : ''}
        />
      </div>

      {/* Section 3: Ungrouped Customer Contracts (previously in group) */}
      <div style={CARD}>
        <Text style={SECTION_TITLE}>Ungrouped Customer Contracts</Text>
        <Table
          dataSource={sampleUngroupedContracts}
          columns={ungroupedCols}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 800 }}
        />
      </div>
    </EditPageLayout>
  )
}
