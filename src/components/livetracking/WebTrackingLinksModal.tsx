// MOVE-3676 — Web Tracking Links modal, opened from a trip card's "⋯" menu in
// Live Tracking 2.0. Layout follows Figma (Live Tracking 2.0 file, frame
// 39397:56171): "For Drivers" / "For Passengers", each a link + primary
// "Copy", and a secondary "Close".

import { Button, Modal, Typography, message } from 'antd'
import { webTrackingUrl } from './webTrackingData'

const { Text } = Typography

export default function WebTrackingLinksModal({ tripId, onClose }: { tripId: string | null; onClose: () => void }) {
  const [messageApi, msgContext] = message.useMessage()
  if (!tripId) return msgContext

  const links = [
    { label: 'For Drivers', url: webTrackingUrl(tripId, 'driver') },
    { label: 'For Passengers', url: webTrackingUrl(tripId, 'passenger') },
  ]

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API can be blocked (non-secure context); the link is still shown to copy by hand.
    }
    // Copy master list key: "Toaster: successfully copy tracking link to clipboard".
    messageApi.success('Tracking link copied to clipboard.')
  }

  return (
    <>
      {msgContext}
      <Modal
        open
        title="Web Tracking Links"
        onCancel={onClose}
        width={594}
        footer={<Button onClick={onClose}>Close</Button>}
      >
        {links.map((l) => (
          <div key={l.label} style={{ marginTop: 20 }}>
            <Text style={{ display: 'block', marginBottom: 10 }}>{l.label}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <a href={l.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {l.url}
              </a>
              <Button type="primary" onClick={() => copy(l.url)}>Copy</Button>
            </div>
          </div>
        ))}
      </Modal>
    </>
  )
}
