import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Typography, Input, Button } from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  FileExclamationOutlined,
  FileSearchOutlined,
  WifiOutlined,
  MoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'

const { Text } = Typography

type DriverStatus = 'On Time' | 'Late'

interface VehicleStop {
  id: string
  label: string
  destination: string
  scheduled: string
  eta: string
  status: DriverStatus
  driver: string
  company: string
  plate: string
  lastOnline: string
  online: boolean
  lat: number
  lng: number
}

const mockStops: VehicleStop[] = [
  { id: '1', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:30', eta: '17:20', status: 'On Time', driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3360, lng: 103.7790 },
  { id: '2', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:10', eta: '18:00', status: 'On Time', driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3300, lng: 103.8060 },
  { id: '3', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:40', eta: '18:30', status: 'On Time', driver: 'Ronny Chan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3235, lng: 103.8085 },
  { id: '4', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:00', eta: '19:10', status: 'On Time', driver: 'Geraldy Tan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3215, lng: 103.8120 },
  { id: '5', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:30', eta: '19:25', status: 'On Time', driver: 'Aldan Kwok', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3175, lng: 103.7945 },
  { id: '6', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '20:00', eta: '19:55', status: 'On Time', driver: 'Monica Leo', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: false, lat: 1.3125, lng: 103.7990 },
  { id: '7', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '20:30', eta: '20:20', status: 'On Time', driver: 'Richard Jen', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3295, lng: 103.8000 },
]

const routePath: [number, number][] = [
  [1.3380, 103.7720],
  [1.3360, 103.7790],
  [1.3320, 103.7950],
  [1.3300, 103.8060],
  [1.3235, 103.8085],
  [1.3215, 103.8120],
]

const routePath2: [number, number][] = [
  [1.3300, 103.8060],
  [1.3250, 103.8020],
  [1.3175, 103.7945],
  [1.3125, 103.7990],
]

// Black teardrop pin with white steering-wheel icon (matches reference markers)
const carIcon = L.divIcon({
  className: 'live-tracking-pin',
  html: `
    <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.2 17 25 17 25s17-12.8 17-25C34 7.6 26.4 0 17 0Z" fill="#1a1a1a"/>
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

/* ── Driver list card ── */
function DriverCard({ stop }: { stop: VehicleStop }) {
  const onTime = stop.status === 'On Time'
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
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
      <Text style={{ display: 'block', fontWeight: 600, fontSize: 15, color: '#1a1a1a', marginTop: 6 }}>
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
          background: '#f7f8fa',
          borderRadius: 8,
          padding: '10px 12px',
          marginTop: 10,
        }}
      >
        <Text style={{ fontSize: 14, color: '#1a1a1a' }}>
          ETA <Text style={{ color: '#1677ff', fontWeight: 700, fontSize: 16 }}>{stop.eta}</Text>
        </Text>
        <span
          style={{
            background: onTime ? '#f6ffed' : '#fff1f0',
            color: onTime ? '#52c41a' : '#cf1322',
            border: `1px solid ${onTime ? '#d9f7be' : '#ffccc7'}`,
            fontSize: 12,
            fontWeight: 500,
            padding: '2px 10px',
            borderRadius: 6,
          }}
        >
          {stop.status}
        </span>
      </div>

      {/* Driver + plate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#bfbfbf', fontSize: 15 }} />
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

  const filtered = mockStops.filter((s) => {
    if (filter === 'Online' && !s.online) return false
    if (filter === 'Offline' && s.online) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        s.driver.toLowerCase().includes(q) ||
        s.plate.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q)
      )
    }
    return true
  })

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
              <MapContainer center={[1.3270, 103.7950]} zoom={14} style={{ height: '100%', minHeight: 600, width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Polyline positions={routePath} pathOptions={{ color: '#52c41a', weight: 4 }} />
                <Polyline positions={routePath2} pathOptions={{ color: '#52c41a', weight: 4 }} />
                {mockStops.map((stop) => (
                  <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={carIcon} />
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
              <Button icon={<FilterOutlined />} style={{ borderColor: '#e8e8e8', color: '#595959' }} />
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
                filtered.map((stop) => <DriverCard key={stop.id} stop={stop} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
