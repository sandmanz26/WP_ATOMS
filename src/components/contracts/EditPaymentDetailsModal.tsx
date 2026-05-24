import { useState } from 'react'
import { Modal, Form, Select, Input, Tooltip, Typography, message } from 'antd'
import type { Contract } from '@/types/contract'

const { Text } = Typography

interface EditPaymentDetailsModalProps {
  open: boolean
  onClose: () => void
  contract: Contract
}

const dayOptions = [
  ...Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
  { label: 'Last day of month', value: 'last' },
]

export default function EditPaymentDetailsModal({ open, onClose, contract }: EditPaymentDetailsModalProps) {
  const [form] = Form.useForm()
  const isGroupManaged = Boolean(contract.contractGroup && contract.contractGroup.trim() !== '')

  const [invoiceGenDate, setInvoiceGenDate] = useState(contract.invoiceGenerationDate ?? '')
  const [invoiceDate, setInvoiceDate] = useState(contract.invoiceDate ?? '')
  const [paymentTerms, setPaymentTerms] = useState(contract.paymentTerms ?? '')
  const [terminationNotice, setTerminationNotice] = useState(contract.terminationNotice ?? '')

  const handleSave = () => {
    message.success('Saved successfully')
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const groupTooltip = 'Managed at group level'

  const labelStyle: React.CSSProperties = { color: '#8c8c8c', fontSize: 13 }

  return (
    <Modal
      open={open}
      title="Edit Payment Details"
      onCancel={handleCancel}
      onOk={handleSave}
      okText="Save"
      cancelText="Cancel"
      width={680}
    >
      <Form layout="vertical" form={form} style={{ marginTop: 12 }}>
        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item label={<Text style={labelStyle}>Billing Company</Text>}>
            <Select
              value={contract.billingCompany}
              disabled
              placeholder="Billing Company"
              options={[{ label: contract.billingCompany, value: contract.billingCompany }]}
            />
          </Form.Item>

          <Form.Item label={<Text style={labelStyle}>Account Payable</Text>}>
            <Select
              value={contract.accountPayable}
              disabled
              placeholder="Account Payable"
              options={[{ label: contract.accountPayable, value: contract.accountPayable }]}
            />
          </Form.Item>

          <Form.Item label={<Text style={labelStyle}>Invoice Generation Date</Text>}>
            <Tooltip title={isGroupManaged ? groupTooltip : undefined}>
              <Select
                value={invoiceGenDate || undefined}
                onChange={setInvoiceGenDate}
                disabled={isGroupManaged}
                placeholder="Select day"
                options={dayOptions}
              />
            </Tooltip>
          </Form.Item>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item label={<Text style={labelStyle}>Invoice Date</Text>}>
            <Tooltip title={isGroupManaged ? groupTooltip : undefined}>
              <Select
                value={invoiceDate || undefined}
                onChange={setInvoiceDate}
                disabled={isGroupManaged}
                placeholder="Select day"
                options={dayOptions}
              />
            </Tooltip>
          </Form.Item>

          <Form.Item label={<Text style={labelStyle}>Payment Terms (days)</Text>}>
            <Tooltip title={isGroupManaged ? groupTooltip : undefined}>
              <Input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                disabled={isGroupManaged}
                placeholder="e.g. 30"
                type="number"
                min={0}
              />
            </Tooltip>
          </Form.Item>

          <Form.Item label={<Text style={labelStyle}>Termination Notice (days)</Text>}>
            <Input
              value={terminationNotice}
              onChange={(e) => setTerminationNotice(Number(e.target.value))}
              placeholder="e.g. 30"
              type="number"
              min={0}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
