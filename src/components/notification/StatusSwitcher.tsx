import { useState, useRef, useEffect } from 'react'
import { Typography, Select } from 'antd'
import { ExperimentOutlined, CloseOutlined, HolderOutlined } from '@ant-design/icons'
import type { TripNotification, TripNotificationStatus, NotificationStatus } from './notificationData'
import { TripStatusBadge, NotificationStatusBadge } from './notificationStatusLogic'

const { Text } = Typography

const TRIP_STATUS_OPTIONS: TripNotificationStatus[] = [
  'Pending Assignment', 'Ready to Sent', 'Sent', 'Resend Required', 'Not Required',
]

const CONTRACT_STATUS_OPTIONS: NotificationStatus[] = [
  'Pending Assignment', 'Ready to Send', 'Partially Sent', 'Completed',
]

// Maps a target contract status to a representative trip-status pattern
// that satisfies the §2.2 aggregation rule, so picking a contract status
// directly is a shortcut for setting every trip by hand.
//   pending assignment = ALL trips pending assignment
//   ready to send      = ≥1 ready to send, 0 sent, not all pending
//   partially sent      = ≥1 but not all sent/not required
//   completed           = ALL trips sent/not required
function applyContractStatusPreset(trips: TripNotification[], target: NotificationStatus): TripNotification[] {
  const n = trips.length
  if (n === 0) return trips
  if (target === 'Pending Assignment') {
    return trips.map((t) => ({ ...t, notificationStatus: 'Pending Assignment' as const }))
  }
  if (target === 'Ready to Send') {
    return trips.map((t, i) => ({ ...t, notificationStatus: (i === 0 ? 'Ready to Sent' : 'Pending Assignment') as TripNotificationStatus }))
  }
  if (target === 'Completed') {
    return trips.map((t) => ({ ...t, notificationStatus: 'Sent' as const }))
  }
  // Partially Sent — alternate Sent/Ready to Sent; guarantee at least one of
  // each even for very small trip counts so it never collapses into
  // Completed or Ready to Send.
  return trips.map((t, i) => ({
    ...t,
    notificationStatus: (n === 1 ? 'Sent' : i % 2 === 0 ? 'Sent' : 'Ready to Sent') as TripNotificationStatus,
  }))
}

interface Props {
  trips: TripNotification[]
  onChangeTripStatus: (index: number, status: TripNotificationStatus) => void
  onBulkSetTrips: (trips: TripNotification[]) => void
  contractStatus: NotificationStatus
}

// Dev/demo-only tool — not part of the PRD spec. Lets a demo presenter flip
// individual trip statuses live to show how contract status aggregation
// (§2.2) and the action enable/disable rules react, without having to
// drive the real Send Email/SMS/Mark-as-Not-Required flows each time.
export default function StatusSwitcher({ trips, onChangeTripStatus, onBulkSetTrips, contractStatus }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return
      const { startX, startY, origX, origY } = dragState.current
      setPos({
        x: Math.min(Math.max(origX + (e.clientX - startX), 8), window.innerWidth - 60),
        y: Math.min(Math.max(origY + (e.clientY - startY), 8), window.innerHeight - 60),
      })
    }
    const onUp = () => { dragState.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startDrag = (e: React.MouseEvent) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos?.x ?? rect.left, origY: pos?.y ?? rect.top }
    e.preventDefault()
  }

  // Default to bottom-right until the user drags it somewhere else.
  const style: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 1200 }
    : { position: 'fixed', right: 24, bottom: 24, zIndex: 1200 }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Status Switcher (demo tool)"
        style={{
          ...style, width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(15,23,42,.3)',
        }}
      >
        <ExperimentOutlined style={{ fontSize: 18 }} />
      </button>
    )
  }

  return (
    <div id="status-switcher-panel" style={{ ...style, width: 340, maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,.28)', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      <div
        onMouseDown={startDrag}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#1a1a1a', color: '#fff', cursor: 'grab' }}
      >
        <HolderOutlined />
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1 }}>Status Switcher (demo)</Text>
        <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
          <CloseOutlined style={{ fontSize: 13 }} />
        </button>
      </div>

      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Contract Status (computed)</Text>
          <NotificationStatusBadge status={contractStatus} />
        </div>
        <Select<NotificationStatus>
          size="small"
          value={contractStatus}
          onChange={(v) => onBulkSetTrips(applyContractStatusPreset(trips, v))}
          style={{ width: '100%' }}
          options={CONTRACT_STATUS_OPTIONS.map((s) => ({ value: s, label: `Set contract → ${s}` }))}
          dropdownStyle={{ zIndex: 1300 }}
        />
      </div>

      <div style={{ overflowY: 'auto', padding: 8 }}>
        {trips.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 12, display: 'block', color: '#1a1a1a' }}>{t.date} · {t.startTime}</Text>
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{t.driver !== '-' ? t.driver : 'Unassigned'}</Text>
            </div>
            <Select<TripNotificationStatus>
              size="small"
              value={t.notificationStatus}
              onChange={(v) => onChangeTripStatus(i, v)}
              style={{ width: 150 }}
              options={TRIP_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              optionRender={(opt) => <TripStatusBadge status={opt.value as TripNotificationStatus} />}
              dropdownStyle={{ zIndex: 1300 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
