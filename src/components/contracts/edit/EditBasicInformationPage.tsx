import { useState, useRef } from 'react'
import {
  Input, Select, Table, Typography, Tag, Divider, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import EditPageLayout from './EditPageLayout'
import { mockContracts } from '@/data/mockData'
import type { Trip, OtherCharge } from '@/types/contract'
import StatusBadge from '@/components/common/StatusBadge'

const { Text } = Typography
const { TextArea } = Input

interface Props { contractId: string; onBack: () => void }

const CARD: React.CSSProperties = {
  background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
  padding: '24px', marginBottom: 16,
}
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 20, display: 'block',
}
const DISABLED_INPUT: React.CSSProperties = { background: '#fafafa', color: '#595959' }

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 13, color: '#8c8c8c' }}>
        {required && <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>}
        {children}
      </Text>
    </div>
  )
}

const TAB_KEYS = ['basic', 'customer', 'trips', 'charges', 'payment'] as const
type TabKey = typeof TAB_KEYS[number]
const TAB_LABELS: Record<TabKey, string> = {
  basic: 'Basic Information',
  customer: 'Customer Details',
  trips: 'Trips',
  charges: 'Other Charges',
  payment: 'Payment Details',
}

const dayOptions = [
  ...Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
  { label: 'Last day of month', value: 'last' },
]

