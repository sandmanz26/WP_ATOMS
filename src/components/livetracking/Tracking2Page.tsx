import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip as MapTooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Typography, Input, Button, Select, Popover, Segmented } from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  WifiOutlined,
} from '@ant-design/icons'
import {
  type VehicleStop,
  type TripStatus,
  mockStops,
  trafficSegments,
  TRAFFIC_COLOR,
  TRAFFIC_LABEL,
  DESTINATION,
  DESTINATION_NAME,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FOCUS_ZOOM,
  ZOOM_OUT,
  deriveStatus,
} from './trackingData'

const { Text } = Typography

/* ── Design tokens ── */
const C = {
  onTime: '#16a34a',
  late: '#f59e0b',
  toCheck: '#ef4444',
  offline: '#94a3b8',
  ink: '#0f172a',
  sub: '#64748b',
  faint: '#94a3b8',
  line: '#e9eef5',
  surface: '#ffffff',
  canvas: '#f4f6fb',
  brand: '#2563eb',
}

const STATUS_COLOR: Record<TripStatus, string> = {
  'On Time': C.onTime,
  Late: C.late,
  'To Check': C.toCheck,
  Notified: C.brand,
}

const STATUS_SOFT: Record<TripStatus, string> = {
  'On Time': '#eafaf0',
  Late: '#fef6e7',
  'To Check': '#fdecec',
  Notified: '#eef2fb',
}

