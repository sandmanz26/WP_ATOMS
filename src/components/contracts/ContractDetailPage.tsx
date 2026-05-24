import { useState, useRef } from 'react'
import {
  Table, Typography, Tag, Divider, Button, Dropdown, Space, Tooltip, Drawer, message,
} from 'antd'
import { DownOutlined, TeamOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { mockContracts } from '@/data/mockData'
import type { Trip, OtherCharge } from '@/types/contract'
import type { AppPage } from '@/App'
import StatusBadge from '@/components/common/StatusBadge'
import EditPaymentDetailsModal from '@/components/contracts/EditPaymentDetailsModal'
import VoidContractModal from '@/components/contracts/VoidContractModal'

const { Text, Title } = Typography

interface Props {
  contractId: string
  onNavigate: (page: AppPage) => void
  onBack: () => void
}

const mockPriceHistory = [
  { id: '1', effectiveDate: '14 Jan 2026', editType: 'Price Edit', editMade: 'Trip price updated $800 → $1,200', reason: 'Annual price review', addedBy: 'Aldan Kwok' },
  { id: '2', effectiveDate: '14 Jan 2026', editType: 'Price Edit', editMade: 'Trip price updated $700 → $950', reason: 'Annual price review', addedBy: 'Monica Leo' },
  { id: '3', effectiveDate: '14 Jan 2026', editType: 'Surcharge Edit', editMade: 'Surcharge added $200', reason: 'Fuel cost increase', addedBy: 'Richard Jen' },
  { id: '4', effectiveDate: '17 Jan 2026', editType: 'Discount Edit', editMade: 'Discount changed $300 → $500', reason: 'Customer loyalty discount', addedBy: 'Richie Ken' },
  { id: '5', effectiveDate: '15 Jan 2026', editType: 'Price Edit', editMade: 'Other charge unit price $50 → $80', reason: 'Service fee update', addedBy: 'Nicholas Maung' },
  { id: '6', effectiveDate: '20 Feb 2026', editType: 'Price Edit', editMade: 'Trip price updated $900 → $1,050', reason: 'Q1 2026 price revision', addedBy: 'Jasmine Tan' },
  { id: '7', effectiveDate: '5 Mar 2026', editType: 'Surcharge Edit', editMade: 'Surcharge removed', reason: 'Fuel cost stabilised', addedBy: 'Aldan Kwok' },
]

const mockChangeHistory = [
  { id: '1', changedOn: '15 Mar 2026, 2:03pm', changedBy: 'Jasmine Tan', field: 'Contract End Date', oldValue: '31 Dec 2026', newValue: '31 Jul 2027' },
  { id: '2', changedOn: '10 Feb 2026, 11:20am', changedBy: 'Heng Yi Ting', field: 'PIC Name', oldValue: 'John Smith', newValue: 'Jasmine Tan' },
  { id: '3', changedOn: '27 Jan 2026, 9:45am', changedBy: 'Aldan Kwok', field: 'Contract Remarks', oldValue: '-', newValue: 'Cross-border customs remark added' },
  { id: '4', changedOn: '5 Jan 2026, 3:10pm', changedBy: 'Heng Yi Ting', field: 'Contract Group', oldValue: '-', newValue: 'APL Group A' },
]

const TAB_KEYS = ['basic', 'customer', 'trips', 'charges', 'payment'] as const
type TabKey = typeof TAB_KEYS[number]
const TAB_LABELS: Record<TabKey, string> = {
  basic: 'Basic Information',
  customer: 'Customer Details',
  trips: 'Trips',
  charges: 'Other Charges',
  payment: 'Payment Details',
}

const SIDEBAR_ITEMS = ['Notifications', 'Roles & Permissions', 'Tenant', 'Staff', 'Operations']
const SIDEBAR_SUBITEMS = ['Fleet Owners', 'Fleets', 'Drivers']

const CARD: React.CSSProperties = {
  background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
  padding: '24px', marginBottom: 16,
}
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 20, display: 'block',
}
const LBL: React.CSSProperties = { fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }
const VAL: React.CSSProperties = { fontSize: 13, display: 'block', fontWeight: 600, color: '#1a1a1a' }

