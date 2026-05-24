import { useState } from 'react'
import { Modal, Form, Input, Button, Typography, message } from 'antd'

const { Paragraph } = Typography

interface VoidContractModalProps {
  open: boolean
  onClose: () => void
  onVoid: (reason: string) => void
}

export default function VoidContractModal({ open, onClose, onVoid }: VoidContractModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    try {
      await form.validateFields()
      const { reasonForVoiding } = form.getFieldsValue()
      setLoading(true)
      // Simulate API call
      await new Promise(res => setTimeout(res, 600))
      message.success('Successfully voided customer contract')
      form.resetFields()
      setLoading(false)
      onVoid(reasonForVoiding)
    } catch {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Void Customer Contract"
      onCancel={handleCancel}
      width={520}
      centered
      maskClosable={false}
      keyboard={false}
      closable={true}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="confirm" type="primary" danger loading={loading} onClick={handleConfirm}>
          Confirm
        </Button>,
      ]}
    >
      <Paragraph style={{ color: '#595959', marginTop: 8, marginBottom: 20 }}>
        Are you sure you want to void this customer contract? This action cannot be undone.
        All trips under this contract will be cancelled and unassigned.
      </Paragraph>

      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label="Reason for Voiding"
          name="reasonForVoiding"
          required
          rules={[
            { required: true, message: 'Reason for voiding is required' },
            { max: 120, message: 'Maximum 120 characters' },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={120}
            showCount
            placeholder="Enter reason for voiding the contract"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
