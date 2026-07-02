import { useState } from 'react'
import { Typography, Select, Input, Button, Modal } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'

const { Text, Title } = Typography

/* ── Mock data standing in for the customers module ── */
const PIC_CONTACT_NUMBERS = [
  '+65 9123 4567',
  '+65 8234 5678',
  '+65 9345 6789',
  '+60 12-345 6789',
]

const PIC_EMAILS = [
  'jane.tan@acme.com',
  'raj.kumar@acme.com',
  'wei.lim@acme.sg',
  'ops@westpoint.sg',
]

const COUNTRY_CODES = [
  { label: 'SG +65', value: '+65' },
  { label: 'MY +60', value: '+60' },
  { label: 'ID +62', value: '+62' },
  { label: 'IN +91', value: '+91' },
  { label: 'PH +63', value: '+63' },
]

type ManualNumber = { code: string; number: string }

/* ── Horizontal row: label (+ Optional) on the left, field(s) on the right ── */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 20, marginBottom: 22, alignItems: 'flex-start' }}>
      <div style={{ width: 128, flexShrink: 0, paddingTop: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{label}</Text>
        <span style={{ fontSize: 11, color: '#8c8c8c', background: '#f5f5f5', padding: '1px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
          Optional
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export default function TestingPage() {
  const [open, setOpen] = useState(false)
  const [picNumbers, setPicNumbers] = useState<string[]>([])
  const [manualNumbers, setManualNumbers] = useState<ManualNumber[]>([])
  const [picEmails, setPicEmails] = useState<string[]>([])
  const [manualEmails, setManualEmails] = useState<string[]>([])
  const [picCcEmails, setPicCcEmails] = useState<string[]>([])
  const [manualCcEmails, setManualCcEmails] = useState<string[]>([])
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null)

  // Manual mobile number rows (country code + number)
  const addNumber = () => setManualNumbers((p) => [...p, { code: '+65', number: '' }])
  const updateNumber = (i: number, patch: Partial<ManualNumber>) =>
    setManualNumbers((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeNumber = (i: number) => setManualNumbers((p) => p.filter((_, idx) => idx !== i))

  // Generic manual email rows (open text)
  const addEmail = (set: React.Dispatch<React.SetStateAction<string[]>>) => set((p) => [...p, ''])
  const updateEmail = (set: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    set((p) => p.map((e, idx) => (idx === i ? v : e)))
  const removeEmail = (set: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    set((p) => p.filter((_, idx) => idx !== i))

  const manualEmailList = (
    values: string[],
    set: React.Dispatch<React.SetStateAction<string[]>>,
  ) => (
    <>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Input
            value={v}
            onChange={(e) => updateEmail(set, i, e.target.value)}
            placeholder="name@example.com"
            style={{ flex: 1 }}
          />
          <Button type="text" icon={<MinusCircleOutlined />} onClick={() => removeEmail(set, i)} />
        </div>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={() => addEmail(set)} style={{ width: '100%' }}>
        Add email
      </Button>
    </>
  )

  const onSubmit = () => {
    setSubmitted({
      contactNumbers: {
        fromCustomers: picNumbers,
        manual: manualNumbers.filter((n) => n.number.trim()).map((n) => `${n.code} ${n.number.trim()}`),
      },
      email: {
        fromCustomers: picEmails,
        manual: manualEmails.filter((e) => e.trim()),
      },
      emailCc: {
        fromCustomers: picCcEmails,
        manual: manualCcEmails.filter((e) => e.trim()),
      },
    })
    setOpen(false)
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 14,
          padding: 24,
          maxWidth: 720,
        }}
      >
        <Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>Testing</Title>
        <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', marginBottom: 16 }}>
          Open the contact / email form in a modal.
        </Text>
        <Button type="primary" onClick={() => setOpen(true)}>Open form</Button>

        {submitted && (
          <div style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Submitted values</Text>
            <pre
              style={{
                background: '#f7f8fa',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 14,
                fontSize: 12.5,
                margin: 0,
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <Modal
        title="Contact form"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Submit"
        width={760}
        destroyOnHidden={false}
      >
        <div style={{ paddingTop: 12 }}>
          {/* ── Contact Number ── */}
          <Row label="Contact Number">
            <Select
              mode="multiple"
              value={picNumbers}
              onChange={setPicNumbers}
              options={PIC_CONTACT_NUMBERS.map((n) => ({ label: n, value: n }))}
              placeholder="Select PIC contact number(s) from customers"
              style={{ width: '100%' }}
              allowClear
            />
            <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', margin: '8px 0' }}>
              Or manually add other mobile numbers (defaults to +65):
            </Text>
            {manualNumbers.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Select
                  value={row.code}
                  onChange={(code) => updateNumber(i, { code })}
                  options={COUNTRY_CODES}
                  style={{ width: 110, flexShrink: 0 }}
                />
                <Input
                  value={row.number}
                  onChange={(e) => updateNumber(i, { number: e.target.value })}
                  placeholder="Mobile number"
                  style={{ flex: 1 }}
                />
                <Button type="text" icon={<MinusCircleOutlined />} onClick={() => removeNumber(i)} />
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addNumber} style={{ width: '100%' }}>
              Add mobile number
            </Button>
          </Row>

          {/* ── Email ── */}
          <Row label="Email">
            <Select
              mode="multiple"
              value={picEmails}
              onChange={setPicEmails}
              options={PIC_EMAILS.map((e) => ({ label: e, value: e }))}
              placeholder="Select PIC email(s) from customers"
              style={{ width: '100%' }}
              allowClear
            />
            <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', margin: '8px 0' }}>
              Or manually add other emails:
            </Text>
            {manualEmailList(manualEmails, setManualEmails)}
          </Row>

          {/* ── Email Cc ── */}
          <Row label="Email Cc">
            <Select
              mode="multiple"
              value={picCcEmails}
              onChange={setPicCcEmails}
              options={PIC_EMAILS.map((e) => ({ label: e, value: e }))}
              placeholder="Select PIC email(s) to Cc"
              style={{ width: '100%' }}
              allowClear
            />
            <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', margin: '8px 0' }}>
              Or manually add other Cc emails:
            </Text>
            {manualEmailList(manualCcEmails, setManualCcEmails)}
          </Row>
        </div>
      </Modal>
    </div>
  )
}
