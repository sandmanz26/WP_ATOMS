import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from 'react'
import { GoogleMap, Marker, Polyline, InfoWindow, TrafficLayer, useJsApiLoader } from '@react-google-maps/api'
import { Typography, Input, Button, Switch, Tooltip, Select, message } from 'antd'
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
  DownOutlined,
  HolderOutlined,
  CloseOutlined,
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

   This page also carries every display switcher already available on the
   main Live Tracking page (map theme, marker style, card style, tab/
   highlight style, double highlight, layer toggles), adapted to this
   list-first layout, via the "Display settings" panel on the map.
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

// Minimal drag-by-header behaviour, no extra dependency needed — same
// mechanism as the Test Console on the main Live Tracking page.
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

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

/* ── Marker styles (ported from Live Tracking) ── */
type MarkerStyle = 'vehicle' | 'label' | 'status' | 'bus'

const MARKER_STYLE_OPTIONS: { value: MarkerStyle; label: string }[] = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'label', label: 'Label' },
  { value: 'status', label: 'Status' },
  { value: 'bus', label: 'Bus' },
]

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

// Steering-wheel pin — the original "Vehicle" marker style
function makePinIcon(fill: string, offline: boolean, selected: boolean): google.maps.Icon {
  const width = offline ? 38 : 32
  const badge = offline
    ? `<circle cx="29" cy="8" r="7" fill="#ff4d4f" stroke="#fff" stroke-width="2"/>
       <line x1="26" y1="5" x2="32" y2="11" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
       <line x1="32" y1="5" x2="26" y2="11" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`
    : ''
  const color = selected ? '#1677ff' : fill
  const svg = `
    <svg width="${width}" height="40" viewBox="0 0 ${width} 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 11.6 16 24 16 24s16-12.4 16-24C32 7.2 24.8 0 16 0Z" fill="${color}"/>
      <circle cx="16" cy="15" r="7.8" fill="none" stroke="#ffffff" stroke-width="1.6"/>
      <circle cx="16" cy="15" r="2" fill="#ffffff"/>
      <line x1="16" y1="15" x2="16" y2="7.2" stroke="#ffffff" stroke-width="1.6"/>
      <line x1="16" y1="15" x2="9.5" y2="19.2" stroke="#ffffff" stroke-width="1.6"/>
      <line x1="16" y1="15" x2="22.5" y2="19.2" stroke="#ffffff" stroke-width="1.6"/>
      ${badge}
    </svg>
  `
  return { url: svgDataUrl(svg), scaledSize: new google.maps.Size(width, 40), anchor: new google.maps.Point(16, 40) }
}

// Rounded "tag" showing the bus code, color-coded by status
function makeLabelIcon(label: string, color: string, selected: boolean): google.maps.Icon {
  const w = Math.max(44, 15 + label.length * 8)
  const h = 22
  const totalH = h + 8
  const stroke = selected ? '#1677ff' : '#ffffff'
  const sw = selected ? 3 : 2
  const cx = w / 2
  const svg = `
    <svg width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <path d="M${cx - 6} ${h - 2} L${cx} ${totalH - 1} L${cx + 6} ${h - 2} Z" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h}" rx="6" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <text x="${cx}" y="${h / 2 + 4}" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="700" fill="#ffffff">${label}</text>
    </svg>
  `
  return { url: svgDataUrl(svg), scaledSize: new google.maps.Size(w, totalH), anchor: new google.maps.Point(cx, totalH) }
}

