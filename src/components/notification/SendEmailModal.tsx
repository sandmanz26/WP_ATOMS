import { useState, useEffect } from 'react'
import { Modal, Typography, Select, Input, Button, message } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import type { TripNotification } from './notificationData'
import { TripStatusBadge } from './notificationStatusLogic'
import RichTextEditor from './RichTextEditor'

const { Text } = Typography

export interface SendEmailPayload {
  emails: string[]
  emailCc: string[]
  subject: string
  content: string
}

interface Props {
  open: boolean
  onClose: () => void
  contractNo: string
  selectedTrips: TripNotification[]
  defaultEmails: string[]
  defaultEmailCc: string[]
  onSend: (payload: SendEmailPayload) => void
}

// PRD §8.5 — subject differs when any selected trip is an amendment (resend required)
function defaultSubject(contractNo: string, trips: TripNotification[]): string {
  const isAmendment = trips.some((t) => t.notificationStatus === 'Resend Required')
  const dates = trips.map((t) => t.date).join(', ')
  return isAmendment
    ? `[${contractNo}] Amendment: Driver Assigned for Trip(s) on ${dates}`
    : `[${contractNo}] Driver Assigned for Trip(s) on ${dates}`
}

// PRD §8.6
const DEFAULT_CONTENT = `<p>Dear Customer,</p><p>Driver assignment for the following trip(s) have been confirmed.</p><p>Should you require any assistance, please contact us at +65 68611187 (ext 0). Thank you!</p><p><i>Please do not reply to this automated message.</i></p>`

export default function SendEmailModal({ open, onClose, contractNo, selectedTrips, defaultEmails, defaultEmailCc, onSend }: Props) {
  const [emails, setEmails] = useState<string[]>(defaultEmails)
  const [emailCc, setEmailCc] = useState<string[]>(defaultEmailCc)
  const [subject, setSubject] = useState(defaultSubject(contractNo, selectedTrips))
  const [content, setContent] = useState(DEFAULT_CONTENT)
  const [editorKey, setEditorKey] = useState(0)

  // selectedTrips is [] at first mount (before any row is selected), so the
  // initial useState above seeds subject with no dates. Re-sync every time
  // the modal opens so it reflects whichever trips are actually selected.
  useEffect(() => {
    if (open) {
      setEmails(defaultEmails)
      setEmailCc(defaultEmailCc)
      setSubject(defaultSubject(contractNo, selectedTrips))
      setContent(DEFAULT_CONTENT)
      setEditorKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = () => {
    onClose()
  }

  const handleSend = () => {
    if (emails.length === 0) {
      message.error('At least one recipient email is required')
      return
    }
    if (!subject.trim()) {
      message.error('Subject is required')
      return
    }
    const plainText = content.replace(/<[^>]*>/g, '').trim()
    if (!plainText) {
      message.error('Email content is required')
      return
    }
    onSend({ emails, emailCc, subject, content })
  }

  const tripColumns = [
    { title: 'Trip Date', key: 'date' },
    { title: 'Start Time', key: 'startTime' },
    { title: 'Driver', key: 'driver' },
    { title: 'Vehicle', key: 'vehicle' },
    { title: 'Track Driver', key: 'track' },
    { title: 'Notification Status', key: 'status' },
  ]

  return (
    <Modal
      title={<Text style={{ fontSize: 17, fontWeight: 700 }}>Send Email Notification</Text>}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={680}
      centered
      destroyOnClose
    >
      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 16 }}>Email Information</Text>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Email</Text>
            <Select
              mode="tags"
              style={{ width: '100%' }}
              value={emails}
              onChange={setEmails}
              maxTagCount="responsive"
              tokenSeparators={[',']}
              suffixIcon={<span style={{ fontSize: 10, color: '#8c8c8c' }}>▾</span>}
            />
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Email CC</Text>
            <Select
              mode="tags"
              style={{ width: '100%' }}
              value={emailCc}
              onChange={setEmailCc}
              maxTagCount="responsive"
              tokenSeparators={[',']}
              suffixIcon={<span style={{ fontSize: 10, color: '#8c8c8c' }}>▾</span>}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Subject</Text>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ borderRadius: 6 }} />
        </div>

        <div>
          <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Content</Text>
          <RichTextEditor key={editorKey} defaultHtml={DEFAULT_CONTENT} onChange={setContent} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: 700 }}>Assigned Trip</Text>
          <Text style={{ fontSize: 13, color: '#595959' }}>{selectedTrips.length} Schedule selected</Text>
        </div>
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 100px 90px 140px', padding: '9px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
            {tripColumns.map((c) => (
              <Text key={c.key} style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600 }}>{c.title}</Text>
            ))}
          </div>
          {selectedTrips.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 100px 90px 140px', padding: '10px 12px', borderBottom: i === selectedTrips.length - 1 ? 'none' : '1px solid #f5f5f5', alignItems: 'center' }}>
              <Text style={{ fontSize: 13 }}>{t.date}</Text>
              <Text style={{ fontSize: 13 }}>{t.startTime}</Text>
              <Text style={{ fontSize: 13 }}>{t.driver}</Text>
              <Text style={{ fontSize: 13 }}>{t.vehicle}</Text>
              <LinkOutlined style={{ color: '#8c8c8c' }} />
              <TripStatusBadge status={t.notificationStatus} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={handleClose} style={{ borderRadius: 6 }}>Cancel</Button>
        <Button type="primary" style={{ borderRadius: 6 }} onClick={handleSend}>Send</Button>
      </div>
    </Modal>
  )
}
