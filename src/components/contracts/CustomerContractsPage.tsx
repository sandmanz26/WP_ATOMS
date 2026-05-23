import { useState, useMemo } from 'react'
import {
  Table,
  Input,
  Button,
  DatePicker,
  Typography,
  Space,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { Contract } from '@/types/contract'
import { mockContracts, upcomingCount, endingNextFourteenDays } from '@/data/mockData'
import StatusBadge from '@/components/common/StatusBadge'
import StatCard from '@/components/contracts/StatCard'
import ContractDrawer from '@/components/contracts/ContractDrawer'

const { RangePicker } = DatePicker
const { Text } = Typography

const PAGE_SIZE = 10

export default function CustomerContractsPage() {
  const [search, setSearch] = useState('')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pagination, setPagination] = useState<TablePaginationConfig>({ current: 1, pageSize: PAGE_SIZE })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return mockContracts
    return mockContracts.filter(
      (c) =>
        c.contractNo.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.contractTitle.toLowerCase().includes(q) ||
        c.contractGroup.toLowerCase().includes(q) ||
        c.createdBy.toLowerCase().includes(q)
    )
  }, [search])

  const handleRowClick = (record: Contract) => {
    setSelectedContract(record)
    setDrawerOpen(true)
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return <Text style={{ color: '#bfbfbf' }}>-</Text>
    return `$ ${price.toLocaleString('en-US', { minimumFractionDigits: 3 }).replace(',', '.')}`
  }

  const formatPeriod = (start: string, end: string | null) =>
    end ? `${start} - ${end}` : `${start} - no end date`

  const columns: ColumnsType<Contract> = [
    {
      title: 'Contract No',
      dataIndex: 'contractNo',
      key: 'contractNo',
      sorter: (a, b) => a.contractNo.localeCompare(b.contractNo),
      render: (v) => <Text style={{ fontSize: 13, color: '#1a1a1a' }}>{v}</Text>,
      width: 180,
    },
    {
      title: 'Customer Code',
      dataIndex: 'customerCode',
      key: 'customerCode',
      sorter: (a, b) => a.customerCode.localeCompare(b.customerCode),
      render: (v) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 140,
    },
    {
      title: 'Contract Group',
      dataIndex: 'contractGroup',
      key: 'contractGroup',
      sorter: (a, b) => a.contractGroup.localeCompare(b.contractGroup),
      render: (v) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 180,
    },
    {
      title: 'Booking Type',
      dataIndex: 'bookingType',
      key: 'bookingType',
      sorter: (a, b) => a.bookingType.localeCompare(b.bookingType),
      render: (v) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 120,
    },
    {
      title: (
        <Space size={4}>
          Price
          <Tooltip
            title="Refers to either the actual total for 1st full month of service, or total quotation value, depending on booking and price type. View contract for details."
            placement="top"
          >
            <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'price',
      key: 'price',
      sorter: (a, b) => (a.price ?? 0) - (b.price ?? 0),
      render: (v) => <Text style={{ fontSize: 13 }}>{formatPrice(v)}</Text>,
      width: 110,
    },
    {
      title: 'Contract Title',
      dataIndex: 'contractTitle',
      key: 'contractTitle',
      sorter: (a, b) => a.contractTitle.localeCompare(b.contractTitle),
      render: (v) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 240,
    },
    {
      title: 'Contract Period',
      key: 'contractPeriod',
      sorter: (a, b) => a.contractPeriodStart.localeCompare(b.contractPeriodStart),
      render: (_, record) => (
        <Text style={{ fontSize: 13 }}>
          {formatPeriod(record.contractPeriodStart, record.contractPeriodEnd)}
        </Text>
      ),
      width: 200,
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      sorter: (a, b) => a.createdBy.localeCompare(b.createdBy),
      render: (v) => <Text style={{ fontSize: 13 }}>{v}</Text>,
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v) => <StatusBadge status={v} />,
      width: 100,
    },
    {
      title: 'Last Updated On',
      dataIndex: 'lastUpdatedOn',
      key: 'lastUpdatedOn',
      sorter: (a, b) => a.lastUpdatedOn.localeCompare(b.lastUpdatedOn),
      render: (v) => <Text style={{ fontSize: 13, color: '#595959' }}>{v}</Text>,
      width: 160,
    },
  ]

  const start = ((pagination.current ?? 1) - 1) * PAGE_SIZE + 1
  const end = Math.min((pagination.current ?? 1) * PAGE_SIZE, filtered.length)

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Page Title */}
      <Text style={{ fontSize: 26, fontWeight: 700, display: 'block', marginBottom: 20, color: '#1a1a1a' }}>
        Customer Contracts
      </Text>

      {/* Stat Cards */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard count={upcomingCount} label="Upcoming" />
        <StatCard count={endingNextFourteenDays} label="Ending (Next 14 Days)" />
      </div>

      {/* Table Card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: '#595959', whiteSpace: 'nowrap' }}>Last updated on:</Text>
            <RangePicker
              size="middle"
              placeholder={['Start of time', '23 Oct 2024']}
              style={{ fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search Customer Contracts"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination((p) => ({ ...p, current: 1 }))
              }}
              style={{ width: 240, fontSize: 13 }}
              allowClear
            />
            <Button icon={<FilterOutlined />} style={{ color: '#595959' }} />
            <Button type="primary">Group customer contracts</Button>
          </div>
        </div>

        {/* Table */}
        <Table<Contract>
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="middle"
          scroll={{ x: 1400 }}
          pagination={{
            current: pagination.current,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (page, size) => setPagination({ current: page, pageSize: size }),
            style: { padding: '8px 20px' },
          }}
          onChange={(pag) => setPagination(pag)}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          rowClassName={(record) =>
            selectedContract?.id === record.id ? 'selected-row' : ''
          }
          footer={() => (
            <Text style={{ fontSize: 13, color: '#595959' }}>
              You are now viewing Customer Contract {start} – {end} of {filtered.length}
            </Text>
          )}
          style={{ borderRadius: 0 }}
        />
      </div>

      <ContractDrawer
        contract={selectedContract}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
