import { useState, useMemo } from 'react'
import {
  Table, Input, Select, Modal, Form, DatePicker, Typography, message, Divider,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import EditPageLayout from './EditPageLayout'
import { mockContracts } from '@/data/mockData'
import type { Trip, OtherCharge } from '@/types/contract'

const { Text } = Typography
const { TextArea } = Input

interface Props { contractId: string; onBack: () => void }

const CARD: React.CSSProperties = {
  background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
  padding: '24px', marginBottom: 16,
}
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 16, display: 'block',
}
const DISABLED_INPUT: React.CSSProperties = { background: '#fafafa', color: '#595959' }

function SectionLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 13, color: '#595959' }}>
        {required && <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>}
        {children}
      </Text>
    </div>
  )
}

export default function EditPricePage({ contractId, onBack }: Props) {
  const contract = mockContracts.find(c => c.id === contractId)!

  // trip prices keyed by trip id
  const [tripPrices, setTripPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(contract.trips.map(t => [t.id, String(t.tripPrice ?? '')]))
  )
  // other charges editable fields
  const [charges, setCharges] = useState(contract.otherCharges.map(c => ({ ...c })))

  // discount / surcharge
  const [discountType, setDiscountType] = useState<'$' | '%'>(contract.discountType ?? '$')
  const [discountVal, setDiscountVal] = useState(String(contract.discount ?? ''))
  const [discountReason, setDiscountReason] = useState(contract.discountReason ?? '')
  const [surchargeType, setSurchargeType] = useState<'$' | '%'>(contract.surchargeType ?? '$')
  const [surchargeVal, setSurchargeVal] = useState(String(contract.surcharge ?? ''))
  const [surchargeReason, setSurchargeReason] = useState(contract.surchargeReason ?? '')

  const [priceModalOpen, setPriceModalOpen] = useState(false)
  const [priceForm] = Form.useForm()

  // PRD: Term + Per Trip or Per Month → trip price editable; Per Day → subtotal editable
  const isTripPriceEditable = contract.priceType === 'Per Trip' || contract.priceType === 'Per Month'

  // auto-calc subtotal
  const subtotalTrips = useMemo(() => {
    if (isTripPriceEditable) {
      return contract.trips.reduce((s, t) => s + (parseFloat(tripPrices[t.id] ?? '0') || 0), 0)
    }
    return contract.trips.reduce((s, t) => s + (t.tripPrice ?? 0), 0)
  }, [tripPrices, contract.trips, isTripPriceEditable])

  const subtotalCharges = useMemo(
    () => charges.reduce((s, c) => s + (c.quantity * (c.unitPrice ?? 0)), 0),
    [charges]
  )

  const subtotal = subtotalTrips + subtotalCharges

  const discountAmt = discountType === '$'
    ? parseFloat(discountVal) || 0
    : (parseFloat(discountVal) || 0) / 100 * subtotal

  const surchargeAmt = surchargeType === '$'
    ? parseFloat(surchargeVal) || 0
    : (parseFloat(surchargeVal) || 0) / 100 * subtotal

  const gst = (subtotal - discountAmt + surchargeAmt) * 0.09
  const total = subtotal - discountAmt + surchargeAmt + gst

  const fmt = (n: number) => {
    const isInt = Number.isInteger(n)
    return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: isInt ? 0 : 2, maximumFractionDigits: 2 })}`
  }

  const fmtAdjust = (type: '$' | '%', rawVal: string, computedAmt: number): string => {
    if (type === '%') return `${rawVal || 0}%`
    return fmt(computedAmt)
  }

  const handleSave = () => setPriceModalOpen(true)

  const handlePriceModalSave = async () => {
    await priceForm.validateFields()
    message.success('Price edits saved successfully')
    setPriceModalOpen(false)
    onBack()
  }

  // ── Trip columns ───────────────────────────────────────────────────────────
  const tripCols: ColumnsType<Trip> = [
    { title: 'Trip Type', dataIndex: 'tripType', key: 'tt', width: 90, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Start Date', dataIndex: 'startDate', key: 'sd', width: 110, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Start Time', dataIndex: 'startTime', key: 'st', width: 100, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Capacity', dataIndex: 'capacity', key: 'cap', width: 90 },
    { title: 'Linked Routes', dataIndex: 'linkedRoute', key: 'lr', width: 120, render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Active Days', dataIndex: 'activeDays', key: 'ad' },
    {
      title: 'Trip Price',
      key: 'price',
      width: 130,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (_: unknown, record: Trip) => isTripPriceEditable ? (
        <Input
          value={tripPrices[record.id]}
          onChange={e => setTripPrices(prev => ({ ...prev, [record.id]: e.target.value }))}
          prefix="$"
          style={{ width: 110 }}
          placeholder="0.00"
        />
      ) : (
        <Text style={{ color: '#8c8c8c' }}>
          {record.tripPrice != null ? fmt(record.tripPrice) : '-'}
        </Text>
      ),
    },
  ]

  // ── Other charge columns (editable) ──────────────────────────────────────
  const chargeCols: ColumnsType<typeof charges[0]> = [
    {
      title: 'Item Description', key: 'desc',
      render: (_, __, i) => (
        <Input value={charges[i].description}
          onChange={e => setCharges(prev => prev.map((c, idx) => idx === i ? { ...c, description: e.target.value } : c))}
          placeholder="Item description"
        />
      ),
    },
    {
      title: 'Quantity', key: 'qty', width: 100,
      render: (_, __, i) => (
        <Input type="number" value={charges[i].quantity}
          onChange={e => setCharges(prev => prev.map((c, idx) => idx === i ? { ...c, quantity: Number(e.target.value), amount: Number(e.target.value) * (c.unitPrice ?? 0) } : c))}
          min={0}
        />
      ),
    },
    {
      title: 'Unit Price', key: 'up', width: 120,
      render: (_, __, i) => (
        <Input prefix="$" type="number" value={charges[i].unitPrice ?? ''}
          onChange={e => setCharges(prev => prev.map((c, idx) => idx === i ? { ...c, unitPrice: Number(e.target.value), amount: c.quantity * Number(e.target.value) } : c))}
          placeholder="0.00" min={0}
        />
      ),
    },
    {
      title: 'Amount', key: 'amt', width: 100,
      render: (_, __, i) => (
        <Input value={fmt(charges[i].quantity * (charges[i].unitPrice ?? 0))} disabled style={DISABLED_INPUT} />
      ),
    },
    {
      title: 'Item Remarks', key: 'ir',
      render: (_, __, i) => (
        <Input value={charges[i].itemRemarks ?? ''}
          onChange={e => setCharges(prev => prev.map((c, idx) => idx === i ? { ...c, itemRemarks: e.target.value } : c))}
          placeholder="Remarks"
        />
      ),
    },
  ]

  const typeSelect = (type: '$' | '%', onChange: (v: '$' | '%') => void) => (
    <Select value={type} onChange={onChange} style={{ width: 55 }} options={[{ value: '$', label: '$' }, { value: '%', label: '%' }]} />
  )

  return (
    <EditPageLayout title={`Edit ${contract.contractNo} - Price`} breadcrumb="Edit Customer Contract" onBack={onBack} onSave={handleSave}>

      {/* Basic Info — all disabled */}
      <div style={CARD}>
        <Text style={SECTION_TITLE}>Basic Information</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {[
            ['Contract Title', contract.contractTitle],
            ['Booking Type', contract.bookingType],
            ['Price Type', contract.priceType ?? '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <SectionLabel>{label}</SectionLabel>
              <Input value={val} disabled style={DISABLED_INPUT} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            ['Contract Start Date', contract.contractPeriodStart],
            ['Contract End Date', contract.contractPeriodEnd ?? '—'],
            ['Contract Group', contract.contractGroup || '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <SectionLabel>{label}</SectionLabel>
              <Input value={val} disabled style={DISABLED_INPUT} />
            </div>
          ))}
        </div>
      </div>

      {/* Customer Details — all disabled */}
      <div style={CARD}>
        <Text style={SECTION_TITLE}>Customer Detail</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            ['Customer Code', contract.customerCode],
            ['Company Name', contract.companyName ?? '—'],
            ['PIC Name', contract.picName ?? '—'],
            ['PIC Email', contract.picEmail ?? '—'],
            ['PIC Contact Number', contract.picContact ?? '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <SectionLabel>{label}</SectionLabel>
              <Input value={val} disabled style={DISABLED_INPUT} />
            </div>
          ))}
        </div>
      </div>

      {/* Trips — price column editable */}
      <div style={CARD}>
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

      {/* Other Charges — editable */}
      <div style={CARD}>
        <Text style={{ ...SECTION_TITLE }}>Other Charges</Text>
        <Table
          dataSource={charges}
          columns={chargeCols}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </div>

      {/* Discount / Surcharge + Price Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Left: discount/surcharge form */}
        <div style={CARD}>
          <Text style={SECTION_TITLE}>Quotation Price Summary</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <div>
              <SectionLabel>Discount Amount</SectionLabel>
              <Input
                value={discountVal}
                onChange={e => setDiscountVal(e.target.value)}
                addonBefore={typeSelect(discountType, setDiscountType)}
                placeholder="0"
                type="number"
                min={0}
              />
            </div>
            <div>
              <SectionLabel>Reason for Discount</SectionLabel>
              <TextArea
                value={discountReason}
                onChange={e => setDiscountReason(e.target.value)}
                maxLength={120}
                rows={1}
                placeholder="Sample Reason"
                disabled={!discountVal}
              />
              <Text style={{ fontSize: 11, color: '#bfbfbf' }}>{discountReason.length}/120</Text>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <SectionLabel>Surcharge Amount</SectionLabel>
              <Input
                value={surchargeVal}
                onChange={e => setSurchargeVal(e.target.value)}
                addonBefore={typeSelect(surchargeType, setSurchargeType)}
                placeholder="0"
                type="number"
                min={0}
              />
            </div>
            <div>
              <SectionLabel>Reason for Surcharge</SectionLabel>
              <TextArea
                value={surchargeReason}
                onChange={e => setSurchargeReason(e.target.value)}
                maxLength={120}
                rows={1}
                placeholder="Sample Reason"
                disabled={!surchargeVal}
              />
              <Text style={{ fontSize: 11, color: '#bfbfbf' }}>{surchargeReason.length}/120</Text>
            </div>
          </div>
        </div>

        {/* Right: price summary card */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ fontSize: 14, color: '#595959' }}>
              {contract.bookingType === 'Term' ? 'Actual Total for Full Month of Service' : 'Total Quotation Value'}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>{fmt(total)}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <Text style={{ color: '#595959', fontSize: 14 }}>Subtotal</Text>
            <Text style={{ fontSize: 14 }}>{fmt(subtotal)}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <Text style={{ color: '#595959', fontSize: 14 }}>Discount</Text>
            <Text style={{ fontSize: 14 }}>{fmtAdjust(discountType, discountVal, discountAmt)}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <Text style={{ color: '#595959', fontSize: 14 }}>Surcharge</Text>
            <Text style={{ fontSize: 14 }}>{fmtAdjust(surchargeType, surchargeVal, surchargeAmt)}</Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <Text style={{ color: '#595959', fontSize: 14 }}>GST (9%)</Text>
            <Text style={{ fontSize: 14, color: gst > 0 ? '#1a1a1a' : '#8c8c8c' }}>{fmt(gst)}</Text>
          </div>
        </div>
      </div>

      {/* Payment Details — view only */}
      <div style={CARD}>
        <Text style={SECTION_TITLE}>Payment Details</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            ['Billing Company', contract.billingCompany ?? '—'],
            ['Invoice Generation Date', contract.invoiceGenerationDate ? `${contract.invoiceGenerationDate} of the month` : '—'],
            ['Invoice Date', contract.invoiceDate ? `${contract.invoiceDate} of the month` : '—'],
            ['Account Payable', contract.accountPayable ?? '—'],
            ['Payment Terms (days)', contract.paymentTerms ?? '—'],
            ['Termination Notice (days)', String(contract.terminationNotice ?? '—')],
          ].map(([label, val]) => (
            <div key={label}>
              <SectionLabel>{label}</SectionLabel>
              <Input value={val} disabled style={DISABLED_INPUT} />
            </div>
          ))}
        </div>
      </div>

      {/* Edit Price Modal (on Save) */}
      <Modal
        open={priceModalOpen}
        title="Confirm Price Edit"
        okText="Save"
        cancelText="Cancel"
        onOk={handlePriceModalSave}
        onCancel={() => setPriceModalOpen(false)}
        width={480}
      >
        <Form form={priceForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            label="Edit Effective Date"
            name="effectiveDate"
            rules={[{ required: true, message: 'Effective date is required' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="Select effective date" />
          </Form.Item>
          <Form.Item
            label="Reason for Price Change"
            name="reason"
            rules={[{ required: true, message: 'Reason is required' }, { max: 120 }]}
          >
            <TextArea maxLength={120} showCount rows={3} placeholder="Enter reason for price change" />
          </Form.Item>
        </Form>
      </Modal>
    </EditPageLayout>
  )
}