/* ── Circular status-colored bus marker (Westpoint fleet) ── */
function makeMarker(color: string, selected: boolean) {
  const d = selected ? 42 : 32
  const g = Math.round(d * 0.54)
  const ring = selected ? `box-shadow:0 0 0 4px ${color}33, 0 6px 16px rgba(15,23,42,.28);` : 'box-shadow:0 3px 8px rgba(15,23,42,.28);'
  return L.divIcon({
    className: 'tracking2-marker',
    html: `
      <div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};
        border:3px solid #fff;${ring}display:flex;align-items:center;justify-content:center;">
        <svg width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="4.5" width="16" height="12.5" rx="2.4"/>
          <line x1="4" y1="11" x2="20" y2="11"/>
          <line x1="9" y1="4.5" x2="9" y2="11"/>
          <line x1="15" y1="4.5" x2="15" y2="11"/>
          <circle cx="8" cy="18.4" r="1.5" fill="#fff" stroke="none"/>
          <circle cx="16" cy="18.4" r="1.5" fill="#fff" stroke="none"/>
        </svg>
      </div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  })
}

/* ── Destination (school) marker ── */
const destinationIcon = L.divIcon({
  className: 'tracking2-dest',
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:30px;height:30px;border-radius:9px;background:#0f172a;border:3px solid #fff;
        box-shadow:0 3px 8px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"/>
          <path d="M5 21V8l7-4 7 4v13"/>
          <path d="M9 21v-5h6v5"/>
        </svg>
      </div>
      <div style="width:2px;height:8px;background:#0f172a;"></div>
    </div>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
})

/* ── Imperatively drives the map on selection ── */
function MapController({ selectedId }: { selectedId: string | null }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedId) return
    const stop = mockStops.find((s) => s.id === selectedId)
    if (!stop) return
    if (stop.lat != null && stop.lng != null) {
      map.flyTo([stop.lat, stop.lng], FOCUS_ZOOM, { duration: 0.7 })
    } else {
      map.flyTo(DEFAULT_CENTER, ZOOM_OUT, { duration: 0.7 })
    }
  }, [selectedId, map])
  return null
}

/* ── KPI chip in the summary strip ── */
function Kpi({ label, count, color, active, onClick }: { label: string; count: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: 'left',
        background: active ? '#fff' : C.surface,
        border: `1px solid ${active ? color : C.line}`,
        boxShadow: active ? `0 4px 14px ${color}22` : '0 1px 2px rgba(15,23,42,.04)',
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .15s',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <Text style={{ fontSize: 12.5, color: C.sub, fontWeight: 500 }}>{label}</Text>
      </div>
      <Text style={{ fontSize: 26, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{count}</Text>
    </button>
  )
}

/* ── Field wrapper for filter popover ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text style={{ fontSize: 13, color: C.sub, display: 'block', marginBottom: 6 }}>{label}</Text>
      {children}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/* ── Redesigned driver card ── */
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
  const color = STATUS_COLOR[status]
  return (
    <div
      ref={innerRef}
      onClick={onSelect}
      style={{
        position: 'relative',
        background: C.surface,
        border: `1px solid ${selected ? C.brand : C.line}`,
        borderRadius: 14,
        padding: '14px 16px 14px 18px',
        marginBottom: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: selected ? '0 8px 22px rgba(37,99,235,.16)' : '0 1px 2px rgba(15,23,42,.04)',
        transition: 'box-shadow .15s, border-color .15s',
      }}
    >
      {/* status accent strip */}
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />

      {/* Header: avatar + driver + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: stop.online ? '#e0edff' : '#eef2f7',
            color: stop.online ? C.brand : C.faint,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12.5,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(stop.driver)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: 600, color: C.ink }} ellipsis>
              {stop.driver}
            </Text>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: stop.online ? C.onTime : C.offline,
                flexShrink: 0,
              }}
              title={stop.online ? 'Online' : 'Offline'}
            />
          </div>
          <Text style={{ fontSize: 12, color: C.faint }}>{stop.plate}</Text>
        </div>
        <span
          style={{
            background: STATUS_SOFT[status],
            color,
            fontSize: 11.5,
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          {status}
        </span>
      </div>

      {/* Route + destination */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12 }}>
        <span style={{ background: '#eef2fb', color: C.brand, fontSize: 11.5, fontWeight: 600, padding: '1px 8px', borderRadius: 6 }}>
          {stop.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <EnvironmentOutlined style={{ color: C.faint, fontSize: 12 }} />
          <Text style={{ fontSize: 13, color: C.ink, fontWeight: 500 }} ellipsis>
            {stop.destination}
          </Text>
        </div>
      </div>

      {/* Timeline: start → ETA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 12,
          padding: '10px 12px',
          background: C.canvas,
          borderRadius: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: C.faint, display: 'block' }}>Start</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <ClockCircleOutlined style={{ color: C.sub, fontSize: 12 }} />
            <Text style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{stop.scheduled}</Text>
          </div>
        </div>
        <ArrowRightOutlined style={{ color: C.faint, fontSize: 12 }} />
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: C.faint, display: 'block' }}>ETA</Text>
          <Text style={{ fontSize: 14, fontWeight: 700, color: stop.eta ? color : C.faint }}>
            {stop.eta ?? 'Not detected'}
          </Text>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <WifiOutlined style={{ color: stop.online ? C.onTime : C.toCheck, fontSize: 13 }} />
          <Text style={{ fontSize: 11.5, color: C.faint }} ellipsis>
            {stop.fleetOwner}
          </Text>
        </div>
        <Text style={{ fontSize: 11.5, color: C.faint }}>{stop.lastOnline}</Text>
      </div>
    </div>
  )
}

export default function Tracking2Page() {
  const [availability, setAvailability] = useState<'All' | 'Online' | 'Offline'>('All')
  const [statusFilter, setStatusFilter] = useState<TripStatus | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Filter popover state
  const [filterOpen, setFilterOpen] = useState(false)
  const [customerCode, setCustomerCode] = useState('')
  const [fleetOwner, setFleetOwner] = useState('')
  const [driverFilter, setDriverFilter] = useState<string | undefined>()
  const [vehicleFilter, setVehicleFilter] = useState<string | undefined>()
  const [driverStatus, setDriverStatus] = useState<string | undefined>()
  const [tripStatus, setTripStatus] = useState<string | undefined>()

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      cardRefs.current[selectedId]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedId])

  // KPI counts (derived from the same data)
  const counts = useMemo(() => {
    const c = { total: mockStops.length, onTime: 0, late: 0, toCheck: 0, offline: 0 }
    mockStops.forEach((s) => {
      const st = deriveStatus(s)
      if (st === 'On Time') c.onTime++
      else if (st === 'Late') c.late++
      else c.toCheck++
      if (!s.online) c.offline++
    })
    return c
  }, [])

  const driverOptions = Array.from(new Set(mockStops.map((s) => s.driver))).map((d) => ({ label: d, value: d }))
  const vehicleOptions = Array.from(new Set(mockStops.map((s) => s.plate))).map((p) => ({ label: p, value: p }))

  const clearAllFilters = () => {
    setCustomerCode('')
    setFleetOwner('')
    setDriverFilter(undefined)
    setVehicleFilter(undefined)
    setDriverStatus(undefined)
    setTripStatus(undefined)
  }

  const filtered = mockStops.filter((s) => {
    if (availability === 'Online' && !s.online) return false
    if (availability === 'Offline' && s.online) return false
    if (statusFilter && deriveStatus(s) !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const hit =
        s.driver.toLowerCase().includes(q) ||
        s.plate.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q) ||
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
    <div style={{ width: 760, padding: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 18 }}>Filter</Text>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
        <Field label="Customer Code">
          <Input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} allowClear />
        </Field>
        <Field label="Fleet Owner">
          <Input value={fleetOwner} onChange={(e) => setFleetOwner(e.target.value)} allowClear />
        </Field>
        <Field label="Driver">
          <Select value={driverFilter} onChange={setDriverFilter} options={driverOptions} style={{ width: '100%' }} allowClear showSearch />
        </Field>
        <Field label="Vehicle">
          <Select value={vehicleFilter} onChange={setVehicleFilter} options={vehicleOptions} style={{ width: '100%' }} allowClear showSearch />
        </Field>
        <Field label="Driver Status">
          <Select
            value={driverStatus}
            onChange={setDriverStatus}
            options={[{ label: 'Online', value: 'Online' }, { label: 'Offline', value: 'Offline' }]}
            style={{ width: '100%' }}
            allowClear
          />
        </Field>
        <Field label="Trip Status">
          <Select
            value={tripStatus}
            onChange={setTripStatus}
            options={[{ label: 'On Time', value: 'On Time' }, { label: 'Late', value: 'Late' }, { label: 'To Check', value: 'To Check' }, { label: 'Notified', value: 'Notified' }]}
            style={{ width: '100%' }}
            allowClear
          />
        </Field>
      </div>
      <Button style={{ marginTop: 18 }} onClick={clearAllFilters}>
        Clear all filters
      </Button>
    </div>
  )

  return (
    <div style={{ padding: '24px 32px', background: C.canvas, minHeight: '100%' }}>
      {/* Page heading */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>Tracking 2.0</Text>
          <span style={{ background: '#e0edff', color: C.brand, fontSize: 11.5, fontWeight: 600, padding: '2px 9px', borderRadius: 999 }}>
            Daily Live Tracking
          </span>
        </div>
        <Text style={{ fontSize: 13, color: C.sub }}>Real-time fleet positions, ETAs and trip status.</Text>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Kpi label="Total Drivers" count={counts.total} color={C.brand} active={statusFilter === null && availability === 'All'} onClick={() => { setStatusFilter(null); setAvailability('All') }} />
        <Kpi label="On Time" count={counts.onTime} color={C.onTime} active={statusFilter === 'On Time'} onClick={() => setStatusFilter(statusFilter === 'On Time' ? null : 'On Time')} />
        <Kpi label="Late" count={counts.late} color={C.late} active={statusFilter === 'Late'} onClick={() => setStatusFilter(statusFilter === 'Late' ? null : 'Late')} />
        <Kpi label="To Check" count={counts.toCheck} color={C.toCheck} active={statusFilter === 'To Check'} onClick={() => setStatusFilter(statusFilter === 'To Check' ? null : 'To Check')} />
        <Kpi label="Offline" count={counts.offline} color={C.offline} active={availability === 'Offline'} onClick={() => setAvailability(availability === 'Offline' ? 'All' : 'Offline')} />
      </div>

      {/* Main */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {/* Map */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            border: `1px solid ${C.line}`,
            boxShadow: '0 1px 2px rgba(15,23,42,.04)',
            minHeight: 660,
          }}
        >
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', minHeight: 660, width: '100%' }} zoomControl={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MapController selectedId={selectedId} />

            {/* 1. Road conditions (traffic) — colored by congestion level */}
            {trafficSegments.map((t) => (
              <Polyline
                key={t.id}
                positions={t.path}
                pathOptions={{ color: TRAFFIC_COLOR[t.level], weight: 7, opacity: 0.55, lineCap: 'round' }}
              />
            ))}

            {/* 2. Driver routes — to the destination; selected one is highlighted */}
            {filtered
              .filter((s) => s.route && s.route.length > 1)
              .map((s) => {
                const sel = selectedId === s.id
                const dim = selectedId != null && !sel
                return (
                  <Polyline
                    key={`route-${s.id}`}
                    positions={s.route as [number, number][]}
                    pathOptions={
                      sel
                        ? { color: C.brand, weight: 5, opacity: 0.95 }
                        : { color: '#64748b', weight: 3, opacity: dim ? 0.1 : 0.4, dashArray: '6 8' }
                    }
                  />
                )
              })}

            {/* Destination (school) */}
            <Marker position={DESTINATION} icon={destinationIcon}>
              <MapTooltip direction="top" offset={[0, -38]} className="tracking2-tooltip">
                {DESTINATION_NAME}
              </MapTooltip>
            </Marker>

            {/* 3. Driver markers (Westpoint buses), colored by trip status */}
            {filtered
              .filter((s) => s.lat != null && s.lng != null)
              .map((s) => {
                const sel = selectedId === s.id
                const color = STATUS_COLOR[deriveStatus(s)]
                return (
                  <Marker
                    key={s.id}
                    position={[s.lat as number, s.lng as number]}
                    icon={makeMarker(color, sel)}
                    eventHandlers={{ click: () => setSelectedId(s.id) }}
                    zIndexOffset={sel ? 1000 : 0}
                  >
                    {sel && (
                      <MapTooltip permanent direction="top" offset={[0, -22]} className="tracking2-tooltip">
                        <strong>{s.driver}</strong> · {s.plate} · ETA {s.eta ?? '—'}
                      </MapTooltip>
                    )}
                  </Marker>
                )
              })}
          </MapContainer>

          {/* Legend */}
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              zIndex: 500,
              background: 'rgba(255,255,255,.96)',
              backdropFilter: 'blur(4px)',
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: '11px 14px',
              boxShadow: '0 4px 14px rgba(15,23,42,.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Text style={{ fontSize: 10.5, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.4, width: 52 }}>
                Bus
              </Text>
              {([['On Time', C.onTime], ['Late', C.late], ['To Check', C.toCheck]] as const).map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                  <Text style={{ fontSize: 12, color: C.sub }}>{l}</Text>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: C.line }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Text style={{ fontSize: 10.5, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.4, width: 52 }}>
                Traffic
              </Text>
              {(['smooth', 'moderate', 'heavy'] as const).map((lvl) => (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 14, height: 4, borderRadius: 2, background: TRAFFIC_COLOR[lvl] }} />
                  <Text style={{ fontSize: 12, color: C.sub }}>{TRAFFIC_LABEL[lvl]}</Text>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: C.faint }} />}
              placeholder="Search route, driver, vehicle..."
              style={{ flex: 1, borderRadius: 10 }}
              allowClear
            />
            <Popover content={filterContent} trigger="click" open={filterOpen} onOpenChange={setFilterOpen} placement="bottomRight">
              <Button icon={<FilterOutlined />} style={{ borderColor: C.line, color: C.sub }} />
            </Popover>
          </div>

          {/* Availability segmented */}
          <Segmented
            block
            value={availability}
            onChange={(v) => setAvailability(v as 'All' | 'Online' | 'Offline')}
            options={['All', 'Online', 'Offline']}
            style={{ marginBottom: 12 }}
          />

          {/* Active status filter chip */}
          {statusFilter && (
            <div style={{ marginBottom: 10 }}>
              <span
                onClick={() => setStatusFilter(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: STATUS_SOFT[statusFilter],
                  color: STATUS_COLOR[statusFilter],
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
              >
                {statusFilter} ✕
              </span>
            </div>
          )}

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 660, paddingRight: 2 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: C.faint, fontSize: 13 }}>No drivers found</div>
            ) : (
              filtered.map((s) => (
                <DriverCard
                  key={s.id}
                  stop={s}
                  selected={selectedId === s.id}
                  onSelect={() => setSelectedId(s.id)}
                  innerRef={(el) => {
                    cardRefs.current[s.id] = el
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
