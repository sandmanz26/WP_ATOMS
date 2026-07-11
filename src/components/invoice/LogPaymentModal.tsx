import { useState } from 'react'
import { Modal, Typography, Input, Select, DatePicker, Button } from 'antd'

const { Text } = Typography

function fmt(n: number) {
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface Props {
  open: boolean
  onClose: () => void
  grandTotal: number
  outstandingBalance: number
}

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'Online Transfer', 'GIRO'].map((m) => ({ value: m, label: m }))
const BANK_ACCOUNTS   = ['DBS Main Account', 'HSBC Business', 'UOB Current', 'OCBC Business', 'Citibank Corporate'].map((b) => ({ value: b, label: b }))

export default function LogPaymentModal({ open, onClose, grandTotal, outstandingBalance }: Props) {
  const [amount,   setAmount]   = useState('')
  const [method,   setMethod]   = useState<string | null>(null)
  const [bank,     setBank]     = useState<string | null>(null)
  const [date,     setDate]     = useState<null>(null)
  const [transRef, setTransRef] = useState('')

  const handleClose = () => {
    setAmount(''); setMethod(null); setBank(null); setDate(null); setTransRef('')
    onClose()
  }

  const required = (label: string) => (
    <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
      <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>{label}
    </Text>
  )

  return (
    <Modal
      title={<Text style={{ fontSize: 16, fontWeight: 700 }}>Log Payment</Text>}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={480}
      centered
    >
      {/* Grand Total + Outstanding Balance */}
      <div style={{
        background: '#e6f4ff', border: '1.5px solid #91caff', borderRadius: 8,
        padding: '14px 20px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <Text style={{ color: '#1677ff', fontSize: 12, display: 'block', marginBottom: 4 }}>Grand Total</Text>
          <Text style={{ color: '#1677ff', fontSize: 18, fontWeight: 700 }}>{fmt(grandTotal)}</Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text style={{ color: '#1677ff', fontSize: 12, display: 'block', marginBottom: 4 }}>Outstanding Balance</Text>
          <Text style={{ color: '#1677ff', fontSize: 18, fontWeight: 700 }}>{fmt(outstandingBalance)}</Text>
        </div>
      </div>

      {/* Amount Received */}
      <div style={{ marginBottom: 16 }}>
        {required('Amount Received')}
        <Input
          prefix={<Text style={{ color: '#595959' }}>$</Text>}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder=""
          style={{ borderRadius: 6 }}
        />
      </div>

      {/* Payment Method */}
      <div style={{ marginBottom: 16 }}>
        {required('Payment Method')}
        <Select
          style={{ width: '100%', borderRadius: 6 }}
          value={method}
          onChange={setMethod}
          options={PAYMENT_METHODS}
          placeholder=""
        />
      </div>

      {/* Bank Account */}
      <div style={{ marginBottom: 16 }}>
        {required('Bank Account')}
        <Select
          style={{ width: '100%' }}
          value={bank}
          onChange={setBank}
          options={BANK_ACCOUNTS}
          placeholder=""
        />
      </div>

      {/* Payment Date */}
      <div style={{ marginBottom: 16 }}>
        {required('Payment Date')}
        <DatePicker style={{ width: '100%', borderRadius: 6 }} value={date} onChange={(d) => setDate(d as null)} />
      </div>

      {/* Transaction Reference */}
      <div style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Transaction Reference</Text>
        <Input
          maxLength={50}
          value={transRef}
          onChange={(e) => setTransRef(e.target.value)}
          style={{ borderRadius: 6 }}
        />
        <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', textAlign: 'right', marginTop: 4 }}>
          {transRef.length}/50
        </Text>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={handleClose} style={{ borderRadius: 6 }}>Cancel</Button>
        <Button type="primary" style={{ borderRadius: 6 }}>Save</Button>
      </div>
    </Modal>
  )
}
