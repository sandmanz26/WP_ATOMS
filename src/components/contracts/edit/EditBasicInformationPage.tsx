import { useState } from 'react'
import {
  Input, Select, Tabs, Table, Typography, message, Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import EditPageLayout from './EditPageLayout'
import { mockContracts } from '@/data/mockData'
import type { Trip, OtherCharge } from '@/types/contract'
import StatusBadge from '@/components/common/StatusBadge'

const { Text } = Typography
const { TextArea } = Input

interface Props {
  contractId: string
  onBack: () => void
}

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8e8e8',
  borderRadius: 10,
  padding: '24px',
  marginBottom: 16,
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

export default function EditBasicInformationPage({ contractId, onBack }: Props) {
  const contract = mockContracts.find(c => c.id === contractId)!
  const [remarks, setRemarks] = useState(contract.contractRemark ?? '')
  const [picName, setPicName] = useState(contract.picName ?? '')

  const isEditable = contract.status !== 'Ended' && contract.status !== 'Voided'

  const handleSave = () => {
    message.success('Saved successfully')
    onBack()
  }

  // Trip columns (view-only)
  const tripCols: ColumnsType<Trip> = [
    { title: 'Trip Type', dataIndex: 'tripType', key: 'tt', width: 100, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Start Date', dataIndex: 'startDate', key: 'sd', width: 110, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => v || '-' },
    { title: 'End Date', dataIndex: 'endDate', key: 'ed', width: 110, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: string) => v || '-' },
    { title: 'Start Time', dataIndex: 'startTime', key: 'st', width: 100, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: 'Capacity', dataIndex: 'capacity', key: 'cap', width: 90 },
    { title: 'Active Days', dataIndex: 'activeDays', key: 'ad' },
    { title: 'Linked Route', dataIndex: 'linkedRoute', key: 'lr', width: 120, render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
    {
      title: 'Trip Status', dataIndex: 'tripStatus', key: 'ts', width: 110,
      render: (v: string) => v ? (
        <Tag color={v === 'Active' ? 'green' : v === 'Upcoming' ? 'blue' : 'default'} style={{ borderRadius: 4 }}>{v}</Tag>
      ) : '-',
    },
  ]

  const chargeCols: ColumnsType<OtherCharge> = [
    { title: 'Item Description', dataIndex: 'description', key: 'desc' },
    { title: 'Quantity', dataIndex: 'quantity', key: 'qty', width: 90 },
    { title: 'Unit Price', dataIndex: 'unitPrice', key: 'up', width: 100, render: (v: number | undefined) => v != null ? `$ ${v.toFixed(2)}` : '-' },
    { title: 'Amount', dataIndex: 'amount', key: 'amt', width: 100, render: (v: number | undefined) => v != null ? `$ ${v.toFixed(2)}` : '-' },
    { title: 'Item Remarks', dataIndex: 'itemRemarks', key: 'ir', render: (v: string) => v || '-' },
  ]

  const tabs = [
    {
      key: 'basic',
      label: 'Basic Information',
      children: (
        <div style={CARD}>
          <Text style={SECTION_TITLE}>Basic Information</Text>

          {/* Row 1: Contract Title / Booking Type / Price Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <FieldLabel required>Contract Title</FieldLabel>
              <Input
                value={contract.contractTitle}
                disabled
                style={DISABLED_INPUT}
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

          {/* Row 2: Contract Start Date / Contract End Date / Contract Group */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <FieldLabel>Contract Start Date</FieldLabel>
              <Input value={contract.contractPeriodStart} disabled style={DISABLED_INPUT} />
            </div>
            <div>
              <FieldLabel>Contract End Date</FieldLabel>
              <Input value={contract.contractPeriodEnd ?? ''} disabled={!isEditable} style={isEditable ? {} : DISABLED_INPUT} />
            </div>
            <div>
              <FieldLabel>Contract Group</FieldLabel>
              <Input value={contract.contractGroup || '—'} disabled style={DISABLED_INPUT} />
            </div>
          </div>

          {/* Row 3: Source Quotation / Contract Remarks */}
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
      ),
    },
    {
      key: 'customer',
      label: 'Customer Details',
      children: (
        <div style={CARD}>
          <Text style={SECTION_TITLE}>Customer Details</Text>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
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

          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Address</FieldLabel>
            <Input value={contract.address ?? '—'} disabled style={DISABLED_INPUT} />
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
              <FieldLabel>PIC Contact</FieldLabel>
              <Input value={contract.picContact ?? '—'} disabled style={DISABLED_INPUT} />
            </div>
            <div>
              <FieldLabel>PIC Email</FieldLabel>
              <Input value={contract.picEmail ?? '—'} disabled style={DISABLED_INPUT} />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'trips',
      label: 'Trips',
      children: (
        <div style={CARD}>
          <Text style={SECTION_TITLE}>Trips</Text>
          <Table<Trip>
            dataSource={contract.trips}
            columns={tripCols}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
          />
        </div>
      ),
    },
    {
      key: 'other-charges',
      label: 'Other Charges',
      children: (
        <div style={CARD}>
          <Text style={SECTION_TITLE}>Other Charges</Text>
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
      ),
    },
    {
      key: 'payment',
      label: 'Payment Details',
      children: (
        <div style={CARD}>
          <Text style={SECTION_TITLE}>Payment Details</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <FieldLabel>Billing Company</FieldLabel>
              <Input value={contract.billingCompany ?? '—'} disabled style={DISABLED_INPUT} />
            </div>
            <div>
              <FieldLabel>Account Payable</FieldLabel>
              <Input value={contract.accountPayable ?? '—'} disabled style={DISABLED_INPUT} />
            </div>
            <div>
              <FieldLabel>Invoice Generation Date</FieldLabel>
              <Input value={contract.invoiceGenerationDate ? `Day ${contract.invoiceGenerationDate} of month` : '—'} disabled style={DISABLED_INPUT} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel>Invoice Date</FieldLabel>
              <Input value={contract.invoiceDate ? `Day ${contract.invoiceDate} of month` : '—'} disabled style={DISABLED_INPUT} />
            </div>
            <div>
              <FieldLabel>Payment Terms (days)</FieldLabel>
              <Input value={contract.paymentTerms ?? '—'} disabled style={DISABLED_INPUT} />
            </div>
            <div>
              <FieldLabel>Termination Notice (days)</FieldLabel>
              <Input value={contract.terminationNotice ?? '—'} disabled style={DISABLED_INPUT} />
            </div>
          </div>
        </div>
      ),
    },
  ]

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

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, overflow: 'hidden' }}>
        <Tabs
          items={tabs}
          tabBarStyle={{ padding: '0 24px', marginBottom: 0 }}
          style={{ marginBottom: 0 }}
        />
      </div>
    </EditPageLayout>
  )
}
