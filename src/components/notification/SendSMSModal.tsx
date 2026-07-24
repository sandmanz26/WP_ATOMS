import { useState, useEffect } from 'react'
import { Modal, Typography, Select, Button, message } from 'antd'
import type { TripNotification } from './notificationData'
import RichTextEditor from './RichTextEditor'

const { Text } = Typography

export interface SendSMSPayload {
  phoneNumbers: string[]
  content: string
}

interface Props {
  open: boolean
  onClose: () => void
  selectedTrip: TripNotification | null
  defaultPhoneNumbers: string[]
  onSend: (payload: SendSMSPayload) => void
}

// SMS is single-trip only, so the template resolves the real driver/vehicle/
// trip details rather than leaving literal [placeholder] text.
function defaultContent(trip: TripNotification | null): string {
  if (!trip) return ''
  const driverFirstName = trip.driver && trip.driver !== '-' ? trip.driver.split(' ')[0] : 'the driver'
  const trackingUrl = `https://trk.wla.sg/${trip.vehicle.replace(/\s+/g, '').toLowerCase()}`
  return `<p>Driver ${driverFirstName} (${trip.vehicle}) assigned for trip on ${trip.date} ${trip.startTime}.</p><p>View trip details/track driver: ${trackingUrl}</p><p>Call +6568611187 (ext 0) for assistance.</p>`
}

export default function SendSMSModal({ open, onClose, selectedTrip, defaultPhoneNumbers, onSend }: Props) {
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(defaultPhoneNumbers)
  const [content, setContent] = useState(defaultContent(selectedTrip))
  const [editorKey, setEditorKey] = useState(0)

  // selectedTrip is null at first mount (before any row is selected), so the
  // initial useState above seeds with empty content. Re-sync every time the
  // modal opens so it reflects whichever trip is actually selected then.
  useEffect(() => {
    if (open) {
      setPhoneNumbers(defaultPhoneNumbers)
      setContent(defaultContent(selectedTrip))
      setEditorKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = () => {
    onClose()
  }

  const handleSend = () => {
    if (phoneNumbers.length === 0) {
      message.error('At least one recipient mobile number is required')
      return
    }
    const plainText = content.replace(/<[^>]*>/g, '').trim()
    if (!plainText) {
      message.error('SMS content is required')
      return
    }
    onSend({ phoneNumbers, content })
  }

  return (
    <Modal
      title={<Text style={{ fontSize: 17, fontWeight: 700 }}>Send SMS</Text>}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={560}
      centered
      destroyOnClose
    >
      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 16 }}>SMS Information</Text>

        <div style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Mobile Number</Text>
          <Select
            mode="tags"
            style={{ width: '100%' }}
            value={phoneNumbers}
            onChange={setPhoneNumbers}
            maxTagCount="responsive"
            tokenSeparators={[',']}
            suffixIcon={<span style={{ fontSize: 10, color: '#8c8c8c' }}>▾</span>}
          />
        </div>

        <div>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Content</Text>
          <RichTextEditor key={editorKey} defaultHtml={defaultContent(selectedTrip)} onChange={setContent} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={handleClose} style={{ borderRadius: 6 }}>Cancel</Button>
        <Button type="primary" style={{ borderRadius: 6 }} onClick={handleSend}>Sent</Button>
      </div>
    </Modal>
  )
}
