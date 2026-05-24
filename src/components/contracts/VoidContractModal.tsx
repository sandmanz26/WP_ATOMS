import { useState } from 'react'
import { Modal, Input, Typography, message } from 'antd'

const { Text } = Typography
const { TextArea } = Input

interface VoidContractModalProps {
  open: boolean
  onClose: () => void
}

export default function VoidContractModal({ open, onClose }: VoidContractModalProps) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    if (!reason.trim()) return
    message.success('Contract voided successfully')
    setReason('')
    onClose()
  }

  const handleCancel = () => {
    setReason('')
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Void Contract"
      onCancel={handleCancel}
      okText="Confirm"
      okButtonProps={{
        danger: true,
        disabled: !reason.trim(),
      }}
      cancelText="Cancel"
      onOk={handleConfirm}
      width={480}
    >
      <Text style={{ display: 'block', marginBottom: 16, color: '#595959' }}>
        This action cannot be undone. All trips will be auto-cancelled.
      </Text>
      <div>
        <Text style={{ display: 'block', marginBottom: 6, color: '#8c8c8c', fontSize: 13 }}>
          Reason for Voiding <span style={{ color: '#ff4d4f' }}>*</span>
        </Text>
        <TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={120}
          showCount
          rows={3}
          placeholder="Enter reason for voiding this contract"
        />
      </div>
    </Modal>
  )
}
