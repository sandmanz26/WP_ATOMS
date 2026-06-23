import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from 'react'
import { GoogleMap, Marker, Polyline, InfoWindow, TrafficLayer, useJsApiLoader } from '@react-google-maps/api'
import { Typography, Input, Button, Select, Popover, Switch, Slider } from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  FileExclamationOutlined,
  FileSearchOutlined,
  WifiOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  CaretRightOutlined,
  PauseOutlined,
  ArrowRightOutlined,
  HolderOutlined,
  CloseOutlined,
  ReloadOutlined,
  BugOutlined,
  EnvironmentOutlined,
  CheckOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import {
  type VehicleStop,
  type BaseTrip,
  type TripStatus,
  baseTrips,
  buildStops,
  TRAFFIC_COLOR,
  TRAFFIC_LABEL,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FOCUS_ZOOM,
  ZOOM_OUT,
  deriveStatus,
  toMinutes,
  pointAlong,
  routeKey,
  STATUS_STYLE,
  formatTimeAmPm,
} from './trackingData'

const { Text } = Typography

// PRD §4.1.2 requires the real Google Maps traffic layer, and routes follow
// actual roads via the Directions API. Set this in .env.local (see the
// setup guide) — never commit a real key. Needs "Maps JavaScript API" and
// "Directions API" enabled.
const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? ''

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// Teardrop pin with white steering-wheel icon (black default, blue when
// selected); offline drivers get a red "no signal" badge so a sudden
// disconnect is visible on the map, not just in the list.
function makePinIcon(fill: string, offline = false): google.maps.Icon {
  const width = offline ? 40 : 34
  const badge = offline
    ? `<circle cx="31" cy="8" r="7" fill="#ff4d4f" stroke="#fff" stroke-width="2"/>
       <line x1="28" y1="5" x2="34" y2="11" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
       <line x1="34" y1="5" x2="28" y2="11" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`
    : ''
  const svg = `
    <svg width="${width}" height="42" viewBox="0 0 ${width} 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.2 17 25 17 25s17-12.8 17-25C34 7.6 26.4 0 17 0Z" fill="${fill}"/>
      <circle cx="17" cy="16" r="8.4" fill="none" stroke="#ffffff" stroke-width="1.7"/>
      <circle cx="17" cy="16" r="2.1" fill="#ffffff"/>
      <line x1="17" y1="16" x2="17" y2="7.6" stroke="#ffffff" stroke-width="1.7"/>
      <line x1="17" y1="16" x2="10" y2="20.5" stroke="#ffffff" stroke-width="1.7"/>
      <line x1="17" y1="16" x2="24" y2="20.5" stroke="#ffffff" stroke-width="1.7"/>
      ${badge}
    </svg>
  `
  return {
    url: svgDataUrl(svg),
    scaledSize: new google.maps.Size(width, 42),
    anchor: new google.maps.Point(17, 42),
  }
}

/* ── Origin (pickup point) marker ── */
function makeOriginIcon(): google.maps.Icon {
  const svg = `
    <svg width="26" height="35" viewBox="0 0 26 35" xmlns="http://www.w3.org/2000/svg">
      <circle cx="13" cy="13" r="13" fill="#16a34a" stroke="#fff" stroke-width="3"/>
      <circle cx="13" cy="13" r="4" fill="#fff"/>
      <rect x="12" y="26" width="2" height="7" fill="#16a34a"/>
    </svg>
  `
  return {
    url: svgDataUrl(svg),
    scaledSize: new google.maps.Size(26, 35),
    anchor: new google.maps.Point(13, 35),
  }
}

/* ── Destination (school) marker ── */
function makeDestinationIcon(): google.maps.Icon {
  const svg = `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="30" height="30" rx="9" fill="#0f172a" stroke="#fff" stroke-width="3"/>
      <path d="M6 27V14l9-5 9 5v13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 27h22" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 27v-5h6v5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="13" y="32" width="2" height="8" fill="#0f172a"/>
    </svg>
  `
  return {
    url: svgDataUrl(svg),
    scaledSize: new google.maps.Size(30, 40),
    anchor: new google.maps.Point(15, 40),
  }
}

/* ── Test console: per-driver status override + helpers ── */
type StatusOverride = 'auto' | TripStatus | 'Offline'

const OVERRIDE_OPTIONS: { label: string; value: StatusOverride }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'On Time', value: 'On Time' },
  { label: 'Late', value: 'Late' },
  { label: 'To Check', value: 'To Check' },
  { label: 'Notified', value: 'Notified' },
  { label: 'Offline', value: 'Offline' },
]

