import { useState, useEffect } from 'react'
import { Modal, Typography, Select, Button, Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

export interface EditRecipientsPayload {
  phoneNumbers: string[]
  emails: string[]
  emailCc: string[]
}

// Mock "PIC contact numbers / emails from customers module" suggestion pool
// (PRD §11.2 — dropdown options should come from the customers module).
const SUGGESTED_PHONE_NUMBERS = [
  '+65 7211 1122', '+65 8881 1234', '+65 3321 1112', '+65 7211 1988',
  '+65 9123 4501', '+65 9123 4510', '+65 8123 7766',
].map((v) => ({ value: v, label: v }))

const SUGGESTED_EMAILS = [
  'daniel.tan@infra.com.sg', 'sales.tan@infra.com.sg', 'marco.antoni@infra.com.sg', 'romadio.tonio@infra.id',
  'rifaldo@gmail.com', 'rifaldo66@gmail.com', 'rifaldo991@gmail.com',
  'ops@sembawanglogistics.com.sg', 'admin@glp.com.sg',
].map((v) => ({ value: v, label: v }))

interface Props {
  open: boolean
  onClose: () => void
  initial: EditRecipientsPayload
  onSave: (payload: EditRecipientsPayload) => void
}

export default function EditRecipientsModal({ open, onClose, initial, onSave }: Props) {
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(initial.phoneNumbers)
  const [emails, setEmails] = useState<string[]>(initial.emails)
  const [emailCc, setEmailCc] = useState<string[]>(initial.emailCc)

  useEffect(() => {
    if (open) {
      setPhoneNumbers(initial.phoneNumbers)
      setEmails(initial.emails)
      setEmailCc(initial.emailCc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = () => {
    onClose()
  }

  const handleSave = () => {
    onSave({ phoneNumbers, emails, emailCc })
    handleClose()
  }

  const fieldLabel = (label: string, tooltip?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined style={{ fontSize: 12.5, color: '#8c8c8c' }} />
        </Tooltip>
      )}
    </div>
  )

  return (
    <Modal
      title={<Text style={{ fontSize: 16, fontWeight: 700 }}>Edit Recipients of Customer Notification</Text>}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
      centered
    >
      <div style={{ marginBottom: 18 }}>
        {fieldLabel('PIC Contact Number', 'Phone numbers registered to receive SMS trip notifications')}
        <Select
          mode="tags"
          style={{ width: '100%' }}
          value={phoneNumbers}
          onChange={setPhoneNumbers}
          options={SUGGESTED_PHONE_NUMBERS}
          tokenSeparators={[',']}
          suffixIcon={<span style={{ fontSize: 10, color: '#8c8c8c' }}>▾</span>}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        {fieldLabel('Email')}
        <Select
          mode="tags"
          style={{ width: '100%' }}
          value={emails}
          onChange={setEmails}
          options={SUGGESTED_EMAILS}
          tokenSeparators={[',']}
          suffixIcon={<span style={{ fontSize: 10, color: '#8c8c8c' }}>▾</span>}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        {fieldLabel('Email CC')}
        <Select
          mode="tags"
          style={{ width: '100%' }}
          value={emailCc}
          onChange={setEmailCc}
          options={SUGGESTED_EMAILS}
          tokenSeparators={[',']}
          suffixIcon={<span style={{ fontSize: 10, color: '#8c8c8c' }}>▾</span>}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={handleClose} style={{ borderRadius: 6 }}>Cancel</Button>
        <Button type="primary" style={{ borderRadius: 6 }} onClick={handleSave}>Sent</Button>
      </div>
    </Modal>
  )
}
