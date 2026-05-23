import { useEffect } from 'react'
import { Modal, Form, Input, Select, DatePicker, Typography, Tooltip, message } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Contract } from '@/types/contract'

const { Text } = Typography

interface CreateGroupModalProps {
  open: boolean
  onCancel: () => void
  onSuccess: (groupName: string) => void
  selectedContracts: Contract[]
}

const dayOptions = [
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
  { value: 'last', label: 'Last day of month' },
]

const paymentTermsOptions = [
  { value: 'net7', label: 'Net 7 days' },
  { value: 'net14', label: 'Net 14 days' },
  { value: 'net30', label: 'Net 30 days' },
  { value: 'net60', label: 'Net 60 days' },
  { value: 'net90', label: 'Net 90 days' },
]

function FieldLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
        </Tooltip>
      )}
    </span>
  )
}

export default function CreateGroupModal({
  open,
  onCancel,
  selectedContracts,
  onSuccess,
}: CreateGroupModalProps) {
  const [form] = Form.useForm()

  // Recurring monthly: all Term; Once-off: all Ad-hoc
  const isRecurring = selectedContracts.length > 0 && selectedContracts.every(c => c.bookingType === 'Term')

  useEffect(() => {
    if (!open) form.resetFields()
  }, [open, form])

  const handleConfirm = async () => {
    let values: Record<string, unknown>
    try {
      values = await form.validateFields()
    } catch {
      message.error('Unable to create group — please fill in all required fields')
      return
    }

    // A.4 Step 2 — First invoice date check (recurring monthly only)
    if (isRecurring) {
      const effectiveMonth = values.effectiveMonth as dayjs.Dayjs
      const invoiceGenDay = values.invoiceGenerationDate as string

      if (effectiveMonth && invoiceGenDay) {
        const day =
          invoiceGenDay === 'last'
            ? effectiveMonth.endOf('month').date()
            : parseInt(invoiceGenDay, 10)
        const firstInvoiceDate = effectiveMonth.date(day)

        if (!firstInvoiceDate.isAfter(dayjs(), 'day')) {
          message.error('First invoice generation date must be a future date')
          form.setFields([
            { name: 'effectiveMonth', errors: [''] },
            {
              name: 'invoiceGenerationDate',
              errors: ['First invoice generation date is a past date'],
            },
          ])
          return
        }
      }
    }

    // A.4 Step 4 — Success
    message.success('Group created successfully')
    onSuccess(values.groupName as string)
    form.resetFields()
  }

  const scheduleLabel = isRecurring ? 'Recurring Monthly' : 'Once-off'

  return (
    <Modal
      title={<Text strong style={{ fontSize: 16 }}>Create Group</Text>}
      open={open}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="Confirm"
      cancelText="Cancel"
      width={520}
      okButtonProps={{ type: 'primary' }}
      destroyOnClose
    >
      {/* Invoice schedule — read-only context info */}
      <div
        style={{
          background: '#f5f5f5',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          display: 'flex',
          gap: 32,
        }}
      >
        <div>
          <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block' }}>Customer Code</Text>
          <Text strong style={{ fontSize: 13 }}>
            {selectedContracts[0]?.customerCode ?? '—'}
          </Text>
        </div>
        <div>
          <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block' }}>Invoice Schedule</Text>
          <Text strong style={{ fontSize: 13 }}>{scheduleLabel}</Text>
        </div>
        <div>
          <Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block' }}>Contracts</Text>
          <Text strong style={{ fontSize: 13 }}>{selectedContracts.length} selected</Text>
        </div>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        {/* Group Name */}
        <Form.Item
          label="Group Name"
          name="groupName"
          rules={[
            { required: true, message: 'Group name is required' },
            { max: 50, message: 'Maximum 50 characters allowed' },
          ]}
        >
          <Input
            placeholder="Enter group name"
            maxLength={50}
            showCount
          />
        </Form.Item>

        {/* Effective Month — hidden if once-off */}
        {isRecurring && (
          <Form.Item
            label={
              <FieldLabel tooltip="The first month the grouped contracts will be included in a single merged invoice.">
                Effective Month
              </FieldLabel>
            }
            name="effectiveMonth"
            rules={[{ required: true, message: 'Effective month is required' }]}
          >
            <DatePicker
              picker="month"
              style={{ width: '100%' }}
              placeholder="Select month and year"
              disabledDate={(d) => d.isBefore(dayjs().startOf('month'))}
            />
          </Form.Item>
        )}

        {/* Invoice Generation Date */}
        <Form.Item
          label="Invoice Generation Date"
          name="invoiceGenerationDate"
          rules={[{ required: true, message: 'Invoice generation date is required' }]}
        >
          {isRecurring ? (
            <Select
              options={dayOptions}
              placeholder="Select day of month"
              showSearch
              optionFilterProp="label"
            />
          ) : (
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Select date"
            />
          )}
        </Form.Item>

        {/* Invoice Date */}
        <Form.Item
          label="Invoice Date"
          name="invoiceDate"
          rules={[{ required: true, message: 'Invoice date is required' }]}
        >
          {isRecurring ? (
            <Select
              options={dayOptions}
              placeholder="Select day of month"
              showSearch
              optionFilterProp="label"
            />
          ) : (
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Select date"
            />
          )}
        </Form.Item>

        {/* Payment Terms */}
        <Form.Item
          label="Payment Terms"
          name="paymentTerms"
          rules={[{ required: true, message: 'Payment terms is required' }]}
        >
          <Select options={paymentTermsOptions} placeholder="Select payment terms" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
