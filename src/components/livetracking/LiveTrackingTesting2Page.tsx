import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from 'react'
import { GoogleMap, Marker, Polyline, InfoWindow, TrafficLayer, useJsApiLoader } from '@react-google-maps/api'
import { Typography, Input, Button, Popover, Switch, Drawer, Tooltip, Select, message } from 'antd'
import {
  SearchOutlined,
  WifiOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  BellOutlined,
  PhoneOutlined,
  CaretRightOutlined,
  PauseOutlined,
  EnvironmentOutlined,
  ControlOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import {
  type VehicleStop,
  type BaseTrip,
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

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? ''

/* ─────────────────────────────────────────────────────────────────────────
   Live Tracking Testing 2 — a list-first revamp. Ops runs 60–80 trips a
   day, so the list is the work surface (≈70% width, two cards per row for
   density) and the map is a context strip (≈30%). Clicking a card or a
   marker opens a rich tooltip with the essentials; "View detail" opens the
   full drawer with actions.
   ───────────────────────────────────────────────────────────────────────── */

/* ── Demo volume: ops handles 60–80 trips/day, the seed set is 23 — clone
   it ×3 with shifted times/positions so the design is exercised at the
   real workload (69 trips). Local to this sandbox page only. ── */
function minutesToHHMM(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function shiftTime(t: string, min: number): string {
  return minutesToHHMM(toMinutes(t) + min)
}

function cloneTrips(suffix: string, shiftMin: number, phaseShift: number): BaseTrip[] {
  return baseTrips.map((t) => ({
    ...t,
    id: `${t.id}${suffix}`,
    label: `${t.label}${suffix.toUpperCase()}`,
    scheduled: shiftTime(t.scheduled, shiftMin),
    eta: t.eta ? shiftTime(t.eta, shiftMin) : null,
    phase: (t.phase + phaseShift) % 1,
  }))
}

const DEMO_TRIPS: BaseTrip[] = [...baseTrips, ...cloneTrips('b', 40, 0.18), ...cloneTrips('c', 85, 0.36)]

/* ── Status → accent color (offline always red: stale position) ── */
function statusColor(stop: VehicleStop): string {
  if (!stop.online) return '#ff4d4f'
  switch (deriveStatus(stop)) {
    case 'Late': return '#faad14'
    case 'Notified': return '#1677ff'
    case 'To Check': return '#ff4d4f'
    default: return '#16a34a'
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0]
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function makeBusBadgeIcon(color: string, selected: boolean): google.maps.Icon {
  const size = selected ? 40 : 30
  const pad = 6
  const total = size + pad * 2
  const c = total / 2
  const r = size / 2 - (selected ? 2 : 1.5)
  const fill = selected ? '#1677ff' : color
  const sw = selected ? 3 : 2.2
  const g = size * 0.56
  const scale = g / 24
  const gx = c - g / 2
  const gy = c - g / 2
  const svg = `
    <svg width="${total}" height="${total}" viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="busShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="rgba(15,23,42,0.35)"/>
        </filter>
      </defs>
      <circle cx="${c}" cy="${c}" r="${r}" fill="${fill}" stroke="#ffffff" stroke-width="${sw}" filter="url(#busShadow)"/>
      <g transform="translate(${gx},${gy}) scale(${scale})">
        <rect x="4.5" y="3" width="15" height="13.5" rx="3" fill="#ffffff"/>
        <rect x="6.3" y="5" width="11.4" height="4.4" rx="1.2" fill="${fill}"/>
        <rect x="6" y="11.4" width="2.6" height="2.6" rx="0.7" fill="${fill}"/>
        <rect x="15.4" y="11.4" width="2.6" height="2.6" rx="0.7" fill="${fill}"/>
        <circle cx="8.3" cy="18.2" r="1.9" fill="#ffffff"/>
        <circle cx="15.7" cy="18.2" r="1.9" fill="#ffffff"/>
      </g>
    </svg>
  `
  return {
    url: svgDataUrl(svg),
    scaledSize: new google.maps.Size(total, total),
    anchor: new google.maps.Point(c, c),
  }
}

function makeOriginIcon(): google.maps.Icon {
  const svg = `
    <svg width="26" height="35" viewBox="0 0 26 35" xmlns="http://www.w3.org/2000/svg">
      <circle cx="13" cy="13" r="13" fill="#16a34a" stroke="#fff" stroke-width="3"/>
      <circle cx="13" cy="13" r="4" fill="#fff"/>
      <rect x="12" y="26" width="2" height="7" fill="#16a34a"/>
    </svg>
  `
  return { url: svgDataUrl(svg), scaledSize: new google.maps.Size(26, 35), anchor: new google.maps.Point(13, 35) }
}

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
  return { url: svgDataUrl(svg), scaledSize: new google.maps.Size(30, 40), anchor: new google.maps.Point(15, 40) }
}

const SILVER_THEME: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
]

/* ── KPI chips: counts double as filters ── */
type KpiKey = 'all' | 'On Time' | 'Late' | 'Offline' | 'Notified'

const KPI_META: { key: KpiKey; label: string; color: string; soft: string; urgent?: boolean }[] = [
  { key: 'all', label: 'All', color: '#1677ff', soft: '#e6f4ff' },
  { key: 'On Time', label: 'On Time', color: '#16a34a', soft: '#f6ffed' },
  { key: 'Late', label: 'Late', color: '#faad14', soft: '#fffbe6', urgent: true },
  { key: 'Offline', label: 'Offline', color: '#ff4d4f', soft: '#fff1f0', urgent: true },
  { key: 'Notified', label: 'Notified', color: '#1677ff', soft: '#e6f4ff' },
]

function kpiMatch(stop: VehicleStop, key: KpiKey): boolean {
  if (key === 'all') return true
  if (key === 'Offline') return !stop.online
  if (!stop.online) return false
  return deriveStatus(stop) === key
}

type SortKey = 'start' | 'eta' | 'label'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'start', label: 'Start time' },
  { value: 'eta', label: 'ETA' },
  { value: 'label', label: 'Route code' },
]