// Status dot: solid circle (online) or hollow with a slash (offline)
function makeStatusDotIcon(color: string, selected: boolean, offline: boolean): google.maps.Icon {
  const size = selected ? 26 : 20
  const c = size / 2
  const r = c - 3
  const ring = selected ? '#1677ff' : '#ffffff'
  const inner = offline
    ? `<line x1="${c - r * 0.5}" y1="${c - r * 0.5}" x2="${c + r * 0.5}" y2="${c + r * 0.5}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`
    : `<circle cx="${c}" cy="${c}" r="${r * 0.34}" fill="#ffffff"/>`
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${c}" cy="${c}" r="${r}" fill="${offline ? '#ffffff' : color}" stroke="${offline ? color : ring}" stroke-width="${selected ? 3 : 2.2}"/>
      ${inner}
    </svg>
  `
  return { url: svgDataUrl(svg), scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(c, c) }
}

function makeMarkerIcon(style: MarkerStyle, stop: VehicleStop, selected: boolean): google.maps.Icon {
  const color = statusColor(stop)
  if (style === 'label') return makeLabelIcon(stop.label, color, selected)
  if (style === 'status') return makeStatusDotIcon(color, selected, !stop.online)
  if (style === 'bus') return makeBusBadgeIcon(color, selected)
  return makePinIcon('#1a1a1a', !stop.online, selected)
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

/* ── Map themes (ported from Live Tracking) ── */
type MapTheme = 'default' | 'silver' | 'night' | 'retro'

const MAP_THEME_OPTIONS: { value: MapTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'silver', label: 'Silver' },
  { value: 'night', label: 'Night' },
  { value: 'retro', label: 'Retro' },
]

const MAP_THEMES: Record<MapTheme, google.maps.MapTypeStyle[]> = {
  default: [],
  silver: [
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
  ],
  night: [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  ],
  retro: [
    { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#523735' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f1e6' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#a5b076' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f1e6' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#b9d3c2' }] },
  ],
}

/* ── KPI chips: counts double as filters ── */
type KpiKey = 'all' | 'On Time' | 'Late' | 'Offline' | 'Notified'

const KPI_META: { key: KpiKey; label: string; color: string; soft: string; border: string; urgent?: boolean }[] = [
  { key: 'all', label: 'All', color: '#1677ff', soft: '#e6f4ff', border: '#91caff' },
  { key: 'On Time', label: 'On Time', color: '#16a34a', soft: '#f6ffed', border: '#b7eb8f' },
  { key: 'Late', label: 'Late', color: '#faad14', soft: '#fffbe6', border: '#ffe58f', urgent: true },
  { key: 'Offline', label: 'Offline', color: '#ff4d4f', soft: '#fff1f0', border: '#ffccc7', urgent: true },
  { key: 'Notified', label: 'Notified', color: '#1677ff', soft: '#e6f4ff', border: '#91caff' },
]

function kpiMatch(stop: VehicleStop, key: KpiKey): boolean {
  if (key === 'all') return true
  if (key === 'Offline') return !stop.online
  if (!stop.online) return false
  return deriveStatus(stop) === key
}

/* ── Highlight (tab) style — ported from Live Tracking's Tab style, applied
   to the KPI/filter bar: Default pill, Segment (connected track), or Color
   (each chip carries its own status hue even when inactive). ── */
type HighlightStyle = 'default' | 'segment' | 'color'

const HIGHLIGHT_STYLE_OPTIONS: { value: HighlightStyle; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'segment', label: 'Segment' },
  { value: 'color', label: 'Color' },
]

function KpiBar({
  style,
  active,
  counts,
  onSelect,
}: {
  style: HighlightStyle
  active: KpiKey
  counts: Record<KpiKey, number>
  onSelect: (k: KpiKey) => void
}) {
  if (style === 'segment') {
    return (
      <div style={{ display: 'flex', gap: 2, background: '#f5f5f5', borderRadius: 10, padding: 3 }}>
        {KPI_META.map((k) => {
          const isActive = active === k.key
          const hot = k.urgent && counts[k.key] > 0
          return (
            <button
              key={k.key}
              onClick={() => onSelect(isActive ? 'all' : k.key)}
              className={hot && !isActive ? 'tab-urgent-pulse' : undefined}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: isActive ? '#fff' : 'transparent',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                color: hot ? '#ff4d4f' : isActive ? '#1a1a1a' : '#8c8c8c',
                fontSize: 12.5,
                fontWeight: isActive || hot ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {k.label}
              <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#1a1a1a' : hot ? '#ff4d4f' : '#bfbfbf' }}>{counts[k.key]}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (style === 'color') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {KPI_META.map((k) => {
          const isActive = active === k.key
          const hot = k.urgent && counts[k.key] > 0
          return (
            <button
              key={k.key}
              onClick={() => onSelect(isActive ? 'all' : k.key)}
              className={hot && !isActive ? 'tab-urgent-pulse' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 13px',
                borderRadius: 18,
                border: `1px solid ${isActive || hot ? k.color : k.border}`,
                background: isActive ? k.color : hot ? k.soft : '#fff',
                color: isActive ? '#fff' : hot ? k.color : '#595959',
                fontSize: 13,
                fontWeight: isActive || hot ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {k.label}
              <span
                style={{
                  minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, fontSize: 11.5, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'rgba(255,255,255,.28)' : hot ? k.color : '#f0f0f0',
                  color: isActive || hot ? '#fff' : '#8c8c8c',
                }}
              >
                {counts[k.key]}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // Default
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {KPI_META.map((k) => {
        const isActive = active === k.key
        const hot = k.urgent && counts[k.key] > 0
        return (
          <button
            key={k.key}
            onClick={() => onSelect(isActive ? 'all' : k.key)}
            className={hot && !isActive ? 'tab-urgent-pulse' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 13px', borderRadius: 20,
              border: `1px solid ${isActive || hot ? k.color : '#e8e8e8'}`,
              background: isActive ? k.color : hot ? k.soft : '#fff',
              color: isActive ? '#fff' : hot ? k.color : '#595959',
              fontSize: 13, fontWeight: isActive || hot ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {k.label}
            <span
              style={{
                minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, fontSize: 11.5, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? 'rgba(255,255,255,.28)' : hot ? k.color : '#f0f0f0',
                color: isActive || hot ? '#fff' : '#8c8c8c',
              }}
            >
              {counts[k.key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

type SortKey = 'start' | 'eta' | 'label'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'start', label: 'Start time' },
  { value: 'eta', label: 'ETA' },
  { value: 'label', label: 'Route code' },
]

/* ── Map/marker tooltip style — how much the InfoWindow/card popover shows ── */
type MapCardStyle = 'default' | 'compact' | 'detailed'

const MAP_CARD_STYLE_OPTIONS: { value: MapCardStyle; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'compact', label: 'Compact' },
  { value: 'detailed', label: 'Detailed' },
]

/* ── Which side of the screen the context map sits on ── */
type MapPosition = 'right' | 'left'

const MAP_POSITION_OPTIONS: { value: MapPosition; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
]

/* ── List : map width proportion ── */
type ListMapRatio = '70:30' | '65:35' | '60:40' | '55:45' | '50:50'

const LIST_MAP_RATIO_OPTIONS: { value: ListMapRatio; label: string }[] = [
  { value: '70:30', label: '70 : 30' },
  { value: '65:35', label: '65 : 35' },
  { value: '60:40', label: '60 : 40' },
  { value: '55:45', label: '55 : 45' },
  { value: '50:50', label: '50 : 50' },
]

function ratioFlex(r: ListMapRatio): [number, number] {
  const [a, b] = r.split(':').map(Number)
  return [a, b]
}

/* ── Rich tooltip body shared by the card popover and the map InfoWindow ── */
function TripSummary({
  stop,
  variant = 'default',
  onViewDetail,
  onTake,
  handled,
}: {
  stop: VehicleStop
  variant?: MapCardStyle
  onViewDetail: () => void
  onTake?: () => void
  handled?: boolean
}) {
  const status = deriveStatus(stop)
  const s = STATUS_STYLE[status]
  const statusLabel = stop.online ? status : 'Offline'
  const lateMin = stop.online && status === 'Late' && stop.eta ? toMinutes(stop.eta) - toMinutes(stop.scheduled) : 0
  const urgent = !stop.online || status === 'Late'
  const takeBtn = urgent && !handled && onTake && (
    <Button size="small" icon={<CheckOutlined style={{ fontSize: 10 }} />} onClick={onTake} style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
      Take it
    </Button>
  )

  // ── Compact: just enough to recognise the trip and act ──
  if (variant === 'compact') {
    return (
      <div style={{ width: 200, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 12, flexShrink: 0 }} />
          <Text style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }} ellipsis>{firstName(stop.driver)}</Text>
          <span style={{ marginLeft: 'auto', flexShrink: 0, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10.5, fontWeight: 500, padding: '0 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
        </div>
        <Text style={{ fontSize: 11.5, color: '#8c8c8c', display: 'block', marginTop: 5 }} ellipsis>
          {stop.online && stop.eta
            ? `ETA ${formatTimeAmPm(stop.eta)}${lateMin > 0 ? ` (+${lateMin}m)` : ''}`
            : !stop.online
              ? `Last seen ${stop.lastOnline ?? 'unknown'}`
              : formatTimeAmPm(stop.scheduled)}
        </Text>
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          <Button size="small" type="primary" icon={<EyeOutlined />} onClick={onViewDetail} style={{ flex: 1, fontSize: 11.5, minWidth: 0, padding: '0 6px' }} />
          {takeBtn}
        </div>
      </div>
    )
  }

  // ── Detailed: adds customer code, and labels the trip start / fleet owner
  //    rows separately instead of folding them into one line ──
  if (variant === 'detailed') {
    return (
      <div style={{ width: 296, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11.5, fontWeight: 600, padding: '0 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {stop.label}
          </span>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', flexShrink: 0 }}>{stop.customerCode}</Text>
          <span style={{ marginLeft: 'auto', flexShrink: 0, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, minWidth: 0 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 13, flexShrink: 0 }} />
          <Text style={{ fontSize: 13, fontWeight: 600, minWidth: 0 }} ellipsis>{stop.driver}</Text>
          <Text style={{ fontSize: 11.5, color: stop.online ? '#16a34a' : '#ff4d4f', flexShrink: 0 }}>{stop.online ? 'Online' : 'Offline'}</Text>
        </div>
        {stop.from && stop.to && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
            <Text style={{ fontSize: 12, color: '#595959', minWidth: 0, flexShrink: 1 }} ellipsis>{stop.from.name}</Text>
            <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 10, flexShrink: 0 }} />
            <Text style={{ fontSize: 12, fontWeight: 600, minWidth: 0, flexShrink: 1 }} ellipsis>{stop.to.name}</Text>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>Trip start: <strong style={{ color: '#1a1a1a' }}>{formatTimeAmPm(stop.scheduled)}</strong></Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }} ellipsis>
            {stop.online && stop.eta ? (
              <>ETA: <strong style={{ color: lateMin > 0 ? '#faad14' : '#1a1a1a' }}>{formatTimeAmPm(stop.eta)}{lateMin > 0 ? ` (+${lateMin}m)` : ''}</strong></>
            ) : !stop.online ? (
              <>Last seen: <strong style={{ color: '#ff4d4f' }}>{stop.lastOnline ?? 'unknown'}</strong></>
            ) : (
              'ETA: —'
            )}
          </Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>Vehicle: <strong style={{ color: '#1a1a1a' }}>{stop.plate}</strong></Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }} ellipsis>Fleet owner: <strong style={{ color: '#1a1a1a' }}>{stop.fleetOwner}</strong></Text>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <Button size="small" type="primary" icon={<EyeOutlined />} onClick={onViewDetail} style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
            View detail
          </Button>
          {takeBtn}
        </div>
      </div>
    )
  }

  // ── Default ──
  return (
    <div style={{ width: 272, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 13, flexShrink: 0 }} />
        <Text style={{ fontSize: 13, fontWeight: 600, minWidth: 0 }} ellipsis>{stop.driver}</Text>
        <span style={{ marginLeft: 'auto', flexShrink: 0, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          {statusLabel}
        </span>
      </div>
      {stop.from && stop.to && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
          <Text style={{ fontSize: 12, color: '#595959', minWidth: 0, flexShrink: 1 }} ellipsis>{stop.from.name}</Text>
          <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 10, flexShrink: 0 }} />
          <Text style={{ fontSize: 12, fontWeight: 600, minWidth: 0, flexShrink: 1 }} ellipsis>{stop.to.name}</Text>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 }}>
        <ClockCircleOutlined style={{ fontSize: 11.5, color: '#8c8c8c', flexShrink: 0 }} />
        <Text style={{ fontSize: 12, color: '#8c8c8c', flexShrink: 0 }}>{formatTimeAmPm(stop.scheduled)}</Text>
        {stop.online && stop.eta && (
          <Text style={{ fontSize: 12, fontWeight: 600, color: lateMin > 0 ? '#faad14' : '#1677ff', minWidth: 0 }} ellipsis>
            · ETA {formatTimeAmPm(stop.eta)}{lateMin > 0 ? ` (+${lateMin}m)` : ''}
          </Text>
        )}
      </div>
      {/* Own row so a long "Last seen" timestamp truncates cleanly instead
          of overflowing the InfoWindow bubble */}
      {!stop.online && (
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#ff4d4f', display: 'block', marginTop: 4 }} ellipsis>
          Last seen {stop.lastOnline ?? 'unknown'}
        </Text>
      )}
      <Text style={{ fontSize: 11.5, color: '#8c8c8c', display: 'block', marginTop: 4 }} ellipsis>
        {stop.plate} · {stop.fleetOwner}
      </Text>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <Button size="small" type="primary" icon={<EyeOutlined />} onClick={onViewDetail} style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
          View detail
        </Button>
        {takeBtn}
      </div>
    </div>
  )
}

/* ── Card style (ported from Live Tracking's Vertical card variation) —
   applied to every card in the two-column grid ── */
type CardStyle = 'compact' | 'split' | 'minimal' | 'detailed' | 'accordion' | 'avatar' | 'timeline' | 'banner' | 'row'

const CARD_STYLE_OPTIONS: { value: CardStyle; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'split', label: 'Split' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'accordion', label: 'Accordion' },
  { value: 'avatar', label: 'Avatar' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'banner', label: 'Banner' },
  { value: 'row', label: 'Row' },
]

function TripGridCard({
  stop,
  variant,
  selected,
  expanded,
  handled,
  onClick,
  onViewDetail,
  onTake,
  innerRef,
}: {
  stop: VehicleStop
  variant: CardStyle
  selected: boolean
  expanded: boolean
  handled: boolean
  onClick: () => void
  onViewDetail: () => void
  onTake: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const color = statusColor(stop)
  const status = deriveStatus(stop)
  const statusLabel = stop.online ? status : 'Offline'
  const start = formatTimeAmPm(stop.scheduled)
  const name = firstName(stop.driver)
  const border = selected ? '#1677ff' : '#f0f0f0'
  const routeChip = (
    <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11.5, fontWeight: 600, padding: '0 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {stop.label}
    </span>
  )
  const urgent = !stop.online || status === 'Late'
  // Lets ops act on a late/offline trip right from the card, no need to
  // open the tooltip or drawer first
  const takeItBtn = urgent && !handled && (
    <Button
      size="small"
      icon={<CheckOutlined style={{ fontSize: 10 }} />}
      onClick={(e) => { e.stopPropagation(); onTake() }}
      style={{ width: '100%', marginTop: 8, fontSize: 11.5, height: 24 }}
    >
      Take it
    </Button>
  )

  if (variant === 'split') {
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              {routeChip}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                <ClockCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} />
                <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{start}</Text>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, borderLeft: '1px solid #f0f0f0', paddingLeft: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block' }} ellipsis>{name}</Text>
              <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>{stop.plate}</Text>
            </div>
          </div>
          {takeItBtn}
        </div>
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', minWidth: 0 }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {routeChip}
        <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{stop.plate}</Text>
          <Text style={{ fontSize: 10.5, color: '#8c8c8c' }}>{start}</Text>
        </div>
        {urgent && !handled && (
          <Tooltip title="Take it">
            <Button
              size="small"
              shape="circle"
              icon={<CheckOutlined style={{ fontSize: 10 }} />}
              onClick={(e) => { e.stopPropagation(); onTake() }}
              style={{ flexShrink: 0 }}
            />
          </Tooltip>
        )}
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {routeChip}
            <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>{stop.customerCode}</Text>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap' }}>{statusLabel}</span>
          </div>
          {stop.from && stop.to && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, minWidth: 0 }}>
              <Text style={{ fontSize: 11.5, color: '#595959' }} ellipsis>{stop.from.name}</Text>
              <ArrowRightOutlined style={{ fontSize: 9, color: '#bfbfbf', flexShrink: 0 }} />
              <Text style={{ fontSize: 11.5, fontWeight: 600 }} ellipsis>{stop.to.name}</Text>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <ClockCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} />
            <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>{start}</Text>
            <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, marginLeft: 8 }} />
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }} ellipsis>{name}</Text>
            <Text style={{ fontSize: 11.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{stop.plate}</Text>
          </div>
          <Text style={{ fontSize: 10.5, color: '#bfbfbf', display: 'block', marginTop: 4 }}>{stop.fleetOwner}</Text>
          {takeItBtn}
        </div>
      </div>
    )
  }

  if (variant === 'accordion') {
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ display: 'flex', background: expanded ? '#f0f7ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {routeChip}
            <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
            <Text style={{ fontSize: 11.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
            <DownOutlined style={{ fontSize: 10, color: '#bfbfbf', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </div>
          {expanded && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e6f0fa', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {stop.from && stop.to && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <Text style={{ fontSize: 11.5, color: '#595959' }} ellipsis>{stop.from.name}</Text>
                  <ArrowRightOutlined style={{ fontSize: 9, color: '#bfbfbf', flexShrink: 0 }} />
                  <Text style={{ fontSize: 11.5, fontWeight: 600 }} ellipsis>{stop.to.name}</Text>
                </div>
              )}
              <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>
                {start} · {statusLabel}
              </Text>
              <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>{stop.fleetOwner}</Text>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <Button size="small" type="primary" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); onViewDetail() }} style={{ flex: 1, fontSize: 11.5 }}>
                  View detail
                </Button>
                {urgent && !handled && (
                  <Button size="small" icon={<CheckOutlined style={{ fontSize: 10 }} />} onClick={(e) => { e.stopPropagation(); onTake() }} style={{ fontSize: 11.5 }}>
                    Take it
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Avatar: driver-forward — initials avatar leads, route tucked under the name ──
  if (variant === 'avatar') {
    const initials = stop.driver
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ display: 'flex', gap: 10, background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, padding: '9px 11px', cursor: 'pointer', minWidth: 0 }}
      >
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
            {routeChip}
            <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap', flexShrink: 0 }}>{statusLabel}</span>
          </div>
          {stop.from && stop.to && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, minWidth: 0 }}>
              <Text style={{ fontSize: 11.5, color: '#8c8c8c', minWidth: 0 }} ellipsis>{stop.from.name}</Text>
              <ArrowRightOutlined style={{ fontSize: 9, color: '#bfbfbf', flexShrink: 0 }} />
              <Text style={{ fontSize: 11.5, color: '#595959', minWidth: 0 }} ellipsis>{stop.to.name}</Text>
            </div>
          )}
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', display: 'block', marginTop: 4 }}>{start} · {stop.plate}</Text>
          {takeItBtn}
        </div>
      </div>
    )
  }

  // ── Timeline: schedule-forward — a mini bar between start time and ETA
  //    so a glance shows whether the trip is running behind ──
  if (variant === 'timeline') {
    const isLate = urgent && stop.online
    const barColor = !stop.online ? '#ff4d4f' : isLate ? '#faad14' : '#16a34a'
    const rightLabel = stop.online
      ? (stop.eta ? formatTimeAmPm(stop.eta) : '—')
      : (stop.lastOnline ?? 'unknown')
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {routeChip}
            <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap', flexShrink: 0 }}>{statusLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <Text style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>{start}</Text>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#f0f0f0', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 2, background: barColor, opacity: 0.35 }} />
              <div style={{ position: 'absolute', right: stop.online ? 0 : '50%', top: -2.5, width: 8, height: 8, borderRadius: '50%', background: barColor, transform: 'translateX(50%)' }} />
            </div>
            <Text style={{ fontSize: 11, fontWeight: 600, color: barColor, flexShrink: 0, whiteSpace: 'nowrap' }} ellipsis>{rightLabel}</Text>
          </div>
          <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginTop: 6 }}>{stop.plate}</Text>
          {takeItBtn}
        </div>
      </div>
    )
  }

  // ── Banner: status-forward — a solid colored header band, white body ──
  if (variant === 'banner') {
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        <div style={{ background: color, padding: '5px 11px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: '#fff', minWidth: 0 }} ellipsis>{stop.label}</Text>
          <Text style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', marginLeft: 'auto', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
            {statusLabel.toUpperCase()}
          </Text>
        </div>
        <div style={{ padding: '9px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
            <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
            <Text style={{ fontSize: 11.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
          </div>
          <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginTop: 4 }}>{start}</Text>
          {takeItBtn}
        </div>
      </div>
    )
  }

  // ── Row: single dense table-like line for fast scanning ──
  if (variant === 'row') {
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', minWidth: 0, height: 36 }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1677ff', width: 46, flexShrink: 0 }}>{stop.label}</span>
        <Text style={{ fontSize: 11.5, color: '#8c8c8c', width: 58, flexShrink: 0 }}>{start}</Text>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', flex: 1, minWidth: 0 }} ellipsis>{name}</Text>
        <Text style={{ fontSize: 11.5, color: '#8c8c8c', width: 62, flexShrink: 0, textAlign: 'right' }}>{stop.plate}</Text>
        <span style={{ fontSize: 10.5, fontWeight: 600, color, width: 52, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>{statusLabel}</span>
        {urgent && !handled && (
          <Tooltip title="Take it">
            <Button
              size="small"
              shape="circle"
              icon={<CheckOutlined style={{ fontSize: 10 }} />}
              onClick={(e) => { e.stopPropagation(); onTake() }}
              style={{ flexShrink: 0 }}
            />
          </Tooltip>
        )}
      </div>
    )
  }

  // compact (default)
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
        border: `1px solid ${border}`,
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
          {routeChip}
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{start}</Text>
          {handled ? (
            <CheckOutlined style={{ marginLeft: 'auto', fontSize: 10, color: '#16a34a', flexShrink: 0 }} title="Handled" />
          ) : (
            <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap', flexShrink: 0 }}>{statusLabel}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minWidth: 0 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
          <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
        </div>
        {takeItBtn}
      </div>
    </div>
  )
}

/* ── Double highlight — ported from Live Tracking. Two levels of highlights
   over the trip list, replacing the KPI bar when enabled. NOTE: the real
   definitions depend on trip status + schedule margin/slack and are still
   being worked out — everything derived from dhInfo() below is
   deterministic PLACEHOLDER logic so the UI can be exercised now. ── */
type DhLevel1 = 'immediate' | 'risk' | 'stable'
type DhLevel2 = 'cur-first' | 'cur-other' | 'next' | 'offline' | 'will-first' | 'will-other' | 'no-slack'

const DH_L1_META: { key: DhLevel1; label: string; color: string; soft: string; border: string }[] = [
  { key: 'immediate', label: 'Immediate attention', color: '#ff4d4f', soft: '#fff1f0', border: '#ffccc7' },
  { key: 'risk', label: 'At risk', color: '#faad14', soft: '#fffbe6', border: '#ffe58f' },
  { key: 'stable', label: 'Stable', color: '#16a34a', soft: '#f6ffed', border: '#b7eb8f' },
]

const DH_L2_META: Record<Exclude<DhLevel1, 'stable'>, { key: DhLevel2; label: string }[]> = {
  immediate: [
    { key: 'cur-first', label: 'Current trip delayed (first point)' },
    { key: 'cur-other', label: 'Current trip delayed (other points)' },
    { key: 'next', label: 'Next trip delayed' },
    { key: 'offline', label: 'Driver offline' },
  ],
  risk: [
    { key: 'will-first', label: 'Current trip will be delayed (first point)' },
    { key: 'will-other', label: 'Current trip will be delayed (other points)' },
    { key: 'no-slack', label: 'No schedule slack' },
  ],
}

interface DhInfo {
  l1: DhLevel1
  l2: DhLevel2 | null
  currentDelayMin: number
  nextTripDelayMin: number
  predictedDelayMin: number
  slackMin: number
}

function dhHash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return h
}

function dhInfo(stop: VehicleStop): DhInfo {
  const h = dhHash(stop.id)
  const currentDelayMin = stop.online && stop.eta ? Math.max(0, toMinutes(stop.eta) - toMinutes(stop.scheduled)) : 0
  // PLACEHOLDER schedule slack — real value = margin to the next trip's start
  const slackMin = (h % 13) * 5 - 15 - currentDelayMin
  const nextTripDelayMin = Math.max(0, -slackMin)
  const predictedDelayMin = stop.online && currentDelayMin === 0 && h % 4 === 0 ? (h % 3) * 5 + 5 : 0
  const atFirstPoint = stop.phase < 0.45

  if (!stop.online) return { l1: 'immediate', l2: 'offline', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (currentDelayMin > 0) return { l1: 'immediate', l2: atFirstPoint ? 'cur-first' : 'cur-other', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (nextTripDelayMin > 0) return { l1: 'immediate', l2: 'next', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (predictedDelayMin > 0) return { l1: 'risk', l2: atFirstPoint ? 'will-first' : 'will-other', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (slackMin <= 5) return { l1: 'risk', l2: 'no-slack', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  return { l1: 'stable', l2: null, currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
}

function slackChipColors(slackMin: number): { color: string; bg: string; border: string } {
  if (slackMin < 0) return { color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' }
  if (slackMin <= 5) return { color: '#d48806', bg: '#fffbe6', border: '#ffe58f' }
  return { color: '#16a34a', bg: '#f6ffed', border: '#b7eb8f' }
}

function DhGridCard({
  stop,
  info,
  selected,
  handled,
  onClick,
  onTake,
  innerRef,
}: {
  stop: VehicleStop
  info: DhInfo
  selected: boolean
  handled: boolean
  onClick: () => void
  onTake: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const accent = info.l1 === 'immediate' ? '#ff4d4f' : info.l1 === 'risk' ? '#faad14' : '#16a34a'
  const baseStatus = deriveStatus(stop)
  const statusLabel = !stop.online ? 'Offline' : info.currentDelayMin > 0 ? 'Late' : info.predictedDelayMin > 0 ? 'Will be late' : baseStatus
  const urgent = !stop.online || statusLabel === 'Late'
  const statusStyle =
    statusLabel === 'Will be late'
      ? { color: '#d48806', bg: '#fffbe6', border: '#ffe58f' }
      : statusLabel === 'Offline'
        ? { color: STATUS_STYLE['To Check'].color, bg: STATUS_STYLE['To Check'].bg, border: STATUS_STYLE['To Check'].border }
        : { color: STATUS_STYLE[baseStatus].color, bg: STATUS_STYLE[baseStatus].bg, border: STATUS_STYLE[baseStatus].border }
  const slack = slackChipColors(info.slackMin)
  const showDelays = info.l1 !== 'stable'
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
        minWidth: 0,
      }}
    >
      <span style={{ width: 4, background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11.5, fontWeight: 600, padding: '0 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {stop.label}
          </span>
          <ClockCircleOutlined style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }} />
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{formatTimeAmPm(stop.scheduled)}</Text>
          <span
            style={{
              marginLeft: 'auto', background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
              fontSize: 10.5, fontWeight: 500, padding: '0 7px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
          <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{firstName(stop.driver)}</Text>
          <Text style={{ fontSize: 10.5, color: stop.online ? '#16a34a' : '#ff4d4f', flexShrink: 0 }}>{stop.online ? 'Online' : 'Offline'}</Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
          <span style={{ background: slack.bg, color: slack.color, border: `1px solid ${slack.border}`, fontSize: 10.5, fontWeight: 600, padding: '0 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            Slack {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin} min
          </span>
          {showDelays && (
            <>
              {(info.currentDelayMin > 0 || info.predictedDelayMin > 0) && (
                <Text style={{ fontSize: 10.5, color: '#ff4d4f', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Cur {info.currentDelayMin > 0 ? `+${info.currentDelayMin}` : `~+${info.predictedDelayMin}`}m
                </Text>
              )}
              {info.nextTripDelayMin > 0 && (
                <Text style={{ fontSize: 10.5, color: '#d48806', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Next +{info.nextTripDelayMin}m
                </Text>
              )}
            </>
          )}
        </div>
        {urgent && !handled && (
          <Button
            size="small"
            icon={<CheckOutlined style={{ fontSize: 10 }} />}
            onClick={(e) => { e.stopPropagation(); onTake() }}
            style={{ width: '100%', marginTop: 8, fontSize: 11.5, height: 24 }}
          >
            Take it
          </Button>
        )}
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
  mapTheme,
  markerStyle,
  mapCardStyle,
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
  mapTheme: MapTheme
  markerStyle: MarkerStyle
  mapCardStyle: MapCardStyle
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
        styles: MAP_THEMES[mapTheme],
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
                icon={makeMarkerIcon(markerStyle, stop, sel)}
                onClick={() => onSelect(stop.id)}
              />
              {sel && (
                <InfoWindow position={{ lat, lng }} onCloseClick={onClose} options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -26) }}>
                  <TripSummary
                    stop={stop}
                    variant={mapCardStyle}
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

/* ── Drawer position — side (docked as a third column) or bottom (docked
   below the list/map row). Both are laid out as normal flex siblings
   instead of an overlay, so the list and map stay fully clickable while
   it's open — no modal mask blocking pointer events. ── */
type DrawerPosition = 'side' | 'bottom'

const DRAWER_POSITION_OPTIONS: { value: DrawerPosition; label: string }[] = [
  { value: 'side', label: 'Side' },
  { value: 'bottom', label: 'Bottom' },
]

/* ── Docked trip detail panel — replaces the old modal Drawer. Same content
   either way; "side" stacks fields vertically, "bottom" wraps them in a row
   since the panel is short and wide instead of tall and narrow. ── */
function TripDetailPanel({
  stop,
  position,
  onClose,
  onNotify,
  onMarkHandled,
  urgent,
  handled,
}: {
  stop: VehicleStop
  position: DrawerPosition
  onClose: () => void
  onNotify: () => void
  onMarkHandled: () => void
  urgent: boolean
  handled: boolean
}) {
  const status = deriveStatus(stop)
  const style = STATUS_STYLE[status]
  const statusLabel = stop.online ? status : 'Offline'
  const lateMin = stop.online && status === 'Late' && stop.eta ? toMinutes(stop.eta) - toMinutes(stop.scheduled) : 0

  const fields = (
    <>
      <DetailItem label="Route">
        {stop.from && stop.to ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
            <Text style={{ fontSize: 13, color: '#595959' }} ellipsis>{stop.from.name}</Text>
            <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 12, flexShrink: 0 }} />
            <Text style={{ fontSize: 13, fontWeight: 600 }} ellipsis>{stop.to.name}</Text>
          </div>
        ) : (
          <Text style={{ fontSize: 13, fontWeight: 600 }}>{stop.destination}</Text>
        )}
      </DetailItem>
      <DetailItem label="Trip start">{formatTimeAmPm(stop.scheduled)}</DetailItem>
      <DetailItem label="ETA">
        {stop.online && stop.eta ? (
          <span style={{ color: status === 'Late' ? '#ff4d4f' : '#1677ff', fontWeight: 700 }}>
            {formatTimeAmPm(stop.eta)}
            {lateMin > 0 && <span style={{ fontWeight: 500 }}> · {lateMin} min late</span>}
          </span>
        ) : (
          <span style={{ color: '#8c8c8c' }}>—</span>
        )}
      </DetailItem>
      <DetailItem label="Driver">{stop.driver}</DetailItem>
      <DetailItem label="Vehicle">{stop.plate}</DetailItem>
      <DetailItem label="Fleet owner">{stop.fleetOwner}</DetailItem>
      {!stop.online && (
        <DetailItem label="Last online">
          <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{stop.lastOnline ?? 'Position unknown'}</span>
        </DetailItem>
      )}
    </>
  )

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(position === 'side'
          // order: 3 keeps it after the list/map regardless of which one
          // "Map position" put first (they use order 1/2 to swap sides)
          ? { width: 340, height: '100%', order: 3 }
          : { width: '100%', height: 232, marginTop: 12 }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Trip detail</Text>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 15 }} />
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 5 }}>{stop.label}</span>
          <span style={{ background: '#f5f5f5', color: '#595959', fontSize: 12, padding: '1px 8px', borderRadius: 5 }}>{stop.customerCode}</span>
          <span style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: 11.5, fontWeight: 600, padding: '1px 9px', borderRadius: 6 }}>{statusLabel}</span>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} title="Close" />
        </div>
      </div>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button type="primary" icon={<BellOutlined />} disabled={stop.notified} onClick={onNotify} style={{ flex: 1 }}>
            {stop.notified ? 'Notified' : 'Notify driver'}
          </Button>
          <Button icon={<CheckOutlined />} disabled={!urgent || handled} onClick={onMarkHandled} style={{ flex: 1 }}>
            {handled ? 'Handled' : 'Mark handled'}
          </Button>
          <Tooltip title="Demo only">
            <Button icon={<PhoneOutlined />} />
          </Tooltip>
        </div>
        {position === 'side' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{fields}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 32px' }}>{fields}</div>
        )}
      </div>
    </div>
  )
}

/* ── Floating, draggable Display settings panel — same mechanism as the
   Test Console on the main Live Tracking page (drag by header, close to a
   reopener button) so every switcher ported from there behaves the same way
   here too. ── */
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontSize: 13, color: '#595959' }}>{label}</Text>
      {children}
    </div>
  )
}

function DisplaySettingsPanel({
  pos,
  onDragStart,
  onClose,
  mapTheme,
  onMapThemeChange,
  cardStyle,
  onCardStyleChange,
  highlightStyle,
  onHighlightStyleChange,
  markerStyle,
  onMarkerStyleChange,
  mapCardStyle,
  onMapCardStyleChange,
  mapPosition,
  onMapPositionChange,
  listMapRatio,
  onListMapRatioChange,
  drawerPosition,
  onDrawerPositionChange,
  doubleHighlight,
  onDoubleHighlightChange,
  showNeedsAttention,
  onShowNeedsAttentionChange,
  showRoutes,
  onShowRoutesChange,
  showTraffic,
  onShowTrafficChange,
  simulating,
  onToggleSimulate,
}: {
  pos: { x: number; y: number }
  onDragStart: (e: React.MouseEvent) => void
  onClose: () => void
  mapTheme: MapTheme
  onMapThemeChange: (v: MapTheme) => void
  cardStyle: CardStyle
  onCardStyleChange: (v: CardStyle) => void
  highlightStyle: HighlightStyle
  onHighlightStyleChange: (v: HighlightStyle) => void
  markerStyle: MarkerStyle
  onMarkerStyleChange: (v: MarkerStyle) => void
  mapCardStyle: MapCardStyle
  onMapCardStyleChange: (v: MapCardStyle) => void
  mapPosition: MapPosition
  onMapPositionChange: (v: MapPosition) => void
  listMapRatio: ListMapRatio
  onListMapRatioChange: (v: ListMapRatio) => void
  drawerPosition: DrawerPosition
  onDrawerPositionChange: (v: DrawerPosition) => void
  doubleHighlight: boolean
  onDoubleHighlightChange: (v: boolean) => void
  showNeedsAttention: boolean
  onShowNeedsAttentionChange: (v: boolean) => void
  showRoutes: boolean
  onShowRoutesChange: (v: boolean) => void
  showTraffic: boolean
  onShowTrafficChange: (v: boolean) => void
  simulating: boolean
  onToggleSimulate: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        zIndex: 2000,
        width: 260,
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
        <Text style={{ fontWeight: 600, fontSize: 13, color: '#d48806', flex: 1 }}>Display settings</Text>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} title="Hide" />
      </div>

      <div style={{ padding: '10px 12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SettingRow label="Map theme">
          <Select size="small" value={mapTheme} onChange={onMapThemeChange} options={MAP_THEME_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <SettingRow label="Card style">
          <Select size="small" value={cardStyle} onChange={onCardStyleChange} options={CARD_STYLE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <SettingRow label="Highlight style">
          <Select size="small" value={highlightStyle} onChange={onHighlightStyleChange} options={HIGHLIGHT_STYLE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <SettingRow label="Marker style">
          <Select size="small" value={markerStyle} onChange={onMarkerStyleChange} options={MARKER_STYLE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <SettingRow label="Map card style">
          <Select size="small" value={mapCardStyle} onChange={onMapCardStyleChange} options={MAP_CARD_STYLE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <div style={{ height: 1, background: '#f0f0f0' }} />
        <SettingRow label="Map position">
          <Select size="small" value={mapPosition} onChange={onMapPositionChange} options={MAP_POSITION_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <SettingRow label="List : map size">
          <Select size="small" value={listMapRatio} onChange={onListMapRatioChange} options={LIST_MAP_RATIO_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <SettingRow label="Detail panel">
          <Select size="small" value={drawerPosition} onChange={onDrawerPositionChange} options={DRAWER_POSITION_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <div style={{ height: 1, background: '#f0f0f0' }} />
        <SettingRow label="Double highlight">
          <Switch size="small" checked={doubleHighlight} onChange={onDoubleHighlightChange} />
        </SettingRow>
        <SettingRow label="Show needs attention">
          <Switch size="small" checked={showNeedsAttention} onChange={onShowNeedsAttentionChange} disabled={doubleHighlight} />
        </SettingRow>
        <div style={{ height: 1, background: '#f0f0f0' }} />
        <SettingRow label="Show route">
          <Switch size="small" checked={showRoutes} onChange={onShowRoutesChange} />
        </SettingRow>
        <SettingRow label="Show traffic">
          <Switch size="small" checked={showTraffic} onChange={onShowTrafficChange} />
        </SettingRow>
        <Button
          size="small"
          type={simulating ? 'primary' : 'default'}
          icon={simulating ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={onToggleSimulate}
          block
        >
          {simulating ? 'Pause' : 'Simulate'}
        </Button>
      </div>
    </div>
  )
}

export default function LiveTrackingTesting2Page() {
  const [filter, setFilter] = useState<KpiKey>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('start')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPosition, setDrawerPosition] = useState<DrawerPosition>('side')
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set())
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set())

  // ── Display settings — ported from the main Live Tracking page ──
  const [mapTheme, setMapTheme] = useState<MapTheme>('silver')
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>('bus')
  const [cardStyle, setCardStyle] = useState<CardStyle>('compact')
  const [mapCardStyle, setMapCardStyle] = useState<MapCardStyle>('default')
  const [mapPosition, setMapPosition] = useState<MapPosition>('right')
  const [listMapRatio, setListMapRatio] = useState<ListMapRatio>('60:40')
  const [highlightStyle, setHighlightStyle] = useState<HighlightStyle>('default')
  const [showNeedsAttention, setShowNeedsAttention] = useState(true)
  const [doubleHighlight, setDoubleHighlight] = useState(false)
  const [dhLevel1, setDhLevel1] = useState<DhLevel1>('immediate')
  const [dhLevel2, setDhLevel2] = useState<DhLevel2 | null>('cur-first')
  const [showRoutes, setShowRoutes] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [messageApi, msgContext] = message.useMessage()

  // Floating, draggable Display settings panel — visible by default, same
  // behaviour as the Test Console on the main Live Tracking page
  const [settingsVisible, setSettingsVisible] = useState(true)
  const { pos: settingsPos, onDragStart: onSettingsDragStart } = useDraggable({
    x: Math.max(window.innerWidth - 292, 16),
    y: 96,
  })

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

  // Double-highlight classification for every trip
  const dhById: Record<string, DhInfo> = Object.fromEntries(stops.map((s) => [s.id, dhInfo(s)]))
  const dhL1Counts: Record<DhLevel1, number> = { immediate: 0, risk: 0, stable: 0 }
  const dhL2Counts: Record<string, number> = {}
  stops.forEach((s) => {
    const info = dhById[s.id]
    dhL1Counts[info.l1] += 1
    if (info.l2) dhL2Counts[info.l2] = (dhL2Counts[info.l2] ?? 0) + 1
  })

  const filtered = stops.filter((s) => {
    if (doubleHighlight) {
      const info = dhById[s.id]
      if (info.l1 !== dhLevel1) return false
      if (dhLevel1 !== 'stable' && dhLevel2 && info.l2 !== dhLevel2) return false
    } else if (!kpiMatch(s, filter)) {
      return false
    }
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

  // Needs-attention grouping — skipped entirely in double-highlight mode
  // (level 1 already does the job) and toggleable otherwise
  const needsAttention = !doubleHighlight && showNeedsAttention
    ? filtered.filter((s) => isUrgent(s) && !handledIds.has(s.id)).sort(sortFn)
    : []
  const others = !doubleHighlight && showNeedsAttention
    ? filtered.filter((s) => !(isUrgent(s) && !handledIds.has(s.id))).sort(sortFn)
    : [...filtered].sort(sortFn)

  const [listFlex, mapFlex] = ratioFlex(listMapRatio)

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

  // Accordion cards only toggle their own inline expansion — no docked
  // panel, since the expanded card already shows the detail.
  const toggleExpand = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
    setDrawerOpen(false)
  }

  // Every other card style: one click selects the trip (which shows its
  // tooltip on the map, not on the card) and opens the docked detail panel
  // directly. Clicking the already-open card again closes it.
  const openCard = (id: string) => {
    if (selectedId === id && drawerOpen) {
      setDrawerOpen(false)
      setSelectedId(null)
    } else {
      setSelectedId(id)
      setDrawerOpen(true)
    }
  }

  const sectionLabel = (text: string, color = '#94a3b8') => (
    <Text style={{ gridColumn: '1 / -1', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.6, margin: '2px 2px 0' }}>
      {text}
    </Text>
  )

  const renderCard = (stop: VehicleStop) => {
    if (doubleHighlight) {
      return (
        <DhGridCard
          key={stop.id}
          stop={stop}
          info={dhById[stop.id]}
          selected={selectedId === stop.id}
          handled={handledIds.has(stop.id)}
          onClick={() => openCard(stop.id)}
          onTake={() => markHandled(stop.id)}
          innerRef={(el) => { cardRefs.current[stop.id] = el }}
        />
      )
    }
    // Accordion expands inline instead of opening the docked panel
    if (cardStyle === 'accordion') {
      return (
        <TripGridCard
          key={stop.id}
          stop={stop}
          variant="accordion"
          selected={selectedId === stop.id}
          expanded={selectedId === stop.id}
          handled={handledIds.has(stop.id)}
          onClick={() => toggleExpand(stop.id)}
          onViewDetail={() => setDrawerOpen(true)}
          onTake={() => markHandled(stop.id)}
          innerRef={(el) => { cardRefs.current[stop.id] = el }}
        />
      )
    }
    // Compact / Split / Minimal / Detailed — one click selects the trip
    // (its tooltip shows on the map only) and opens the docked detail
    // panel directly, no separate card-level tooltip step
    return (
      <TripGridCard
        key={stop.id}
        stop={stop}
        variant={cardStyle}
        selected={selectedId === stop.id}
        expanded={false}
        handled={handledIds.has(stop.id)}
        onClick={() => openCard(stop.id)}
        onViewDetail={() => setDrawerOpen(true)}
        onTake={() => markHandled(stop.id)}
        innerRef={(el) => { cardRefs.current[stop.id] = el }}
      />
    )
  }

  return (
    <div style={{ padding: '20px' }}>
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
        {/* ── Header: KPI/highlight bar + search + sort ── */}
        <div style={{ flexShrink: 0 }}>
          {doubleHighlight ? (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {DH_L1_META.map((m) => {
                  const active = dhLevel1 === m.key
                  return (
                    <button
                      key={m.key}
                      onClick={() => { setDhLevel1(m.key); setDhLevel2(null) }}
                      className={m.key === 'immediate' && dhL1Counts.immediate > 0 && !active ? 'tab-urgent-pulse' : undefined}
                      style={{
                        padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap',
                        border: `1px solid ${active ? m.color : m.border}`,
                        background: active ? m.color : m.soft,
                        color: active ? '#fff' : m.color,
                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      {m.label} ({dhL1Counts[m.key]})
                    </button>
                  )
                })}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    placeholder="Search route, driver, plate..."
                    style={{ borderRadius: 8, width: 240 }}
                    allowClear
                  />
                  <Select size="middle" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} style={{ width: 118 }} />
                </div>
              </div>
              {dhLevel1 !== 'stable' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DH_L2_META[dhLevel1].map((m) => {
                    const active = dhLevel2 === m.key
                    const count = dhL2Counts[m.key] ?? 0
                    return (
                      <button
                        key={m.key}
                        onClick={() => setDhLevel2(active ? null : m.key)}
                        style={{
                          padding: '4px 10px', borderRadius: 6,
                          border: `1px solid ${active ? '#1677ff' : '#e8e8e8'}`,
                          background: active ? '#e6f4ff' : '#fff',
                          color: active ? '#1677ff' : count === 0 ? '#bfbfbf' : '#595959',
                          fontSize: 11.5, fontWeight: active ? 600 : 500, cursor: 'pointer', transition: 'all .15s',
                        }}
                      >
                        {m.label} ({count})
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <KpiBar style={highlightStyle} active={filter} counts={counts} onSelect={setFilter} />
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
          )}
        </div>

        {/* ── Body: list-first, proportion and map side both switchable ── */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* List */}
          <div style={{ order: mapPosition === 'left' ? 2 : 1, flex: listFlex, minWidth: 0, overflowY: 'auto', paddingRight: 2 }}>
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
          <div style={{ order: mapPosition === 'left' ? 1 : 2, flex: mapFlex, minWidth: 320, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
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
                  mapTheme={mapTheme}
                  markerStyle={markerStyle}
                  mapCardStyle={mapCardStyle}
                  handledIds={handledIds}
                  onSelect={(id) => { setSelectedId(id); setDrawerOpen(false) }}
                  onClose={() => setSelectedId(null)}
                  onViewDetail={() => setDrawerOpen(true)}
                  onTake={markHandled}
                  onRouteResolved={onRouteResolved}
                />
              </MapErrorBoundary>
            )}

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

          {/* Docked trip detail — side: a third flex column, laid out next
              to the map instead of overlaying it, so both stay clickable */}
          {drawerOpen && selectedStop && drawerPosition === 'side' && (
            <TripDetailPanel
              stop={selectedStop}
              position="side"
              onClose={() => setDrawerOpen(false)}
              onNotify={() => notifyDriver(selectedStop.id)}
              onMarkHandled={() => markHandled(selectedStop.id)}
              urgent={isUrgent(selectedStop)}
              handled={handledIds.has(selectedStop.id)}
            />
          )}
        </div>

        {/* Docked trip detail — bottom: docked below the list/map row */}
        {drawerOpen && selectedStop && drawerPosition === 'bottom' && (
          <TripDetailPanel
            stop={selectedStop}
            position="bottom"
            onClose={() => setDrawerOpen(false)}
            onNotify={() => notifyDriver(selectedStop.id)}
            onMarkHandled={() => markHandled(selectedStop.id)}
            urgent={isUrgent(selectedStop)}
            handled={handledIds.has(selectedStop.id)}
          />
        )}
      </div>

      {settingsVisible ? (
        <DisplaySettingsPanel
          pos={settingsPos}
          onDragStart={onSettingsDragStart}
          onClose={() => setSettingsVisible(false)}
          mapTheme={mapTheme}
          onMapThemeChange={setMapTheme}
          cardStyle={cardStyle}
          onCardStyleChange={setCardStyle}
          highlightStyle={highlightStyle}
          onHighlightStyleChange={setHighlightStyle}
          markerStyle={markerStyle}
          onMarkerStyleChange={setMarkerStyle}
          mapCardStyle={mapCardStyle}
          onMapCardStyleChange={setMapCardStyle}
          mapPosition={mapPosition}
          onMapPositionChange={setMapPosition}
          listMapRatio={listMapRatio}
          onListMapRatioChange={setListMapRatio}
          drawerPosition={drawerPosition}
          onDrawerPositionChange={setDrawerPosition}
          doubleHighlight={doubleHighlight}
          onDoubleHighlightChange={setDoubleHighlight}
          showNeedsAttention={showNeedsAttention}
          onShowNeedsAttentionChange={setShowNeedsAttention}
          showRoutes={showRoutes}
          onShowRoutesChange={setShowRoutes}
          showTraffic={showTraffic}
          onShowTrafficChange={setShowTraffic}
          simulating={simulating}
          onToggleSimulate={() => setSimulating((v) => !v)}
        />
      ) : (
        <Button
          shape="circle"
          size="large"
          icon={<ControlOutlined />}
          onClick={() => setSettingsVisible(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            borderColor: '#ffd591',
            color: '#d48806',
            boxShadow: '0 6px 18px rgba(15,23,42,.18)',
          }}
          title="Show display settings"
        />
      )}
    </div>
  )
}
