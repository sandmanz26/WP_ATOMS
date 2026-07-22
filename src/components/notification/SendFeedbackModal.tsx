import { Modal, Typography, Button } from 'antd'
import { CheckCircleFilled, LoadingOutlined } from '@ant-design/icons'

const { Text } = Typography

interface Props {
  open: boolean
  loading: boolean
  failedRecipients: string[]
  onReturn: () => void
}

export default function SendFeedbackModal({ open, loading, failedRecipients, onReturn }: Props) {
  return (
    <Modal open={open} closable={false} footer={null} width={440} centered>
      {loading ? (
        <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <LoadingOutlined style={{ fontSize: 32, color: '#1677ff' }} />
          <Text style={{ fontSize: 14, color: '#595959' }}>Sending notification…</Text>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <CheckCircleFilled style={{ fontSize: 22, color: '#52c41a' }} />
            <Text style={{ fontSize: 17, fontWeight: 700 }}>Notification Send Status</Text>
          </div>
          {failedRecipients.length === 0 ? (
            <Text style={{ fontSize: 13.5, color: '#595959', display: 'block', marginBottom: 24 }}>
              Customer notification has been sent successfully to all recipients.
            </Text>
          ) : (
            <div style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13.5, color: '#595959', display: 'block', marginBottom: 8 }}>
                Customer notification has been sent successfully, except to the following recipients:
              </Text>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {failedRecipients.map((r) => (
                  <li key={r}><Text style={{ fontSize: 13.5, color: '#595959' }}>{r}</Text></li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" style={{ borderRadius: 6 }} onClick={onReturn}>Return to Details Page</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