function minutesToHHMM(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

// Force a trip into the exact status a tester picked, so the same override
// flows through deriveStatus() into the map marker, the card and the stat
// counts — there is no separate "test" data path to drift out of sync.
function applyOverride(t: BaseTrip, override: StatusOverride): BaseTrip {
  switch (override) {
    case 'Offline':
      return { ...t, online: false, notified: false, eta: null, lastOnline: t.lastOnline ?? '22 Jun 2026, 09:00 AM' }
    case 'On Time':
      return { ...t, online: true, notified: false, firstPointRegistered: false, eta: t.scheduled }
    case 'Late':
      return { ...t, online: true, notified: false, firstPointRegistered: false, eta: minutesToHHMM(toMinutes(t.scheduled) + 15) }
    case 'To Check':
      return { ...t, online: true, notified: false, firstPointRegistered: false, eta: null }
    case 'Notified':
      return { ...t, notified: true }
    default:
      return t
  }
}

// Minimal drag-by-header behaviour, no extra dependency needed.
function useDraggable(initial: { x: number; y: number }) {
  const [pos, setPos] = useState(initial)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  const onDragStart = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y }
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      setPos({ x: d.baseX + (ev.clientX - d.startX), y: d.baseY + (ev.clientY - d.startY) })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return { pos, onDragStart }
}

/* ── Draggable test console: control # drivers/trips shown + force each
   driver's status, so QA can reproduce a specific test case on demand ── */
