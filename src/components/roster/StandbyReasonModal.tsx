// MOVE-3769 §3 — ticking Standby by hand opens this modal. The reason is
// required, and is shown next to the checkbox once saved. Standby that comes
// from the roster rule does not go through here; only manual assignment does.

import { useEffect, useState } from 'react'
import { Input, Modal, Typography } from 'antd'

const { Text } = Typography
const { TextArea } = Input

export default function StandbyReasonModal({
  open,
  employeeName,
  initialReason,
  onCancel,
  onSave,
}: {
  open: boolean
  employeeName: string
  initialReason?: string
  onCancel: () => void
  onSave: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason(initialReason ?? '')
    setShowErrors(false)
  }, [open, initialReason])

  const reasonError = reason.trim() ? null : 'Reason for standby is required'

  const handleOk = () => {
    setShowErrors(true)
    if (reasonError) return
    onSave(reason.trim())
  }

  return (
    <Modal open={open} title="Assign Standby" onCancel={onCancel} onOk={handleOk} okText="Save" width={420}>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Employee</Text>
        <div><Text strong style={{ fontSize: 13 }}>{employeeName}</Text></div>
      </div>

      <div style={{ marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Reason for Standby <span style={{ color: '#cf1322' }}>*</span>
        </Text>
      </div>
      <TextArea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        status={showErrors && reasonError ? 'error' : undefined}
        placeholder="Why is this employee on standby?"
      />
      {showErrors && reasonError && (
        <Text type="danger" style={{ fontSize: 11 }}>{reasonError}</Text>
      )}
    </Modal>
  )
}