/* ── Rich tooltip body shared by the card popover and the map InfoWindow ── */
function TripSummary({ stop, onViewDetail, onTake, handled }: { stop: VehicleStop; onViewDetail: () => void; onTake?: () => void; handled?: boolean }) {
  const status = deriveStatus(stop)
  const s = STATUS_STYLE[status]
  const statusLabel = stop.online ? status : 'Offline'
  const lateMin = stop.online && status === 'Late' && stop.eta ? toMinutes(stop.eta) - toMinutes(stop.scheduled) : 0
  const urgent = !stop.online || status === 'Late'
  return (
    <div style={{ width: 252 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 13 }} />
        <Text style={{ fontSize: 13, fontWeight: 600 }}>{stop.driver}</Text>
        <span style={{ marginLeft: 'auto', background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          {statusLabel}
        </span>
      </div>
      {stop.from && stop.to && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
          <Text style={{ fontSize: 12, color: '#595959' }} ellipsis>{stop.from.name}</Text>
          <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 10, flexShrink: 0 }} />
          <Text style={{ fontSize: 12, fontWeight: 600 }} ellipsis>{stop.to.name}</Text>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <ClockCircleOutlined style={{ fontSize: 11.5, color: '#8c8c8c' }} />
        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{formatTimeAmPm(stop.scheduled)}</Text>
        {stop.online && stop.eta ? (
          <Text style={{ fontSize: 12, fontWeight: 600, color: lateMin > 0 ? '#faad14' : '#1677ff' }}>
            · ETA {formatTimeAmPm(stop.eta)}{lateMin > 0 ? ` (+${lateMin}m)` : ''}
          </Text>
        ) : !stop.online ? (
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#ff4d4f' }}>· Last seen {stop.lastOnline ?? 'unknown'}</Text>
        ) : null}
      </div>
      <Text style={{ fontSize: 11.5, color: '#8c8c8c', display: 'block', marginTop: 4 }}>
        {stop.plate} · {stop.fleetOwner}
      </Text>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <Button size="small" type="primary" icon={<EyeOutlined />} onClick={onViewDetail} style={{ flex: 1, fontSize: 12 }}>
          View detail
        </Button>
        {urgent && !handled && onTake && (
          <Button size="small" icon={<CheckOutlined style={{ fontSize: 10 }} />} onClick={onTake} style={{ fontSize: 12 }}>
            Take it
          </Button>
        )}
      </div>
    </div>
  )
}

/* ── Compact grid card: just enough to scan 60–80 trips fast ── */
function CompactCard({
  stop,
  selected,
  handled,
  onClick,
  innerRef,
}: {
  stop: VehicleStop
  selected: boolean
  handled: boolean
  onClick: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const color = statusColor(stop)
  const status = deriveStatus(stop)
  const statusLabel = stop.online ? status : 'Offline'
  return (
    <div
      ref={innerRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={{
        display: 'flex',
        background: selected ? '#e6f4ff' : '#fff',
        border: `1px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
        borderRadius: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background .15s, border-color .15s',
        minWidth: 0,
      }}
    >
      <span style={{ width: 4, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11.5, fontWeight: 600, padding: '0 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {stop.label}
          </span>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{formatTimeAmPm(stop.scheduled)}</Text>
          {handled ? (
            <CheckOutlined style={{ marginLeft: 'auto', fontSize: 10, color: '#16a34a', flexShrink: 0 }} title="Handled" />
          ) : (
            <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap', flexShrink: 0 }}>{statusLabel}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minWidth: 0 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
          <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{firstName(stop.driver)}</Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
        </div>
      </div>
    </div>
  )
}

class MapErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override render() {
    if (this.state.error) {
      return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#ff4d4f', textAlign: 'center', padding: 24 }}>
          <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>Map failed to render</Text>
          <Text style={{ fontSize: 12.5, color: '#8c8c8c', maxWidth: 300 }}>
            {this.state.error.message || 'An unexpected error occurred in the Google Maps widget.'}
          </Text>
        </div>
      )
    }
    return this.props.children
  }
}

function Testing2MapView({
  stops,
  selectedId,
  selectedStop,
  posRef,
  showRoutes,
  showTraffic,
  handledIds,
  onSelect,
  onClose,
  onViewDetail,
  onTake,
  onRouteResolved,
}: {
  stops: VehicleStop[]
  selectedId: string | null
  selectedStop: VehicleStop | null
  posRef: React.MutableRefObject<Record<string, [number, number] | null>>
  showRoutes: boolean
  showTraffic: boolean
  handledIds: Set<string>
  onSelect: (id: string) => void
  onClose: () => void
  onViewDetail: () => void
  onTake: (id: string) => void
  onRouteResolved: (key: string, path: [number, number][]) => void
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })
  const mapRef = useRef<google.maps.Map | null>(null)
  const originIcon = useMemo(() => (isLoaded ? makeOriginIcon() : undefined), [isLoaded])
  const destinationIcon = useMemo(() => (isLoaded ? makeDestinationIcon() : undefined), [isLoaded])

  const requestedKeysRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!isLoaded) return
    const service = new google.maps.DirectionsService()
    stops.forEach((s) => {
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
            requestedKeysRef.current.delete(key)
          }
        }
      )
    })
  }, [isLoaded, stops, onRouteResolved])

  useEffect(() => {
    if (!selectedId || !mapRef.current) return
    const p = posRef.current[selectedId]
    if (p) {
      mapRef.current.panTo({ lat: p[0], lng: p[1] })
      mapRef.current.setZoom(FOCUS_ZOOM)
    } else {
      mapRef.current.panTo({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] })
      mapRef.current.setZoom(ZOOM_OUT)
    }
  }, [selectedId, posRef])

  if (loadError) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f', padding: 16, textAlign: 'center' }}>
        Failed to load Google Maps: {loadError.message}
      </div>
    )
  }
  if (!isLoaded) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
        Loading Google Maps…
      </div>
    )
  }

  return (
    <GoogleMap
      center={{ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }}
      zoom={DEFAULT_ZOOM}
      mapContainerStyle={{ height: '100%', width: '100%' }}
      onLoad={(map) => { mapRef.current = map }}
      options={{
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        styles: SILVER_THEME,
      }}
    >
      {showTraffic && <TrafficLayer />}

      {showRoutes &&
        stops
          .filter((s) => s.route && s.route.length > 1)
          // On a narrow context map, drawing 69 routes is noise — only the
          // selected trip's route is shown.
          .filter((s) => selectedId === s.id)
          .map((s) => (
            <Polyline
              key={`route-${s.id}`}
              path={(s.route as [number, number][]).map(([lat, lng]) => ({ lat, lng }))}
              options={{ strokeColor: '#1677ff', strokeWeight: 7.5, strokeOpacity: 0.95 }}
            />
          ))}

      {selectedStop?.from && (
        <Marker position={{ lat: selectedStop.from.lat, lng: selectedStop.from.lng }} icon={originIcon} title={`From: ${selectedStop.from.name}`} />
      )}
      {selectedStop?.to && (
        <Marker position={{ lat: selectedStop.to.lat, lng: selectedStop.to.lng }} icon={destinationIcon} title={`To: ${selectedStop.to.name}`} />
      )}

      {stops
        .map((stop) => ({ stop, pos: posRef.current[stop.id] }))
        .filter((x) => x.pos != null)
        .map(({ stop, pos }) => {
          const [lat, lng] = pos as [number, number]
          const sel = selectedId === stop.id
          return (
            <div key={stop.id}>
              <Marker
                position={{ lat, lng }}
                icon={makeBusBadgeIcon(statusColor(stop), sel)}
                onClick={() => onSelect(stop.id)}
              />
              {sel && (
                <InfoWindow position={{ lat, lng }} onCloseClick={onClose} options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -26) }}>
                  <TripSummary
                    stop={stop}
                    handled={handledIds.has(stop.id)}
                    onViewDetail={onViewDetail}
                    onTake={() => onTake(stop.id)}
                  />
                </InfoWindow>
              )}
            </div>
          )
        })}
    </GoogleMap>
  )
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <Text style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>
        {label}
      </Text>
      <div style={{ fontSize: 13, color: '#1a1a1a' }}>{children}</div>
    </div>
  )
}

export default function LiveTrackingTesting2Page() {
  const [filter, setFilter] = useState<KpiKey>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('start')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set())
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set())
  const [showRoutes, setShowRoutes] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [messageApi, msgContext] = message.useMessage()

  const [realRoutes, setRealRoutes] = useState<Record<string, [number, number][]>>({})
  const onRouteResolved = (key: string, path: [number, number][]) =>
    setRealRoutes((prev) => (prev[key] ? prev : { ...prev, [key]: path }))

  const stops = buildStops(DEMO_TRIPS).map((s) => {
    const withNotify = notifiedIds.has(s.id) ? { ...s, notified: true } : s
    if (!withNotify.from || !withNotify.to) return withNotify
    const real = realRoutes[routeKey(withNotify.from, withNotify.to)]
    if (!real) return withNotify
    const pos = pointAlong(real, withNotify.phase)
    return { ...withNotify, route: real, lat: pos[0], lng: pos[1] }
  })

  useEffect(() => {
    if (!simulating) return
    const id = setInterval(() => setProgress((p) => (p + 0.004 >= 1 ? 0 : p + 0.004)), 80)
    return () => clearInterval(id)
  }, [simulating])

  const posRef = useRef<Record<string, [number, number] | null>>({})
  const livePos = (s: VehicleStop): [number, number] | null => {
    if (simulating && s.route && s.route.length > 1) return pointAlong(s.route, (s.phase + progress) % 1)
    return s.lat != null && s.lng != null ? [s.lat, s.lng] : null
  }
  posRef.current = Object.fromEntries(stops.map((s) => [s.id, livePos(s)]))

  const selectedStop = selectedId ? stops.find((s) => s.id === selectedId) ?? null : null

  const counts = Object.fromEntries(KPI_META.map((k) => [k.key, stops.filter((s) => kpiMatch(s, k.key)).length])) as Record<KpiKey, number>

  const isUrgent = (s: VehicleStop) => !s.online || deriveStatus(s) === 'Late'

  const filtered = stops.filter((s) => {
    if (!kpiMatch(s, filter)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (
        !s.driver.toLowerCase().includes(q) &&
        !s.plate.toLowerCase().includes(q) &&
        !s.customerCode.toLowerCase().includes(q) &&
        !s.label.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  const sortFn = (a: VehicleStop, b: VehicleStop): number => {
    switch (sortBy) {
      case 'eta': {
        const av = a.online && a.eta ? toMinutes(a.eta) : Infinity
        const bv = b.online && b.eta ? toMinutes(b.eta) : Infinity
        return av - bv
      }
      case 'label': return a.label.localeCompare(b.label)
      default: return toMinutes(a.scheduled) - toMinutes(b.scheduled)
    }
  }

  const needsAttention = filtered.filter((s) => isUrgent(s) && !handledIds.has(s.id)).sort(sortFn)
  const others = filtered.filter((s) => !(isUrgent(s) && !handledIds.has(s.id))).sort(sortFn)

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      cardRefs.current[selectedId]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedId])

  const markHandled = (id: string) => {
    setHandledIds((prev) => new Set(prev).add(id))
    messageApi.success('Marked as handled — moved out of Needs attention')
  }
  const notifyDriver = (id: string) => {
    setNotifiedIds((prev) => new Set(prev).add(id))
    messageApi.success('Driver notified — status set to Notified')
  }

  const clearFilters = () => {
    setFilter('all')
    setSearch('')
  }

  const selectCard = (id: string) => {
    // Second click on the selected card dismisses its tooltip
    setSelectedId((prev) => (prev === id ? null : id))
    setDrawerOpen(false)
  }

  const sectionLabel = (text: string, color = '#94a3b8') => (
    <Text style={{ gridColumn: '1 / -1', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.6, margin: '2px 2px 0' }}>
      {text}
    </Text>
  )

  const renderCard = (stop: VehicleStop) => (
    <Popover
      key={stop.id}
      open={selectedId === stop.id && !drawerOpen}
      content={
        <TripSummary
          stop={stop}
          handled={handledIds.has(stop.id)}
          onViewDetail={() => setDrawerOpen(true)}
          onTake={() => markHandled(stop.id)}
        />
      }
      placement="left"
    >
      <CompactCard
        stop={stop}
        selected={selectedId === stop.id}
        handled={handledIds.has(stop.id)}
        onClick={() => selectCard(stop.id)}
        innerRef={(el) => { cardRefs.current[stop.id] = el }}
      />
    </Popover>
  )

  return (
    <div style={{ padding: '24px 32px' }}>
      {msgContext}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          height: 'calc(100vh - 96px)',
        }}
      >
        {/* ── Header: KPI chips + search + sort ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          {KPI_META.map((k) => {
            const hot = k.urgent && counts[k.key] > 0
            const active = filter === k.key
            return (
              <button
                key={k.key}
                onClick={() => setFilter(active ? 'all' : k.key)}
                className={hot && !active ? 'tab-urgent-pulse' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 13px',
                  borderRadius: 20,
                  border: `1px solid ${active || hot ? k.color : '#e8e8e8'}`,
                  background: active ? k.color : hot ? k.soft : '#fff',
                  color: active ? '#fff' : hot ? k.color : '#595959',
                  fontSize: 13,
                  fontWeight: active || hot ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {k.label}
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 10,
                    fontSize: 11.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? 'rgba(255,255,255,.28)' : hot ? k.color : '#f0f0f0',
                    color: active || hot ? '#fff' : '#8c8c8c',
                  }}
                >
                  {counts[k.key]}
                </span>
              </button>
            )
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search route, driver, plate..."
              style={{ borderRadius: 8, width: 260 }}
              allowClear
            />
            <Select size="middle" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} style={{ width: 118 }} />
          </div>
        </div>

        {/* ── Body: list-first (70%) + context map (30%) ── */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* List */}
          <div style={{ flex: 7, minWidth: 0, overflowY: 'auto', paddingRight: 2 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#bfbfbf' }}>
                <CloseCircleOutlined style={{ fontSize: 26, display: 'block', marginBottom: 10 }} />
                <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', marginBottom: 12 }}>
                  No trips match the current filter
                </Text>
                <Button size="small" onClick={clearFilters}>Clear filters</Button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {needsAttention.length > 0 && (
                  <>
                    {sectionLabel(`Needs attention (${needsAttention.length})`, '#ff4d4f')}
                    {needsAttention.map(renderCard)}
                    {others.length > 0 && sectionLabel('All trips')}
                  </>
                )}
                {others.map(renderCard)}
              </div>
            )}
          </div>

          {/* Context map */}
          <div style={{ flex: 3, minWidth: 300, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
            {!GOOGLE_MAPS_API_KEY ? (
              <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f7f8fa', color: '#8c8c8c', textAlign: 'center', padding: 24 }}>
                <EnvironmentOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
                <Text style={{ color: '#595959', fontWeight: 600 }}>Google Maps API key not configured</Text>
                <Text style={{ fontSize: 13, color: '#8c8c8c', maxWidth: 260 }}>
                  Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> to load the live map.
                </Text>
              </div>
            ) : (
              <MapErrorBoundary>
                <Testing2MapView
                  stops={stops}
                  selectedId={selectedId}
                  selectedStop={selectedStop}
                  posRef={posRef}
                  showRoutes={showRoutes}
                  showTraffic={showTraffic}
                  handledIds={handledIds}
                  onSelect={(id) => { setSelectedId(id); setDrawerOpen(false) }}
                  onClose={() => setSelectedId(null)}
                  onViewDetail={() => setDrawerOpen(true)}
                  onTake={markHandled}
                  onRouteResolved={onRouteResolved}
                />
              </MapErrorBoundary>
            )}

            <Popover
              placement="bottomRight"
              trigger="click"
              content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 168 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={{ fontSize: 13, color: '#595959' }}>Show route</Text>
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
              }
            >
              <Button
                icon={<ControlOutlined />}
                size="small"
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 500, boxShadow: '0 4px 14px rgba(15,23,42,.12)' }}
                title="Map layers"
              />
            </Popover>

            {/* Compact traffic legend for the narrow map */}
            <div
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                zIndex: 500,
                background: 'rgba(255,255,255,.96)',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: '5px 9px',
                boxShadow: '0 4px 14px rgba(15,23,42,.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {(['smooth', 'moderate', 'heavy'] as const).map((lvl) => (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 4, borderRadius: 2, background: TRAFFIC_COLOR[lvl] }} />
                  <Text style={{ fontSize: 11, color: '#64748b' }}>{TRAFFIC_LABEL[lvl]}</Text>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full detail drawer (from "View detail") ── */}
      <Drawer
        title="Trip detail"
        placement="right"
        width={380}
        open={drawerOpen && !!selectedStop}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedStop && (() => {
          const st = selectedStop
          const status = deriveStatus(st)
          const style = STATUS_STYLE[status]
          const statusLabel = st.online ? status : 'Offline'
          const lateMin = st.online && status === 'Late' && st.eta ? toMinutes(st.eta) - toMinutes(st.scheduled) : 0
          const urgent = isUrgent(st)
          const handled = handledIds.has(st.id)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WifiOutlined style={{ color: st.online ? '#52c41a' : '#ff4d4f', fontSize: 16 }} />
                <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 12.5, fontWeight: 600, padding: '2px 9px', borderRadius: 5 }}>{st.label}</span>
                <span style={{ background: '#f5f5f5', color: '#595959', fontSize: 12.5, padding: '2px 9px', borderRadius: 5 }}>{st.customerCode}</span>
                <span style={{ marginLeft: 'auto', background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 6 }}>{statusLabel}</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="primary"
                  icon={<BellOutlined />}
                  disabled={st.notified}
                  onClick={() => notifyDriver(st.id)}
                  style={{ flex: 1 }}
                >
                  {st.notified ? 'Notified' : 'Notify driver'}
                </Button>
                <Button
                  icon={<CheckOutlined />}
                  disabled={!urgent || handled}
                  onClick={() => markHandled(st.id)}
                  style={{ flex: 1 }}
                >
                  {handled ? 'Handled' : 'Mark handled'}
                </Button>
                <Tooltip title="Demo only">
                  <Button icon={<PhoneOutlined />} />
                </Tooltip>
              </div>

              <DetailItem label="Route">
                {st.from && st.to ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                    <Text style={{ fontSize: 13, color: '#595959' }} ellipsis>{st.from.name}</Text>
                    <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 12, flexShrink: 0 }} />
                    <Text style={{ fontSize: 13, fontWeight: 600 }} ellipsis>{st.to.name}</Text>
                  </div>
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>{st.destination}</Text>
                )}
              </DetailItem>
              <DetailItem label="Trip start">{formatTimeAmPm(st.scheduled)}</DetailItem>
              <DetailItem label="ETA">
                {st.online && st.eta ? (
                  <span style={{ color: status === 'Late' ? '#ff4d4f' : '#1677ff', fontWeight: 700 }}>
                    {formatTimeAmPm(st.eta)}
                    {lateMin > 0 && <span style={{ fontWeight: 500 }}> · {lateMin} min late</span>}
                  </span>
                ) : (
                  <span style={{ color: '#8c8c8c' }}>—</span>
                )}
              </DetailItem>
              <DetailItem label="Driver">{st.driver}</DetailItem>
              <DetailItem label="Vehicle">{st.plate}</DetailItem>
              <DetailItem label="Fleet owner">{st.fleetOwner}</DetailItem>
              {!st.online && (
                <DetailItem label="Last online">
                  <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{st.lastOnline ?? 'Position unknown'}</span>
                </DetailItem>
              )}
            </div>
          )
        })()}
      </Drawer>
    </div>
  )
}
