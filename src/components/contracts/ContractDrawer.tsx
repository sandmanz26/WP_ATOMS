import { Drawer, Button, Dropdown, Table, Typography, Divider, Space, Tooltip } from 'antd'
import {
  CloseOutlined,
  LinkOutlined,
  DownOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { Contract, Trip, OtherCharge } from '@/types/contract'
import StatusBadge from '@/components/common/StatusBadge'

const { Text, Title } = Typography

interface ContractDrawerProps {
  contract: Contract | null
  open: boolean
  onClose: () => void
}

function InfoField({ label, children, sub }: { label: React.ReactNode; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</Text>
      <Text strong style={{ fontSize: 13, display: 'block' }}>{children}</Text>
      {sub && <Text style={{ color: '#8c8c8c', fontSize: 12, marginTop: 2, display: 'block' }}>{sub}</Text>}
    </div>
  )
}

function InfoRow({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Divider style={{ margin: '16px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        {children}
      </div>
    </>
  )
}

const tripColumns = [
  {
    title: 'Trip Type',
    dataIndex: 'tripType',
    key: 'tripType',
    width: 80,
    onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
    render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
  },
  {
    title: 'Start Time',
    dataIndex: 'startTime',
    key: 'startTime',
    width: 90,
    onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
    render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
  },
  {
    title: 'Capacity',
    dataIndex: 'capacity',
    key: 'capacity',
    width: 75,
    onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
    render: (v: number) => <Text style={{ fontSize: 13 }}>{v}</Text>,
  },
  {
    title: 'Active Days',
    dataIndex: 'activeDays',
    key: 'activeDays',
    onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
    render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
  },
  {
    title: 'Linked Route',
    dataIndex: 'linkedRoute',
    key: 'linkedRoute',
    width: 105,
    onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
    render: (v: string) => (
      <Text style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer' }}>{v}</Text>
    ),
  },
]

const chargeColumns = [
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
  },
  {
    title: 'Quantity',
    dataIndex: 'quantity',
    key: 'quantity',
    width: 90,
    render: (v: number) => <Text style={{ fontSize: 13 }}>{v}</Text>,
  },
]

const actionItems = [
  { key: 'join', label: 'Join Existing Group' },
  { key: 'download', label: 'Download' },
  { key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Delete</span> },
  { key: 'history', label: 'Change History' },
]

const editItems = [
  { key: 'basic', label: 'Basic Information' },
  { key: 'price', label: 'Price' },
  { key: 'payment', label: 'Payment details' },
  { key: 'group', label: 'Group' },
]

export default function ContractDrawer({ contract, open, onClose }: ContractDrawerProps) {
  if (!contract) return null

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `$ ${price.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
  }

  const formatPeriod = (start: string, end: string | null) =>
    end ? `${start} - ${end}` : `${start} - no end date`

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      closeIcon={false}
      styles={{
        body: { padding: 0 },
        header: { display: 'none' },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 0' }}>

          {/* See full details / Close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <LinkOutlined style={{ fontSize: 13 }} />
              See full details
            </Text>
            <CloseOutlined
              onClick={onClose}
              style={{ fontSize: 15, color: '#8c8c8c', cursor: 'pointer' }}
            />
          </div>

          {/* Contract No + Actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <Title
                level={4}
                style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
              >
                {contract.contractNo}
              </Title>
              <StatusBadge status={contract.status} />
            </div>

            <Space size={8} style={{ flexShrink: 0 }}>
              {/* Actions dropdown */}
              <Dropdown menu={{ items: actionItems }} trigger={['click']} placement="bottomRight">
                <Button style={{ minWidth: 110 }}>
                  Actions <DownOutlined style={{ fontSize: 11 }} />
                </Button>
              </Dropdown>

              {/* Edit split button */}
              <Dropdown menu={{ items: editItems }} trigger={['click']} placement="bottomRight">
                <Button
                  type="primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0,
                    paddingLeft: 16,
                    paddingRight: 10,
                  }}
                >
                  Edit
                  <span
                    style={{
                      display: 'inline-block',
                      width: 1,
                      height: 14,
                      background: 'rgba(255,255,255,0.35)',
                      margin: '0 8px',
                    }}
                  />
                  <DownOutlined style={{ fontSize: 11 }} />
                </Button>
              </Dropdown>
            </Space>
          </div>
        </div>

        <Divider style={{ margin: '18px 0 0' }} />

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 32px' }}>

          {/* Basic Information */}
          <Title level={5} style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 600 }}>
            Basic Information
          </Title>

          {/* Contract Title – full width */}
          <InfoField label="Contract Title">{contract.contractTitle}</InfoField>

          {/* Customer Code / Booking Type */}
          <InfoRow>
            <InfoField label="Customer Code">{contract.customerCode}</InfoField>
            <InfoField label="Booking Type">{contract.bookingType}</InfoField>
          </InfoRow>

          {/* Price / Contract Period */}
          <InfoRow>
            <InfoField
              label={
                <span>
                  Price{' '}
                  <Tooltip title="Refers to either the actual total for 1st full month of service, or total quotation value, depending on booking and price type. View contract for details.">
                    <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                  </Tooltip>
                </span>
              }
            >
              {formatPrice(contract.price)}
            </InfoField>
            <InfoField label="Contract Period">
              {formatPeriod(contract.contractPeriodStart, contract.contractPeriodEnd)}
            </InfoField>
          </InfoRow>

          {/* Contract Group / Contract Remark */}
          <InfoRow>
            <InfoField label="Contract Group" sub={contract.contractPeriodStart.split(' ')[1]}>
              {contract.contractGroup || '-'}
            </InfoField>
            <InfoField label="Contract Remark">{contract.contractRemark}</InfoField>
          </InfoRow>

          <Divider style={{ margin: '20px 0' }} />

          {/* Trips */}
          <Title level={5} style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Trips</Title>
          <Table<Trip>
            dataSource={contract.trips}
            columns={tripColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
            scroll={{ x: true }}
          />

          <Divider style={{ margin: '20px 0' }} />

          {/* Other Charges */}
          <Title level={5} style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Other Charges</Title>
          <Table<OtherCharge>
            dataSource={contract.otherCharges}
            columns={chargeColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
          />

          <Divider style={{ margin: '20px 0' }} />

          {/* Additional Information */}
          <Title level={5} style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Additional Information</Title>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Created On</Text>
              <Text strong style={{ fontSize: 13, display: 'block' }}>{contract.createdOn}</Text>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>1 month ago</Text>
            </div>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Created By</Text>
              <Text strong style={{ fontSize: 13 }}>{contract.createdBy}</Text>
            </div>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Last Updated On</Text>
              <Text strong style={{ fontSize: 13, display: 'block' }}>{contract.lastUpdatedOn}</Text>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>1 month ago</Text>
            </div>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Last Updated By</Text>
              <Text strong style={{ fontSize: 13 }}>{contract.lastUpdatedBy}</Text>
            </div>
          </div>

        </div>
      </div>
    </Drawer>
  )
}