function fmt(n: number) {
  const isInt = Number.isInteger(n)
  return `$ ${n.toLocaleString('en-US', {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtTotal(n: number) {
  const isInt = Number.isInteger(n)
  if (isInt) return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })},-`
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ordinalDay(n: string): string {
  if (n === 'last') return 'Last day of the month'
  const num = parseInt(n)
  if (isNaN(num)) return n
  const v = Math.abs(num % 100)
  const suffix = (v > 10 && v < 14) ? 'th' : (['th', 'st', 'nd', 'rd'][num % 10] ?? 'th')
  return `${num}${suffix} of the month`
}

export default function ContractDetailPage({ contractId, onNavigate, onBack }: Props) {
  const contract = mockContracts.find(c => c.id === contractId)!
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [voidModalOpen, setVoidModalOpen] = useState(false)
  const [changeHistoryOpen, setChangeHistoryOpen] = useState(false)

  const basicRef = useRef<HTMLDivElement>(null)
  const customerRef = useRef<HTMLDivElement>(null)
  const tripsRef = useRef<HTMLDivElement>(null)
  const chargesRef = useRef<HTMLDivElement>(null)
  const paymentRef = useRef<HTMLDivElement>(null)

  const REFS: Record<TabKey, React.RefObject<HTMLDivElement>> = {
    basic: basicRef, customer: customerRef, trips: tripsRef,
    charges: chargesRef, payment: paymentRef,
  }

  const scrollTo = (key: TabKey) => {
    setActiveTab(key)
    const el = REFS[key].current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 130
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const isEndedOrVoided = contract.status === 'Ended' || contract.status === 'Voided'
  const isUpcoming = contract.status === 'Upcoming'
  const hasGroup = Boolean(contract.contractGroup?.trim())
  const isVoided = contract.status === 'Voided'
  const hasTrips = contract.trips.length > 0
  const hasCharges = contract.otherCharges.length > 0

  const visibleTabs = TAB_KEYS.filter(k => {
    if (k === 'trips' && !hasTrips) return false
    if (k === 'charges' && !hasCharges) return false
    return true
  })

  // Price summary
  const subtotalTrips = contract.trips.reduce((s, t) => s + (t.tripPrice ?? 0), 0)
  const subtotalCharges = contract.otherCharges.reduce((s, c) => s + (c.amount ?? 0), 0)
  const subtotal = subtotalTrips + subtotalCharges
  const discountAmt = contract.discountType === '$'
    ? (contract.discount ?? 0)
    : (contract.discount ?? 0) / 100 * subtotal
  const surchargeAmt = contract.surchargeType === '$'
    ? (contract.surcharge ?? 0)
    : (contract.surcharge ?? 0) / 100 * subtotal
  const gst = (subtotal - discountAmt + surchargeAmt) * 0.09
  const total = subtotal - discountAmt + surchargeAmt + gst

  // Edit dropdown — per PRD: disabled for Ended/Voided; Group disabled if not in group
  const editItems = [
    {
      key: 'basic',
      label: isEndedOrVoided
        ? <Tooltip title="Cannot edit an Ended or Voided contract"><span style={{ color: '#bfbfbf' }}>Basic Information</span></Tooltip>
        : <span>Basic Information</span>,
      disabled: isEndedOrVoided,
    },
    {
      key: 'price',
      label: isEndedOrVoided
        ? <Tooltip title="Cannot edit an Ended or Voided contract"><span style={{ color: '#bfbfbf' }}>Price</span></Tooltip>
        : <span>Price</span>,
      disabled: isEndedOrVoided,
    },
    {
      key: 'payment',
      label: isEndedOrVoided
        ? <Tooltip title="Cannot edit an Ended or Voided contract"><span style={{ color: '#bfbfbf' }}>Payment Details</span></Tooltip>
        : <span>Payment Details</span>,
      disabled: isEndedOrVoided,
    },
    {
      key: 'group',
      label: (isEndedOrVoided || !hasGroup)
        ? <Tooltip title={isEndedOrVoided ? 'Cannot edit an Ended or Voided contract' : 'Contract is not in a group'}><span style={{ color: '#bfbfbf' }}>Group</span></Tooltip>
        : <span>Group</span>,
      disabled: isEndedOrVoided || !hasGroup,
    },
  ]

  // Actions dropdown — per PRD 1.1: Void only for Upcoming; Join disabled if in group or Voided
  const actionItems = [
    {
      key: 'join',
      label: (hasGroup || isVoided)
        ? <Tooltip title={hasGroup ? 'Already in a group' : 'Voided contracts cannot join a group'}><span style={{ color: '#bfbfbf' }}>Join Existing Group</span></Tooltip>
        : <span>Join Existing Group</span>,
      disabled: hasGroup || isVoided,
    },
    { key: 'download', label: <span>Download</span> },
    { key: 'history', label: <span>View Change History</span> },
    { key: 'price-history', label: <span>View Price Change History</span> },
    {
      key: 'void',
      label: isUpcoming
        ? <span style={{ color: '#ff4d4f' }}>Void</span>
        : <Tooltip title="Only Upcoming contracts can be voided"><span style={{ color: '#bfbfbf' }}>Void</span></Tooltip>,
      disabled: !isUpcoming,
    },
  ]

  const handleEditClick = ({ key }: { key: string }) => {
    if (isEndedOrVoided) return
    if (key === 'basic') onNavigate({ type: 'edit-basic', contractId: contract.id })
    else if (key === 'price') onNavigate({ type: 'edit-price', contractId: contract.id })
    else if (key === 'payment') setPaymentModalOpen(true)
    else if (key === 'group' && hasGroup) onNavigate({ type: 'edit-group', contractId: contract.id })
  }

  const handleActionClick = ({ key }: { key: string }) => {
    if (key === 'void' && isUpcoming) setVoidModalOpen(true)
    else if (key === 'history') setChangeHistoryOpen(true)
    else if (key === 'price-history') {
      document.getElementById('section-price-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    else if (key === 'download') message.info('Download is not yet available')
    else if (key === 'join') message.info('Join group is not yet available')
  }

  // Trip columns (sortable per PRD)
  const tripCols: ColumnsType<Trip> = [
    { title: 'Trip Type', dataIndex: 'tripType', key: 'tt', width: 90, sorter: (a, b) => a.tripType.localeCompare(b.tripType), onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Start Date', dataIndex: 'startDate', key: 'sd', width: 105, sorter: true, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => v || '-' },
    { title: 'End Date', dataIndex: 'endDate', key: 'ed', width: 105, sorter: true, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => v || '-' },
    { title: 'Start Time', dataIndex: 'startTime', key: 'st', width: 95, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'End Time', dataIndex: 'endTime', key: 'et', width: 90, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v?: string) => v || '-' },
    { title: 'Capacity', dataIndex: 'capacity', key: 'cap', width: 80 },
    { title: 'Active Days', dataIndex: 'activeDays', key: 'ad' },
    { title: 'Linked Routes', dataIndex: 'linkedRoute', key: 'lr', width: 120, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
  ]

  const chargeCols: ColumnsType<OtherCharge> = [
    { title: 'Item Description', dataIndex: 'description', key: 'desc' },
    { title: 'Quantity', dataIndex: 'quantity', key: 'qty', width: 90 },
    { title: 'Unit Price', dataIndex: 'unitPrice', key: 'up', width: 110, render: (v?: number) => v != null ? fmt(v) : '-' },
    { title: 'Amount', dataIndex: 'amount', key: 'amt', width: 110, render: (v?: number) => v != null ? fmt(v) : '-' },
    { title: 'Remark', dataIndex: 'itemRemarks', key: 'ir', render: (v?: string) => v || '-' },
  ]

  const priceHistoryCols = [
    { title: 'Edit Effective Date', dataIndex: 'effectiveDate', key: 'ed', width: 155, sorter: true, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Edit Type', dataIndex: 'editType', key: 'et', width: 130, sorter: true, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Edit Made', dataIndex: 'editMade', key: 'em', sorter: true, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Reason for Price Change', dataIndex: 'reason', key: 'r', onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Added By', dataIndex: 'addedBy', key: 'ab', width: 130, sorter: true, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0',
        position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100, overflowY: 'auto',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>C</span>
          </div>
          <Text strong style={{ fontSize: 14 }}>Company</Text>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#597ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>HE</span>
          </div>
          <Text style={{ fontSize: 13 }}>Heikke Ekkieh</Text>
        </div>
        {SIDEBAR_ITEMS.map(label => (
          <div key={label} style={{ padding: '8px 20px', fontSize: 13, color: '#595959', cursor: 'pointer', margin: '1px 8px', borderRadius: 6 }}>{label}</div>
        ))}
        {SIDEBAR_SUBITEMS.map(label => (
          <div key={label} style={{ padding: '8px 32px', fontSize: 13, color: '#595959', cursor: 'pointer' }}>{label}</div>
        ))}
        <div style={{ margin: '4px 8px', padding: '8px 12px', borderRadius: 6, background: '#e6f4ff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined style={{ color: '#1677ff', fontSize: 14 }} />
          <Text style={{ fontSize: 13, color: '#1677ff', fontWeight: 500 }}>Customer Contracts</Text>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Breadcrumb bar */}
        <div style={{
          padding: '0 32px', height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0', background: '#fff',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <Text style={{ fontSize: 13, color: '#8c8c8c' }}>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Home</span>
            {' / '}
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Customer Contract</span>
            {' / '}
            <span style={{ color: '#1a1a1a' }}>Customer Contract Detail</span>
          </Text>
          <Text
            onClick={onBack}
            style={{ fontSize: 13, color: '#1677ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <ArrowLeftOutlined style={{ fontSize: 12 }} />
            Return to Customer Contracts Listing
          </Text>
        </div>

        {/* Page header */}
        <div style={{
          padding: '16px 32px', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 48, zIndex: 9, borderBottom: '1px solid #e8e8e8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Title level={3} style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1a1a1a' }}>
              {contract.contractNo}
            </Title>
            <StatusBadge status={contract.status} />
          </div>
          <Space size={8}>
            <Button onClick={onBack}>Cancel</Button>
            <Dropdown
              menu={{ items: actionItems, onClick: handleActionClick }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button style={{ minWidth: 110 }}>
                Actions <DownOutlined style={{ fontSize: 11 }} />
              </Button>
            </Dropdown>
            <Dropdown
              menu={{ items: editItems, onClick: handleEditClick }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button
                type="primary"
                style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 16, paddingRight: 10 }}
              >
                Edit
                <span style={{ display: 'inline-block', width: 1, height: 14, background: 'rgba(255,255,255,0.35)', margin: '0 8px' }} />
                <DownOutlined style={{ fontSize: 11 }} />
              </Button>
            </Dropdown>
          </Space>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px', flex: 1 }}>

          {/* Sticky tab navigation */}
          <div style={{
            position: 'sticky', top: 112, zIndex: 8,
            background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
            marginBottom: 16, overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', padding: '0 8px' }}>
              {visibleTabs.map(key => (
                <button
                  key={key}
                  onClick={() => scrollTo(key)}
                  style={{
                    padding: '13px 20px', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: 14, outline: 'none',
                    color: activeTab === key ? '#1677ff' : '#595959',
                    borderBottom: activeTab === key ? '2px solid #1677ff' : '2px solid transparent',
                    fontWeight: activeTab === key ? 500 : 400,
                    marginBottom: -1, transition: 'color 0.2s',
                  }}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Section 1: Basic Information ── */}
          <div ref={basicRef} style={CARD}>
            <Text style={SECTION_TITLE}>Basic Information</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>

              {/* Left: fields with dividers between rows */}
              <div>
                {/* Row: Contract Title */}
                <div style={{ padding: '4px 0 16px' }}>
                  <Text style={LBL}>Contract Title</Text>
                  <Text style={{ ...VAL, fontSize: 14 }}>{contract.contractTitle}</Text>
                </div>
                <Divider style={{ margin: '0 0 16px' }} />

                {/* Row: Booking Type / Price Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px', padding: '0 0 16px' }}>
                  <div>
                    <Text style={LBL}>Booking Type</Text>
                    <Text style={VAL}>{contract.bookingType || '-'}</Text>
                  </div>
                  <div>
                    <Text style={LBL}>Price Type</Text>
                    <Text style={VAL}>{contract.priceType || '-'}</Text>
                  </div>
                </div>
                <Divider style={{ margin: '0 0 16px' }} />

                {/* Row: Contract Period / Contract Group */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px', padding: '0 0 16px' }}>
                  <div>
                    <Text style={LBL}>Contract Period</Text>
                    <Text style={{ ...VAL, color: '#1677ff' }}>
                      {contract.contractPeriodStart}
                      {' - '}
                      {contract.contractPeriodEnd ?? <em style={{ fontStyle: 'italic', color: '#8c8c8c' }}>no end date</em>}
                    </Text>
                  </div>
                  <div>
                    <Text style={LBL}>Contract Group</Text>
                    <Text style={VAL}>{contract.contractGroup || '-'}</Text>
                  </div>
                </div>
                <Divider style={{ margin: '0 0 16px' }} />

                {/* Row: Source Quotation / Contract Remark */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
                  <div>
                    <Text style={LBL}>Source Quotation</Text>
                    <Text style={VAL}>-</Text>
                  </div>
                  <div>
                    <Text style={LBL}>Contract Remark</Text>
                    <Text style={VAL}>{contract.contractRemark || '-'}</Text>
                  </div>
                </div>
              </div>

              {/* Right: Price Summary card */}
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e8e8', alignSelf: 'start' }}>
                <div style={{ background: '#2d2d2d', padding: '16px 20px', textAlign: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Price Summary</Text>
                </div>
                <div style={{ padding: '0 20px' }}>
                  {/* Sub Total — prominent, always 2dp */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
                    <Text style={{ fontSize: 14, fontWeight: 700 }}>Sub Total</Text>
                    <Text style={{ fontSize: 15, fontWeight: 700 }}>
                      {`$ ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </Text>
                  </div>
                  <Divider style={{ margin: 0 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                    <Text style={{ fontSize: 13, color: '#595959' }}>Discount</Text>
                    <Text style={{ fontSize: 13 }}>{fmt(discountAmt)}</Text>
                  </div>
                  <Divider style={{ margin: 0 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                    <Text style={{ fontSize: 13, color: '#595959' }}>Surcharge</Text>
                    <Text style={{ fontSize: 13 }}>{fmt(surchargeAmt)}</Text>
                  </div>
                  <Divider style={{ margin: 0 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                    <Text style={{ fontSize: 13, color: '#595959' }}>GST (9%)</Text>
                    <Text style={{ fontSize: 13 }}>{fmt(gst)}</Text>
                  </div>
                  <Divider style={{ margin: 0 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '14px 0' }}>
                    <Text style={{ fontSize: 12, color: '#595959', lineHeight: 1.5, flex: 1 }}>
                      {contract.bookingType === 'Term'
                        ? 'Actual Total for Full Month of Service'
                        : 'Total Quotation Value'}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {`$ ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Customer Details ── */}
          <div ref={customerRef} style={CARD}>
            <Text style={SECTION_TITLE}>Customer Details</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 40px', paddingBottom: 16 }}>
              <div>
                <Text style={LBL}>Customer Code</Text>
                <Text style={VAL}>{contract.customerCode}</Text>
              </div>
              <div>
                <Text style={LBL}>Company Name</Text>
                <Text style={VAL}>{contract.companyName || '-'}</Text>
              </div>
              <div>
                <Text style={LBL}>PIC Name</Text>
                <Text style={VAL}>{contract.picName || '-'}</Text>
              </div>
            </div>
            <Divider style={{ margin: '0 0 16px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 40px' }}>
              <div>
                <Text style={LBL}>PIC Contact Number</Text>
                <Text style={VAL}>{contract.picContact || '-'}</Text>
              </div>
              <div>
                <Text style={LBL}>PIC Email</Text>
                <Text style={VAL}>{contract.picEmail || '-'}</Text>
              </div>
              <div>
                <Text style={LBL}>Address</Text>
                <Text style={{ ...VAL, whiteSpace: 'normal' }}>
                  {[contract.address, contract.unitNo, contract.buildingName].filter(Boolean).join(', ') || '-'}
                </Text>
              </div>
            </div>
          </div>

          {/* ── Section 3: Trips ── */}
          {hasTrips && (
            <div ref={tripsRef} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ ...SECTION_TITLE, marginBottom: 0 }}>Trips</Text>
                <Text style={{ fontSize: 15, fontWeight: 600 }}>{fmtTotal(subtotalTrips)}</Text>
              </div>
              <Table<Trip>
                dataSource={contract.trips}
                columns={tripCols}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 950 }}
              />
            </div>
          )}

          {/* ── Section 4: Other Charges ── */}
          {hasCharges && (
            <div ref={chargesRef} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ ...SECTION_TITLE, marginBottom: 0 }}>Other Charges</Text>
                <Text style={{ fontSize: 15, fontWeight: 600 }}>{fmtTotal(subtotalCharges)}</Text>
              </div>
              <Table<OtherCharge>
                dataSource={contract.otherCharges}
                columns={chargeCols}
                rowKey="id"
                size="small"
                pagination={false}
              />
            </div>
          )}

          {/* ── Section 5: Payment Details ── */}
          <div ref={paymentRef} style={CARD}>
            <Text style={SECTION_TITLE}>Payment Details</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 40px', marginBottom: 20 }}>
              <div>
                <Text style={LBL}>Billing Company</Text>
                <Text style={VAL}>{contract.billingCompany || '-'}</Text>
              </div>
              <div>
                <Text style={LBL}>Invoice Generation Date</Text>
                <Text style={VAL}>
                  {contract.invoiceGenerationDate ? ordinalDay(contract.invoiceGenerationDate) : '-'}
                </Text>
              </div>
              <div>
                <Text style={LBL}>Invoice Date</Text>
                <Text style={VAL}>
                  {contract.invoiceDate ? ordinalDay(contract.invoiceDate) : '-'}
                </Text>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 40px' }}>
              <div>
                <Text style={LBL}>Account Payable</Text>
                <Text style={VAL}>{contract.accountPayable || '-'}</Text>
              </div>
              <div>
                <Text style={LBL}>Payment Terms</Text>
                <Text style={VAL}>{contract.paymentTerms ? `${contract.paymentTerms} Days` : '-'}</Text>
              </div>
              <div>
                <Text style={LBL}>Termination Notice</Text>
                <Text style={VAL}>{contract.terminationNotice != null ? `${contract.terminationNotice} days` : '-'}</Text>
              </div>
            </div>
          </div>

          {/* ── Section 6: Price Change History ── */}
          <div id="section-price-history" style={CARD}>
            <Text style={SECTION_TITLE}>Price Change History</Text>
            <Table
              dataSource={mockPriceHistory}
              columns={priceHistoryCols}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
              scroll={{ x: 800 }}
            />
          </div>

          {/* ── Section 7: Additional Information ── */}
          <div style={CARD}>
            <Text style={SECTION_TITLE}>Additional Information</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 40px', marginBottom: 20 }}>
              <div>
                <Text style={LBL}>Created On</Text>
                <Text style={VAL}>{contract.createdOn}</Text>
                <Text style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2, display: 'block' }}>1 month ago</Text>
              </div>
              <div>
                <Text style={LBL}>Created By</Text>
                <Text style={VAL}>{contract.createdBy}</Text>
              </div>
              <div>
                <Text style={LBL}>Updated On</Text>
                <Text style={VAL}>{contract.lastUpdatedOn}</Text>
                <Text style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2, display: 'block' }}>1 month ago</Text>
              </div>
            </div>
            <div>
              <Text style={LBL}>Updated By</Text>
              <Text style={VAL}>{contract.lastUpdatedBy}</Text>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}
      {paymentModalOpen && (
        <EditPaymentDetailsModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          contract={contract}
        />
      )}
      <VoidContractModal
        open={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
      />

      {/* ── Change History Drawer ── */}
      <Drawer
        open={changeHistoryOpen}
        onClose={() => setChangeHistoryOpen(false)}
        title="Change History"
        width={600}
        placement="right"
      >
        <Table
          dataSource={mockChangeHistory}
          columns={[
            { title: 'Changed On', dataIndex: 'changedOn', key: 'co', width: 165, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
            { title: 'Changed By', dataIndex: 'changedBy', key: 'cb', width: 130, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
            { title: 'Field', dataIndex: 'field', key: 'f', width: 150, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
            { title: 'Old Value', dataIndex: 'oldValue', key: 'ov', onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
            { title: 'New Value', dataIndex: 'newValue', key: 'nv', onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
          ]}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, size: 'small' }}
        />
      </Drawer>
    </div>
  )
}
