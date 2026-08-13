// MOVE-3769 §3 — ticking Extend opens this modal. Both fields are required
// before the change can be saved; cancelling leaves the checkbox unticked.

import { useEffect, useState } from 'react'
import { Input, InputNumber, Modal, Typography } from 'antd'

const { Text } = Typography
const { TextArea } = Input

export interface ExtendDetails {
  hours: number
  reason: string
}

export default function ExtendShiftModal({
  open,
  employeeName,
  initial,
  onCancel,
  onSave,
}: {
  open: boolean
  employeeName: string
  initial?: ExtendDetails
  onCancel: () => void
  onSave: (details: ExtendDetails) => void
}) {
  const [hours, setHours] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setHours(initial?.hours ?? null)
    setReason(initial?.reason ?? '')
    setShowErrors(false)
  }, [open, initial])

  const hoursError = hours === null || hours <= 0 ? 'Number of hours extended is required' : null
  const reasonError = reason.trim() ? null : 'Reason for extension is required'

  const handleOk = () => {
    setShowErrors(true)
    if (hoursError || reasonError) return
    onSave({ hours: hours!, reason: reason.trim() })
  }

  return (
    <Modal open={open} title="Extend Shift" onCancel={onCancel} onOk={handleOk} okText="Save" width={420}>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Employee</Text>
        <div><Text strong style={{ fontSize: 13 }}>{employeeName}</Text></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Number of hours extended <span style={{ color: '#cf1322' }}>*</span>
          </Text>
        </div>
        <InputNumber
          min={0.5}
          max={12}
          step={0.5}
          value={hours}
          onChange={setHours}
          style={{ width: '100%' }}
          status={showErrors && hoursError ? 'error' : undefined}
        />
        {showErrors && hoursError && (
          <Text type="danger" style={{ fontSize: 11 }}>{hoursError}</Text>
        )}
      </div>

      <div>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Reason for extension <span style={{ color: '#cf1322' }}>*</span>
          </Text>
        </div>
        <TextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          status={showErrors && reasonError ? 'error' : undefined}
        />
        {showErrors && reasonError && (
          <Text type="danger" style={{ fontSize: 11 }}>{reasonError}</Text>
        )}
      </div>
    </Modal>
  )
}