function TestConsole({
  pos,
  onDragStart,
  onClose,
  driverCount,
  maxDrivers,
  onDriverCountChange,
  trips,
  overrides,
  onOverrideChange,
  onReset,
  bulkStatus,
  onBulkStatusChange,
  onBulkApply,
  summary,
}: {
  pos: { x: number; y: number }
  onDragStart: (e: React.MouseEvent) => void
  onClose: () => void
  driverCount: number
  maxDrivers: number
  onDriverCountChange: (n: number) => void
  trips: BaseTrip[]
  overrides: Record<string, StatusOverride>
  onOverrideChange: (id: string, v: StatusOverride) => void
  onReset: () => void
  bulkStatus: StatusOverride
  onBulkStatusChange: (v: StatusOverride) => void
  onBulkApply: () => void
  summary: { label: string; color: string; count: number }[]
}) {
  return (
    <div
      data-testid="test-console"
      style={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        zIndex: 2000,
        width: 300,
        background: '#fff',
        border: '1px solid #ffd591',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(15,23,42,.18)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '78vh',
      }}
    >
      <div
        onMouseDown={onDragStart}
        style={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 10px',
          borderBottom: '1px solid #ffe7ba',
          background: '#fff7e6',
          borderRadius: '12px 12px 0 0',
          userSelect: 'none',
        }}
      >
        <HolderOutlined style={{ color: '#d48806' }} />
        <Text style={{ fontWeight: 600, fontSize: 13, color: '#d48806', flex: 1 }}>Test Console</Text>
        <Button size="small" type="text" icon={<ReloadOutlined />} onClick={onReset} title="Reset overrides" />
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} title="Hide" />
      </div>

      <div style={{ padding: '10px 12px', overflowY: 'auto', flex: 1 }}>
        {/* Live sync summary — same `stops` array feeds the map markers, the
            driver list and these counts, so this is always what's on screen */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {summary.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              <Text style={{ fontSize: 11.5, color: '#595959' }}>{s.label} {s.count}</Text>
            </div>
          ))}
        </div>

        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
          Drivers / trips shown: <strong style={{ color: '#1a1a1a' }}>{driverCount}</strong> / {maxDrivers}
        </Text>
        <Slider min={1} max={maxDrivers} value={driverCount} onChange={onDriverCountChange} />

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <Select
            size="small"
            value={bulkStatus}
            onChange={onBulkStatusChange}
            options={OVERRIDE_OPTIONS}
            style={{ flex: 1 }}
            dropdownStyle={{ zIndex: 2100 }}
          />
          <Button size="small" onClick={onBulkApply}>Apply to all</Button>
        </div>

        <Text style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 6 }}>
          Per-driver status
        </Text>
        {trips.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Text
              style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={`${t.driver} · ${t.label}`}
            >
              {t.driver} <span style={{ color: '#bfbfbf' }}>· {t.label}</span>
            </Text>
            <Select
              size="small"
              value={overrides[t.id] ?? 'auto'}
              onChange={(v) => onOverrideChange(t.id, v)}
              options={OVERRIDE_OPTIONS}
              style={{ width: 104, flexShrink: 0 }}
              dropdownStyle={{ zIndex: 2100 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Urgency ticker: surfaces trips that need attention right now (offline
   or running late) as a row of cards above the map — a card pops in the
   moment a trip goes wrong and disappears the moment it's resolved, so
   dispatchers don't have to keep scanning the full driver list. ── */
function UrgencyTicker({
  stops,
  selectedId,
  onSelect,
  onTakeIt,
}: {
  stops: VehicleStop[]
  selectedId: string | null
  onSelect: (id: string) => void
  onTakeIt: (id: string) => void
}) {
  if (stops.length === 0) return null
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        marginBottom: 12,
        paddingBottom: 2,
      }}
    >
      {stops.map((s) => {
        const offline = !s.online
        const accent = offline ? '#ff4d4f' : '#faad14'
        const selected = selectedId === s.id
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id) }}
            className={`urgency-card ${offline ? 'urgency-card-offline' : 'urgency-card-late'}`}
            style={{
              flexShrink: 0,
              width: 158,
              textAlign: 'left',
              background: '#fff',
              border: `1px solid ${selected ? accent : '#f0f0f0'}`,
              borderRadius: 10,
              overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            <div className="urgency-strip" style={{ height: 4, background: accent }} />
            <div style={{ padding: '7px 10px' }}>
              <span className="urgency-ping" style={{ color: accent }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {offline ? (
                  <WifiOutlined style={{ color: accent, fontSize: 12 }} />
                ) : (
                  <ClockCircleOutlined style={{ color: accent, fontSize: 12 }} />
                )}
                <Text style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{s.label}</Text>
              </div>
              <Text
                style={{ fontSize: 11, color: '#8c8c8c', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={s.driver}
              >
                {s.driver}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: accent }}>
                {offline ? 'Offline' : `Late · ETA ${s.eta ? formatTimeAmPm(s.eta) : '-'}`}
              </Text>
              <Button
                size="small"
                icon={<CheckOutlined style={{ fontSize: 10 }} />}
                onClick={(e) => { e.stopPropagation(); onTakeIt(s.id) }}
                style={{ width: '100%', marginTop: 6, fontSize: 11, height: 24 }}
              >
                Take it
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Stat card (Late / To Check) ── */
function StatCard({
  icon,
  iconBg,
  label,
  labelColor,
  count,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  labelColor: string
  count: number
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        padding: '8px 10px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
          fontSize: 14,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: labelColor, fontSize: 11, fontWeight: 600, display: 'block', lineHeight: 1.3 }}>{label}</Text>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>{count}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Driver</Text>
        </div>
      </div>
      <Button
        size="small"
        icon={<SearchOutlined />}
        style={{ borderColor: '#e8e8e8', color: '#595959', flexShrink: 0 }}
      />
    </div>
  )
}

/* ── Filter pill ── */
function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '7px 0',
        borderRadius: 18,
        border: active ? 'none' : '1px solid #e8e8e8',
        background: active ? '#1677ff' : '#fff',
        color: active ? '#fff' : '#595959',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

/* ── Field label wrapper for the filter popover ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text style={{ fontSize: 13, color: '#595959', display: 'block', marginBottom: 6 }}>{label}</Text>
      {children}
    </div>
  )
}

/* ── Driver list card ── */
function DriverCard({
  stop,
  selected,
  onSelect,
  innerRef,
}: {
  stop: VehicleStop
  selected: boolean
  onSelect: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const status = deriveStatus(stop)
  const s = STATUS_STYLE[status]
  // deriveStatus() folds offline into 'To Check' (shared with Tracking 2.0,
  // not to be changed here) — but the status switcher has a distinct
  // "Offline" option, so the badge shown to the admin must say "Offline"
  // too rather than silently relabelling it "To Check".
  const statusLabel = stop.online ? status : 'Offline'
  // PRD §4.2.3/BR-002: status + ETA are hidden once the first point is registered
  const showStatusAndEta = !stop.firstPointRegistered
  return (
    <div
      ref={innerRef}
      onClick={onSelect}
      style={{
        background: selected ? '#e6f4ff' : '#fff',
        border: `1px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Top: bus label + customer code + more */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              background: '#e6f4ff',
              color: '#1677ff',
              fontSize: 12,
              fontWeight: 500,
              padding: '1px 8px',
              borderRadius: 4,
            }}
          >
            {stop.label}
          </span>
          <span
            style={{
              background: '#f5f5f5',
              color: '#595959',
              fontSize: 12,
              fontWeight: 500,
              padding: '1px 8px',
              borderRadius: 4,
            }}
          >
            {stop.customerCode}
          </span>
        </div>
        <MoreOutlined style={{ color: '#bfbfbf', fontSize: 16, cursor: 'pointer' }} />
      </div>

      {/* Trip: from → to */}
      {stop.from && stop.to ? (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
          <Text style={{ fontSize: 12.5, color: '#595959' }} ellipsis>{stop.from.name}</Text>
          <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 11, flexShrink: 0 }} />
          <Text
            style={{ fontSize: 12.5, fontWeight: 600, color: selected ? '#1677ff' : '#1a1a1a' }}
            ellipsis
          >
            {stop.to.name}
          </Text>
        </div>
      ) : (
        <Text style={{ display: 'block', fontWeight: 600, fontSize: 15, color: selected ? '#1677ff' : '#1a1a1a', marginTop: 6 }}>
          {stop.destination}
        </Text>
      )}

      {/* Trip Start Time (PRD §4.2.2) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
        <Text style={{ fontSize: 13, color: '#8c8c8c' }}>{formatTimeAmPm(stop.scheduled)}</Text>
      </div>

      {/* ETA + Trip Status — hidden once first point is registered (BR-002) */}
      {showStatusAndEta ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: selected ? '#fff' : '#f7f8fa',
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 10,
          }}
        >
          <Text style={{ fontSize: 14, color: '#1a1a1a' }}>
            ETA{' '}
            <Text style={{ color: stop.online && stop.eta ? '#1677ff' : '#8c8c8c', fontWeight: 700, fontSize: 16 }}>
              {stop.online && stop.eta ? formatTimeAmPm(stop.eta) : '-'}
            </Text>
          </Text>
          <span
            style={{
              background: s.bg,
              color: s.color,
              border: `1px solid ${s.border}`,
              fontSize: 12,
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: 6,
            }}
          >
            {statusLabel}
          </span>
        </div>
      ) : (
        <div
          style={{
            background: selected ? '#fff' : '#f7f8fa',
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 10,
          }}
        >
          <Text style={{ fontSize: 13, color: '#8c8c8c' }}>First point registered</Text>
        </div>
      )}

      {/* Driver + plate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 15 }} />
        <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{stop.driver}</Text>
        <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginLeft: 'auto' }}>{stop.plate}</Text>
      </div>

      {/* Fleet Owner + last online (offline drivers only, per BR-012) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 12, color: '#bfbfbf' }}>{stop.fleetOwner}</Text>
        {!stop.online && stop.lastOnline && (
          <Text style={{ fontSize: 12, color: '#bfbfbf' }}>Last online {stop.lastOnline}</Text>
        )}
      </div>
    </div>
  )
}

/* ── Contains crashes from the Google Maps SDK (e.g. a degraded/auth-failed
   map throwing on marker/polyline updates) to the map widget only, so a
   single bad render there can't blank out the whole page ── */
class MapErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override render() {
    if (this.state.error) {
      return (
        <div style={{ height: '100%', minHeight: 600, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#ff4d4f', textAlign: 'center', padding: 24 }}>
          <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>Map failed to render</Text>
          <Text style={{ fontSize: 12.5, color: '#8c8c8c', maxWidth: 360 }}>
            {this.state.error.message || 'An unexpected error occurred in the Google Maps widget.'}
          </Text>
        </div>
      )
    }
    return this.props.children
  }
}

/* ── Google Maps view: only mounted once an API key is configured, so the
   loader script is never requested otherwise ── */
function LiveMapView({
  filtered,
  selectedId,
  selectedStop,
  posRef,
  showRoutes,
  showTraffic,
  onSelect,
  onRouteResolved,
}: {
  filtered: VehicleStop[]
  selectedId: string | null
  selectedStop: VehicleStop | null
  posRef: React.MutableRefObject<Record<string, [number, number] | null>>
  showRoutes: boolean
  showTraffic: boolean
  onSelect: (id: string) => void
  onRouteResolved: (key: string, path: [number, number][]) => void
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })
  const mapRef = useRef<google.maps.Map | null>(null)
  const carIcon = useMemo(() => (isLoaded ? makePinIcon('#1a1a1a') : undefined), [isLoaded])
  const carIconSelected = useMemo(() => (isLoaded ? makePinIcon('#1677ff') : undefined), [isLoaded])
  const carIconOffline = useMemo(() => (isLoaded ? makePinIcon('#1a1a1a', true) : undefined), [isLoaded])
  const carIconOfflineSelected = useMemo(() => (isLoaded ? makePinIcon('#1677ff', true) : undefined), [isLoaded])
  const originIcon = useMemo(() => (isLoaded ? makeOriginIcon() : undefined), [isLoaded])
  const destinationIcon = useMemo(() => (isLoaded ? makeDestinationIcon() : undefined), [isLoaded])

  // Fetch the real, road-following route for each distinct origin→destination
  // leg via the Directions API (requires "Directions API" enabled on the
  // Maps key) — replaces the synthetic curve as soon as it resolves. Keyed
  // by leg so trips that share a pickup/destination only fetch once.
  const requestedKeysRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!isLoaded) return
    const service = new google.maps.DirectionsService()
    filtered.forEach((s) => {
      if (!s.from || !s.to) return
      const key = routeKey(s.from, s.to)
      if (requestedKeysRef.current.has(key)) return
      requestedKeysRef.current.add(key)
      service.route(
        {
          origin: { lat: s.from.lat, lng: s.from.lng },
          destination: { lat: s.to.lat, lng: s.to.lng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            const path = result.routes[0].overview_path.map((p) => [p.lat(), p.lng()] as [number, number])
            onRouteResolved(key, path)
          } else {
            // Leave the synthetic curve in place and allow a retry later
            requestedKeysRef.current.delete(key)
          }
        }
      )
    })
  }, [isLoaded, filtered, onRouteResolved])

  // Pan/zoom the map when a card/marker is selected (replaces Leaflet's MapController)
  useEffect(() => {
    if (!selectedId || !mapRef.current) return
    const p = posRef.current[selectedId]
    if (p) {
      // Available driver, or To Check with a last-seen location → zoom in to icon
      mapRef.current.panTo({ lat: p[0], lng: p[1] })
      mapRef.current.setZoom(FOCUS_ZOOM)
    } else {
      // To Check with no driver last seen → zoom out, no driver icon
      mapRef.current.panTo({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] })
      mapRef.current.setZoom(ZOOM_OUT)
    }
  }, [selectedId, posRef])

  if (loadError) {
    return (
      <div style={{ height: '100%', minHeight: 600, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f' }}>
        Failed to load Google Maps: {loadError.message}
      </div>
    )
  }
  if (!isLoaded) {
    return (
      <div style={{ height: '100%', minHeight: 600, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
        Loading Google Maps…
      </div>
    )
  }

  return (
    <GoogleMap
      center={{ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }}
      zoom={DEFAULT_ZOOM}
      mapContainerStyle={{ height: '100%', minHeight: 600, width: '100%' }}
      onLoad={(map) => { mapRef.current = map }}
      options={{
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      }}
    >
      {/* Real-time road conditions (traffic) — toggleable */}
      {showTraffic && <TrafficLayer />}

      {/* Driver routes to the destination — toggleable; selected one highlighted */}
      {showRoutes &&
        filtered
          .filter((s) => s.route && s.route.length > 1)
          .map((s) => {
            const sel = selectedId === s.id
            const dim = selectedId != null && !sel
            return (
              <Polyline
                key={`route-${s.id}`}
                path={(s.route as [number, number][]).map(([lat, lng]) => ({ lat, lng }))}
                options={
                  sel
                    ? { strokeColor: '#1677ff', strokeWeight: 5, strokeOpacity: 0.95 }
                    : { strokeColor: '#64748b', strokeWeight: 3, strokeOpacity: dim ? 0.1 : 0.4 }
                }
              />
            )
          })}

      {/* Selected trip's origin (from) and destination (to) */}
      {selectedStop?.from && (
        <Marker
          position={{ lat: selectedStop.from.lat, lng: selectedStop.from.lng }}
          icon={originIcon}
          title={`From: ${selectedStop.from.name}`}
        />
      )}
      {selectedStop?.to && (
        <Marker
          position={{ lat: selectedStop.to.lat, lng: selectedStop.to.lng }}
          icon={destinationIcon}
          title={`To: ${selectedStop.to.name}`}
        />
      )}

      {/* Driver markers — animated along route while simulating */}
      {filtered
        .map((stop) => ({ stop, pos: posRef.current[stop.id] }))
        .filter((x) => x.pos != null)
        .map(({ stop, pos }) => {
          const [lat, lng] = pos as [number, number]
          const sel = selectedId === stop.id
          const icon = stop.online
            ? sel ? carIconSelected : carIcon
            : sel ? carIconOfflineSelected : carIconOffline
          return (
            <div key={stop.id}>
              <Marker
                position={{ lat, lng }}
                icon={icon}
                onClick={() => onSelect(stop.id)}
              />
              {sel && (() => {
                // Same deriveStatus()/STATUS_STYLE source of truth as the
                // driver list and the test switcher, so the badge here never
                // drifts from what's shown anywhere else. deriveStatus()
                // folds offline into 'To Check', so relabel it "Offline" —
                // matching the switcher's own distinct option for it.
                const tripStatus = deriveStatus(stop)
                const tripStyle = STATUS_STYLE[tripStatus]
                const tripStatusLabel = stop.online ? tripStatus : 'Offline'
                return (
                  <InfoWindow position={{ lat, lng }} options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -38) }}>
                    <div style={{ minWidth: 188, fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 13 }} />
                        <strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{stop.driver}</strong>
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{stop.plate}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: '1px solid #f0f0f0',
                        }}
                      >
                        {stop.online ? (
                          <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                            ETA <strong style={{ color: '#1a1a1a' }}>{stop.eta ? formatTimeAmPm(stop.eta) : '-'}</strong>
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 12, color: '#ff4d4f', fontWeight: 600 }}>
                            Offline · last seen{stop.lastOnline ? ` ${stop.lastOnline}` : ' position unknown'}
                          </Text>
                        )}
                        <span
                          style={{
                            background: tripStyle.bg,
                            color: tripStyle.color,
                            border: `1px solid ${tripStyle.border}`,
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '1px 8px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                            marginLeft: 8,
                          }}
                        >
                          {tripStatusLabel}
                        </span>
                      </div>
                    </div>
                  </InfoWindow>
                )
              })()}
            </div>
          )
        })}
    </GoogleMap>
  )
}

export default function LiveTrackingPage() {
  const [filter, setFilter] = useState<'All' | 'Offline' | 'Online' | 'To Check'>('All')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Lets the driver list panel be hidden to free up width for the map —
  // it's a fixed-width column, so on a narrow viewport it can otherwise
  // crowd the map down to a sliver with no way to get it back
  const [showDriverList, setShowDriverList] = useState(true)

  // Trips an admin has "taken" off the urgency ticker to action — moves them
  // into the "To Check" tab/queue so the ticker frees up for the next
  // problem trip (PRD follow-up: ops handle ~40 drivers/day, need to triage fast)
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set())
  const onTakeIt = (id: string) => setTakenIds((prev) => new Set(prev).add(id))

  // Filter popover state
  const [filterOpen, setFilterOpen] = useState(false)
  const [customerCode, setCustomerCode] = useState('')
  const [fleetOwner, setFleetOwner] = useState('')
  const [driverFilter, setDriverFilter] = useState<string | undefined>()
  const [vehicleFilter, setVehicleFilter] = useState<string | undefined>()
  const [driverStatus, setDriverStatus] = useState<string | undefined>()
  const [tripStatus, setTripStatus] = useState<string | undefined>()

  // Map layer toggles + movement simulation
  const [showRoutes, setShowRoutes] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [progress, setProgress] = useState(0)

  // Test console — lets dev/QA dial in a specific test case (how many
  // drivers/trips are live, and what status each one is in) and see it
  // reflected immediately in the map markers, list and stat counts below.
  const [testPanelVisible, setTestPanelVisible] = useState(true)
  const [driverCount, setDriverCount] = useState(baseTrips.length)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, StatusOverride>>({})
  const [bulkStatus, setBulkStatus] = useState<StatusOverride>('auto')
  const { pos: testPanelPos, onDragStart: onTestPanelDragStart } = useDraggable({
    x: Math.max(window.innerWidth - 332, 16),
    y: 96,
  })

  // Real, road-following routes resolved from the Directions API, keyed by
  // routeKey(from, to) — replaces the synthetic curve once available.
  const [realRoutes, setRealRoutes] = useState<Record<string, [number, number][]>>({})
  const onRouteResolved = (key: string, path: [number, number][]) =>
    setRealRoutes((prev) => (prev[key] ? prev : { ...prev, [key]: path }))

  const visibleTrips = baseTrips.slice(0, driverCount)
  const workingTrips = visibleTrips.map((t) => applyOverride(t, statusOverrides[t.id] ?? 'auto'))
  const stops = buildStops(workingTrips).map((s) => {
    if (!s.from || !s.to) return s
    const real = realRoutes[routeKey(s.from, s.to)]
    if (!real) return s
    const pos = pointAlong(real, s.phase)
    return { ...s, route: real, lat: pos[0], lng: pos[1] }
  })

  const setOverride = (id: string, v: StatusOverride) =>
    setStatusOverrides((prev) => ({ ...prev, [id]: v }))
  const resetOverrides = () => {
    setStatusOverrides({})
    setBulkStatus('auto')
  }
  const applyBulkStatus = () =>
    setStatusOverrides((prev) => {
      const next = { ...prev }
      visibleTrips.forEach((t) => { next[t.id] = bulkStatus })
      return next
    })

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Driver list height tracks the left column's rendered height (stat cards
  // + ticker + map) so it always reaches the same bottom edge as the map,
  // instead of a hardcoded cap that leaves a gap when the map area grows.
  const leftColRef = useRef<HTMLDivElement | null>(null)
  const [leftColHeight, setLeftColHeight] = useState(600)
  useEffect(() => {
    if (!leftColRef.current) return
    const el = leftColRef.current
    const observer = new ResizeObserver(([entry]) => setLeftColHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // Latest live position per driver (animated when simulating, else static)
  const posRef = useRef<Record<string, [number, number] | null>>({})

  // Advance the simulation while playing
  useEffect(() => {
    if (!simulating) return
    const id = setInterval(() => {
      setProgress((p) => {
        const np = p + 0.004
        return np >= 1 ? 0 : np
      })
    }, 80)
    return () => clearInterval(id)
  }, [simulating])

  // Current position of a driver: advance from its current phase while
  // simulating, else its live/last-seen position
  const livePos = (s: VehicleStop): [number, number] | null => {
    if (simulating && s.route && s.route.length > 1) return pointAlong(s.route, (s.phase + progress) % 1)
    return s.lat != null && s.lng != null ? [s.lat, s.lng] : null
  }
  posRef.current = Object.fromEntries(stops.map((s) => [s.id, livePos(s)]))

  const selectedStop = selectedId ? stops.find((s) => s.id === selectedId) ?? null : null

  // Trips needing attention right now — offline or running late — for the
  // urgency ticker above the map. Based on the full dataset (not `filtered`)
  // so a problem trip doesn't vanish just because of an active search/filter.
  // Once an admin hits "Take it" the trip moves to the "To Check" queue
  // instead, freeing a slot in the ticker for the next problem trip.
  const urgentStops = stops.filter((s) => (!s.online || deriveStatus(s) === 'Late') && !takenIds.has(s.id))

  // Self-clean the "To Check" queue: once a taken trip is back online and on
  // time it's no longer a problem, so drop it rather than leaving stale
  // entries — keeps it as live a view as the rest of the screen.
  useEffect(() => {
    setTakenIds((prev) => {
      if (prev.size === 0) return prev
      const stillUrgent = new Set(stops.filter((s) => !s.online || deriveStatus(s) === 'Late').map((s) => s.id))
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (stillUrgent.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [stops])

  // When selection changes (e.g. from a marker click), auto-scroll the list to its card
  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      cardRefs.current[selectedId]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedId])

  const driverOptions = Array.from(new Set(stops.map((s) => s.driver))).map((d) => ({ label: d, value: d }))
  const vehicleOptions = Array.from(new Set(stops.map((s) => s.plate))).map((p) => ({ label: p, value: p }))

  // Stat counts derived from the data (kept in sync with the list/map)
  const lateCount = stops.filter((s) => deriveStatus(s) === 'Late').length
  const toCheckCount = stops.filter((s) => deriveStatus(s) === 'To Check').length
  const onTimeCount = stops.filter((s) => deriveStatus(s) === 'On Time').length
  const notifiedCount = stops.filter((s) => deriveStatus(s) === 'Notified').length
  const offlineCount = stops.filter((s) => !s.online).length

  const testSummary = [
    { label: 'On Time', color: STATUS_STYLE['On Time'].color, count: onTimeCount },
    { label: 'Late', color: STATUS_STYLE.Late.color, count: lateCount },
    { label: 'To Check', color: STATUS_STYLE['To Check'].color, count: toCheckCount },
    { label: 'Notified', color: STATUS_STYLE.Notified.color, count: notifiedCount },
    { label: 'Offline', color: '#8c8c8c', count: offlineCount },
  ]

  const clearAllFilters = () => {
    setCustomerCode('')
    setFleetOwner('')
    setDriverFilter(undefined)
    setVehicleFilter(undefined)
    setDriverStatus(undefined)
    setTripStatus(undefined)
  }

  const filtered = stops.filter((s) => {
    if (filter === 'Online' && !s.online) return false
    if (filter === 'Offline' && s.online) return false
    if (filter === 'To Check' && !takenIds.has(s.id)) return false
    if (search.trim()) {
      // PRD §4.4.2: search across Driver's name, Vehicle plate, Customer code, Bus label
      const q = search.toLowerCase()
      const hit =
        s.driver.toLowerCase().includes(q) ||
        s.plate.toLowerCase().includes(q) ||
        s.customerCode.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q)
      if (!hit) return false
    }
    if (customerCode.trim() && !s.customerCode.toLowerCase().includes(customerCode.toLowerCase())) return false
    if (fleetOwner.trim() && !s.fleetOwner.toLowerCase().includes(fleetOwner.toLowerCase())) return false
    if (driverFilter && s.driver !== driverFilter) return false
    if (vehicleFilter && s.plate !== vehicleFilter) return false
    if (driverStatus === 'Online' && !s.online) return false
    if (driverStatus === 'Offline' && s.online) return false
    if (tripStatus && deriveStatus(s) !== tripStatus) return false
    return true
  })

  const filterContent = (
    <div style={{ width: 820, padding: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 20 }}>Filter</Text>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
        <Field label="Customer Code">
          <Input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} allowClear />
        </Field>
        <Field label="Fleet Owner">
          <Input value={fleetOwner} onChange={(e) => setFleetOwner(e.target.value)} allowClear />
        </Field>
        <Field label="Driver">
          <Select
            value={driverFilter}
            onChange={setDriverFilter}
            options={driverOptions}
            style={{ width: '100%' }}
            allowClear
            showSearch
          />
        </Field>
        <Field label="Vehicle">
          <Select
            value={vehicleFilter}
            onChange={setVehicleFilter}
            options={vehicleOptions}
            style={{ width: '100%' }}
            allowClear
            showSearch
          />
        </Field>
        <Field label="Driver Status">
          <Select
            value={driverStatus}
            onChange={setDriverStatus}
            options={[
              { label: 'Online', value: 'Online' },
              { label: 'Offline', value: 'Offline' },
            ]}
            style={{ width: '100%' }}
            allowClear
          />
        </Field>
        <Field label="Trip Status">
          <Select
            value={tripStatus}
            onChange={setTripStatus}
            options={[
              { label: 'On Time', value: 'On Time' },
              { label: 'Late', value: 'Late' },
              { label: 'To Check', value: 'To Check' },
              { label: 'Notified', value: 'Notified' },
            ]}
            style={{ width: '100%' }}
            allowClear
          />
        </Field>
      </div>
      <Button style={{ marginTop: 20 }} onClick={clearAllFilters}>
        Clear all filters
      </Button>
    </div>
  )

  return (
    <div style={{ padding: '24px 32px' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 14,
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* ── Left column: stat cards + map ── */}
          <div ref={leftColRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <StatCard
                icon={<FileExclamationOutlined />}
                iconBg="#f5a623"
                label="Late"
                labelColor="#fa541c"
                count={lateCount}
              />
              <StatCard
                icon={<FileSearchOutlined />}
                iconBg="#f5222d"
                label="To Check"
                labelColor="#1a1a1a"
                count={toCheckCount}
              />
            </div>

            <UrgencyTicker stops={urgentStops} selectedId={selectedId} onSelect={setSelectedId} onTakeIt={onTakeIt} />

            {/* Map */}
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #f0f0f0',
                flex: 1,
                minHeight: 600,
              }}
            >
              {!GOOGLE_MAPS_API_KEY ? (
                <div
                  style={{
                    height: '100%',
                    minHeight: 600,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: '#f7f8fa',
                    color: '#8c8c8c',
                    textAlign: 'center',
                    padding: 24,
                  }}
                >
                  <EnvironmentOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
                  <Text style={{ color: '#595959', fontWeight: 600 }}>Google Maps API key not configured</Text>
                  <Text style={{ fontSize: 13, color: '#8c8c8c', maxWidth: 360 }}>
                    Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> (see <code>.env.example</code>) to load the live map and traffic layer.
                  </Text>
                </div>
              ) : (
                <MapErrorBoundary>
                  <LiveMapView
                    filtered={filtered}
                    selectedId={selectedId}
                    selectedStop={selectedStop}
                    posRef={posRef}
                    showRoutes={showRoutes}
                    showTraffic={showTraffic}
                    onSelect={setSelectedId}
                    onRouteResolved={onRouteResolved}
                  />
                </MapErrorBoundary>
              )}

              {/* Map controls: layer toggles + movement simulation */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 500,
                  background: 'rgba(255,255,255,.96)',
                  border: '1px solid #f0f0f0',
                  borderRadius: 10,
                  padding: '10px 12px',
                  boxShadow: '0 4px 14px rgba(15,23,42,.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minWidth: 168,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontSize: 13, color: '#595959' }}>Show routes</Text>
                  <Switch size="small" checked={showRoutes} onChange={setShowRoutes} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontSize: 13, color: '#595959' }}>Show traffic</Text>
                  <Switch size="small" checked={showTraffic} onChange={setShowTraffic} />
                </div>
                <Button
                  size="small"
                  type={simulating ? 'primary' : 'default'}
                  icon={simulating ? <PauseOutlined /> : <CaretRightOutlined />}
                  onClick={() => setSimulating((v) => !v)}
                  block
                >
                  {simulating ? 'Pause' : 'Simulate'}
                </Button>
              </div>

              {/* Traffic legend */}
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  bottom: 14,
                  zIndex: 500,
                  background: 'rgba(255,255,255,.96)',
                  border: '1px solid #f0f0f0',
                  borderRadius: 10,
                  padding: '9px 12px',
                  boxShadow: '0 4px 14px rgba(15,23,42,.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <Text style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Traffic
                </Text>
                {(['smooth', 'moderate', 'heavy'] as const).map((lvl) => (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 4, borderRadius: 2, background: TRAFFIC_COLOR[lvl] }} />
                    <Text style={{ fontSize: 12, color: '#64748b' }}>{TRAFFIC_LABEL[lvl]}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right column: search + pills + list ── */}
          {showDriverList ? (
            <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Search + filter */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="input route code, bus label..."
                  style={{ flex: 1, borderRadius: 8 }}
                  allowClear
                />
                <Popover
                  content={filterContent}
                  trigger="click"
                  open={filterOpen}
                  onOpenChange={setFilterOpen}
                  placement="bottomRight"
                >
                  <Button icon={<FilterOutlined />} style={{ borderColor: '#e8e8e8', color: '#595959' }} />
                </Popover>
                <Button
                  icon={<MenuFoldOutlined />}
                  onClick={() => setShowDriverList(false)}
                  style={{ borderColor: '#e8e8e8', color: '#595959' }}
                  title="Hide list"
                />
              </div>

              {/* Filter pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Pill active={filter === 'All'} onClick={() => setFilter('All')}>All</Pill>
                <Pill active={filter === 'Offline'} onClick={() => setFilter('Offline')}>Offline</Pill>
                <Pill active={filter === 'Online'} onClick={() => setFilter('Online')}>Online</Pill>
                <Pill active={filter === 'To Check'} onClick={() => setFilter('To Check')}>
                  To Check{takenIds.size > 0 ? ` (${takenIds.size})` : ''}
                </Pill>
              </div>

              {/* Driver list */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: leftColHeight, paddingRight: 2 }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf', fontSize: 13 }}>
                    No drivers found
                  </div>
                ) : (
                  filtered.map((stop) => (
                    <DriverCard
                      key={stop.id}
                      stop={stop}
                      selected={selectedId === stop.id}
                      onSelect={() => setSelectedId(stop.id)}
                      innerRef={(el) => {
                        cardRefs.current[stop.id] = el
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <Button
              icon={<MenuUnfoldOutlined />}
              onClick={() => setShowDriverList(true)}
              style={{ flexShrink: 0, borderColor: '#e8e8e8', color: '#595959' }}
              title="Show list"
            />
          )}
        </div>
      </div>

      {testPanelVisible ? (
        <TestConsole
          pos={testPanelPos}
          onDragStart={onTestPanelDragStart}
          onClose={() => setTestPanelVisible(false)}
          driverCount={driverCount}
          maxDrivers={baseTrips.length}
          onDriverCountChange={setDriverCount}
          trips={visibleTrips}
          overrides={statusOverrides}
          onOverrideChange={setOverride}
          onReset={resetOverrides}
          bulkStatus={bulkStatus}
          onBulkStatusChange={setBulkStatus}
          onBulkApply={applyBulkStatus}
          summary={testSummary}
        />
      ) : (
        <Button
          shape="circle"
          size="large"
          icon={<BugOutlined />}
          onClick={() => setTestPanelVisible(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            borderColor: '#ffd591',
            color: '#d48806',
            boxShadow: '0 6px 18px rgba(15,23,42,.18)',
          }}
          title="Show test console"
        />
      )}
    </div>
  )
}
