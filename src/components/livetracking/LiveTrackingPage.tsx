import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Typography, Input, Tag, Divider } from 'antd'
import { SearchOutlined, WifiOutlined } from '@ant-design/icons'

const { Text } = Typography

interface VehicleStop {
  id: string
  label: string
  destination: string
  time: string
  eta: string
  driver: string
  plate: string
  lastOnline: string
  lat: number
  lng: number
}

const mockStops: VehicleStop[] = [
  { id: '1', label: 'Dyson 1', destination: 'Japanese Kindergarten', time: '17:30', eta: '17:20', driver: 'Ronald Abdulah', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', lat: 1.3294, lng: 103.7843 },
  { id: '2', label: 'Dyson 1', destination: 'Japanese Kindergarten', time: '18:10', eta: '18:00', driver: 'Ronald Abdulah', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', lat: 1.3247, lng: 103.8011 },
  { id: '3', label: 'Dyson 1', destination: 'Japanese Kindergarten', time: '18:40', eta: '18:30', driver: 'Ronny Chan', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', lat: 1.3203, lng: 103.8067 },
  { id: '4', label: 'Dyson 1', destination: 'Japanese Kindergarten', time: '19:00', eta: '19:10', driver: 'Geraldy Tan', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', lat: 1.3147, lng: 103.7900 },
  { id: '5', label: 'Dyson 1', destination: 'Japanese Kindergarten', time: '19:30', eta: '19:25', driver: 'Aldan Kwok', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', lat: 1.3081, lng: 103.7958 },
]

const routePath: [number, number][] = mockStops.map(s => [s.lat, s.lng])

const carIcon = L.divIcon({
  className: 'live-tracking-car-icon',
  html: `
    <div style="
      width: 28px; height: 28px; border-radius: 50%;
      background: #1a1a1a; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.35); border: 2px solid #fff;
    ">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function StatChip({ color, bg, label, count }: { color: string; bg: string; label: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, background: '#fff',
      border: '1px solid #e8e8e8', borderRadius: 4, padding: '10px 16px',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
      </div>
      <div>
        <Text style={{ color, fontSize: 12, fontWeight: 600, display: 'block' }}>{label}</Text>
        <Text style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{count}</Text>
        <Text style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 4 }}>Driver</Text>
      </div>
    </div>
  )
}

export default function LiveTrackingPage() {
  return (
    <div style={{ padding: '24px 32px' }}>
      <Typography.Title level={3} style={{ margin: '0 0 16px', fontSize: 26, fontWeight: 700, color: '#1a1a1a' }}>
        Live Tracking
      </Typography.Title>

      {/* Top bar: stat chips + search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <StatChip color="#d46b08" bg="#fff7e6" label="Late" count={12} />
          <StatChip color="#cf1322" bg="#fff1f0" label="To Check" count={12} />
        </div>
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Input route code, bus label..."
          style={{ width: 280 }}
        />
      </div>

      {/* Map + driver list */}
      <div style={{ display: 'flex', gap: 16, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <MapContainer
            center={[1.3185, 103.7950]}
            zoom={14}
            style={{ height: 640, width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <Polyline positions={routePath} pathOptions={{ color: '#52c41a', weight: 4 }} />
            {mockStops.map(stop => (
              <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={carIcon} />
            ))}
          </MapContainer>
        </div>

        {/* Driver list */}
        <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid #e8e8e8', maxHeight: 640, overflowY: 'auto' }}>
          {mockStops.map((stop, i) => (
            <div key={stop.id} style={{ padding: '14px 18px' }}>
              <Tag color="blue" style={{ marginBottom: 6 }}>{stop.label}</Tag>
              <Text style={{ display: 'block', fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{stop.destination}</Text>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{stop.time}</Text>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 13, color: '#8c8c8c' }}>
                  ETA <Text style={{ color: '#1677ff', fontWeight: 700 }}>{stop.eta}</Text>
                </Text>
                <Tag style={{ background: '#f5f5f5', border: 'none', color: '#595959' }}>On Time</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <WifiOutlined style={{ color: '#52c41a', fontSize: 13 }} />
                <Text style={{ fontSize: 13, fontWeight: 600 }}>{stop.driver}</Text>
                <Text style={{ fontSize: 13, color: '#595959', marginLeft: 'auto' }}>{stop.plate}</Text>
              </div>
              <Text style={{ fontSize: 11, color: '#bfbfbf' }}>{stop.lastOnline}</Text>
              {i < mockStops.length - 1 && <Divider style={{ margin: '14px 0 0' }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
