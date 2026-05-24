import { useState } from 'react'
import { Drawer, Button, Dropdown, Table, Typography, Divider, Space, Tooltip, message } from 'antd'
import {
  CloseOutlined,
  LinkOutlined,
  DownOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { Contract, Trip, OtherCharge } from '@/types/contract'
import type { AppPage } from '@/App'
import StatusBadge from '@/components/common/StatusBadge'
import EditPaymentDetailsModal from '@/components/contracts/EditPaymentDetailsModal'
import VoidContractModal from '@/components/contracts/VoidContractModal'

const { Text, Title } = Typography

interface ContractDrawerProps {
  contract: Contract | null
  open: boolean
  onClose: () => void
  onNavigate: (page: AppPage) => void
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

export default function ContractDrawer({ contract, open, onClose, onNavigate }: ContractDrawerProps) {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [voidModalOpen, setVoidModalOpen] = useState(false)

  if (!contract) return null

  const isEndedOrVoided = contract.status === 'Ended' || contract.status === 'Voided'
  const hasGroup = Boolean(contract.contractGroup && contract.contractGroup.trim() !== '')
  const isUpcoming = contract.status === 'Upcoming'
  const isVoided = contract.status === 'Voided'

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `$ ${price.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
  }

  const formatPeriod = (start: string, end: string | null) =>
    end ? `${start} - ${end}` : `${start} - no end date`

  // Edit dropdown items with disable/tooltip logic
  const editItems = [
    {
      key: 'basic',
      label: isEndedOrVoided ? (
        <Tooltip title="Cannot edit an Ended or Voided contract">
          <span style={{ color: '#bfbfbf' }}>Basic Information</span>
        </Tooltip>
      ) : (
        <span>Basic Information</span>
      ),
      disabled: isEndedOrVoided,
    },
    {
      key: 'price',
      label: isEndedOrVoided ? (
        <Tooltip title="Cannot edit an Ended or Voided contract">
          <span style={{ color: '#bfbfbf' }}>Price</span>
        </Tooltip>
      ) : (
        <span>Price</span>
      ),
      disabled: isEndedOrVoided,
    },
    {
      key: 'payment',
      label: isEndedOrVoided ? (
        <Tooltip title="Cannot edit an Ended or Voided contract">
          <span style={{ color: '#bfbfbf' }}>Payment Details</span>
        </Tooltip>
      ) : (
        <span>Payment Details</span>
      ),
      disabled: isEndedOrVoided,
    },
    {
      key: 'group',
      label: (isEndedOrVoided || !hasGroup) ? (
        <Tooltip title={isEndedOrVoided ? 'Cannot edit an Ended or Voided contract' : 'Contract is not in a group'}>
          <span style={{ color: '#bfbfbf' }}>Group</span>
        </Tooltip>
      ) : (
        <span>Group</span>
      ),
      disabled: isEndedOrVoided || !hasGroup,
    },
  ]

  // Actions dropdown items
  const actionItems = [
    {
      key: 'join',
      label: (hasGroup || isVoided) ? (
        <Tooltip title={hasGroup ? 'Already in a group' : 'Voided contracts cannot join a group'}>
          <span style={{ color: '#bfbfbf' }}>Join Existing Group</span>
        </Tooltip>
      ) : (
        <span>Join Existing Group</span>
      ),
      disabled: hasGroup || isVoided,
    },
    {
      key: 'download',
      label: <span>Download</span>,
    },
    {
      key: 'history',
      label: <span>View Change History</span>,
    },
    {
      key: 'price-history',
      label: <span>View Price Change History</span>,
    },
    {
      key: 'void',
      label: isUpcoming ? (
        <span style={{ color: '#ff4d4f' }}>Void</span>
      ) : (
        <Tooltip title="Only Upcoming contracts can be voided">
          <span style={{ color: '#bfbfbf' }}>Void</span>
        </Tooltip>
      ),
      disabled: !isUpcoming,
    },
  ]

  const handleEditMenuClick = ({ key }: { key: string }) => {
    if (key === 'basic' && !isEndedOrVoided) {
      onNavigate({ type: 'edit-basic', contractId: contract.id })
    } else if (key === 'price' && !isEndedOrVoided) {
      onNavigate({ type: 'edit-price', contractId: contract.id })
    } else if (key === 'payment' && !isEndedOrVoided) {
      setPaymentModalOpen(true)
    } else if (key === 'group' && !isEndedOrVoided && hasGroup) {
      onNavigate({ type: 'edit-group', contractId: contract.id })
    }
  }

  const handleActionMenuClick = ({ key }: { key: string }) => {
    if (key === 'void' && isUpcoming) {
      setVoidModalOpen(true)
    } else if (key === 'history') {
      message.info('Change history is not yet available')
    } else if (key === 'price-history') {
      message.info('Price change history is not yet available')
    } else if (key === 'download') {
      message.info('Download is not yet available')
    }
  }

  return (
    <>
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
              <Text
                onClick={() => { onNavigate({ type: 'detail', contractId: contract.id }); onClose() }}
                style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
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
                <Dropdown
                  menu={{ items: actionItems, onClick: handleActionMenuClick }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button style={{ minWidth: 110 }}>
                    Actions <DownOutlined style={{ fontSize: 11 }} />
                  </Button>
                </Dropdown>

                {/* Edit split button */}
                <Dropdown
                  menu={{ items: editItems, onClick: handleEditMenuClick }}
                  trigger={['click']}
                  placement="bottomRight"
                >
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

      {/* Payment Details Modal */}
      {paymentModalOpen && (
        <EditPaymentDetailsModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          contract={contract}
        />
      )}

      {/* Void Contract Modal */}
      <VoidContractModal
        open={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
      />
    </>
  )
}
