import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Typography, Input, Button, Select, Popover } from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  FileExclamationOutlined,
  FileSearchOutlined,
  WifiOutlined,
  MoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import {
  type VehicleStop,
  mockStops,
  routePath,
  routePath2,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FOCUS_ZOOM,
  ZOOM_OUT,
  deriveStatus,
  STATUS_STYLE,
} from './trackingData'

const { Text } = Typography

// Teardrop pin with white steering-wheel icon (black default, blue when selected)
function makePin(fill: string) {
  return L.divIcon({
    className: 'live-tracking-pin',
    html: `
      <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12.2 17 25 17 25s17-12.8 17-25C34 7.6 26.4 0 17 0Z" fill="${fill}"/>
        <circle cx="17" cy="16" r="8.4" fill="none" stroke="#ffffff" stroke-width="1.7"/>
        <circle cx="17" cy="16" r="2.1" fill="#ffffff"/>
        <line x1="17" y1="16" x2="17" y2="7.6" stroke="#ffffff" stroke-width="1.7"/>
        <line x1="17" y1="16" x2="10" y2="20.5" stroke="#ffffff" stroke-width="1.7"/>
        <line x1="17" y1="16" x2="24" y2="20.5" stroke="#ffffff" stroke-width="1.7"/>
      </svg>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  })
}
const carIcon = makePin('#1a1a1a')
const carIconSelected = makePin('#1677ff')

/* ── Imperatively drives the map when a card/marker is selected ── */
function MapController({ selectedId }: { selectedId: string | null }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedId) return
    const stop = mockStops.find((s) => s.id === selectedId)
    if (!stop) return
    if (stop.lat != null && stop.lng != null) {
      // Available driver, or To Check with a last-seen location → zoom in to icon
      map.flyTo([stop.lat, stop.lng], FOCUS_ZOOM, { duration: 0.7 })
    } else {
      // To Check with no driver last seen → zoom out, no driver icon
      map.flyTo(DEFAULT_CENTER, ZOOM_OUT, { duration: 0.7 })
    }
  }, [selectedId, map])
  return null
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
        gap: 16,
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
          fontSize: 22,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: labelColor, fontSize: 13, fontWeight: 600, display: 'block' }}>{label}</Text>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{count}</Text>
          <Text style={{ fontSize: 13, color: '#8c8c8c' }}>Driver</Text>
        </div>
      </div>
      <Button
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
  const status = deriveStatus(stop.scheduled, stop.eta)
  const s = STATUS_STYLE[status]
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
      {/* Top: tag + more */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        <MoreOutlined style={{ color: '#bfbfbf', fontSize: 16, cursor: 'pointer' }} />
      </div>

      {/* Destination */}
      <Text
        style={{
          display: 'block',
          fontWeight: 600,
          fontSize: 15,
          color: selected ? '#1677ff' : '#1a1a1a',
          marginTop: 6,
        }}
      >
        {stop.destination}
      </Text>

      {/* Scheduled time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
        <Text style={{ fontSize: 13, color: '#8c8c8c' }}>{stop.scheduled}</Text>
      </div>

      {/* ETA box */}
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
          <Text style={{ color: stop.eta ? '#1677ff' : '#8c8c8c', fontWeight: 700, fontSize: 16 }}>
            {stop.eta ?? '-'}
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
          {status}
        </span>
      </div>

      {/* Driver + plate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 15 }} />
        <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{stop.driver}</Text>
        <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginLeft: 'auto' }}>{stop.plate}</Text>
      </div>

      {/* Company + last online */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 12, color: '#bfbfbf' }}>{stop.company}</Text>
        <Text style={{ fontSize: 12, color: '#bfbfbf' }}>{stop.lastOnline}</Text>
      </div>
    </div>
  )
}

export default function LiveTrackingPage() {
  const [filter, setFilter] = useState<'All' | 'Offline' | 'Online'>('All')
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

  // When selection changes (e.g. from a marker click), auto-scroll the list to its card
  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      cardRefs.current[selectedId]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedId])

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
    if (filter === 'Online' && !s.online) return false
    if (filter === 'Offline' && s.online) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const hit =
        s.driver.toLowerCase().includes(q) ||
        s.plate.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q)
      if (!hit) return false
    }
    if (customerCode.trim() && !s.company.toLowerCase().includes(customerCode.toLowerCase())) return false
    if (fleetOwner.trim() && !s.company.toLowerCase().includes(fleetOwner.toLowerCase())) return false
    if (driverFilter && s.driver !== driverFilter) return false
    if (vehicleFilter && s.plate !== vehicleFilter) return false
    if (driverStatus === 'Online' && !s.online) return false
    if (driverStatus === 'Offline' && s.online) return false
    if (tripStatus && deriveStatus(s.scheduled, s.eta) !== tripStatus) return false
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
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          {/* ── Left column: stat cards + map ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <StatCard
                icon={<FileExclamationOutlined />}
                iconBg="#f5a623"
                label="Late"
                labelColor="#fa541c"
                count={12}
              />
              <StatCard
                icon={<FileSearchOutlined />}
                iconBg="#f5222d"
                label="To Check"
                labelColor="#1a1a1a"
                count={12}
              />
            </div>

            {/* Map */}
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0', flex: 1, minHeight: 600 }}>
              <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', minHeight: 600, width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapController selectedId={selectedId} />
                <Polyline positions={routePath} pathOptions={{ color: '#52c41a', weight: 4 }} />
                <Polyline positions={routePath2} pathOptions={{ color: '#52c41a', weight: 4 }} />
                {mockStops
                  .filter((stop) => stop.lat != null && stop.lng != null)
                  .map((stop) => (
                    <Marker
                      key={stop.id}
                      position={[stop.lat as number, stop.lng as number]}
                      icon={selectedId === stop.id ? carIconSelected : carIcon}
                      eventHandlers={{ click: () => setSelectedId(stop.id) }}
                    />
                  ))}
              </MapContainer>
            </div>
          </div>

          {/* ── Right column: search + pills + list ── */}
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
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Pill active={filter === 'All'} onClick={() => setFilter('All')}>All</Pill>
              <Pill active={filter === 'Offline'} onClick={() => setFilter('Offline')}>Offline</Pill>
              <Pill active={filter === 'Online'} onClick={() => setFilter('Online')}>Online</Pill>
            </div>

            {/* Driver list */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 600, paddingRight: 2 }}>
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
        </div>
      </div>
    </div>
  )
}
