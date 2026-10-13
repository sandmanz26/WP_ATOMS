// Web tracking pages opened from the links in Live Tracking 2.0's "Web
// Tracking Links" modal (MOVE-3676). One page, two audiences:
//
//   driver    — Map + traffic, Driver's location, Routelist, Route points,
//               Registration (the driver registers each point on arrival)
//   passenger — Map + traffic, ETA, Driver's location, Passenger location,
//               Routelist, Route points, Registration (read-only: sees which
//               points the driver has registered)
//
// Behaviour from MOVE-1685 (FMS): keep the screen awake while the driver page
// is open, hide the bus icon when there's no location, and show "Trip has
// ended, tracking unavailable" once the link expires (1 hour after trip end).
//
// Built for a phone browser first, but the same page lays out as map + side
// panel on a desktop browser (the product team asked for both).
//
// No backend: the driver's position is simulated along the route. On the
// driver page the browser is still asked for location permission, because
// whether that is granted is a real state the page has to handle.

import { useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker, Polyline, TrafficLayer, useJsApiLoader } from '@react-google-maps/api'
import { MapContainer, TileLayer, Marker as LMarker, Polyline as LPolyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Avatar, Button, Modal, Popover, Segmented, Switch, Tag, Typography, message } from 'antd'
import {
  AimOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DisconnectOutlined,
  EnvironmentOutlined,
  ExperimentOutlined,
  MobileOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { trafficSegments, TRAFFIC_COLOR } from './trackingData'
import {
  formatAmPm,
  positionAlong,
  webTrip,
  type WebTrackingAudience,
  type WtPoint,
  type WtRoute,
} from './webTrackingData'

const { Text } = Typography
const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? ''

const BLUE = '#1677ff'
const GREEN = '#16a34a'
const GREY = '#8c8c8c'
const MIN_PER_LEG = 8 // demo: scheduled minutes between consecutive points

/** Demo-only switch, so every state the page can be in is reachable without a backend. */
type DemoState = 'live' | 'location-off' | 'driver-offline' | 'expired'

function useIsMobile() {
  const q = '(max-width: 767px)'
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

/* ───────────────────────────── Map ───────────────────────────── */

interface MapProps {
  points: WtPoint[]
  registered: Record<string, string>
  nextPointId: string | null
  driverPos: [number, number] | null
  passengerPos: [number, number] | null
  showTraffic: boolean
  focus: [number, number] | null
}

const busSvg = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="${BLUE}" stroke="#fff" stroke-width="3"/><rect x="12" y="11" width="16" height="16" rx="3" fill="#fff"/><rect x="14" y="13" width="12" height="6" rx="1" fill="${BLUE}"/><circle cx="15.5" cy="24" r="1.6" fill="${BLUE}"/><circle cx="24.5" cy="24" r="1.6" fill="${BLUE}"/><rect x="13" y="27" width="3" height="3" rx="1" fill="#fff"/><rect x="24" y="27" width="3" height="3" rx="1" fill="#fff"/></svg>`

const pointSvg = (n: number, state: 'done' | 'next' | 'todo') => {
  const fill = state === 'done' ? GREEN : state === 'next' ? BLUE : '#fff'
  const stroke = state === 'todo' ? '#8c8c8c' : '#fff'
  const color = state === 'todo' ? '#595959' : '#fff'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/><text x="14" y="18.5" font-family="Inter,Arial" font-size="12" font-weight="700" text-anchor="middle" fill="${color}">${n}</text></svg>`
}

const passengerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="${BLUE}" fill-opacity="0.18"/><circle cx="17" cy="17" r="7" fill="${BLUE}" stroke="#fff" stroke-width="3"/></svg>`

const dataUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

function pointState(p: WtPoint, registered: Record<string, string>, nextPointId: string | null) {
  return registered[p.id] ? 'done' : p.id === nextPointId ? 'next' : 'todo'
}

function GoogleTrackingMap({ points, registered, nextPointId, driverPos, passengerPos, showTraffic, focus }: MapProps) {
  const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: GOOGLE_MAPS_API_KEY })
  const mapRef = useRef<google.maps.Map | null>(null)
  useEffect(() => {
    if (focus && mapRef.current) mapRef.current.panTo({ lat: focus[0], lng: focus[1] })
  }, [focus])
  if (loadError) return <MapMessage text={`Failed to load Google Maps: ${loadError.message}`} />
  if (!isLoaded) return <MapMessage text="Loading map…" />
  return (
    <GoogleMap
      center={{ lat: points[1]?.lat ?? 1.33, lng: points[1]?.lng ?? 103.8 }}
      zoom={14}
      mapContainerStyle={{ height: '100%', width: '100%' }}
      onLoad={(m) => {
        mapRef.current = m
        const b = new google.maps.LatLngBounds()
        points.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }))
        m.fitBounds(b, 60)
      }}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: false }}
    >
      {showTraffic && <TrafficLayer />}
      <Polyline path={points.map((p) => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: BLUE, strokeWeight: 6, strokeOpacity: 0.85 }} />
      {points.map((p, i) => (
        <Marker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          title={p.name}
          icon={{ url: dataUrl(pointSvg(i + 1, pointState(p, registered, nextPointId))), anchor: new google.maps.Point(14, 14) }}
        />
      ))}
      {passengerPos && (
        <Marker position={{ lat: passengerPos[0], lng: passengerPos[1] }} title="You" icon={{ url: dataUrl(passengerSvg), anchor: new google.maps.Point(17, 17) }} />
      )}
      {driverPos && (
        <Marker position={{ lat: driverPos[0], lng: driverPos[1] }} title="Driver" zIndex={10} icon={{ url: dataUrl(busSvg(40)), anchor: new google.maps.Point(20, 20) }} />
      )}
    </GoogleMap>
  )
}

function LeafletFit({ points }: { points: WtPoint[] }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [50, 50] })
  }, [map, points])
  return null
}

function LeafletPan({ focus }: { focus: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.panTo(focus)
  }, [map, focus])
  return null
}

const leafletIcon = (svg: string, size: number) =>
  L.divIcon({ html: svg, className: 'wt-divicon', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })

/** Fallback when VITE_GOOGLE_MAPS_API_KEY isn't set: OpenStreetMap tiles + the mock traffic corridors. */
function LeafletTrackingMap({ points, registered, nextPointId, driverPos, passengerPos, showTraffic, focus }: MapProps) {
  return (
    <MapContainer center={[points[1]?.lat ?? 1.33, points[1]?.lng ?? 103.8]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LeafletFit points={points} />
      <LeafletPan focus={focus} />
      {showTraffic &&
        trafficSegments.map((s) => (
          <LPolyline key={s.id} positions={s.path} pathOptions={{ color: TRAFFIC_COLOR[s.level], weight: 5, opacity: 0.9 }} />
        ))}
      <LPolyline positions={points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: BLUE, weight: 6, opacity: 0.85 }} />
      {points.map((p, i) => (
        <LMarker key={p.id} position={[p.lat, p.lng]} icon={leafletIcon(pointSvg(i + 1, pointState(p, registered, nextPointId)), 28)} />
      ))}
      {passengerPos && <LMarker position={passengerPos} icon={leafletIcon(passengerSvg, 34)} />}
      {driverPos && <LMarker position={driverPos} icon={leafletIcon(busSvg(40), 40)} zIndexOffset={1000} />}
    </MapContainer>
  )
}

function MapMessage({ text }: { text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREY, background: '#f0f2f5', padding: 16, textAlign: 'center' }}>
      {text}
    </div>
  )
}

/* ─────────────────────────── Panel parts ─────────────────────────── */

function SectionTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: 700, color: GREY, letterSpacing: 0.4, textTransform: 'uppercase' }}>{children}</Text>
      {extra}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <Text style={{ fontSize: 12, color: GREY, display: 'block' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{value}</Text>
    </div>
  )
}

function routeStatus(idx: number, activeIdx: number) {
  if (idx < activeIdx) return <Tag color="success" style={{ margin: 0 }}>Completed</Tag>
  if (idx === activeIdx) return <Tag color="processing" style={{ margin: 0 }}>In Progress</Tag>
  return <Tag style={{ margin: 0 }}>Upcoming</Tag>
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function WebTrackingPage({ audience, tripId }: { audience: WebTrackingAudience; tripId: string }) {
  const trip = useMemo(() => webTrip(tripId), [tripId])
  const isMobile = useIsMobile()
  const [messageApi, msgContext] = message.useMessage()
  const isDriver = audience === 'driver'

  const [demo, setDemo] = useState<DemoState>('live')
  const [showTraffic, setShowTraffic] = useState(true)
  const [viewRouteIdx, setViewRouteIdx] = useState(0)
  const [focus, setFocus] = useState<[number, number] | null>(null)
  const [showMe, setShowMe] = useState(!isDriver)
  const [wakeLock, setWakeLock] = useState<'on' | 'unsupported'>('unsupported')

  // Route 1 is in progress: points 1–2 already registered, bus between 2 and 3.
  const activeRoute = trip?.routes[0]
  const [progress, setProgress] = useState(1.35)
  const [registered, setRegistered] = useState<Record<string, string>>(() =>
    activeRoute ? Object.fromEntries(activeRoute.points.slice(0, 2).map((p, i) => [p.id, formatAmPm(addMinutes(p.scheduled, i === 0 ? 1 : 3))])) : {},
  )

  // Demo clock: the bus creeps along the route while the page is live.
  useEffect(() => {
    if (demo === 'expired' || !activeRoute) return
    const id = window.setInterval(() => {
      setProgress((p) => Math.min(activeRoute.points.length - 1.05, p + 0.01))
    }, 1000)
    return () => window.clearInterval(id)
  }, [demo, activeRoute])

  // Driver page: ask for location (MOVE-1685 biz req 3.3) and keep the screen
  // awake (biz req 3.2.1) — tracking stops if the phone locks.
  useEffect(() => {
    if (!isDriver || demo === 'expired') return
    let watch: number | undefined
    if ('geolocation' in navigator) {
      watch = navigator.geolocation.watchPosition(
        () => setDemo((d) => (d === 'location-off' ? 'live' : d)),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setDemo('location-off')
        },
        { enableHighAccuracy: true },
      )
    }
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        lock = l
        setWakeLock('on')
      })
      .catch(() => setWakeLock('unsupported'))
    return () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch)
      lock?.release().catch(() => undefined)
    }
  }, [isDriver, demo])

  if (!trip || !activeRoute) return <EndedScreen text="This tracking link is invalid." />
  if (demo === 'expired') return <EndedScreen text="Trip has ended, tracking unavailable" demo={<DemoSwitch value={demo} onChange={setDemo} isDriver={isDriver} />} />

  const viewRoute = trip.routes[viewRouteIdx]
  const nextPoint = activeRoute.points.find((p) => !registered[p.id]) ?? null
  const driverVisible = isDriver ? demo !== 'location-off' : demo !== 'driver-offline'
  const driverPos = driverVisible && viewRouteIdx === 0 ? positionAlong(activeRoute.points, progress) : null
  // Demo: the passenger stands a short walk from point 3.
  const passengerPos: [number, number] | null = showMe ? [activeRoute.points[2].lat + 0.0025, activeRoute.points[2].lng - 0.002] : null
  const nowHHmm = addMinutes(activeRoute.start, Math.round(progress * MIN_PER_LEG))
  const etaFor = (p: WtPoint) => {
    const idx = activeRoute.points.findIndex((x) => x.id === p.id)
    const mins = Math.max(1, Math.round((idx - progress) * MIN_PER_LEG))
    return { mins, at: formatAmPm(addMinutes(nowHHmm, mins)) }
  }

  const register = (p: WtPoint) => {
    Modal.confirm({
      title: `Register ${p.name}?`,
      content: 'Confirm that you have arrived at this point.',
      okText: 'Register',
      onOk: () => {
        setRegistered((r) => ({ ...r, [p.id]: formatAmPm(nowHHmm) }))
        // Registering means the bus is at that point.
        const idx = activeRoute.points.findIndex((x) => x.id === p.id)
        setProgress((pr) => Math.max(pr, idx))
        messageApi.success(`${p.name} registered.`)
      },
    })
  }

  const statusChip = isDriver ? (
    demo === 'location-off' ? (
      <Tag icon={<DisconnectOutlined />} color="error" style={{ margin: 0 }}>Not sharing location</Tag>
    ) : (
      <Tag color="success" style={{ margin: 0 }}><span className="wt-pulse" /> Sharing live location</Tag>
    )
  ) : demo === 'driver-offline' ? (
    <Tag icon={<DisconnectOutlined />} color="error" style={{ margin: 0 }}>Driver location unavailable</Tag>
  ) : (
    <Tag color="success" style={{ margin: 0 }}><span className="wt-pulse" /> Live</Tag>
  )

  const banner = isDriver ? (
    demo === 'location-off' ? (
      <Banner tone="error" icon={<EnvironmentOutlined />}>
        Location access is off, so ops can't see where you are. Allow location for this site in your browser settings, then reload.
      </Banner>
    ) : (
      <Banner tone="info" icon={<MobileOutlined />}>
        Keep this page open until the trip ends. {wakeLock === 'on' ? 'Your screen will stay on.' : "Don't let your screen turn off — tracking stops when it does."}
      </Banner>
    )
  ) : demo === 'driver-offline' ? (
    <Banner tone="warning" icon={<DisconnectOutlined />}>
      The driver's location is currently unavailable. This page updates when it's back.
    </Banner>
  ) : null

  const etaCard = !isDriver && (
    <div style={{ background: demo === 'driver-offline' ? '#fafafa' : '#e6f4ff', border: `1px solid ${demo === 'driver-offline' ? '#f0f0f0' : '#91caff'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
      {nextPoint && demo !== 'driver-offline' ? (
        <>
          <Text style={{ fontSize: 12, color: '#595959', display: 'block' }}>Arriving at {nextPoint.name}</Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: 700, color: BLUE, lineHeight: 1.2 }}>{etaFor(nextPoint).mins} min</Text>
            <Text style={{ fontSize: 13, color: '#595959' }}>ETA {etaFor(nextPoint).at}</Text>
          </div>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 12, color: '#595959', display: 'block' }}>ETA</Text>
          <Text style={{ fontSize: 20, fontWeight: 700, color: GREY }}>Unavailable</Text>
        </>
      )}
    </div>
  )

  const panel = (
    <div style={{ padding: isMobile ? '12px 16px 24px' : 20 }}>
      {/* Driver */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Avatar size={44} style={{ background: BLUE, flexShrink: 0 }}>{trip.driver.charAt(0)}</Avatar>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: 700, display: 'block' }} ellipsis>{trip.driver}</Text>
          <Text style={{ fontSize: 13, color: GREY }}>{trip.plate} · {trip.fleetOwner}</Text>
        </div>
        {!isDriver && <Button shape="circle" icon={<PhoneOutlined />} href={`tel:${trip.driverPhone.replace(/\s/g, '')}`} aria-label="Call driver" />}
      </div>

      {etaCard}

      {/* Schedule details */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>Schedule Details</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date" value={trip.date} />
          <Field label="Time" value={`${formatAmPm(trip.routes[0].start)} - ${formatAmPm(trip.routes[trip.routes.length - 1].end)}`} />
          <div style={{ gridColumn: '1 / -1' }}><Field label="Customer" value={trip.customer} /></div>
        </div>
      </div>

      {/* Routelist */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>Route List</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trip.routes.map((r, i) => (
            <RouteCard key={r.id} route={r} selected={i === viewRouteIdx} status={routeStatus(i, 0)} onClick={() => setViewRouteIdx(i)} />
          ))}
        </div>
      </div>

      {/* Route points + registration */}
      <div>
        <SectionTitle extra={<Text style={{ fontSize: 12, color: GREY }}>{viewRoute.code}</Text>}>Route Points</SectionTitle>
        <div>
          {viewRoute.points.map((p, i) => {
            const onActive = viewRouteIdx === 0
            const done = onActive && registered[p.id]
            const isNext = onActive && nextPoint?.id === p.id
            const last = i === viewRoute.points.length - 1
            return (
              <div key={p.id} style={{ display: 'flex', gap: 12, cursor: 'pointer' }} onClick={() => setFocus([p.lat, p.lng])}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: 12, fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? GREEN : isNext ? BLUE : '#fff',
                      color: done || isNext ? '#fff' : '#595959',
                      border: done || isNext ? 'none' : '1.5px solid #bfbfbf',
                    }}
                  >
                    {i + 1}
                  </div>
                  {!last && <div style={{ flex: 1, width: 2, background: done ? GREEN : '#e8e8e8', minHeight: 24 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</Text>
                    <Text style={{ fontSize: 12, color: GREY, whiteSpace: 'nowrap' }}>{formatAmPm(p.scheduled)}</Text>
                  </div>
                  {done ? (
                    <Text style={{ fontSize: 12, color: GREEN }}><CheckCircleFilled /> Registered at {registered[p.id]}</Text>
                  ) : isNext && driverVisible ? (
                    <Text style={{ fontSize: 12, color: BLUE }}><ClockCircleOutlined /> Next · ETA {etaFor(p).at}</Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: GREY }}>Not registered</Text>
                  )}
                  {isDriver && isNext && (
                    <div style={{ marginTop: 8 }}>
                      <Button type="primary" size={isMobile ? 'large' : 'middle'} block={isMobile} disabled={demo === 'location-off'} onClick={(e) => { e.stopPropagation(); register(p) }}>
                        Register
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const map = (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {GOOGLE_MAPS_API_KEY ? (
        <GoogleTrackingMap points={viewRoute.points} registered={viewRouteIdx === 0 ? registered : {}} nextPointId={viewRouteIdx === 0 ? nextPoint?.id ?? null : null} driverPos={driverPos} passengerPos={passengerPos} showTraffic={showTraffic} focus={focus} />
      ) : (
        <LeafletTrackingMap points={viewRoute.points} registered={viewRouteIdx === 0 ? registered : {}} nextPointId={viewRouteIdx === 0 ? nextPoint?.id ?? null : null} driverPos={driverPos} passengerPos={passengerPos} showTraffic={showTraffic} focus={focus} />
      )}
      {/* Traffic toggle — same control as the Live Tracking map card */}
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 500, background: '#fff', borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 8px rgba(0,0,0,.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch size="small" checked={showTraffic} onChange={setShowTraffic} />
        <Text style={{ fontSize: 13 }}>Traffic</Text>
      </div>
      <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {driverPos && <Button shape="circle" icon={<img src={dataUrl(busSvg(18))} alt="" style={{ width: 18 }} />} onClick={() => setFocus([...driverPos])} aria-label="Centre on driver" />}
        {!isDriver && (
          <Button
            shape="circle"
            type={showMe ? 'primary' : 'default'}
            icon={<AimOutlined />}
            onClick={() => {
              setShowMe(true)
              setFocus([activeRoute.points[2].lat + 0.0025, activeRoute.points[2].lng - 0.002])
            }}
            aria-label="Show my location"
          />
        )}
      </div>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {msgContext}
      <style>{`.wt-divicon{background:none;border:none}.wt-pulse{display:inline-block;width:7px;height:7px;border-radius:4px;background:${GREEN};margin-right:4px;animation:wtp 1.4s infinite}@keyframes wtp{50%{opacity:.25}}`}</style>
      {/* Header */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Text style={{ fontWeight: 800, letterSpacing: 2, fontSize: isMobile ? 14 : 16 }}>WESTPOINT</Text>
        {!isMobile && <Text style={{ color: GREY }}>{isDriver ? 'Driver Tracking' : 'Trip Tracking'}</Text>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {statusChip}
          <DemoSwitch value={demo} onChange={setDemo} isDriver={isDriver} />
        </div>
      </div>
      {banner}

      {isMobile ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ height: '46vh' }}>{map}</div>
          <div style={{ borderTop: '1px solid #f0f0f0', borderRadius: '14px 14px 0 0', marginTop: -12, position: 'relative', zIndex: 600, background: '#fff' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d9d9d9', margin: '8px auto 0' }} />
            {panel}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{map}</div>
          <div style={{ width: 400, borderLeft: '1px solid #f0f0f0', overflowY: 'auto' }}>{panel}</div>
        </div>
      )}
    </div>
  )
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m + min
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function RouteCard({ route, selected, status, onClick }: { route: WtRoute; selected: boolean; status: React.ReactNode; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{ border: `1px solid ${selected ? BLUE : '#f0f0f0'}`, background: selected ? '#f0f7ff' : '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: 600 }}>{route.code}</Text>
        {status}
      </div>
      <Text style={{ fontSize: 12, color: GREY }}>
        {formatAmPm(route.start)} - {formatAmPm(route.end)} · {route.points.length} points · {route.points[0].name} → {route.points[route.points.length - 1].name}
      </Text>
    </div>
  )
}

function Banner({ tone, icon, children }: { tone: 'info' | 'warning' | 'error'; icon: React.ReactNode; children: React.ReactNode }) {
  const c = { info: ['#e6f4ff', '#91caff', BLUE], warning: ['#fffbe6', '#ffe58f', '#d48806'], error: ['#fff2f0', '#ffccc7', '#cf1322'] }[tone]
  return (
    <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'flex-start', background: c[0], borderBottom: `1px solid ${c[1]}`, padding: '8px 16px', fontSize: 13, color: '#1a1a1a' }}>
      <span style={{ color: c[2], marginTop: 1 }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function EndedScreen({ text, demo }: { text: string; demo?: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, background: '#f5f5f5', textAlign: 'center' }}>
      <Text style={{ fontWeight: 800, letterSpacing: 2, fontSize: 16 }}>WESTPOINT</Text>
      <ClockCircleOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />
      <Text style={{ fontSize: 16, fontWeight: 600 }}>{text}</Text>
      {demo}
    </div>
  )
}

/** Prototype-only: flips the page between the states a real link can be in. */
function DemoSwitch({ value, onChange, isDriver }: { value: DemoState; onChange: (v: DemoState) => void; isDriver: boolean }) {
  const options = isDriver
    ? [{ label: 'Live', value: 'live' }, { label: 'Location off', value: 'location-off' }, { label: 'Expired', value: 'expired' }]
    : [{ label: 'Live', value: 'live' }, { label: 'Driver offline', value: 'driver-offline' }, { label: 'Expired', value: 'expired' }]
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title="Demo state (prototype only)"
      content={<Segmented size="small" options={options} value={value} onChange={(v) => onChange(v as DemoState)} />}
    >
      <Button size="small" type="dashed" icon={<ExperimentOutlined />}>Demo</Button>
    </Popover>
  )
}

