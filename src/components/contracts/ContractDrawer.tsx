import { Drawer, Button, Dropdown, Table, Typography, Divider, Space, Tooltip } from 'antd'
import {
  CloseOutlined,
  LinkOutlined,
  DownOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { Contract } from '@/types/contract'
import type { Trip, OtherCharge } from '@/types/contract'
import StatusBadge from '@/components/common/StatusBadge'

const { Text, Title } = Typography

interface ContractDrawerProps {
  contract: Contract | null
  open: boolean
  onClose: () => void
}

function InfoField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</Text>
      <Text strong style={{ fontSize: 13 }}>{children}</Text>
    </div>
  )
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
      {children}
    </div>
  )
}

const tripColumns = [
  { title: 'Trip Type', dataIndex: 'tripType', key: 'tripType', width: 90, render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text> },
  { title: 'Start Time', dataIndex: 'startTime', key: 'startTime', width: 90, render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text> },
  { title: 'Capacity', dataIndex: 'capacity', key: 'capacity', width: 80, render: (v: number) => <Text style={{ fontSize: 13 }}>{v}</Text> },
  { title: 'Active Days', dataIndex: 'activeDays', key: 'activeDays', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text> },
  {
    title: 'Linked Route',
    dataIndex: 'linkedRoute',
    key: 'linkedRoute',
    width: 110,
    render: (v: string) => (
      <Text style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer' }}>{v}</Text>
    ),
  },
]

const chargeColumns = [
  { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text> },
  { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 100, render: (v: number) => <Text style={{ fontSize: 13 }}>{v}</Text> },
]

const actionItems = [
  { key: 'join', label: 'Join Existing Group' },
  { key: 'download', label: 'Download' },
  { key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Delete</span> },
  { key: 'history', label: 'View Change His...' },
]

const editItems = [
  { key: 'edit', label: 'Edit' },
  { key: 'duplicate', label: 'Duplicate' },
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
      width={480}
      closeIcon={false}
      styles={{
        body: { padding: 0 },
        header: { display: 'none' },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer' }}>
              <LinkOutlined style={{ marginRight: 4 }} />
              See full details
            </Text>
            <CloseOutlined
              onClick={onClose}
              style={{ fontSize: 16, color: '#8c8c8c', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <Title level={4} style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
                {contract.contractNo}
              </Title>
              <StatusBadge status={contract.status} />
            </div>
            <Space size={8}>
              <Dropdown menu={{ items: actionItems }} trigger={['click']}>
                <Button>
                  Actions <DownOutlined />
                </Button>
              </Dropdown>
              <Dropdown
                menu={{ items: editItems }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  type="primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 0, paddingRight: 8 }}
                >
                  Edit
                  <Divider type="vertical" style={{ borderColor: 'rgba(255,255,255,0.3)', height: 16, margin: '0 4px 0 8px' }} />
                  <DownOutlined style={{ fontSize: 11 }} />
                </Button>
              </Dropdown>
            </Space>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          {/* Basic Information */}
          <Title level={5} style={{ margin: '0 0 16px', fontSize: 15 }}>Basic Information</Title>

          <div style={{ marginBottom: 16 }}>
            <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 4 }}>Contract Title</Text>
            <Text strong style={{ fontSize: 13 }}>{contract.contractTitle}</Text>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <InfoGrid>
            <InfoField label="Customer Code">{contract.customerCode}</InfoField>
            <InfoField label="Booking Type">{contract.bookingType}</InfoField>
          </InfoGrid>

          <Divider style={{ margin: '16px 0' }} />

          <InfoGrid>
            <InfoField label={
              <span>
                Price{' '}
                <Tooltip title="Refers to either the actual total for 1st full month of service, or total quotation value, depending on booking and price type. View contract for details.">
                  <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                </Tooltip>
              </span>
            }>
              {formatPrice(contract.price)}
            </InfoField>
            <InfoField label="Contract Period">
              {formatPeriod(contract.contractPeriodStart, contract.contractPeriodEnd)}
            </InfoField>
          </InfoGrid>

          <Divider style={{ margin: '16px 0' }} />

          <InfoGrid>
            <InfoField label="Contract Group">{contract.contractGroup || '-'}</InfoField>
            <InfoField label="Contract Remark">{contract.contractRemark}</InfoField>
          </InfoGrid>

          <Divider style={{ margin: '20px 0' }} />

          {/* Trips */}
          <Title level={5} style={{ margin: '0 0 12px', fontSize: 15 }}>Trips</Title>
          <Table<Trip>
            dataSource={contract.trips}
            columns={tripColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
            style={{ marginBottom: 0 }}
            scroll={{ x: true }}
          />

          <Divider style={{ margin: '20px 0' }} />

          {/* Other Charges */}
          <Title level={5} style={{ margin: '0 0 12px', fontSize: 15 }}>Other Charges</Title>
          <Table<OtherCharge>
            dataSource={contract.otherCharges}
            columns={chargeColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
          />

          <Divider style={{ margin: '20px 0' }} />

          {/* Additional Information */}
          <Title level={5} style={{ margin: '0 0 16px', fontSize: 15 }}>Additional Information</Title>
          <InfoGrid>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Created On</Text>
              <Text strong style={{ fontSize: 13, display: 'block' }}>{contract.createdOn}</Text>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>1 month ago</Text>
            </div>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Created By</Text>
              <Text strong style={{ fontSize: 13 }}>{contract.createdBy}</Text>
            </div>
          </InfoGrid>

          <Divider style={{ margin: '16px 0' }} />

          <InfoGrid>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Last Updated On</Text>
              <Text strong style={{ fontSize: 13, display: 'block' }}>{contract.lastUpdatedOn}</Text>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>1 month ago</Text>
            </div>
            <div>
              <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 2 }}>Last Updated By</Text>
              <Text strong style={{ fontSize: 13 }}>{contract.lastUpdatedBy}</Text>
            </div>
          </InfoGrid>
        </div>
      </div>
    </Drawer>
  )
}