export default function EditBasicInformationPage({ contractId, onBack }: Props) {
  const contract = mockContracts.find(c => c.id === contractId)!
  const [remarks, setRemarks] = useState(contract.contractRemark ?? '')
  const [picName, setPicName] = useState(contract.picName ?? '')
  const [activeTab, setActiveTab] = useState<TabKey>('basic')

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

  const isEditable = contract.status !== 'Ended' && contract.status !== 'Voided'

  const fmt = (n: number) =>
    `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

  const tripCols: ColumnsType<Trip> = [
    { title: 'Trip Type', dataIndex: 'tripType', key: 'tt', width: 90, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Start Date', dataIndex: 'startDate', key: 'sd', width: 105, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => v || '-' },
    { title: 'End Date', dataIndex: 'endDate', key: 'ed', width: 105, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => v || '-' },
    { title: 'Start Time', dataIndex: 'startTime', key: 'st', width: 95, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Capacity', dataIndex: 'capacity', key: 'cap', width: 80 },
    { title: 'Active Days', dataIndex: 'activeDays', key: 'ad' },
    { title: 'Linked Routes', dataIndex: 'linkedRoute', key: 'lr', width: 120, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
    {
      title: 'Trip Status', dataIndex: 'tripStatus', key: 'ts', width: 100, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (v: string) => v ? (
        <Tag color={v === 'Active' ? 'green' : v === 'Upcoming' ? 'blue' : 'default'} style={{ borderRadius: 4 }}>{v}</Tag>
      ) : '-',
    },
  ]

  const chargeCols: ColumnsType<OtherCharge> = [
    { title: 'Item Description', dataIndex: 'description', key: 'desc' },
    { title: 'Quantity', dataIndex: 'quantity', key: 'qty', width: 90 },
    { title: 'Unit Price', dataIndex: 'unitPrice', key: 'up', width: 110, render: (v: number | undefined) => v != null ? fmt(v) : '-' },
    { title: 'Amount', dataIndex: 'amount', key: 'amt', width: 110, render: (v: number | undefined) => v != null ? fmt(v) : '-' },
    { title: 'Remark', dataIndex: 'itemRemarks', key: 'ir', render: (v: string) => v || '-' },
  ]

  const handleSave = () => {
    message.success('Saved successfully')
    onBack()
  }

  return (
    <EditPageLayout
      title={`Edit ${contract.contractNo} - Basic Information`}
      breadcrumb="Edit Customer Contract"
      onBack={onBack}
      onSave={handleSave}
    >
      <div style={{ marginBottom: 12 }}>
        <StatusBadge status={contract.status} />
      </div>

      {/* ── Sticky tab anchor navigation ── */}
      <div style={{
        position: 'sticky', top: 112, zIndex: 8,
        background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
        marginBottom: 16, overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', padding: '0 8px' }}>
          {TAB_KEYS.map(key => (
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

      {/* ── Basic Information ── */}
      <div ref={basicRef} style={CARD}>
        <Text style={SECTION_TITLE}>Basic Information</Text>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FieldLabel required>Contract Title</FieldLabel>
            <Input
              value={contract.contractTitle}
              disabled={!isEditable}
              style={!isEditable ? DISABLED_INPUT : {}}
              maxLength={120}
              showCount
            />
          </div>
          <div>
            <FieldLabel>Booking Type</FieldLabel>
            <Input value={contract.bookingType} disabled style={DISABLED_INPUT} />
          </div>
          <div>
            <FieldLabel>Price Type</FieldLabel>
            <Select
              value={contract.priceType ?? undefined}
              disabled
              style={{ width: '100%' }}
              placeholder="—"
              options={contract.priceType ? [{ label: contract.priceType, value: contract.priceType }] : []}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FieldLabel>Contract Start Date</FieldLabel>
            <Input value={contract.contractPeriodStart} disabled style={DISABLED_INPUT} />
          </div>
          <div>
            <FieldLabel>Contract End Date</FieldLabel>
            <Input
              value={contract.contractPeriodEnd ?? ''}
              disabled={!isEditable}
              style={!isEditable ? DISABLED_INPUT : {}}
              placeholder="—"
            />
          </div>
          <div>
            <FieldLabel>Contract Group</FieldLabel>
            <Input value={contract.contractGroup || '—'} disabled style={DISABLED_INPUT} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <FieldLabel>Source Quotation</FieldLabel>
            <Input value="—" disabled style={DISABLED_INPUT} />
          </div>
          <div>
            <FieldLabel>Contract Remarks</FieldLabel>
            <TextArea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              maxLength={120}
              showCount
              rows={2}
              disabled={!isEditable}
              placeholder="Enter contract remarks"
            />
          </div>
        </div>
      </div>

      {/* ── Customer Detail ── */}
      <div ref={customerRef} style={CARD}>
        <Text style={SECTION_TITLE}>Customer Detail</Text>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FieldLabel required>Customer Code</FieldLabel>
            <Select
              value={contract.customerCode}
              disabled={Boolean(contract.contractGroup) || !isEditable}
              style={{ width: '100%' }}
              options={[{ label: contract.customerCode, value: contract.customerCode }]}
            />
          </div>
          <div>
            <FieldLabel>Company Name</FieldLabel>
            <Input value={contract.companyName ?? '—'} disabled style={DISABLED_INPUT} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 110px 160px', gap: 16, marginBottom: 16, alignItems: 'end' }}>
          <div>
            <FieldLabel>Postal Code</FieldLabel>
            <Input.Search
              value={contract.postalCode ?? ''}
              placeholder="Postal code"
              enterButton="Search"
              disabled={!isEditable}
              onSearch={() => {}}
            />
          </div>
          <div>
            <FieldLabel>Street Address</FieldLabel>
            <Input value={contract.address ?? '—'} disabled style={DISABLED_INPUT} />
          </div>
          <div>
            <FieldLabel>Unit No</FieldLabel>
            <Input value={contract.unitNo ?? '—'} disabled style={DISABLED_INPUT} />
          </div>
          <div>
            <FieldLabel>Building Name</FieldLabel>
            <Input value={contract.buildingName ?? '—'} disabled style={DISABLED_INPUT} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <FieldLabel required>PIC Name</FieldLabel>
            <Select
              value={picName || undefined}
              onChange={setPicName}
              disabled={!isEditable}
              style={{ width: '100%' }}
              placeholder="Select PIC"
              options={contract.picName ? [{ label: contract.picName, value: contract.picName }] : []}
            />
          </div>
          <div>
            <FieldLabel>PIC Email</FieldLabel>
            <Input value={contract.picEmail ?? '—'} disabled style={DISABLED_INPUT} />
          </div>
          <div>
            <FieldLabel>PIC Contact Number</FieldLabel>
            <Input value={contract.picContact ?? '—'} disabled style={DISABLED_INPUT} />
          </div>
        </div>
      </div>

      {/* ── Trips ── */}
      <div ref={tripsRef} style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ ...SECTION_TITLE, marginBottom: 0 }}>Trips</Text>
          <Text style={{ fontSize: 15, fontWeight: 600 }}>{fmt(subtotalTrips)}</Text>
        </div>
        <Table<Trip>
          dataSource={contract.trips}
          columns={tripCols}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
        />
      </div>

      {/* ── Other Charges ── */}
      <div ref={chargesRef} style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ ...SECTION_TITLE, marginBottom: 0 }}>Other Charges</Text>
          <Text style={{ fontSize: 15, fontWeight: 600 }}>{fmt(subtotalCharges)}</Text>
        </div>
        {contract.otherCharges.length > 0 ? (
          <Table<OtherCharge>
            dataSource={contract.otherCharges}
            columns={chargeCols}
            rowKey="id"
            size="small"
            pagination={false}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text style={{ color: '#8c8c8c' }}>No other charges</Text>
          </div>
        )}
      </div>

      {/* ── Quotation Price Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={CARD}>
          <Text style={SECTION_TITLE}>Quotation Price Summary</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <div>
              <FieldLabel>Discount Amount</FieldLabel>
              <Input
                addonBefore="$"
                value={contract.discount ?? ''}
                disabled
                style={DISABLED_INPUT}
                placeholder="0"
              />
            </div>
            <div>
              <FieldLabel>Reason for Discount</FieldLabel>
              <TextArea
                value={contract.discountReason ?? ''}
                disabled
                rows={1}
                style={DISABLED_INPUT}
                placeholder="Sample Reason"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel>Surcharge Amount</FieldLabel>
              <Input
                addonBefore="$"
                value={contract.surcharge ?? ''}
                disabled
                style={DISABLED_INPUT}
                placeholder="0"
              />
            </div>
            <div>
              <FieldLabel>Reason for Surcharge</FieldLabel>
              <TextArea
                value={contract.surchargeReason ?? ''}
                disabled
                rows={1}
                style={DISABLED_INPUT}
                placeholder="Sample Reason"
              />
            </div>
          </div>
        </div>

        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ fontSize: 14, color: '#595959' }}>
              {contract.bookingType === 'Term' ? 'Actual Total for First Month of Service' : 'Total Quotation Value'}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>{fmt(total)}</Text>
          </div>
          {([['Subtotal', subtotal], ['Discount', -discountAmt], ['Surcharge', surchargeAmt]] as [string, number][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <Text style={{ color: '#595959', fontSize: 14 }}>{label}</Text>
              <Text style={{ fontSize: 14 }}>{fmt(val)}</Text>
            </div>
          ))}
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <Text style={{ color: '#595959', fontSize: 14 }}>GST(9%)</Text>
            <Text style={{ fontSize: 14, color: '#8c8c8c' }}>({fmt(gst)})</Text>
          </div>
        </div>
      </div>

      {/* ── Payment Details ── */}
      <div ref={paymentRef} style={CARD}>
        <Text style={SECTION_TITLE}>Payment Details</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FieldLabel>Billing Company</FieldLabel>
            <Select
              value={contract.billingCompany ?? undefined}
              disabled
              style={{ width: '100%' }}
              placeholder="Select"
              options={contract.billingCompany ? [{ label: contract.billingCompany, value: contract.billingCompany }] : []}
            />
          </div>
          <div>
            <FieldLabel>Invoice Generation Date</FieldLabel>
            <Select
              value={contract.invoiceGenerationDate ?? undefined}
              disabled
              style={{ width: '100%' }}
              placeholder="Select"
              options={dayOptions}
            />
          </div>
          <div>
            <FieldLabel>Invoice Date</FieldLabel>
            <Select
              value={contract.invoiceDate ?? undefined}
              disabled
              style={{ width: '100%' }}
              placeholder="Select"
              options={dayOptions}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <FieldLabel>Account Payable</FieldLabel>
            <Select
              value={contract.accountPayable ?? undefined}
              disabled
              style={{ width: '100%' }}
              placeholder="Select"
              options={contract.accountPayable ? [{ label: contract.accountPayable, value: contract.accountPayable }] : []}
            />
          </div>
          <div>
            <FieldLabel required>Payment Terms (days)</FieldLabel>
            <Input value={contract.paymentTerms ?? ''} disabled style={DISABLED_INPUT} placeholder="30" />
          </div>
          <div>
            <FieldLabel required>Termination Notice (days)</FieldLabel>
            <Input value={String(contract.terminationNotice ?? '')} disabled style={DISABLED_INPUT} placeholder="3" />
          </div>
        </div>
      </div>
    </EditPageLayout>
  )
}
