import { useState } from 'react'
import { Modal, Form, Select, Input, DatePicker, Tooltip, Typography, message } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { Contract } from '@/types/contract'

const { Text } = Typography

interface EditPaymentDetailsModalProps {
  open: boolean
  onClose: () => void
  contract: Contract
}

// Invoice Generation Date: 1-31 + "last day of month" (Term/Others+per-month)
const invoiceGenDayOptions = [
  ...Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
  { label: 'Last day of month', value: 'last' },
]

// Invoice Date: 1-31 only (no "last day")
const invoiceDateDayOptions = Array.from({ length: 31 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}))

const paymentTermsOptions = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
]

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: '#8c8c8c', fontSize: 13 }}>
      <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>
      {children}
    </Text>
  )
}

export default function EditPaymentDetailsModal({ open, onClose, contract }: EditPaymentDetailsModalProps) {
  const [form] = Form.useForm()

  const isGroupManaged = Boolean(contract.contractGroup?.trim())
  const isAdHoc = contract.bookingType === 'Ad-hoc'

  // Day-of-month values (Term / Others+per-month)
  const [invoiceGenDay, setInvoiceGenDay] = useState(contract.invoiceGenerationDate ?? '')
  const [invoiceDateDay, setInvoiceDateDay] = useState(contract.invoiceDate ?? '')

  // Date picker values (Ad-hoc / once-off)
  const [invoiceGenPicker, setInvoiceGenPicker] = useState<Dayjs | null>(
    contract.invoiceGenerationDate
      ? dayjs(contract.invoiceGenerationDate, ['D MMM YYYY', 'YYYY-MM-DD'])
      : null
  )
  const [invoiceDatePicker, setInvoiceDatePicker] = useState<Dayjs | null>(
    contract.invoiceDate
      ? dayjs(contract.invoiceDate, ['D MMM YYYY', 'YYYY-MM-DD'])
      : null
  )

  const [paymentTerms, setPaymentTerms] = useState(String(contract.paymentTerms ?? ''))
  const [terminationNotice, setTerminationNotice] = useState(String(contract.terminationNotice ?? ''))

  const groupTooltip = 'Tooltip: disable invoice & payment terms fields'

  const handleSave = () => {
    message.success('Saved successfully')
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Edit Payment Details"
      onCancel={onClose}
      onOk={handleSave}
      okText="Save"
      cancelText="Cancel"
      width={640}
    >
      <Form layout="vertical" form={form} style={{ marginTop: 16 }}>

        {/* Row 1: Billing Company + Account Payable */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label={<RequiredLabel>Billing Company</RequiredLabel>} style={{ marginBottom: 12 }}>
            <Select
              value={contract.billingCompany ?? undefined}
              disabled
              placeholder="—"
              options={contract.billingCompany ? [{ label: contract.billingCompany, value: contract.billingCompany }] : []}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label={<RequiredLabel>Account Payable</RequiredLabel>} style={{ marginBottom: 12 }}>
            <Select
              value={contract.accountPayable ?? undefined}
              disabled
              placeholder="—"
              options={contract.accountPayable ? [{ label: contract.accountPayable, value: contract.accountPayable }] : []}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </div>

        {/* Row 2: Invoice Generation Date + Invoice Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label={<RequiredLabel>Invoice Generation Date</RequiredLabel>} style={{ marginBottom: 12 }}>
            <Tooltip title={isGroupManaged ? groupTooltip : undefined}>
              {isAdHoc ? (
                <DatePicker
                  value={invoiceGenPicker}
                  onChange={setInvoiceGenPicker}
                  disabled={isGroupManaged}
                  format="D MMM YYYY"
                  style={{ width: '100%' }}
                  placeholder="Select date"
                />
              ) : (
                <Select
                  value={invoiceGenDay || undefined}
                  onChange={setInvoiceGenDay}
                  disabled={isGroupManaged}
                  placeholder="Select day"
                  options={invoiceGenDayOptions}
                  style={{ width: '100%' }}
                />
              )}
            </Tooltip>
          </Form.Item>

          <Form.Item label={<RequiredLabel>Invoice Date</RequiredLabel>} style={{ marginBottom: 12 }}>
            <Tooltip title={isGroupManaged ? groupTooltip : undefined}>
              {isAdHoc ? (
                <DatePicker
                  value={invoiceDatePicker}
                  onChange={setInvoiceDatePicker}
                  disabled={isGroupManaged}
                  format="D MMM YYYY"
                  style={{ width: '100%' }}
                  placeholder="Select date"
                />
              ) : (
                <Select
                  value={invoiceDateDay || undefined}
                  onChange={setInvoiceDateDay}
                  disabled={isGroupManaged}
                  placeholder="Select day"
                  options={invoiceDateDayOptions}
                  style={{ width: '100%' }}
                />
              )}
            </Tooltip>
          </Form.Item>
        </div>

        {/* Row 3: Payment Terms + Termination Notice */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label={<RequiredLabel>Payment Terms</RequiredLabel>} style={{ marginBottom: 0 }}>
            <Tooltip title={isGroupManaged ? groupTooltip : undefined}>
              <Select
                value={paymentTerms || undefined}
                onChange={setPaymentTerms}
                disabled={isGroupManaged}
                placeholder="Select payment terms"
                options={paymentTermsOptions}
                style={{ width: '100%' }}
              />
            </Tooltip>
          </Form.Item>

          <Form.Item label={<RequiredLabel>Termination Notice</RequiredLabel>} style={{ marginBottom: 0 }}>
            <Input
              value={terminationNotice}
              onChange={e => setTerminationNotice(e.target.value)}
              type="number"
              min={0}
              addonAfter="days"
              placeholder="e.g. 30"
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
