import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from 'react'
import { GoogleMap, Marker, Polyline, InfoWindow, TrafficLayer, useJsApiLoader } from '@react-google-maps/api'
import { Typography, Input, Button, Switch, Tooltip, Select, Slider, message, Dropdown, Modal, Popover } from 'antd'
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
  ExclamationCircleFilled,
  WarningFilled,
  CheckCircleFilled,
  MoreOutlined,
  SwapOutlined,
  LogoutOutlined,
  FlagOutlined,
  AimOutlined,
  FileTextOutlined,
  SoundOutlined,
  AlertOutlined,
  AppstoreOutlined,
  FilterOutlined,
  UserOutlined,
  TeamOutlined,
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
import { type DummyStop, DUMMY_STOPS } from './dummyLiveData'

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
  { key: 'all', label: 'All', color: '#595959', soft: '#f0f0f0', border: '#bfbfbf' },
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
   to the KPI/filter bar: Default pill, Segment (connected track), Color
   (each chip carries its own status hue even when inactive), or one of two
   "2 Levels" visuals for the Immediate attention/At risk/Stable system —
   Pills (rounded chips, same as the level-1 style used elsewhere) or Cards
   (dashboard-tile level 1 with an icon badge, underline tabs for level 2). ── */
type FlashingStyle = 'none' | 'pulse' | 'ring' | 'glow' | 'blink' | 'shake' | 'bounce'

const FLASHING_STYLE_OPTIONS: { value: FlashingStyle; label: string }[] = [
  { value: 'none',   label: 'None' },
  { value: 'pulse',  label: 'Pulse' },
  { value: 'ring',   label: 'Ring' },
  { value: 'glow',   label: 'Glow' },
  { value: 'blink',  label: 'Blink' },
  { value: 'shake',  label: 'Shake' },
  { value: 'bounce', label: 'Bounce' },
]

function flashCls(style: FlashingStyle, hot: boolean, active: boolean): string | undefined {
  if (!hot || active) return undefined
  if (style === 'none')   return undefined
  if (style === 'pulse')  return 'tab-urgent-pulse'
  return `flash-${style}`
}

type HighlightStyle =
  | 'default' | 'segment' | 'color'
  | 'two-level' | 'two-level-cards' | 'two-level-minimal'
  | 'two-level-banner' | 'two-level-stats' | 'two-level-badge' | 'two-level-progress'
  | 'two-level-inline' | 'two-level-panel' | 'two-level-metro' | 'two-level-equal'
  | 'flashing-card'

const HIGHLIGHT_STYLE_OPTIONS: { value: HighlightStyle; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'segment', label: 'Segment' },
  { value: 'color', label: 'Color' },
  { value: 'two-level', label: '1. Pills' },
  { value: 'two-level-cards', label: '2. Cards' },
  { value: 'two-level-minimal', label: '3. Minimal' },
  { value: 'two-level-banner', label: '4. Banner' },
  { value: 'two-level-stats', label: '5. Stats' },
  { value: 'two-level-badge', label: '6. Badge' },
  { value: 'two-level-progress', label: '7. Progress' },
  { value: 'two-level-inline', label: '8. Inline' },
  { value: 'two-level-panel', label: '9. Panel' },
  { value: 'two-level-metro', label: '10. Metro' },
  { value: 'two-level-equal', label: '11. Equal Width' },
  { value: 'flashing-card', label: '12. Flashing Card' },
]

function KpiBar({
  style,
  active,
  counts,
  onSelect,
}: {
  style: 'default' | 'segment' | 'color'
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

type SortKey = 'start' | 'slack-asc' | 'slack-desc' | 'delay-asc' | 'delay-desc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'start', label: 'Start time' },
  { value: 'slack-asc', label: 'Slack (low → high)' },
  { value: 'slack-desc', label: 'Slack (high → low)' },
  { value: 'delay-asc', label: 'Delay (low → high)' },
  { value: 'delay-desc', label: 'Delay (high → low)' },
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
  claim,
}: {
  stop: VehicleStop
  variant?: MapCardStyle
  onViewDetail: () => void
  onTake?: () => void
  handled?: boolean
  claim?: ClaimBundle
}) {
  const status = deriveStatus(stop)
  const s = STATUS_STYLE[status]
  const statusLabel = stop.online ? status : 'Offline'
  const lateMin = stop.online && status === 'Late' && stop.eta ? toMinutes(stop.eta) - toMinutes(stop.scheduled) : 0
  const urgent = !stop.online || status === 'Late'
  const accent = statusColor(stop)
  const takeBtn = !claim && urgent && !handled && onTake && (
    <Button size="small" icon={<CheckOutlined style={{ fontSize: 10 }} />} onClick={onTake} style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
      Take it
    </Button>
  )
  // Claim workflow control, shown below the trip's own action row (in place
  // of the plain "Take it" button) so the map popup mirrors the card/drawer
  const claimRow = claim && (
    <div style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
      <ClaimControl accent={accent} claim={claim} compact />
    </div>
  )

  // ── ETA & progress shared computations ──
  const progressPct = Math.round(stop.phase * 100)
  const delayMin: number | null = stop.online && stop.eta ? toMinutes(stop.eta) - toMinutes(stop.scheduled) : null
  const delayLabel = delayMin === null ? '—' : delayMin > 0 ? `+${delayMin} min late` : 'On time'
  const delayColor = delayMin === null ? '#8c8c8c' : delayMin > 0 ? '#ff4d4f' : '#16a34a'

  // Thin inline progress bar (avoids Ant Design Progress overhead)
  const progressBar = (
    <div style={{ height: 5, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${progressPct}%`, height: '100%', background: accent, borderRadius: 3 }} />
    </div>
  )

  const fromName = stop.from?.name
  const toName = stop.to?.name ?? stop.destination

  // ── Compact: ultra-compact — label + status, progress bar, ETA line, view detail ──
  if (variant === 'compact') {
    return (
      <div style={{ width: 210, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11, fontWeight: 600, padding: '0 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {stop.label}
          </span>
          <span style={{ marginLeft: 'auto', flexShrink: 0, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10.5, fontWeight: 500, padding: '0 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
          <Text style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>Progress:</Text>
          {progressBar}
          <Text style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', flexShrink: 0 }}>{progressPct}%</Text>
        </div>
        <Text style={{ fontSize: 11.5, display: 'block', marginTop: 4 }} ellipsis>
          {stop.online && stop.eta
            ? <><span style={{ color: '#8c8c8c' }}>ETA </span><strong style={{ color: delayMin !== null && delayMin > 0 ? '#ff4d4f' : '#1677ff' }}>{formatTimeAmPm(stop.eta)}</strong><span style={{ color: delayColor }}>{' '}({delayLabel})</span></>
            : !stop.online
              ? <span style={{ color: '#ff4d4f' }}>Last seen {stop.lastOnline ?? 'unknown'}</span>
              : <span style={{ color: '#8c8c8c' }}>Sched. {formatTimeAmPm(stop.scheduled)}</span>}
        </Text>
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          <Button size="small" type="primary" icon={<EyeOutlined />} onClick={onViewDetail} style={{ flex: 1, fontSize: 11.5, minWidth: 0, padding: '0 6px' }}>
            View detail
          </Button>
          {takeBtn}
        </div>
        {claimRow}
      </div>
    )
  }

  // ── Detailed: same as default but also shows driver + plate ──
  if (variant === 'detailed') {
    return (
      <div style={{ width: 296, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11.5, fontWeight: 600, padding: '0 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {stop.label}
          </span>
          <span style={{ marginLeft: 'auto', flexShrink: 0, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 11.5, color: '#8c8c8c', flexShrink: 0 }}>Trip progress:</Text>
            {progressBar}
            <Text style={{ fontSize: 11.5, fontWeight: 600, color: '#1a1a1a', flexShrink: 0 }}>{progressPct}%</Text>
          </div>
          {(fromName || toName) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
              {fromName && <Text style={{ fontSize: 11.5, color: '#595959' }} ellipsis>From: {fromName}</Text>}
              {toName && <Text style={{ fontSize: 11.5, fontWeight: 600 }} ellipsis>To: {toName}</Text>}
            </div>
          )}
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>
            ETA: <strong style={{ color: stop.online && stop.eta ? (delayMin !== null && delayMin > 0 ? '#ff4d4f' : '#1677ff') : '#8c8c8c' }}>
              {stop.online && stop.eta ? formatTimeAmPm(stop.eta) : '—'}
            </strong>
          </Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>
            Delay: <strong style={{ color: delayColor }}>{delayLabel}</strong>
          </Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>
            Scheduled: <strong style={{ color: '#1a1a1a' }}>{formatTimeAmPm(stop.scheduled)}</strong>
          </Text>
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>
            Driver: <strong style={{ color: '#1a1a1a' }}>{firstName(stop.driver)}</strong>
            <span style={{ color: stop.online ? '#16a34a' : '#ff4d4f', marginLeft: 6 }}>
              <WifiOutlined style={{ fontSize: 11 }} /> {stop.online ? 'Online' : 'Offline'}
            </span>
          </Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c' }}>
            Vehicle: <strong style={{ color: '#1a1a1a' }}>{stop.plate}</strong>
          </Text>
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8, display: 'flex', gap: 6 }}>
          <Button size="small" type="primary" icon={<EyeOutlined />} onClick={onViewDetail} style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
            View detail
          </Button>
          {takeBtn}
        </div>
        {claimRow}
      </div>
    )
  }

  // ── Default: PRD 4.4 map card fields ──
  // Conditions per PRD: ETA/delay = "not available" for To Check/Notified;
  // Current Delay hidden entirely when On Time.
  const etaUnavailable = status === 'To Check' || status === 'Notified'
  const hideDelay = status === 'On Time' && stop.online
  const nextPointName = stop.to?.name ?? stop.destination
  const dummyStop = stop as DummyStop
  const rawNextPointEta = dummyStop._nextPointEta !== undefined ? dummyStop._nextPointEta : stop.eta
  const rawLastPointEta = dummyStop._lastPointEta !== undefined ? dummyStop._lastPointEta : (stop.eta ? shiftTime(stop.eta, 10 + (dhHash(stop.id) % 15)) : null)
  const nextPointEtaStr = etaUnavailable ? 'not available' : (rawNextPointEta ? formatTimeAmPm(rawNextPointEta) : '—')
  const lastPointEtaStr = etaUnavailable ? 'not available' : (rawLastPointEta ? formatTimeAmPm(rawLastPointEta) : '—')
  const currentDelayStr = etaUnavailable ? 'not available' : (delayMin !== null && delayMin > 0 ? `+${delayMin} min` : '—')

  return (
    <div style={{ width: 272, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* Header: route label + customer code + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11.5, fontWeight: 600, padding: '0 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {stop.label}
        </span>
        <Text style={{ fontSize: 11, color: '#8c8c8c', flex: 1, minWidth: 0 }} ellipsis>{stop.customerCode}</Text>
        <span style={{ flexShrink: 0, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          {statusLabel}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        {progressBar}
        <Text style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', flexShrink: 0 }}>{progressPct}%</Text>
      </div>
      {/* PRD 4.4 data rows */}
      <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <Text style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>Next Point</Text>
          <Text style={{ fontSize: 11.5, fontWeight: 500, color: '#1a1a1a', textAlign: 'right', minWidth: 0 }} ellipsis>{nextPointName}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>Next Point ETA</Text>
          <Text style={{ fontSize: 11.5, fontWeight: 600, color: etaUnavailable ? '#8c8c8c' : '#1677ff' }}>{nextPointEtaStr}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>Last Point ETA</Text>
          <Text style={{ fontSize: 11.5, fontWeight: 500, color: etaUnavailable ? '#8c8c8c' : '#595959' }}>{lastPointEtaStr}</Text>
        </div>
        {!hideDelay && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>Current Delay</Text>
            <Text style={{ fontSize: 11.5, fontWeight: 600, color: etaUnavailable ? '#8c8c8c' : '#ff4d4f' }}>{currentDelayStr}</Text>
          </div>
        )}
      </div>
      {/* Driver Last Online — only when offline (PRD 4.4) */}
      {!stop.online && (
        <div style={{ marginTop: 6, padding: '4px 8px', background: '#fff1f0', borderRadius: 6, border: '1px solid #ffccc7' }}>
          <Text style={{ fontSize: 11, color: '#ff4d4f', fontWeight: 500 }}>
            Last online: {stop.lastOnline ?? 'unknown'}
          </Text>
        </div>
      )}
      <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8, display: 'flex', gap: 6 }}>
        <Button size="small" type="primary" icon={<EyeOutlined />} onClick={onViewDetail} style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
          View detail
        </Button>
        {takeBtn}
      </div>
      {claimRow}
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

/* ── Action model — Take it (simple binary handled/unhandled) or Claim
   workflow, per the ops requirement: claim → shows "Claimed by xx" →
   release (only the claimant) or take over (anyone else) → mark action
   complete (moves the trip to Stable). Alert-to-management (req 5) is
   KIV on the real time threshold per the spec, so it's a deterministic
   placeholder flag here, same pattern as the rest of the DH system. ── */
type ActionModel = 'take-it' | 'claim'

const ACTION_MODEL_OPTIONS: { value: ActionModel; label: string }[] = [
  { value: 'take-it', label: 'Take it' },
  { value: 'claim', label: 'Claim workflow' },
]

// Visual style of the "Claim" call-to-action button — text only (current),
// icon alongside the text, or icon only (no text)
type ClaimButtonStyle = 'text' | 'icon-text' | 'icon'

const CLAIM_BUTTON_STYLE_OPTIONS: { value: ClaimButtonStyle; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'icon-text', label: 'Icon + text' },
  { value: 'icon', label: 'Icon only' },
]

// Version 1 (Denise): claim component on all cards, urgent UI for "immediate
// attention", calm UI (no flash, outlined) for "at risk" / "stable".
// Version 2: claim component only on "immediate attention" + "at risk" cards.
type ClaimCardScope = 'all' | 'at-risk-up'

const CLAIM_CARD_SCOPE_OPTIONS: { value: ClaimCardScope; label: string }[] = [
  { value: 'all', label: 'All cards (v1)' },
  { value: 'at-risk-up', label: 'Immed. + At risk (v2)' },
]

// Feedback idea 1: instead of category accent, use fixed urgency signal —
// urgent = solid red flash, non-urgent = border-only outlined.
type ClaimColorMode = 'category' | 'urgency'

const CLAIM_COLOR_MODE_OPTIONS: { value: ClaimColorMode; label: string }[] = [
  { value: 'category', label: 'Category color' },
  { value: 'urgency', label: 'Urgency (red/outline)' },
]

// Feedback idea 2: claim CTA fills card width (current) or is compact/auto-width.
type ClaimButtonWidth = 'full' | 'compact'

const CLAIM_BUTTON_WIDTH_OPTIONS: { value: ClaimButtonWidth; label: string }[] = [
  { value: 'full', label: 'Full width' },
  { value: 'compact', label: 'Compact' },
]

// Slack chip placement: its own row (current) or inline next to the status badge.
type SlackPosition = 'row' | 'inline'

const SLACK_POSITION_OPTIONS: { value: SlackPosition; label: string }[] = [
  { value: 'row', label: 'Row' },
  { value: 'inline', label: 'Inline (by status)' },
]

// Card style that applies specifically when a 2-level highlight is active.
// The regular Card style only affects TripGridCard (not DhGridCard), so 2-level
// mode gets its own density selector to avoid a dead control in the panel.
type DhCardStyle = 'standard' | 'info' | 'compact' | 'minimal' | 'slim' | 'internal' | 'rev01' | 'rev02' | 'rev03'
type L2Spacing = 12 | 16 | 20 | 24

const L2_SPACING_OPTIONS: { value: L2Spacing; label: string }[] = [
  { value: 12, label: '12px' },
  { value: 16, label: '16px' },
  { value: 20, label: '20px' },
  { value: 24, label: '24px' },
]

const DH_CARD_STYLE_OPTIONS: { value: DhCardStyle; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'info', label: 'Info' },
  { value: 'compact', label: 'Compact' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'slim', label: 'Slim' },
  { value: 'internal', label: 'Internal' },
  { value: 'rev01', label: 'Rev 01' },
  { value: 'rev02', label: 'Rev 02' },
  { value: 'rev03', label: 'Rev 03' },
]

/* ── Additional filter dimensions beyond the KPI/highlight bar ── */
type FilterDriverStatus = 'all' | 'online' | 'offline'
type FilterAttention = 'all' | 'unclaimed' | 'mine' | 'others' | 'complete'

// The only "logged in" identity in this sandbox
const CURRENT_USER = 'Heikke Ekkieh'

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

interface ClaimBundle {
  claimedBy?: string
  actionComplete: boolean
  overdue: boolean
  notified: boolean
  buttonStyle: ClaimButtonStyle
  urgent: boolean
  flashingStyle?: FlashingStyle
  colorMode: ClaimColorMode
  buttonWidth: ClaimButtonWidth
  onClaim: () => void
  onRelease: () => void
  onTakeOver: () => void
  onMarkComplete: () => void
  onNotify: () => void
  onViewGps: () => void
  onViewSchedule: () => void
  onSendAnnouncement: () => void
  onCreateIncident: () => void
}

/* ── Claim / release / take-over / mark-complete control. While unclaimed,
   the CTA is an urgent flashing button (text/icon per "Claim button style").
   Once claimed or completed it's no longer actionable by clicking it — so it
   drops the button chrome entirely and reads as plain status text — plus a
   "More actions" menu for release/take-over/mark-complete. ── */
function ClaimControl({ accent, claim, compact }: { accent: string; claim: ClaimBundle; compact?: boolean }) {
  const {
    claimedBy, actionComplete, overdue, notified, buttonStyle, urgent, colorMode, buttonWidth, flashingStyle,
    onClaim, onRelease, onTakeOver, onMarkComplete,
    onNotify, onViewGps, onViewSchedule, onSendAnnouncement, onCreateIncident,
  } = claim
  const isMine = claimedBy === CURRENT_USER
  const settled = actionComplete || !!claimedBy
  const label = actionComplete ? 'Action complete' : claimedBy ? `Claimed by ${firstName(claimedBy)}` : 'Claim'
  const showIcon = buttonStyle !== 'text'
  const showText = buttonStyle !== 'icon'
  // Primary state (immediate): filled red. Secondary state (at-risk/stable): outline grey.
  const btnBg = urgent ? '#ff4d4f' : 'transparent'
  const btnColor = urgent ? '#fff' : '#595959'
  const btnBorder = urgent ? '#ff4d4f' : '#d9d9d9'
  const isFullWidth = buttonWidth === 'full'

  // Order follows biz req 2.3's "More actions" list verbatim
  const items = [
    { key: 'gps', label: 'View trip GPS report', icon: <AimOutlined />, onClick: onViewGps },
    { key: 'schedule', label: 'View daily schedule details', icon: <FileTextOutlined />, onClick: onViewSchedule },
    { key: 'notify', label: notified ? 'Notified' : 'Send notification to driver', icon: <BellOutlined />, disabled: notified, onClick: onNotify },
    { key: 'announce', label: 'Send announcement to passengers', icon: <SoundOutlined />, onClick: onSendAnnouncement },
    { key: 'incident', label: 'Create incident', icon: <AlertOutlined />, onClick: onCreateIncident },
    ...(claimedBy && isMine && !actionComplete
      ? [{ key: 'release', label: 'Release trip', icon: <LogoutOutlined />, onClick: onRelease }]
      : []),
    ...(claimedBy && !isMine && !actionComplete
      ? [{ key: 'takeover', label: 'Take over trip', icon: <SwapOutlined />, onClick: onTakeOver }]
      : []),
    { key: 'complete', label: 'Mark as action complete', icon: <FlagOutlined />, disabled: actionComplete, onClick: onMarkComplete },
    { key: 'maps', label: 'Open driver location in Google Maps', icon: <EnvironmentOutlined />, disabled: true },
  ]

  const cta = settled ? (
    <div
      style={{
        flex: compact ? undefined : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        minWidth: 0,
        height: 24,
        fontSize: 11.5,
        fontWeight: 400,
        color: '#8c8c8c',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </div>
  ) : (
    <Button
      size="small"
      className={urgent ? (flashingStyle && flashingStyle !== 'none' ? (flashingStyle === 'pulse' ? 'tab-urgent-pulse' : `flash-${flashingStyle}`) : undefined) : undefined}
      icon={showIcon ? <CheckOutlined style={{ fontSize: 10 }} /> : undefined}
      onClick={onClaim}
      style={{
        flex: (!compact && isFullWidth) ? 1 : undefined,
        width: (compact || !isFullWidth) ? undefined : undefined,
        height: 24,
        fontSize: 11.5,
        fontWeight: 600,
        padding: showText ? undefined : 0,
        background: btnBg,
        color: btnColor,
        borderColor: btnBorder,
      }}
    >
      {showText ? 'Claim' : undefined}
    </Button>
  )

  return (
    <div style={{ marginTop: compact ? 0 : 8 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: !settled && !isFullWidth ? 'flex-end' : undefined }}>
        {!settled && !showText ? <Tooltip title="Claim">{cta}</Tooltip> : cta}
        <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
          <Button size="small" icon={<MoreOutlined />} style={{ height: 24, width: 24, padding: 0, flexShrink: 0 }} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      </div>
      {!compact && overdue && !actionComplete && (
        <Text style={{ fontSize: 10, color: '#ff4d4f', fontWeight: 600, display: 'block', marginTop: 3 }}>
          ⚠ Alert sent to management
        </Text>
      )}
    </div>
  )
}

function TripGridCard({
  stop,
  variant,
  selected,
  expanded,
  handled,
  showAction,
  claim,
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
  showAction: boolean
  claim?: ClaimBundle
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
  // open the tooltip or drawer first — hidden when "Action placement" is
  // set to Detail, where the action only lives in the docked panel.
  // In Claim workflow mode this becomes the claim/release/take-over control.
  const takeItBtn = showAction && !claim && urgent && !handled && (
    <Button
      size="small"
      icon={<CheckOutlined style={{ fontSize: 10 }} />}
      onClick={(e) => { e.stopPropagation(); onTake() }}
      style={{ width: '100%', marginTop: 8, fontSize: 11.5, height: 24 }}
    >
      Take it
    </Button>
  )
  const claimControl = showAction && claim && <ClaimControl accent={color} claim={claim} />
  const actionControl = claim ? claimControl : takeItBtn
  const viewDetailBtn = (
    <Button
      type="link"
      size="small"
      icon={<EyeOutlined style={{ fontSize: 11 }} />}
      onClick={(e) => { e.stopPropagation(); onViewDetail() }}
      style={{ padding: 0, fontSize: 11, height: 'auto', marginTop: 4, display: 'block' }}
    >
      View detail
    </Button>
  )
  // Trello-style assignee badge — once a trip is taken/claimed, a small
  // avatar pins to the card's corner regardless of where the action itself
  // lives. Kept inside the card's own bounds (not overlapping the edge)
  // since several variants clip their content to round the left accent strip.
  const badgeName = claim ? (claim.claimedBy ?? (claim.actionComplete ? CURRENT_USER : undefined)) : handled ? CURRENT_USER : undefined
  const handledBadge = badgeName && (
    <div
      title={`Taken by ${badgeName}`}
      style={{
        position: 'absolute',
        top: 5,
        right: 5,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#597ef7',
        color: '#fff',
        fontSize: 8.5,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1.5px solid #fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        zIndex: 1,
      }}
    >
      {initialsOf(badgeName)}
    </div>
  )

  if (variant === 'split') {
    return (
      <div
        ref={innerRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={{ position: 'relative', display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        {handledBadge}
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingRight: badgeName ? 20 : 0 }}>
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
          {actionControl}
          {viewDetailBtn}
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
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, padding: '8px 10px', paddingRight: badgeName ? 22 : 10, cursor: 'pointer', minWidth: 0 }}
      >
        {handledBadge}
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {routeChip}
        <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{stop.plate}</Text>
          <Text style={{ fontSize: 10.5, color: '#8c8c8c' }}>{start}</Text>
        </div>
        {showAction && claim ? (
          <div style={{ width: 118, flexShrink: 0 }}>
            <ClaimControl accent={color} claim={claim} compact />
          </div>
        ) : (
          showAction && urgent && !handled && (
            <Tooltip title="Take it">
              <Button
                size="small"
                shape="circle"
                icon={<CheckOutlined style={{ fontSize: 10 }} />}
                onClick={(e) => { e.stopPropagation(); onTake() }}
                style={{ flexShrink: 0 }}
              />
            </Tooltip>
          )
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
        style={{ position: 'relative', display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        {handledBadge}
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: badgeName ? 20 : 0 }}>
            {routeChip}
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
          {actionControl}
          {viewDetailBtn}
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
        style={{ position: 'relative', display: 'flex', background: expanded ? '#f0f7ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        {handledBadge}
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: badgeName ? 20 : 0 }}>
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
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <Button size="small" type="primary" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); onViewDetail() }} style={{ flex: 1, fontSize: 11.5 }}>
                  View detail
                </Button>
                {showAction && !claim && urgent && !handled && (
                  <Button size="small" icon={<CheckOutlined style={{ fontSize: 10 }} />} onClick={(e) => { e.stopPropagation(); onTake() }} style={{ fontSize: 11.5 }}>
                    Take it
                  </Button>
                )}
              </div>
              {showAction && claim && <ClaimControl accent={color} claim={claim} compact />}
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
        style={{ position: 'relative', display: 'flex', gap: 10, background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, padding: '9px 11px', cursor: 'pointer', minWidth: 0 }}
      >
        {handledBadge}
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: badgeName ? 20 : 0 }}>
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
          {actionControl}
          {viewDetailBtn}
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
        style={{ position: 'relative', display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        {handledBadge}
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: badgeName ? 20 : 0 }}>
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
          {actionControl}
          {viewDetailBtn}
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
        style={{ position: 'relative', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
      >
        {handledBadge}
        <div style={{ background: color, padding: '5px 11px', paddingRight: badgeName ? 24 : 11, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
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
          {actionControl}
          {viewDetailBtn}
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
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', minWidth: 0, height: 36 }}
      >
        {badgeName && (
          <div
            title={`Taken by ${badgeName}`}
            style={{
              width: 18, height: 18, borderRadius: '50%', background: '#597ef7', color: '#fff',
              fontSize: 8.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {initialsOf(badgeName)}
          </div>
        )}
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1677ff', width: 46, flexShrink: 0 }}>{stop.label}</span>
        <Text style={{ fontSize: 11.5, color: '#8c8c8c', width: 58, flexShrink: 0 }}>{start}</Text>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', flex: 1, minWidth: 0 }} ellipsis>{name}</Text>
        <Text style={{ fontSize: 11.5, color: '#8c8c8c', width: 62, flexShrink: 0, textAlign: 'right' }}>{stop.plate}</Text>
        <span style={{ fontSize: 10.5, fontWeight: 600, color, width: 52, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>{statusLabel}</span>
        {showAction && claim ? (
          <div style={{ width: 100, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <ClaimControl accent={color} claim={claim} compact />
          </div>
        ) : (
          showAction && urgent && !handled && (
            <Tooltip title="Take it">
              <Button
                size="small"
                shape="circle"
                icon={<CheckOutlined style={{ fontSize: 10 }} />}
                onClick={(e) => { e.stopPropagation(); onTake() }}
                style={{ flexShrink: 0 }}
              />
            </Tooltip>
          )
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
        position: 'relative',
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
      {handledBadge}
      <span style={{ width: 4, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: badgeName ? 20 : 0 }}>
          {routeChip}
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{start}</Text>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap', flexShrink: 0 }}>{statusLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minWidth: 0 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
          <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
        </div>
        {actionControl}
        {viewDetailBtn}
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
  { key: 'immediate', label: 'Immediate Attention', color: '#ff4d4f', soft: '#fff1f0', border: '#ffccc7' },
  { key: 'risk', label: 'At Risk', color: '#faad14', soft: '#fffbe6', border: '#ffe58f' },
  { key: 'stable', label: 'Stable', color: '#16a34a', soft: '#f6ffed', border: '#b7eb8f' },
]

const DH_L2_META: Record<Exclude<DhLevel1, 'stable'>, { key: DhLevel2; label: string; short: string }[]> = {
  immediate: [
    { key: 'cur-first', label: 'Late (First Point)', short: 'Late (First Point)' },
    { key: 'will-first', label: 'Will be Late (First Point)', short: 'Will be Late (1st)' },
    { key: 'next', label: 'Next Trip Delayed', short: 'Next Trip' },
    { key: 'offline', label: 'ETA Unavailable', short: 'ETA Unavail.' },
  ],
  risk: [
    { key: 'cur-other', label: 'Late (Other Points)', short: 'Late (Other Points)' },
    { key: 'will-other', label: 'Will be Late (Other Points)', short: 'Will be Late (Others)' },
    { key: 'no-slack', label: 'No Schedule Slack', short: 'No Slack' },
  ],
}

const DH_L1_ICON: Record<DhLevel1, React.ComponentType<{ style?: React.CSSProperties }>> = {
  immediate: ExclamationCircleFilled,
  risk: WarningFilled,
  stable: CheckCircleFilled,
}

/* ── "2 Levels (Cards)" — a distinct visual for the same two-tier system:
   level 1 as dashboard tiles with an icon badge instead of pills, level 2
   as underline tabs instead of chips. ── */
function TwoLevelCardHeader({
  level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change,
  rightSlot, l2Spacing = 12, l2MatchL1Width = false, flashingStyle = 'pulse',
  l1FontSize = 24, l2FontSize = 11,
}: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1Tiles = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, flex: l2MatchL1Width ? undefined : 1 }}>
      {DH_L1_META.map((m) => {
        const active = level1 === m.key
        const Icon = DH_L1_ICON[m.key]
        const hot = m.key === 'immediate' && l1Counts.immediate > 0 && level1 === null
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, hot, active)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px 10px 10px', borderRadius: 10,
              border: `1.5px solid ${active ? m.color : '#f0f0f0'}`,
              background: active ? m.soft : '#fff',
              cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <Text style={{ fontSize: l1FontSize, fontWeight: active ? 800 : 600, color: active ? m.color : '#1a1a1a', lineHeight: 1, display: 'block' }}>{l1Counts[m.key]}</Text>
              <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? m.color : '#595959', whiteSpace: 'nowrap' }}>{m.label}</Text>
            </div>
          </button>
        )
      })}
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px 10px 10px', borderRadius: 10,
          border: `1.5px solid ${level1 === null ? '#595959' : '#f0f0f0'}`,
          background: level1 === null ? '#e6f4ff' : '#fff',
          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
        }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AppstoreOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Text style={{ fontSize: l1FontSize, fontWeight: level1 === null ? 800 : 600, color: level1 === null ? '#595959' : '#1a1a1a', lineHeight: 1, display: 'block' }}>{totalCount}</Text>
          <Text style={{ fontSize: 12, fontWeight: level1 === null ? 700 : 400, color: level1 === null ? '#595959' : '#595959', whiteSpace: 'nowrap' }}>All</Text>
        </div>
      </button>
    </div>
  )
  const l2Tabs = level1 !== null && level1 !== 'stable' && (
    <div style={{ display: 'flex', gap: 0, flexWrap: 'nowrap', borderBottom: '1px solid #f0f0f0', marginTop: 8 }}>
      {DH_L2_META[level1].map((m) => {
        const active = level2 === m.key
        const count = l2Counts[m.key] ?? 0
        return (
          <button
            key={m.key}
            onClick={() => onLevel2Change(active ? null : m.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              textAlign: 'center', padding: '8px 10px', marginBottom: -1,
              border: 'none', borderBottom: `2px solid ${active ? '#1677ff' : 'transparent'}`,
              background: 'transparent', color: active ? '#1677ff' : count === 0 ? '#bfbfbf' : '#595959',
              fontSize: l2FontSize, fontWeight: active ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
            }}
          >
            {m.short}
            <span style={{ minWidth: 22, height: 22, borderRadius: 11, padding: '0 6px', background: active ? '#1677ff' : count === 0 ? '#f0f0f0' : '#fff1f0', color: active ? '#fff' : count === 0 ? '#bfbfbf' : '#ff4d4f', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
          </button>
        )
      })}
    </div>
  )
  if (l2MatchL1Width) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{l1Tiles}{l2Tabs}</div>
        {rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}
      </div>
    )
  }
  return <><div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{l1Tiles}{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>{l2Tabs}</>
}

/* ── Minimalist two-level header — no colored icon tiles, just a thin
   underline-tab row for L1 and compact chips for L2. Lighter visual weight
   than TwoLevelCardHeader, works better when screen space is tight. ── */
function TwoLevelMinimalHeader({
  level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change,
  rightSlot, l2Spacing = 12, l2MatchL1Width = false, flashingStyle = 'pulse',
  l1FontSize = 24, l2FontSize = 11,
}: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1Tabs = (
    <div style={{ display: 'flex', flex: l2MatchL1Width ? undefined : 1, borderBottom: l2MatchL1Width ? undefined : '1px solid #f0f0f0' }}>
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '10px 8px', marginBottom: l2MatchL1Width ? undefined : -1,
          border: 'none', borderBottom: `2px solid ${level1 === null ? '#595959' : 'transparent'}`,
          background: level1 === null ? '#e6f4ff' : 'transparent', cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <Text style={{ fontSize: l1FontSize, fontWeight: level1 === null ? 800 : 600, color: level1 === null ? '#595959' : '#1a1a1a', lineHeight: 1 }}>{totalCount}</Text>
        <Text style={{ fontSize: 11, fontWeight: level1 === null ? 700 : 400, color: level1 === null ? '#595959' : '#8c8c8c', whiteSpace: 'nowrap' }}>All</Text>
      </button>
      {DH_L1_META.map((m) => {
        const active = level1 === m.key
        const hot = m.key === 'immediate' && l1Counts.immediate > 0 && level1 === null
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, hot, active)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '10px 8px 10px', marginBottom: l2MatchL1Width ? undefined : -1,
              border: 'none', borderBottom: `2px solid ${active ? m.color : 'transparent'}`,
              background: active ? m.soft : 'transparent', cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
              <Text style={{ fontSize: l1FontSize, fontWeight: active ? 800 : 600, color: active ? m.color : '#1a1a1a', lineHeight: 1 }}>{l1Counts[m.key]}</Text>
            </div>
            <Text style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? m.color : '#8c8c8c', whiteSpace: 'nowrap' }}>{m.label}</Text>
          </button>
        )
      })}
    </div>
  )
  const l2Chips = level1 !== null && level1 !== 'stable' && (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, marginTop: 8 }}>
      {DH_L2_META[level1].map((m) => {
        const active = level2 === m.key
        const count = l2Counts[m.key] ?? 0
        return (
          <button
            key={m.key}
            onClick={() => onLevel2Change(active ? null : m.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              textAlign: 'center', padding: '4px 8px', borderRadius: 6,
              border: `1px solid ${active ? '#1677ff' : '#e8e8e8'}`,
              background: active ? '#e6f4ff' : '#fafafa',
              color: active ? '#1677ff' : count === 0 ? '#bfbfbf' : '#595959',
              fontSize: l2FontSize, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
            }}
          >
            {m.short}
            <span style={{ minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px', background: active ? '#1677ff' : '#f0f0f0', color: active ? '#fff' : count === 0 ? '#bfbfbf' : '#595959', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
          </button>
        )
      })}
    </div>
  )
  if (l2MatchL1Width) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 0 }}>
        <div>{l1Tabs}{l2Chips}</div>
        {rightSlot && <div style={{ flexShrink: 0, paddingBottom: 6, marginLeft: 'auto' }}>{rightSlot}</div>}
      </div>
    )
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0' }}>
        {l1Tabs}
        {rightSlot && <div style={{ flexShrink: 0, paddingBottom: 6 }}>{rightSlot}</div>}
      </div>
      {l2Chips}
    </>
  )
}

// Shared prop shape for all two-level header variants
interface TwoLevelHeaderProps {
  level1: DhLevel1 | null
  level2: DhLevel2 | null
  l1Counts: Record<DhLevel1, number>
  l2Counts: Record<string, number>
  onLevel1Change: (v: DhLevel1 | null) => void
  onLevel2Change: (v: DhLevel2 | null) => void
  rightSlot?: React.ReactNode
  l2Spacing?: L2Spacing
  l2MatchL1Width?: boolean
  flashingStyle?: FlashingStyle
  boxPadding?: number
  l1FontSize?: number
  l2FontSize?: number
}

// Shared L2 chip row used by all two-level header variants.
// flushLeft=true: chips take natural width, left-aligned (pill style).
// flushLeft=false (default): chips stretch equally across full width (underline-tab style).
function TwoLevelL2Chips({ level1, level2, l2Counts, onLevel2Change, l2Spacing = 12, flushLeft = false, l2FontSize = 11 }: {
  level1: DhLevel1 | null; level2: DhLevel2 | null
  l2Counts: Record<string, number>; onLevel2Change: (v: DhLevel2 | null) => void
  l2Spacing?: L2Spacing
  flushLeft?: boolean
  l2FontSize?: number
}) {
  if (level1 === null || level1 === 'stable') return null
  if (flushLeft) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {DH_L2_META[level1].map((m) => {
          const active = level2 === m.key
          const count = l2Counts[m.key] ?? 0
          return (
            <button
              key={m.key}
              onClick={() => onLevel2Change(active ? null : m.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 16,
                border: `1px solid ${active ? '#1677ff' : '#e8e8e8'}`,
                background: active ? '#e6f4ff' : '#fafafa',
                color: active ? '#1677ff' : count === 0 ? '#bfbfbf' : '#595959',
                fontSize: l2FontSize, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {m.short}
              <span style={{
                minWidth: 22, height: 22, borderRadius: 11, padding: '0 6px',
                background: active ? '#1677ff' : count === 0 ? '#f0f0f0' : '#fff1f0',
                color: active ? '#fff' : count === 0 ? '#bfbfbf' : '#ff4d4f',
                fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 0, flexWrap: 'nowrap', marginTop: 8, borderBottom: '1px solid #f0f0f0' }}>
      {DH_L2_META[level1].map((m) => {
        const active = level2 === m.key
        const count = l2Counts[m.key] ?? 0
        return (
          <button
            key={m.key}
            onClick={() => onLevel2Change(active ? null : m.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              textAlign: 'center', padding: '6px 8px', marginBottom: -1,
              border: 'none', borderBottom: `2px solid ${active ? '#1677ff' : 'transparent'}`,
              background: 'transparent',
              color: active ? '#1677ff' : count === 0 ? '#bfbfbf' : '#595959',
              fontSize: l2FontSize, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >
            {m.short}
            <span style={{
              minWidth: 22, height: 22, borderRadius: 11, padding: '0 6px',
              background: active ? '#1677ff' : count === 0 ? '#f0f0f0' : '#fff1f0',
              color: active ? '#fff' : count === 0 ? '#bfbfbf' : '#ff4d4f',
              fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Banner variant: active category fills with its color, inactive categories
   are compact text segments. Equal-width columns, no icon badges. ── */
function TwoLevelBannerHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, flashingStyle = 'pulse', l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1 = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, flex: l2MatchL1Width ? undefined : 1, borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      {DH_L1_META.map((m, i) => {
        const active = level1 === m.key
        const Icon = DH_L1_ICON[m.key]
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, m.key === 'immediate' && l1Counts.immediate > 0, active)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '13px 8px', background: active ? m.color : '#fafafa',
              border: 'none', borderRight: i < 2 ? `1px solid ${active ? 'rgba(255,255,255,.25)' : '#e8e8e8'}` : 'none',
              cursor: 'pointer', transition: 'background .18s',
            }}
          >
            {active && <Icon style={{ color: 'rgba(255,255,255,.8)', fontSize: 13 }} />}
            <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: active ? '#fff' : m.color, lineHeight: 1 }}>{l1Counts[m.key]}</Text>
            <Text style={{ fontSize: 10.5, fontWeight: active ? 700 : 400, color: active ? 'rgba(255,255,255,.85)' : '#8c8c8c', whiteSpace: 'nowrap' }}>{m.label}</Text>
          </button>
        )
      })}
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 3, padding: '13px 8px', background: level1 === null ? '#595959' : '#fafafa',
          border: 'none', borderRight: 'none',
          cursor: 'pointer', transition: 'background .18s',
        }}
      >
        <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: level1 === null ? '#fff' : '#1677ff', lineHeight: 1 }}>{totalCount}</Text>
        <Text style={{ fontSize: 10.5, fontWeight: level1 === null ? 700 : 400, color: level1 === null ? 'rgba(255,255,255,.85)' : '#8c8c8c', whiteSpace: 'nowrap' }}>All</Text>
      </button>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div>{l1}{l2}</div>{rightSlot && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{rightSlot}</div>}</div>
  return <><div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>{l1}{rightSlot && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{rightSlot}</div>}</div>{l2}</>
}

/* ── Stats variant: horizontal strip with a large colored number, label, and
   a colored left-accent bar on the active item. Clean and data-table-like. ── */
function TwoLevelStatsHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, flashingStyle = 'pulse', l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1 = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', flex: l2MatchL1Width ? undefined : 1, borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      {DH_L1_META.map((m, i) => {
        const active = level1 === m.key
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, m.key === 'immediate' && l1Counts.immediate > 0, active)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              border: 'none', borderLeft: `3px solid ${active ? m.color : 'transparent'}`,
              borderRight: i < 2 ? '1px solid #f0f0f0' : 'none',
              background: active ? m.soft : '#fff', cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: m.color, lineHeight: 1, flexShrink: 0 }}>{l1Counts[m.key]}</Text>
            <Text style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#1a1a1a' : '#8c8c8c', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{m.label}</Text>
          </button>
        )
      })}
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          border: 'none', borderLeft: `3px solid ${level1 === null ? '#595959' : 'transparent'}`,
          borderRight: 'none',
          background: level1 === null ? '#e6f4ff' : '#fff', cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: '#1677ff', lineHeight: 1, flexShrink: 0 }}>{totalCount}</Text>
        <Text style={{ fontSize: 11, fontWeight: level1 === null ? 700 : 400, color: level1 === null ? '#595959' : '#8c8c8c', whiteSpace: 'nowrap', lineHeight: 1.3 }}>All</Text>
      </button>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div>{l1}{l2}</div>{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>
  return <><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{l1}{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>{l2}</>
}

/* ── Badge variant: compact pill-shaped buttons, each with a small filled
   count circle + label. Fits alongside other header controls without
   dominating the space. ── */
function TwoLevelBadgeHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, flashingStyle = 'pulse', l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1 = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: l2MatchL1Width ? undefined : 1 }}>
      {DH_L1_META.map((m) => {
        const active = level1 === m.key
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, m.key === 'immediate' && l1Counts.immediate > 0, active)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 12px 5px 6px', borderRadius: 20,
              border: `1.5px solid ${active ? m.color : '#e8e8e8'}`,
              background: active ? m.soft : '#fff', cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: m.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{l1Counts[m.key]}</span>
            <Text style={{ fontSize: 12, color: active ? m.color : '#595959', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{m.label}</Text>
          </button>
        )
      })}
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 12px 5px 6px', borderRadius: 20,
          border: `1.5px solid ${level1 === null ? '#595959' : '#e8e8e8'}`,
          background: level1 === null ? '#e6f4ff' : '#fff', cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: '#1677ff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{totalCount}</span>
        <Text style={{ fontSize: 12, color: level1 === null ? '#595959' : '#595959', fontWeight: level1 === null ? 600 : 400, whiteSpace: 'nowrap' }}>All</Text>
      </button>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}><div>{l1}{l2}</div>{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>
  return <><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{l1}{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>{l2}</>
}

/* ── Progress variant: a proportional stacked bar showing the share of trips
   in each category + compact label row below. The bar itself is clickable.
   Gives a clear at-a-glance sense of how many trips are at each severity. ── */
function TwoLevelProgressHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const total = (l1Counts.immediate + l1Counts.risk + l1Counts.stable) || 1
  const l1 = (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 9 }}>
        {DH_L1_META.map((m) => (
          <div
            key={m.key}
            role="button"
            tabIndex={0}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onLevel1Change(m.key); onLevel2Change(null) } }}
            style={{
              flex: l1Counts[m.key] || 0.5,
              background: level1 === m.key ? m.color : `${m.color}55`,
              borderRadius: 3, cursor: 'pointer', transition: 'all .25s',
              minWidth: 6,
            }}
            title={`${m.label}: ${l1Counts[m.key]} (${Math.round((l1Counts[m.key] / total) * 100)}%)`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {DH_L1_META.map((m) => {
          const active = level1 === m.key
          const pct = Math.round((l1Counts[m.key] / total) * 100)
          return (
            <button
              key={m.key}
              onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16,
                border: `1px solid ${active ? m.color : 'transparent'}`,
                background: active ? m.soft : 'transparent',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
              <Text style={{ fontSize: 12, color: active ? m.color : '#595959', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>
                {m.label}
              </Text>
              <Text style={{ fontSize: 11, color: active ? m.color : '#bfbfbf', fontWeight: 700 }}>
                {l1Counts[m.key]}
              </Text>
              <Text style={{ fontSize: 10, color: '#bfbfbf' }}>{pct}%</Text>
            </button>
          )
        })}
        <button
          onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16,
            border: `1px solid ${level1 === null ? '#595959' : 'transparent'}`,
            background: level1 === null ? '#e6f4ff' : 'transparent',
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <AppstoreOutlined style={{ fontSize: 8, color: '#1677ff', flexShrink: 0 }} />
          <Text style={{ fontSize: 12, color: level1 === null ? '#595959' : '#595959', fontWeight: level1 === null ? 600 : 400, whiteSpace: 'nowrap' }}>All</Text>
          <Text style={{ fontSize: 11, color: level1 === null ? '#595959' : '#bfbfbf', fontWeight: 700 }}>{total}</Text>
        </button>
      </div>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div>{l1}{l2}</div>{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>{l1}</div>
        {rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}
      </div>
      {l2}
    </>
  )
}

/* ── Inline variant: single left-aligned row — count + label per category,
   no box chrome, only the active item gets a colored underline. ── */
function TwoLevelInlineHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, flashingStyle = 'pulse', l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1 = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {DH_L1_META.map((m, i) => {
        const active = level1 === m.key
        const hot = m.key === 'immediate' && l1Counts.immediate > 0 && level1 === null
        return (
          <>
            {i > 0 && <span key={`sep-${m.key}`} style={{ width: 1, height: 22, background: '#e8e8e8', flexShrink: 0, margin: '0 6px' }} />}
            <button
              key={m.key}
              onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
              className={flashCls(flashingStyle, hot, active)}
              style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                background: 'none', border: 'none', borderBottom: `2px solid ${active ? m.color : 'transparent'}`,
                padding: '6px 4px 7px', cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: m.color, lineHeight: 1 }}>{l1Counts[m.key]}</Text>
              <Text style={{ fontSize: 12.5, fontWeight: active ? 700 : 400, color: active ? m.color : '#595959', whiteSpace: 'nowrap' }}>{m.label}</Text>
            </button>
          </>
        )
      })}
      <span style={{ width: 1, height: 22, background: '#e8e8e8', flexShrink: 0, margin: '0 6px' }} />
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          background: 'none', border: 'none', borderBottom: `2px solid ${level1 === null ? '#595959' : 'transparent'}`,
          padding: '6px 4px 7px', cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: '#1677ff', lineHeight: 1 }}>{totalCount}</Text>
        <Text style={{ fontSize: 12.5, fontWeight: level1 === null ? 700 : 400, color: level1 === null ? '#595959' : '#595959', whiteSpace: 'nowrap' }}>All</Text>
      </button>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} flushLeft l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div>{l1}{l2}</div>{rightSlot && <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{rightSlot}</div>}</div>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {l1}
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{rightSlot}</div>
      </div>
      {l2}
    </>
  )
}

/* ── Panel variant: left-aligned natural-width cards, each with a colored
   top accent border, big count, and label. Cards don't stretch. ── */
function TwoLevelPanelHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, flashingStyle = 'pulse', boxPadding = 10, l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1 = (
    <div style={{ display: 'flex', gap: 8 }}>
      {DH_L1_META.map((m) => {
        const active = level1 === m.key
        // Only pulse in the "All" view (level1 === null) — when a specific
        // category is already selected, the pulse on other tiles creates a
        // false impression that they're still active.
        const hot = m.key === 'immediate' && l1Counts.immediate > 0 && level1 === null && level1 === null
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, hot, active)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: `${boxPadding}px 16px ${boxPadding}px 14px`,
              borderRadius: 10,
              border: `1.5px solid ${active ? m.color : '#f0f0f0'}`,
              borderTop: `3px solid ${m.color}`,
              background: active ? m.soft : '#fff',
              cursor: 'pointer', transition: 'all .15s',
              minWidth: 106,
            }}
          >
            <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: m.color, lineHeight: 1, display: 'block' }}>{l1Counts[m.key]}</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, color: active ? m.color : '#595959', marginTop: 4, whiteSpace: 'nowrap', lineHeight: 1.3 }}>{m.label}</Text>
          </button>
        )
      })}
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          padding: `${boxPadding}px 16px ${boxPadding}px 14px`,
          borderRadius: 10,
          border: `1.5px solid ${level1 === null ? '#595959' : '#f0f0f0'}`,
          borderTop: `3px solid ${level1 === null ? '#595959' : '#bfbfbf'}`,
          background: level1 === null ? '#f0f0f0' : '#fff',
          cursor: 'pointer', transition: 'all .15s',
          minWidth: 106,
        }}
      >
        <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: '#595959', lineHeight: 1, display: 'block' }}>{totalCount}</Text>
        <Text style={{ fontSize: 12, fontWeight: 700, color: '#595959', marginTop: 4, whiteSpace: 'nowrap', lineHeight: 1.3 }}>All</Text>
      </button>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} flushLeft l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div>{l1}{l2}</div>{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {l1}
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{rightSlot}</div>
      </div>
      {l2}
    </>
  )
}

/* ── Metro variant: fixed-width solid-color tiles, left-aligned. Active tile
   fills with its category color; inactive tiles show a soft tint. ── */
function TwoLevelMetroHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, flashingStyle = 'pulse', l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1 = (
    <div style={{ display: 'flex', gap: 6 }}>
      {DH_L1_META.map((m) => {
        const active = level1 === m.key
        const hot = m.key === 'immediate' && l1Counts.immediate > 0 && level1 === null
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, hot, active)}
            style={{
              width: 114, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '12px 14px',
              borderRadius: 10,
              background: active ? m.color : m.soft,
              border: `1.5px solid ${active ? m.color : m.border}`,
              cursor: 'pointer', transition: 'all .2s',
            }}
          >
            <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: active ? '#fff' : m.color, lineHeight: 1, display: 'block' }}>{l1Counts[m.key]}</Text>
            <Text style={{ fontSize: 11.5, fontWeight: 700, color: active ? 'rgba(255,255,255,.88)' : '#595959', marginTop: 5, lineHeight: 1.3 }}>{m.label}</Text>
          </button>
        )
      })}
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          width: 114, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          padding: '12px 14px',
          borderRadius: 10,
          background: level1 === null ? '#595959' : '#f5f5f5',
          border: `1.5px solid ${level1 === null ? '#595959' : '#bfbfbf'}`,
          cursor: 'pointer', transition: 'all .2s',
        }}
      >
        <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: level1 === null ? '#fff' : '#595959', lineHeight: 1, display: 'block' }}>{totalCount}</Text>
        <Text style={{ fontSize: 11.5, fontWeight: 700, color: level1 === null ? 'rgba(255,255,255,.88)' : '#595959', marginTop: 5, lineHeight: 1.3 }}>All</Text>
      </button>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} flushLeft l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div>{l1}{l2}</div>{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {l1}
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{rightSlot}</div>
      </div>
      {l2}
    </>
  )
}

/* ── Equal Width variant: same as Panel but all 4 boxes (including "All")
   share equal flex-1 width. Padding adjustable via boxPadding prop. ── */
function TwoLevelEqualHeader({ level1, level2, l1Counts, l2Counts, onLevel1Change, onLevel2Change, rightSlot, l2Spacing, l2MatchL1Width = false, flashingStyle = 'pulse', boxPadding = 10, l1FontSize = 24, l2FontSize = 11 }: TwoLevelHeaderProps) {
  const totalCount = l1Counts.immediate + l1Counts.risk + l1Counts.stable
  const l1 = (
    <div style={{ display: 'flex', gap: 8, flex: l2MatchL1Width ? undefined : 1 }}>
      {DH_L1_META.map((m) => {
        const active = level1 === m.key
        const hot = m.key === 'immediate' && l1Counts.immediate > 0 && level1 === null
        return (
          <button
            key={m.key}
            onClick={() => { onLevel1Change(m.key); onLevel2Change(null) }}
            className={flashCls(flashingStyle, hot, active)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: `${boxPadding}px 16px ${boxPadding}px 14px`,
              borderRadius: 10,
              border: `1.5px solid ${active ? m.color : '#f0f0f0'}`,
              borderTop: `3px solid ${m.color}`,
              background: active ? m.soft : '#fff',
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: m.color, lineHeight: 1, display: 'block' }}>{l1Counts[m.key]}</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, color: active ? m.color : '#595959', marginTop: 4, whiteSpace: 'nowrap', lineHeight: 1.3 }}>{m.label}</Text>
          </button>
        )
      })}
      <button
        onClick={() => { onLevel1Change(null); onLevel2Change(null) }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          padding: `${boxPadding}px 16px ${boxPadding}px 14px`,
          borderRadius: 10,
          border: `1.5px solid ${level1 === null ? '#595959' : '#f0f0f0'}`,
          borderTop: `3px solid ${level1 === null ? '#595959' : '#bfbfbf'}`,
          background: level1 === null ? '#f0f0f0' : '#fff',
          cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <Text style={{ fontSize: l1FontSize, fontWeight: 800, color: '#595959', lineHeight: 1, display: 'block' }}>{totalCount}</Text>
        <Text style={{ fontSize: 12, fontWeight: 700, color: '#595959', marginTop: 4, whiteSpace: 'nowrap', lineHeight: 1.3 }}>All</Text>
      </button>
    </div>
  )
  const l2 = <TwoLevelL2Chips level1={level1} level2={level2} l2Counts={l2Counts} onLevel2Change={onLevel2Change} l2Spacing={l2Spacing} flushLeft l2FontSize={l2FontSize} />
  if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div>{l1}{l2}</div>{rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}</div>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {l1}
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{rightSlot}</div>
      </div>
      {l2}
    </>
  )
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

  // PRD 4.1 categorisation rules:
  // Immediate: ETA unavailable/offline, Late(FP), Will be Late(FP), Next trip delayed
  // At Risk:   Late(OP), Will be Late(OP), No schedule slack
  if (!stop.online) return { l1: 'immediate', l2: 'offline', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (currentDelayMin > 0 && atFirstPoint) return { l1: 'immediate', l2: 'cur-first', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (currentDelayMin > 0) return { l1: 'risk', l2: 'cur-other', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (nextTripDelayMin > 0) return { l1: 'immediate', l2: 'next', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (predictedDelayMin > 0 && atFirstPoint) return { l1: 'immediate', l2: 'will-first', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (predictedDelayMin > 0) return { l1: 'risk', l2: 'will-other', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  if (slackMin <= 5) return { l1: 'risk', l2: 'no-slack', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  return { l1: 'stable', l2: null, currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
}

/* ── Mock contact / next-trip data generators — deterministic from stop id ── */
const PHONE_PREFIXES = ['+65 8', '+65 9']
const PIC_NAMES = ['Alice Tan', 'Ben Lim', 'Carol Wong', 'David Ng', 'Emily Koh', 'Francis Lee']

function mockPhone(seed: number): string {
  const prefix = PHONE_PREFIXES[seed % 2]
  const digits = String((seed * 7919 + 12345) % 10000000).padStart(7, '0')
  return `${prefix}${digits}`
}

function mockPicName(seed: number): string {
  return PIC_NAMES[seed % PIC_NAMES.length]
}

function mockNextTrip(stop: VehicleStop): { routeCode: string; startTime: string; destination: string } {
  const h = dhHash(stop.id)
  const DESTS = ['Marina Bay Sands', 'Changi Airport T1', 'Jurong East MRT', 'Woodlands CK', 'Orchard Road']
  return {
    routeCode: `RT-${String((h * 31 + 17) % 900 + 100)}`,
    startTime: shiftTime(stop.scheduled, 90 + (h % 6) * 15),
    destination: DESTS[h % DESTS.length],
  }
}

function slackChipColors(slackMin: number): { color: string; bg: string; border: string } {
  if (slackMin < 0) return { color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' }
  if (slackMin <= 5) return { color: '#d48806', bg: '#fffbe6', border: '#ffe58f' }
  return { color: '#16a34a', bg: '#f6ffed', border: '#b7eb8f' }
}

// Derive a rich status label + badge style using l2 for FP/OP distinction.
// FP (first point) = amber; OP (other points) = orange.
function richStatus(stop: VehicleStop, info: DhInfo): { label: string; color: string; bg: string; border: string } {
  if (!stop.online) return { label: 'Offline', color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' }
  if (stop.notified) return { label: 'Notified', ...STATUS_STYLE['Notified'] }
  switch (info.l2) {
    case 'cur-first':  return { label: 'Late (First Point)',          color: '#d4b106', bg: '#fffbe6', border: '#ffe58f' }
    case 'cur-other':  return { label: 'Late (Other Points)',         color: '#d46b08', bg: '#fff7e6', border: '#ffd591' }
    case 'will-first': return { label: 'Will be Late (First Point)',  color: '#d4b106', bg: '#fffbe6', border: '#ffe58f' }
    case 'will-other': return { label: 'Will be Late (Other Points)', color: '#d46b08', bg: '#fff7e6', border: '#ffd591' }
  }
  const base = deriveStatus(stop)
  return { label: base, ...STATUS_STYLE[base] }
}

function DhGridCard({
  stop,
  info,
  selected,
  handled,
  showAction,
  claim,
  onClick,
  onViewDetail,
  onTake,
  innerRef,
  showDelayText = true,
  showDriverStatusText = true,
  slackPosition = 'row',
  showSlack = true,
}: {
  stop: VehicleStop
  info: DhInfo
  selected: boolean
  handled: boolean
  showAction: boolean
  claim?: ClaimBundle
  onClick: () => void
  onViewDetail?: () => void
  onTake: () => void
  innerRef: (el: HTMLDivElement | null) => void
  showDelayText?: boolean
  showDriverStatusText?: boolean
  slackPosition?: SlackPosition
  showSlack?: boolean
}) {
  const accent = info.l1 === 'immediate' ? '#ff4d4f' : info.l1 === 'risk' ? '#faad14' : '#16a34a'
  const rs = richStatus(stop, info)
  const statusLabel = rs.label
  const statusStyle = rs
  const urgent = !stop.online || (info.l1 === 'immediate' && info.l2 !== 'next')
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
      <div style={{ flex: 1, minWidth: 0, padding: '9px 11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11.5, fontWeight: 600, padding: '0 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stop.label}
          </span>
          <ClockCircleOutlined style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }} />
          <Text style={{ fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{formatTimeAmPm(stop.scheduled)}</Text>
          {slackPosition === 'inline' && showSlack && (
            <span style={{ background: slack.bg, color: slack.color, border: `1px solid ${slack.border}`, fontSize: 10.5, fontWeight: 600, padding: '0 6px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Slack {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin} min
            </span>
          )}
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
          <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', flexShrink: 0 }}>{firstName(stop.driver)}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
          {showDriverStatusText && (
            <Text style={{ fontSize: 10.5, color: stop.online ? '#16a34a' : '#ff4d4f', marginLeft: 'auto', flexShrink: 0 }}>{stop.online ? 'Online' : 'Offline'}</Text>
          )}
        </div>
        {((slackPosition === 'row' && showSlack) || (showDelays && showDelayText)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
            {slackPosition === 'row' && showSlack && (
              <span style={{ background: slack.bg, color: slack.color, border: `1px solid ${slack.border}`, fontSize: 10.5, fontWeight: 600, padding: '0 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                Slack {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin} min
              </span>
            )}
            {showDelays && showDelayText && (
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
        )}
        {showAction && (claim ? <ClaimControl accent={accent} claim={claim} /> : urgent && !handled && (
          <Button
            size="small"
            icon={<CheckOutlined style={{ fontSize: 10 }} />}
            onClick={(e) => { e.stopPropagation(); onTake() }}
            style={{ width: '100%', marginTop: 8, fontSize: 11.5, height: 24 }}
          >
            Take it
          </Button>
        ))}
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined style={{ fontSize: 11 }} />}
          onClick={(e) => { e.stopPropagation(); onViewDetail?.() }}
          style={{ padding: 0, fontSize: 11, height: 'auto', marginTop: 4, display: 'block' }}
        >
          View detail
        </Button>
      </div>
    </div>
  )
}

/* ── Internal card variant — suggested by the internal team.
   Route code badge left; trip status + slack chips right-aligned in the
   same row. Driver row below. Actions pinned bottom-right. ── */
function DhInternalCard({
  stop, info, selected, handled, showAction, claim, onClick, onTake, innerRef,
}: {
  stop: VehicleStop; info: DhInfo; selected: boolean; handled: boolean
  showAction: boolean; claim?: ClaimBundle
  onClick: () => void; onTake: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const accent = info.l1 === 'immediate' ? '#ff4d4f' : info.l1 === 'risk' ? '#faad14' : '#16a34a'
  const rs = richStatus(stop, info)
  const statusLabel = rs.label
  const statusStyle = rs
  const urgent = !stop.online || (info.l1 === 'immediate' && info.l2 !== 'next')
  const slack = slackChipColors(info.slackMin)
  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    background: '#f5f5f5', color: '#595959',
    border: '1px solid #e8e8e8',
    fontSize: 11.5, fontWeight: 500, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
  }
  return (
    <div
      ref={innerRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        background: selected ? '#e6f4ff' : '#fff',
        border: `1px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
        borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
        padding: '10px 12px', minWidth: 0,
      }}
    >
      {/* Row 1: route code left | status + slack right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={pill}>{stop.label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
          <span style={{ ...pill, color: statusStyle.color, background: statusStyle.bg, borderColor: statusStyle.border }}>
            {statusLabel}
          </span>
          <span style={{ ...pill, color: slack.color, background: slack.bg, borderColor: slack.border }}>
            Slack: {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin} min
          </span>
        </div>
      </div>
      {/* Row 2: wifi + plate + driver | start time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
        <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', flexShrink: 0 }}>({stop.plate})</Text>
        <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{firstName(stop.driver)}</Text>
        <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', marginLeft: 'auto', flexShrink: 0 }}>{formatTimeAmPm(stop.scheduled)}</Text>
      </div>
      {/* Row 3: actions right-aligned */}
      {showAction && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {claim ? (
            <ClaimControl accent={accent} claim={claim} />
          ) : urgent && !handled ? (
            <>
              <Button size="small" onClick={(e) => { e.stopPropagation(); onTake() }}>Take it</Button>
              <Button size="small" icon={<MoreOutlined />} />
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ── Rev 01: Route name full-width top row → Status | Slack row →
   WiFi+Driver | StartTime row → Actions row (right-aligned). ── */
function DhRev01Card({
  stop, info, selected, handled, showAction, claim, onClick, onTake, innerRef,
}: {
  stop: VehicleStop; info: DhInfo; selected: boolean; handled: boolean
  showAction: boolean; claim?: ClaimBundle
  onClick: () => void; onTake: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const accent = info.l1 === 'immediate' ? '#ff4d4f' : info.l1 === 'risk' ? '#faad14' : '#16a34a'
  const rs = richStatus(stop, info)
  const urgent = !stop.online || (info.l1 === 'immediate' && info.l2 !== 'next')
  const slack = slackChipColors(info.slackMin)
  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    background: '#f5f5f5', color: '#595959', border: '1px solid #e8e8e8',
    fontSize: 11.5, fontWeight: 500, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
  }
  const routeName = stop.destination ?? (stop.from && stop.to ? `${stop.from.name} → ${stop.to.name}` : stop.label)
  return (
    <div
      ref={innerRef} role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 7,
        background: selected ? '#e6f4ff' : '#fff',
        border: `1px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
        borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
        padding: '10px 12px', minWidth: 0,
      }}
    >
      {/* Row 1: route name full-width */}
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', minWidth: 0 }} ellipsis>{routeName}</Text>
      {/* Row 2: status chip left | slack chip right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ ...pill, color: rs.color, background: rs.bg, borderColor: rs.border }}>{rs.label}</span>
        <span style={{ ...pill, color: slack.color, background: slack.bg, borderColor: slack.border, marginLeft: 'auto' }}>
          Slack: {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin}min
        </span>
      </div>
      {/* Row 3: wifi + driver left | start time right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
        <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', flexShrink: 0 }}>({stop.plate})</Text>
        <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{firstName(stop.driver)}</Text>
        <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', marginLeft: 'auto', flexShrink: 0 }}>{formatTimeAmPm(stop.scheduled)}</Text>
      </div>
      {/* Row 4: actions right-aligned */}
      {showAction && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {claim ? (
            <ClaimControl accent={accent} claim={claim} />
          ) : urgent && !handled ? (
            <>
              <Button size="small" onClick={(e) => { e.stopPropagation(); onTake() }}>Claim</Button>
              <Button size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ── Rev 02: Route name + StartTime on same top row → Status | Slack row →
   WiFi+Driver | Actions on same bottom row. ── */
function DhRev02Card({
  stop, info, selected, handled, showAction, claim, onClick, onTake, innerRef,
}: {
  stop: VehicleStop; info: DhInfo; selected: boolean; handled: boolean
  showAction: boolean; claim?: ClaimBundle
  onClick: () => void; onTake: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const accent = info.l1 === 'immediate' ? '#ff4d4f' : info.l1 === 'risk' ? '#faad14' : '#16a34a'
  const rs = richStatus(stop, info)
  const urgent = !stop.online || (info.l1 === 'immediate' && info.l2 !== 'next')
  const slack = slackChipColors(info.slackMin)
  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    background: '#f5f5f5', color: '#595959', border: '1px solid #e8e8e8',
    fontSize: 11.5, fontWeight: 500, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
  }
  const routeName = stop.destination ?? (stop.from && stop.to ? `${stop.from.name} → ${stop.to.name}` : stop.label)
  return (
    <div
      ref={innerRef} role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 7,
        background: selected ? '#e6f4ff' : '#fff',
        border: `1px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
        borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
        padding: '10px 12px', minWidth: 0,
      }}
    >
      {/* Row 1: route name left | start time right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Text style={{ fontSize: 12, color: '#8c8c8c', flex: 1, minWidth: 0 }} ellipsis>{routeName}</Text>
        <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTimeAmPm(stop.scheduled)}</Text>
      </div>
      {/* Row 2: status chip left | slack chip right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ ...pill, color: rs.color, background: rs.bg, borderColor: rs.border }}>{rs.label}</span>
        <span style={{ ...pill, color: slack.color, background: slack.bg, borderColor: slack.border, marginLeft: 'auto' }}>
          Slack: {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin}min
        </span>
      </div>
      {/* Row 3: wifi + driver left | actions right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
        <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', flexShrink: 0 }}>({stop.plate})</Text>
        <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{firstName(stop.driver)}</Text>
        {showAction && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
            {claim ? (
              <ClaimControl accent={accent} claim={claim} />
            ) : urgent && !handled ? (
              <>
                <Button size="small" onClick={(e) => { e.stopPropagation(); onTake() }}>Claim</Button>
                <Button size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Rev 03: Status | Slack top row → WiFi+Driver | Time middle row →
   Route name (de-emphasised) | Claim status bottom row. ── */
function DhRev03Card({
  stop, info, selected, handled, showAction, claim, onClick, onTake, innerRef,
}: {
  stop: VehicleStop; info: DhInfo; selected: boolean; handled: boolean
  showAction: boolean; claim?: ClaimBundle
  onClick: () => void; onTake: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const accent = info.l1 === 'immediate' ? '#ff4d4f' : info.l1 === 'risk' ? '#faad14' : '#16a34a'
  const rs = richStatus(stop, info)
  const urgent = !stop.online || (info.l1 === 'immediate' && info.l2 !== 'next')
  const slack = slackChipColors(info.slackMin)
  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    background: '#f5f5f5', color: '#595959', border: '1px solid #e8e8e8',
    fontSize: 11.5, fontWeight: 500, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
  }
  const routeName = stop.destination ?? (stop.from && stop.to ? `${stop.from.name} → ${stop.to.name}` : stop.label)
  return (
    <div
      ref={innerRef} role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 7,
        background: selected ? '#e6f4ff' : '#fff',
        border: `1px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
        borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
        padding: '10px 12px', minWidth: 0,
      }}
    >
      {/* Row 1: status chip left | slack chip right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ ...pill, color: rs.color, background: rs.bg, borderColor: rs.border }}>{rs.label}</span>
        <span style={{ ...pill, color: slack.color, background: slack.bg, borderColor: slack.border, marginLeft: 'auto' }}>
          Slack: {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin}min
        </span>
      </div>
      {/* Row 2: wifi + driver left | start time right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 11.5, flexShrink: 0 }} />
        <Text style={{ fontSize: 12, color: '#1a1a1a', whiteSpace: 'nowrap', flexShrink: 0 }}>({stop.plate})</Text>
        <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{firstName(stop.driver)}</Text>
        <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', marginLeft: 'auto', flexShrink: 0 }}>{formatTimeAmPm(stop.scheduled)}</Text>
      </div>
      {/* Row 3: route name left | claim action right — same text style as "Claimed by" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Text style={{ fontSize: 11.5, color: '#8c8c8c', flex: 1, minWidth: 0 }} ellipsis>{routeName}</Text>
        {showAction && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {claim ? (
              <ClaimControl accent={accent} claim={claim} />
            ) : urgent && !handled ? (
              <>
                <Button size="small" onClick={(e) => { e.stopPropagation(); onTake() }}>Claim</Button>
                <Button size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
              </>
            ) : null}
          </div>
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
  claim,
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
  claim?: ClaimBundle
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
                    claim={claim}
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

/* ── Drawer position — Side/Bottom dock as normal flex siblings (they
   shift/shrink the list+map row instead of covering it, so both stay
   clickable while the panel is open). Drawer is the classic overlay
   instead — it slides in from the right on top of the layout without
   resizing it, at the cost of covering whatever sits underneath it. ── */
type DrawerPosition = 'side' | 'bottom' | 'overlay'

const DRAWER_POSITION_OPTIONS: { value: DrawerPosition; label: string }[] = [
  { value: 'side', label: 'Side' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'overlay', label: 'Drawer' },
]

/* ── Where the Late/Offline "Take it" action lives: right on the card for
   one-click triage, or tucked away in the detail panel only. Either way,
   once a trip is taken a small assignee avatar pins to the card — like a
   Trello member avatar after you assign a card to yourself. ── */
type ActionPlacement = 'card' | 'detail'

const ACTION_PLACEMENT_OPTIONS: { value: ActionPlacement; label: string }[] = [
  { value: 'card', label: 'On card' },
  { value: 'detail', label: 'In detail' },
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
  claim,
}: {
  stop: VehicleStop
  position: DrawerPosition
  onClose: () => void
  onNotify: () => void
  onMarkHandled: () => void
  urgent: boolean
  handled: boolean
  claim?: ClaimBundle
}) {
  const status = deriveStatus(stop)
  const style = STATUS_STYLE[status]
  const statusLabel = stop.online ? status : 'Offline'
  const lateMin = stop.online && status === 'Late' && stop.eta ? toMinutes(stop.eta) - toMinutes(stop.scheduled) : 0
  const accent = statusColor(stop)

  // Contacts and next-trip — use real data if available (dummy stops), else deterministic mock
  const h = dhHash(stop.id)
  const _ds = stop as DummyStop
  const driverPhone = _ds._driverPhone !== undefined ? _ds._driverPhone : mockPhone(h)
  const fleetPhone = _ds._fleetPhone !== undefined ? _ds._fleetPhone : mockPhone(h + 13)
  const customerPIC = _ds._customerPic !== undefined ? _ds._customerPic : mockPicName(h)
  const customerPhone = _ds._customerPhone !== undefined ? _ds._customerPhone : mockPhone(h + 7)
  const nextTrip = _ds._nextTrip !== undefined ? (_ds._nextTrip ?? mockNextTrip(stop)) : mockNextTrip(stop)

  const contactSections = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Driver */}
      <div style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
        <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Driver</Text>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{stop.driver}</Text>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{driverPhone}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: stop.online ? '#52c41a' : '#ff4d4f', display: 'inline-block' }} />
            <Text style={{ fontSize: 11.5, color: stop.online ? '#16a34a' : '#ff4d4f' }}>{stop.online ? 'Online' : 'Offline'}</Text>
          </div>
        </div>
      </div>
      {/* Fleet Owner */}
      <div style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
        <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fleet Owner</Text>
        <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{stop.fleetOwner}</Text>
        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{fleetPhone}</Text>
      </div>
      {/* Customer PIC */}
      <div style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
        <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Customer PIC <Text style={{ fontSize: 10, fontWeight: 400 }}>({stop.customerCode})</Text>
        </Text>
        <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{customerPIC}</Text>
        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{customerPhone}</Text>
      </div>
      {/* Next Trip */}
      <div style={{ padding: '10px 0' }}>
        <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Trip</Text>
        {nextTrip ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{nextTrip.routeCode}</Text>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Starts {formatTimeAmPm(nextTrip.startTime)} · {nextTrip.destination}</Text>
          </>
        ) : (
          <Text style={{ fontSize: 12, color: '#8c8c8c' }}>No next trip</Text>
        )}
      </div>
    </div>
  )

  return (
    <div
      className={position === 'overlay' ? 'detail-drawer-overlay' : undefined}
      style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(position === 'side'
          // order: 3 keeps it after the list/map regardless of which one
          // "Map position" put first (they use order 1/2 to swap sides)
          ? { borderRadius: 12, width: 340, height: '100%', order: 3 }
          : position === 'overlay'
            // Classic overlay — fixed on top of everything, sliding in from
            // the right, instead of pushing the list/map layout
            ? { borderRadius: 0, position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 1500, boxShadow: '-8px 0 28px rgba(15,23,42,.18)' }
            : { borderRadius: 12, width: '100%', height: 232, marginTop: 12 }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Trip detail</Text>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 15 }} />
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 5 }}>{stop.label}</span>
          <span style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: 11.5, fontWeight: 600, padding: '1px 9px', borderRadius: 6 }}>{statusLabel}</span>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} title="Close" />
        </div>
      </div>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {claim ? (
          <div style={{ flexShrink: 0 }}>
            <ClaimControl accent={accent} claim={claim} />
          </div>
        ) : (
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
        )}
        {contactSections}
      </div>
    </div>
  )
}

/* ── Flashing Card Stack — urgent trips surface one-by-one every 3 s as a
   dismissible card stack anchored to the bottom-left. Max 5 cards; each has
   a Claim action and a Dismiss (×). New cards animate in; the stack shows
   oldest at top, newest at bottom. ── */
interface FlashCard {
  stop: VehicleStop
  info: DhInfo
  entryKey: number  // unique per entry so React sees new elements
}

function FlashingCardStack({
  urgentStops,
  dhById,
  onClaim,
  active,
}: {
  urgentStops: VehicleStop[]
  dhById: Record<string, DhInfo>
  onClaim: (id: string) => void
  active: boolean
}) {
  const [cards, setCards] = useState<FlashCard[]>([])
  const counterRef = useRef(0)
  const queueIndexRef = useRef(0)

  useEffect(() => {
    if (!active) { setCards([]); return }
    const add = () => {
      if (urgentStops.length === 0) return
      setCards((prev) => {
        if (prev.length >= 5) return prev
        // cycle through urgentStops, skip any already in the stack
        let tried = 0
        while (tried < urgentStops.length) {
          const candidate = urgentStops[queueIndexRef.current % urgentStops.length]
          queueIndexRef.current++
          tried++
          if (!prev.find((c) => c.stop.id === candidate.id)) {
            const info = dhById[candidate.id]
            if (!info) continue
            return [...prev, { stop: candidate, info, entryKey: counterRef.current++ }]
          }
        }
        return prev
      })
    }
    add() // show first card immediately
    const id = setInterval(add, 3000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, urgentStops.length])

  const dismiss = (key: number) =>
    setCards((prev) => prev.filter((c) => c.entryKey !== key))

  const claim = (card: FlashCard) => {
    onClaim(card.stop.id)
    dismiss(card.entryKey)
  }

  if (!active || cards.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: 28,
        zIndex: 1800,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 300,
        pointerEvents: 'none',
      }}
    >
      {cards.map((card) => {
        const { stop, info } = card
        const accent = info.l1 === 'immediate' ? '#ff4d4f' : '#faad14'
        const accentSoft = info.l1 === 'immediate' ? '#fff1f0' : '#fffbe6'
        const accentBorder = info.l1 === 'immediate' ? '#ffccc7' : '#ffe58f'
        const delayLabel =
          info.currentDelayMin > 0
            ? `Late +${info.currentDelayMin} min`
            : info.predictedDelayMin > 0
              ? `Will be late +${info.predictedDelayMin} min`
              : info.nextTripDelayMin > 0
                ? `Next trip +${info.nextTripDelayMin} min`
                : info.l2 === 'no-slack'
                  ? 'No schedule slack'
                  : info.l2 === 'offline'
                    ? 'ETA unavailable'
                    : 'Needs attention'
        return (
          <div
            key={card.entryKey}
            className="fcard-enter fcard-pulse"
            style={{
              background: '#fff',
              borderRadius: 12,
              border: `1.5px solid ${accentBorder}`,
              borderLeft: `4px solid ${accent}`,
              padding: '11px 12px',
              pointerEvents: 'all',
              position: 'relative',
            }}
          >
            {/* Dismiss × */}
            <button
              onClick={() => dismiss(card.entryKey)}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#bfbfbf', fontSize: 14, lineHeight: 1, padding: 2,
              }}
              title="Dismiss"
            >×</button>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingRight: 18 }}>
              <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                {stop.label}
              </span>
              <Text style={{ fontSize: 11.5, fontWeight: 600, color: '#1a1a1a', flex: 1, minWidth: 0 }} ellipsis>
                {stop.customerCode}
              </Text>
              <span style={{ background: accentSoft, color: accent, border: `1px solid ${accentBorder}`, fontSize: 10.5, fontWeight: 600, padding: '1px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {info.l1 === 'immediate' ? 'Immediate' : 'At Risk'}
              </span>
            </div>

            {/* Sub-category + driver */}
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11.5, color: accent, fontWeight: 600, display: 'block' }}>{delayLabel}</Text>
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                {stop.driver} · {stop.plate}
              </Text>
            </div>

            {/* Claim action */}
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => claim(card)}
              style={{ width: '100%', background: accent, borderColor: accent, fontSize: 12 }}
            >
              Claim this trip
            </Button>
          </div>
        )
      })}
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
  onOpenGallery,
  isTwoLevel,
  dhCardStyle,
  onDhCardStyleChange,
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
  actionPlacement,
  onActionPlacementChange,
  actionModel,
  onActionModelChange,
  claimButtonStyle,
  onClaimButtonStyleChange,
  claimCardScope,
  onClaimCardScopeChange,
  claimColorMode,
  onClaimColorModeChange,
  claimButtonWidth,
  onClaimButtonWidthChange,
  showDelayText,
  onShowDelayTextChange,
  showDriverStatusText,
  onShowDriverStatusTextChange,
  slackPosition,
  onSlackPositionChange,
  l2Spacing,
  onL2SpacingChange,
  l2MatchL1Width,
  onL2MatchL1WidthChange,
  showNeedsAttention,
  onShowNeedsAttentionChange,
  showRoutes,
  onShowRoutesChange,
  showTraffic,
  onShowTrafficChange,
  simulating,
  onToggleSimulate,
  flashingStyle,
  onFlashingStyleChange,
  highlightBoxPadding,
  onHighlightBoxPaddingChange,
  l1FontSize,
  onL1FontSizeChange,
  l2FontSize,
  onL2FontSizeChange,
  useDummyData,
  onUseDummyDataChange,
}: {
  pos: { x: number; y: number }
  onDragStart: (e: React.MouseEvent) => void
  onClose: () => void
  mapTheme: MapTheme
  onMapThemeChange: (v: MapTheme) => void
  cardStyle: CardStyle
  onCardStyleChange: (v: CardStyle) => void
  onOpenGallery: () => void
  isTwoLevel: boolean
  dhCardStyle: DhCardStyle
  onDhCardStyleChange: (v: DhCardStyle) => void
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
  actionPlacement: ActionPlacement
  onActionPlacementChange: (v: ActionPlacement) => void
  actionModel: ActionModel
  onActionModelChange: (v: ActionModel) => void
  claimButtonStyle: ClaimButtonStyle
  onClaimButtonStyleChange: (v: ClaimButtonStyle) => void
  claimCardScope: ClaimCardScope
  onClaimCardScopeChange: (v: ClaimCardScope) => void
  claimColorMode: ClaimColorMode
  onClaimColorModeChange: (v: ClaimColorMode) => void
  claimButtonWidth: ClaimButtonWidth
  onClaimButtonWidthChange: (v: ClaimButtonWidth) => void
  showDelayText: boolean
  onShowDelayTextChange: (v: boolean) => void
  showDriverStatusText: boolean
  onShowDriverStatusTextChange: (v: boolean) => void
  slackPosition: SlackPosition
  onSlackPositionChange: (v: SlackPosition) => void
  l2Spacing: L2Spacing
  onL2SpacingChange: (v: L2Spacing) => void
  l2MatchL1Width: boolean
  onL2MatchL1WidthChange: (v: boolean) => void
  showNeedsAttention: boolean
  onShowNeedsAttentionChange: (v: boolean) => void
  showRoutes: boolean
  onShowRoutesChange: (v: boolean) => void
  showTraffic: boolean
  onShowTrafficChange: (v: boolean) => void
  simulating: boolean
  onToggleSimulate: () => void
  flashingStyle: FlashingStyle
  onFlashingStyleChange: (v: FlashingStyle) => void
  highlightBoxPadding: number
  onHighlightBoxPaddingChange: (v: number) => void
  l1FontSize: number
  onL1FontSizeChange: (v: number) => void
  l2FontSize: number
  onL2FontSizeChange: (v: number) => void
  useDummyData: boolean
  onUseDummyDataChange: (v: boolean) => void
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
        {isTwoLevel ? (
          <SettingRow label="2L card style">
            <Select size="small" value={dhCardStyle} onChange={onDhCardStyleChange} options={DH_CARD_STYLE_OPTIONS} style={{ width: 120 }} dropdownStyle={{ zIndex: 2100 }} />
          </SettingRow>
        ) : (
          <>
            <SettingRow label="Card style">
              <Select size="small" value={cardStyle} onChange={onCardStyleChange} options={CARD_STYLE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
            <Button size="small" icon={<AppstoreOutlined />} onClick={onOpenGallery} block>
              Browse card gallery
            </Button>
          </>
        )}
        <SettingRow label="Highlight style">
          <Select size="small" value={highlightStyle} onChange={onHighlightStyleChange} options={HIGHLIGHT_STYLE_OPTIONS.filter(o => o.value.startsWith('two-level'))} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
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
        <SettingRow label="Action placement">
          <Select size="small" value={actionPlacement} onChange={onActionPlacementChange} options={ACTION_PLACEMENT_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        <SettingRow label="Action model">
          <Select size="small" value={actionModel} onChange={onActionModelChange} options={ACTION_MODEL_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
        </SettingRow>
        {actionModel === 'claim' && (
          <>
            <div style={{ height: 1, background: '#f0f0f0' }} />
            <SettingRow label="Claim btn style">
              <Select size="small" value={claimButtonStyle} onChange={onClaimButtonStyleChange} options={CLAIM_BUTTON_STYLE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
            <SettingRow label="Claim on cards">
              <Select size="small" value={claimCardScope} onChange={onClaimCardScopeChange} options={CLAIM_CARD_SCOPE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
            <SettingRow label="Claim color">
              <Select size="small" value={claimColorMode} onChange={onClaimColorModeChange} options={CLAIM_COLOR_MODE_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
            <SettingRow label="Claim btn width">
              <Select size="small" value={claimButtonWidth} onChange={onClaimButtonWidthChange} options={CLAIM_BUTTON_WIDTH_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
          </>
        )}
        {isTwoLevel && (
          <>
            <div style={{ height: 1, background: '#f0f0f0' }} />
            <SettingRow label="Slack position">
              <Select size="small" value={slackPosition} onChange={onSlackPositionChange} options={SLACK_POSITION_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
            <SettingRow label="Show delay text">
              <Switch size="small" checked={showDelayText} onChange={onShowDelayTextChange} />
            </SettingRow>
            <SettingRow label="Driver status text">
              <Switch size="small" checked={showDriverStatusText} onChange={onShowDriverStatusTextChange} />
            </SettingRow>
            <SettingRow label="L2 spacing">
              <Select size="small" value={l2Spacing} onChange={onL2SpacingChange} options={L2_SPACING_OPTIONS} style={{ width: 104 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
            <SettingRow label="L2 match L1 width">
              <Switch size="small" checked={l2MatchL1Width} onChange={onL2MatchL1WidthChange} />
            </SettingRow>
            <SettingRow label="Flashing">
              <Select size="small" value={flashingStyle} onChange={onFlashingStyleChange} options={FLASHING_STYLE_OPTIONS} style={{ width: 80 }} dropdownStyle={{ zIndex: 2100 }} />
            </SettingRow>
            <SettingRow label="L1 font">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Slider min={16} max={36} value={l1FontSize} onChange={onL1FontSizeChange} style={{ width: 64, margin: 0 }} />
                <Text style={{ fontSize: 12, color: '#595959', minWidth: 24, textAlign: 'right' }}>{l1FontSize}px</Text>
              </div>
            </SettingRow>
            <SettingRow label="L2 font">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Slider min={9} max={16} value={l2FontSize} onChange={onL2FontSizeChange} style={{ width: 64, margin: 0 }} />
                <Text style={{ fontSize: 12, color: '#595959', minWidth: 24, textAlign: 'right' }}>{l2FontSize}px</Text>
              </div>
            </SettingRow>
            {(highlightStyle === 'two-level-panel' || highlightStyle === 'two-level-equal') && (
              <SettingRow label="Box padding">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Slider
                    min={4} max={20} value={highlightBoxPadding} onChange={onHighlightBoxPaddingChange}
                    style={{ width: 64, margin: 0 }}
                  />
                  <Text style={{ fontSize: 12, color: '#595959', minWidth: 24, textAlign: 'right' }}>{highlightBoxPadding}px</Text>
                </div>
              </SettingRow>
            )}
          </>
        )}
        {!isTwoLevel && (
          <>
            <div style={{ height: 1, background: '#f0f0f0' }} />
            <SettingRow label="Needs attention">
              <Switch size="small" checked={showNeedsAttention} onChange={onShowNeedsAttentionChange} />
            </SettingRow>
          </>
        )}
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
        <div style={{ height: 1, background: '#f0f0f0' }} />
        <SettingRow label="Use dummy data">
          <Switch size="small" checked={useDummyData} onChange={onUseDummyDataChange} />
        </SettingRow>
      </div>
    </div>
  )
}

/* ── Card style gallery — every card variant rendered side by side with the
   same sample trips, so ops can compare designs at a glance and apply one
   in a single click instead of flipping through the "Card style" dropdown
   one option at a time. ── */
function CardStyleGallery({
  open,
  onClose,
  samples,
  handledIds,
  showAction,
  getClaim,
  activeStyle,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  samples: VehicleStop[]
  handledIds: Set<string>
  showAction: boolean
  getClaim?: (stop: VehicleStop) => ClaimBundle | undefined
  activeStyle: CardStyle
  onSelect: (v: CardStyle) => void
}) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1060} zIndex={3000} title="Card style gallery">
      <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', margin: '-4px 0 16px' }}>
        The same sample trips rendered in every card style — pick the one that reads best.
      </Text>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
        {CARD_STYLE_OPTIONS.map((opt) => {
          const isActive = opt.value === activeStyle
          return (
            <div
              key={opt.value}
              style={{
                border: `1.5px solid ${isActive ? '#1677ff' : '#f0f0f0'}`,
                borderRadius: 12,
                padding: 12,
                background: isActive ? '#f0f7ff' : '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{opt.label}</Text>
                <Button size="small" type={isActive ? 'primary' : 'default'} onClick={() => onSelect(opt.value)}>
                  {isActive ? 'In use' : 'Use this style'}
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {samples.map((stop) => (
                  <TripGridCard
                    key={stop.id}
                    stop={stop}
                    variant={opt.value}
                    selected={false}
                    expanded={false}
                    handled={handledIds.has(stop.id)}
                    showAction={showAction}
                    claim={getClaim?.(stop)}
                    onClick={() => {}}
                    onViewDetail={() => {}}
                    onTake={() => {}}
                    innerRef={() => {}}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

export default function LiveTrackingTesting2Page() {
  const [filter, setFilter] = useState<KpiKey>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('slack-asc')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPosition, setDrawerPosition] = useState<DrawerPosition>('overlay')
  const [actionPlacement, setActionPlacement] = useState<ActionPlacement>('card')
  const [actionModel, setActionModel] = useState<ActionModel>('claim')
  const [claimButtonStyle, setClaimButtonStyle] = useState<ClaimButtonStyle>('text')
  const [claimCardScope, setClaimCardScope] = useState<ClaimCardScope>('all')
  const [dhCardStyle, setDhCardStyle] = useState<DhCardStyle>('internal')
  const [l2Spacing, setL2Spacing] = useState<L2Spacing>(12)
  const [l2MatchL1Width, setL2MatchL1Width] = useState(false)
  const [claimColorMode, setClaimColorMode] = useState<ClaimColorMode>('category')
  const [claimButtonWidth, setClaimButtonWidth] = useState<ClaimButtonWidth>('compact')
  const [showDelayText, setShowDelayText] = useState(true)
  const [showDriverStatusText, setShowDriverStatusText] = useState(true)
  const [slackPosition, setSlackPosition] = useState<SlackPosition>('row')
  const [filterDriverStatus, setFilterDriverStatus] = useState<FilterDriverStatus>('all')
  const [filterAttention, setFilterAttention] = useState<FilterAttention>('all')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set())
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set())
  // Claim workflow — who claimed each trip and which ones are wrapped up.
  // A few trips start pre-claimed by a second demo teammate (deterministic,
  // not random) so the Take over / Release paths have something to act on.
  const [claimedBy, setClaimedBy] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {}
    baseTrips.forEach((t) => {
      if (dhHash(t.id) % 9 === 0) seed[t.id] = 'Farah Aziz'
    })
    return seed
  })
  const [actionCompleteIds, setActionCompleteIds] = useState<Set<string>>(new Set())
  const [galleryOpen, setGalleryOpen] = useState(false)

  // ── Display settings — ported from the main Live Tracking page ──
  const [mapTheme, setMapTheme] = useState<MapTheme>('silver')
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>('bus')
  const [cardStyle, setCardStyle] = useState<CardStyle>('compact')
  const [mapCardStyle, setMapCardStyle] = useState<MapCardStyle>('default')
  const [mapPosition, setMapPosition] = useState<MapPosition>('left')
  const [listMapRatio, setListMapRatio] = useState<ListMapRatio>('60:40')
  const [highlightStyle, setHighlightStyle] = useState<HighlightStyle>('two-level-panel')
  const [showNeedsAttention, setShowNeedsAttention] = useState(true)
  const [flashingStyle, setFlashingStyle] = useState<FlashingStyle>('pulse')
  const [highlightBoxPadding, setHighlightBoxPadding] = useState(10)
  const [l1FontSize, setL1FontSize] = useState(24)
  const [l2FontSize, setL2FontSize] = useState(11)
  const [useDummyData, setUseDummyData] = useState(false)
  // "2 Levels" is one of the Highlight style options — not a separate toggle
  const isTwoLevel = highlightStyle.startsWith('two-level')
  const isFlashingCard = highlightStyle === 'flashing-card'
  const [dhLevel1, setDhLevel1] = useState<DhLevel1 | null>('immediate')
  const [dhLevel2, setDhLevel2] = useState<DhLevel2 | null>('cur-first')
  const handleLevel1Change = (v: DhLevel1 | null) => {
    setDhLevel1(v)
    setDhLevel2(null)
    if (v === 'immediate') setSortBy('slack-asc')
    else if (v === 'risk') setSortBy('delay-desc')
    else setSortBy('start')
  }
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

  const stops: VehicleStop[] = useDummyData
    ? DUMMY_STOPS.map((s) => (notifiedIds.has(s.id) ? { ...s, notified: true } : s))
    : buildStops(DEMO_TRIPS).map((s) => {
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

  // A small, status-diverse sample for the card style gallery — one offline,
  // one late, one on-time trip, so every variant's color coding is visible
  const gallerySamples = [
    stops.find((s) => !s.online),
    stops.find((s) => s.online && deriveStatus(s) === 'Late'),
    stops.find((s) => s.online && deriveStatus(s) === 'On Time'),
  ].filter((s): s is VehicleStop => !!s)

  // Double-highlight classification for every trip. Claim workflow biz req 3:
  // marking a trip's action complete re-categorises it as Stable regardless
  // of what the underlying placeholder delay math says.
  const dhById: Record<string, DhInfo> = Object.fromEntries(
    stops.map((s) => {
      const overrideDh = (s as DummyStop)._dh
      const info: DhInfo = overrideDh !== undefined ? overrideDh : dhInfo(s)
      if (actionModel === 'claim' && actionCompleteIds.has(s.id) && info.l1 !== 'stable') {
        return [s.id, { ...info, l1: 'stable' as DhLevel1, l2: null }]
      }
      return [s.id, info]
    })
  )
  const dhL1Counts: Record<DhLevel1, number> = { immediate: 0, risk: 0, stable: 0 }
  const dhL2Counts: Record<string, number> = {}
  stops.forEach((s) => {
    const info = dhById[s.id]
    dhL1Counts[info.l1] += 1
    if (info.l2) dhL2Counts[info.l2] = (dhL2Counts[info.l2] ?? 0) + 1
  })

  // Stops that need immediate or at-risk attention — used by FlashingCardStack
  const flashUrgentStops = stops.filter((s) => {
    const info = dhById[s.id]
    return info && info.l1 !== 'stable' && !handledIds.has(s.id) && !actionCompleteIds.has(s.id)
  })

  const filtered = stops.filter((s) => {
    if (isTwoLevel || isFlashingCard) {
      const info = dhById[s.id]
      if (dhLevel1 !== null && info.l1 !== dhLevel1) return false
      if (dhLevel1 !== null && dhLevel1 !== 'stable' && dhLevel2 && info.l2 !== dhLevel2) return false
    } else if (!kpiMatch(s, filter)) {
      return false
    }
    // Driver status filter
    if (filterDriverStatus === 'online' && !s.online) return false
    if (filterDriverStatus === 'offline' && s.online) return false
    // Ops attention filter (only meaningful when action model = claim)
    if (filterAttention !== 'all') {
      const isClaimed = !!claimedBy[s.id]
      const isComplete = actionCompleteIds.has(s.id)
      if (filterAttention === 'unclaimed' && (isClaimed || isComplete)) return false
      if (filterAttention === 'mine' && claimedBy[s.id] !== CURRENT_USER) return false
      if (filterAttention === 'others' && (claimedBy[s.id] === CURRENT_USER || !isClaimed || isComplete)) return false
      if (filterAttention === 'complete' && !isComplete) return false
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
      case 'slack-asc': return (dhById[a.id]?.slackMin ?? 0) - (dhById[b.id]?.slackMin ?? 0)
      case 'slack-desc': return (dhById[b.id]?.slackMin ?? 0) - (dhById[a.id]?.slackMin ?? 0)
      case 'delay-asc': return (dhById[a.id]?.currentDelayMin ?? 0) - (dhById[b.id]?.currentDelayMin ?? 0)
      case 'delay-desc': return (dhById[b.id]?.currentDelayMin ?? 0) - (dhById[a.id]?.currentDelayMin ?? 0)
      default: return toMinutes(a.scheduled) - toMinutes(b.scheduled)
    }
  }

  // Needs-attention grouping — skipped entirely in double-highlight mode
  // (level 1 already does the job) and toggleable otherwise
  const needsAttention = !isTwoLevel && showNeedsAttention
    ? filtered.filter((s) => isUrgent(s) && !handledIds.has(s.id)).sort(sortFn)
    : []
  const others = !isTwoLevel && showNeedsAttention
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

  // Claim workflow actions (biz req 1/2/4)
  const claimTrip = (id: string) => {
    setClaimedBy((prev) => ({ ...prev, [id]: CURRENT_USER }))
    messageApi.success('Trip claimed')
  }
  const releaseTrip = (id: string) => {
    setClaimedBy((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    messageApi.info('Trip released')
  }
  const takeOverTrip = (id: string) => {
    setClaimedBy((prev) => ({ ...prev, [id]: CURRENT_USER }))
    messageApi.success('Trip taken over')
  }
  // Marking action complete re-categorises the trip as Stable (biz req 3)
  const markActionComplete = (id: string) => {
    setActionCompleteIds((prev) => new Set(prev).add(id))
    messageApi.success('Action marked complete — trip is now Stable')
  }
  // "More actions" stubs (biz req 2.3) — no real GPS/schedule/announcement/
  // incident systems in this sandbox, so these just confirm the action fired
  const viewGpsReport = () => messageApi.info('Opening trip GPS report (demo)')
  const viewScheduleDetails = () => messageApi.info('Opening daily schedule details (demo)')
  const sendAnnouncement = () => messageApi.success('Announcement sent to passengers')
  const createIncident = () => messageApi.warning('Incident created (demo)')

  const clearFilters = () => {
    setFilter('all')
    setSearch('')
    setFilterDriverStatus('all')
    setFilterAttention('all')
  }

  // Accordion cards only toggle their own inline expansion — no docked
  // panel, since the expanded card already shows the detail.
  const toggleExpand = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
    setDrawerOpen(false)
  }

  // Every other card style: one click toggles the trip selection (which shows
  // its InfoWindow on the map / highlights the card) without opening the drawer.
  // The drawer is opened explicitly via the card's "View detail" button.
  const openCard = (id: string) => {
    setSelectedId((prev) => prev === id ? null : id)
    setDrawerOpen(false)
  }

  const sectionLabel = (text: string, color = '#94a3b8') => (
    <Text style={{ gridColumn: '1 / -1', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.6, margin: '2px 2px 0' }}>
      {text}
    </Text>
  )

  // Claim workflow bundle for a trip (biz req 1/2/3/4/5). Overdue (req 5,
  // "alert management") is a deterministic placeholder: an urgent trip
  // that's sat unclaimed-or-unresolved reads as overdue.
  const claimBundle = (stop: VehicleStop): ClaimBundle => {
    const complete = actionCompleteIds.has(stop.id)
    const l1 = dhById[stop.id]?.l1 ?? 'stable'
    return {
      claimedBy: claimedBy[stop.id],
      actionComplete: complete,
      overdue: !complete && isUrgent(stop) && dhHash(stop.id) % 4 === 0,
      notified: !!stop.notified,
      buttonStyle: claimButtonStyle,
      urgent: l1 === 'immediate',
      flashingStyle,
      colorMode: claimColorMode,
      buttonWidth: claimButtonWidth,
      onClaim: () => claimTrip(stop.id),
      onRelease: () => releaseTrip(stop.id),
      onTakeOver: () => takeOverTrip(stop.id),
      onMarkComplete: () => markActionComplete(stop.id),
      onNotify: () => notifyDriver(stop.id),
      onViewGps: viewGpsReport,
      onViewSchedule: viewScheduleDetails,
      onSendAnnouncement: sendAnnouncement,
      onCreateIncident: createIncident,
    }
  }

  const renderCard = (stop: VehicleStop) => {
    const claimLevel = dhById[stop.id]?.l1 ?? 'stable'
    const scopeAllows = claimCardScope === 'all' || claimLevel !== 'stable'
    const claim = actionModel === 'claim' && scopeAllows ? claimBundle(stop) : undefined
    if (isTwoLevel) {
      const revProps = {
        key: stop.id, stop, info: dhById[stop.id],
        selected: selectedId === stop.id, handled: handledIds.has(stop.id),
        showAction: actionPlacement === 'card', claim,
        onClick: () => openCard(stop.id), onTake: () => markHandled(stop.id),
        innerRef: (el: HTMLDivElement | null) => { cardRefs.current[stop.id] = el },
      }
      if (dhCardStyle === 'rev01') return <DhRev01Card {...revProps} />
      if (dhCardStyle === 'rev02') return <DhRev02Card {...revProps} />
      if (dhCardStyle === 'rev03') return <DhRev03Card {...revProps} />
      if (dhCardStyle === 'internal') {
        return (
          <DhInternalCard
            key={stop.id}
            stop={stop}
            info={dhById[stop.id]}
            selected={selectedId === stop.id}
            handled={handledIds.has(stop.id)}
            showAction={actionPlacement === 'card'}
            claim={claim}
            onClick={() => openCard(stop.id)}
            onTake={() => markHandled(stop.id)}
            innerRef={(el) => { cardRefs.current[stop.id] = el }}
          />
        )
      }
      // Derive per-preset prop overrides
      // standard: all info on (respects global toggles)
      // info:     slack row + delay text, no driver status text label
      // compact:  slack inline, no delay text, no driver status text
      // minimal:  no slack row, no delay text, no driver status text
      // slim:     no slack, no delay, no driver status (same as minimal but narrower padding intent)
      const dhPreset: { showDelayText: boolean; showDriverStatusText: boolean; slackPosition: SlackPosition; showSlack: boolean } =
        dhCardStyle === 'info'    ? { showDelayText: true,  showDriverStatusText: false, slackPosition: 'row',    showSlack: true } :
        dhCardStyle === 'compact' ? { showDelayText: false, showDriverStatusText: false, slackPosition: 'inline', showSlack: true } :
        dhCardStyle === 'minimal' ? { showDelayText: false, showDriverStatusText: false, slackPosition: 'row',    showSlack: false } :
        dhCardStyle === 'slim'    ? { showDelayText: false, showDriverStatusText: false, slackPosition: 'inline', showSlack: false } :
        /* standard */              { showDelayText: showDelayText, showDriverStatusText: showDriverStatusText, slackPosition: slackPosition, showSlack: true }
      return (
        <DhGridCard
          key={stop.id}
          stop={stop}
          info={dhById[stop.id]}
          selected={selectedId === stop.id}
          handled={handledIds.has(stop.id)}
          showAction={actionPlacement === 'card'}
          claim={claim}
          onClick={() => openCard(stop.id)}
          onViewDetail={() => { setSelectedId(stop.id); setDrawerOpen(true) }}
          onTake={() => markHandled(stop.id)}
          innerRef={(el) => { cardRefs.current[stop.id] = el }}
          showDelayText={dhPreset.showDelayText}
          showDriverStatusText={dhPreset.showDriverStatusText}
          slackPosition={dhPreset.slackPosition}
          showSlack={dhPreset.showSlack}
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
          showAction={actionPlacement === 'card'}
          claim={claim}
          onClick={() => toggleExpand(stop.id)}
          onViewDetail={() => { setSelectedId(stop.id); setDrawerOpen(true) }}
          onTake={() => markHandled(stop.id)}
          innerRef={(el) => { cardRefs.current[stop.id] = el }}
        />
      )
    }
    // Compact / Split / Minimal / Detailed — one click selects the trip
    // (shows its InfoWindow on the map), "View detail" button opens the panel.
    return (
      <TripGridCard
        key={stop.id}
        stop={stop}
        variant={cardStyle}
        selected={selectedId === stop.id}
        expanded={false}
        handled={handledIds.has(stop.id)}
        showAction={actionPlacement === 'card'}
        claim={claim}
        onClick={() => openCard(stop.id)}
        onViewDetail={() => { setSelectedId(stop.id); setDrawerOpen(true) }}
        onTake={() => markHandled(stop.id)}
        innerRef={(el) => { cardRefs.current[stop.id] = el }}
      />
    )
  }

  const activeFilterCount = (filterDriverStatus !== 'all' ? 1 : 0) + (filterAttention !== 'all' ? 1 : 0)

  const filterPopoverContent = (
    <div style={{ width: 210 }}>
      <div style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>DRIVER STATUS</Text>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['all', 'All'], ['online', 'Online'], ['offline', 'Offline']] as [FilterDriverStatus, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterDriverStatus(v)}
              style={{
                flex: 1, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${filterDriverStatus === v ? '#1677ff' : '#e8e8e8'}`,
                background: filterDriverStatus === v ? '#e6f4ff' : '#fff',
                color: filterDriverStatus === v ? '#1677ff' : '#595959',
                fontWeight: filterDriverStatus === v ? 600 : 400,
                transition: 'all .12s',
              }}
            >{l}</button>
          ))}
        </div>
      </div>
      <div>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>OPS ATTENTION</Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {([
            ['all', 'All'],
            ['unclaimed', 'Unclaimed'],
            ['mine', 'Claimed by me'],
            ['others', 'Claimed by others'],
            ['complete', 'Action complete'],
          ] as [FilterAttention, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterAttention(v)}
              style={{
                width: '100%', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, textAlign: 'left',
                border: `1px solid ${filterAttention === v ? '#1677ff' : '#e8e8e8'}`,
                background: filterAttention === v ? '#e6f4ff' : '#fff',
                color: filterAttention === v ? '#1677ff' : '#595959',
                fontWeight: filterAttention === v ? 600 : 400,
                transition: 'all .12s',
              }}
            >{l}</button>
          ))}
        </div>
      </div>
      {activeFilterCount > 0 && (
        <Button size="small" type="link" onClick={() => { setFilterDriverStatus('all'); setFilterAttention('all') }} style={{ marginTop: 10, padding: 0 }}>
          Clear filters
        </Button>
      )}
    </div>
  )

  const filterBtn = (
    <Popover
      open={filterPopoverOpen}
      onOpenChange={setFilterPopoverOpen}
      content={filterPopoverContent}
      title="Filter"
      trigger="click"
      placement="bottomRight"
    >
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <Button
          size="middle"
          icon={<FilterOutlined />}
          style={{
            padding: '0 10px',
            borderColor: activeFilterCount > 0 ? '#1677ff' : undefined,
            color: activeFilterCount > 0 ? '#1677ff' : undefined,
          }}
        />
        {activeFilterCount > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
            background: '#1677ff', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {activeFilterCount}
          </span>
        )}
      </div>
    </Popover>
  )

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
          gap: isTwoLevel ? l2Spacing : 12,
          height: 'calc(100vh - 96px)',
        }}
      >
        {/* ── Header: KPI/highlight bar + search + sort ── */}
        <div style={{ flexShrink: 0 }}>
          {(isTwoLevel || isFlashingCard) ? (() => {
            const l2Props = { level1: dhLevel1, level2: dhLevel2, l1Counts: dhL1Counts, l2Counts: dhL2Counts, onLevel1Change: handleLevel1Change, onLevel2Change: setDhLevel2, l2Spacing, l2MatchL1Width, flashingStyle, l1FontSize, l2FontSize }
            const rightSlot = (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search route, driver, plate..." style={{ borderRadius: 8, width: 210 }} allowClear />
                {filterBtn}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, color: '#8c8c8c', whiteSpace: 'nowrap' }}>Sort</Text>
                  <Select size="middle" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} style={{ width: 152 }} />
                </div>
              </div>
            )
            if (isFlashingCard) return <TwoLevelPanelHeader {...l2Props} boxPadding={highlightBoxPadding} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-cards') return <TwoLevelCardHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-minimal') return <TwoLevelMinimalHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-banner') return <TwoLevelBannerHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-stats') return <TwoLevelStatsHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-badge') return <TwoLevelBadgeHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-progress') return <TwoLevelProgressHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-inline') return <TwoLevelInlineHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-panel') return <TwoLevelPanelHeader {...l2Props} boxPadding={highlightBoxPadding} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-metro') return <TwoLevelMetroHeader {...l2Props} rightSlot={rightSlot} />
            if (highlightStyle === 'two-level-equal') return <TwoLevelEqualHeader {...l2Props} boxPadding={highlightBoxPadding} rightSlot={rightSlot} />
            // Default 'two-level' pills
            const pillsTotalCount = dhL1Counts.immediate + dhL1Counts.risk + dhL1Counts.stable
            const pillsL1 = (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => handleLevel1Change(null)}
                  style={{ padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap', border: `1px solid ${dhLevel1 === null ? '#1677ff' : '#91caff'}`, background: dhLevel1 === null ? '#1677ff' : '#e6f4ff', color: dhLevel1 === null ? '#fff' : '#1677ff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>
                  All ({pillsTotalCount})
                </button>
                {DH_L1_META.map((m) => {
                  const active = dhLevel1 === m.key
                  return (
                    <button key={m.key} onClick={() => handleLevel1Change(m.key)}
                      className={flashCls(flashingStyle, m.key === 'immediate' && dhL1Counts.immediate > 0, active)}
                      style={{ padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap', border: `1px solid ${active ? m.color : m.border}`, background: active ? m.color : m.soft, color: active ? '#fff' : m.color, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>
                      {m.label} ({dhL1Counts[m.key]})
                    </button>
                  )
                })}
              </div>
            )
            const pillsL2 = <TwoLevelL2Chips level1={dhLevel1} level2={dhLevel2} l2Counts={dhL2Counts} onLevel2Change={setDhLevel2} l2Spacing={l2Spacing} />
            if (l2MatchL1Width) return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}><div>{pillsL1}{pillsL2}</div><div style={{ flexShrink: 0 }}>{rightSlot}</div></div>
            return (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>{pillsL1}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{rightSlot}</div>
                </div>
                {pillsL2}
              </>
            )
          })() : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <KpiBar style={highlightStyle as 'default' | 'segment' | 'color'} active={filter} counts={counts} onSelect={setFilter} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search route, driver, plate..."
                  style={{ borderRadius: 8, width: 240 }}
                  allowClear
                />
                {filterBtn}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, color: '#8c8c8c', whiteSpace: 'nowrap' }}>Sort</Text>
                  <Select size="middle" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} style={{ width: 152 }} />
                </div>
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
                  claim={actionModel === 'claim' && selectedStop && (claimCardScope === 'all' || (dhById[selectedStop.id]?.l1 ?? 'stable') !== 'stable') ? claimBundle(selectedStop) : undefined}
                  onSelect={(id) => { setSelectedId(id); setDrawerOpen(false) }}
                  onClose={() => setSelectedId(null)}
                  onViewDetail={() => setDrawerOpen(true)}
                  onTake={markHandled}
                  onRouteResolved={onRouteResolved}
                />
              </MapErrorBoundary>
            )}


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
              claim={actionModel === 'claim' && (claimCardScope === 'all' || (dhById[selectedStop.id]?.l1 ?? 'stable') !== 'stable') ? claimBundle(selectedStop) : undefined}
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
            claim={actionModel === 'claim' && (claimCardScope === 'all' || (dhById[selectedStop.id]?.l1 ?? 'stable') !== 'stable') ? claimBundle(selectedStop) : undefined}
          />
        )}
      </div>

      {/* Detail panel — Drawer: classic overlay sliding in from the right,
          on top of everything (unlike Side/Bottom, this one covers rather
          than pushes the layout underneath it) */}
      {drawerOpen && selectedStop && drawerPosition === 'overlay' && (
        <TripDetailPanel
          stop={selectedStop}
          position="overlay"
          onClose={() => setDrawerOpen(false)}
          onNotify={() => notifyDriver(selectedStop.id)}
          onMarkHandled={() => markHandled(selectedStop.id)}
          urgent={isUrgent(selectedStop)}
          handled={handledIds.has(selectedStop.id)}
          claim={actionModel === 'claim' && (claimCardScope === 'all' || (dhById[selectedStop.id]?.l1 ?? 'stable') !== 'stable') ? claimBundle(selectedStop) : undefined}
        />
      )}

      {/* Flashing Card Stack — fixed overlay at bottom-left, only when variant is active */}
      <FlashingCardStack
        urgentStops={flashUrgentStops}
        dhById={dhById}
        onClaim={(id) => {
          markHandled(id)
          messageApi.success('Trip claimed')
        }}
        active={isFlashingCard}
      />

      {settingsVisible ? (
        <DisplaySettingsPanel
          pos={settingsPos}
          onDragStart={onSettingsDragStart}
          onClose={() => setSettingsVisible(false)}
          mapTheme={mapTheme}
          onMapThemeChange={setMapTheme}
          cardStyle={cardStyle}
          onCardStyleChange={setCardStyle}
          onOpenGallery={() => setGalleryOpen(true)}
          isTwoLevel={isTwoLevel || isFlashingCard}
          dhCardStyle={dhCardStyle}
          onDhCardStyleChange={setDhCardStyle}
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
          actionPlacement={actionPlacement}
          onActionPlacementChange={setActionPlacement}
          actionModel={actionModel}
          onActionModelChange={setActionModel}
          claimButtonStyle={claimButtonStyle}
          onClaimButtonStyleChange={setClaimButtonStyle}
          claimCardScope={claimCardScope}
          onClaimCardScopeChange={setClaimCardScope}
          claimColorMode={claimColorMode}
          onClaimColorModeChange={setClaimColorMode}
          claimButtonWidth={claimButtonWidth}
          onClaimButtonWidthChange={setClaimButtonWidth}
          showDelayText={showDelayText}
          onShowDelayTextChange={setShowDelayText}
          showDriverStatusText={showDriverStatusText}
          onShowDriverStatusTextChange={setShowDriverStatusText}
          slackPosition={slackPosition}
          onSlackPositionChange={setSlackPosition}
          l2Spacing={l2Spacing}
          onL2SpacingChange={setL2Spacing}
          l2MatchL1Width={l2MatchL1Width}
          onL2MatchL1WidthChange={setL2MatchL1Width}
          showNeedsAttention={showNeedsAttention}
          onShowNeedsAttentionChange={setShowNeedsAttention}
          showRoutes={showRoutes}
          onShowRoutesChange={setShowRoutes}
          showTraffic={showTraffic}
          onShowTrafficChange={setShowTraffic}
          simulating={simulating}
          onToggleSimulate={() => setSimulating((v) => !v)}
          flashingStyle={flashingStyle}
          onFlashingStyleChange={setFlashingStyle}
          highlightBoxPadding={highlightBoxPadding}
          onHighlightBoxPaddingChange={setHighlightBoxPadding}
          l1FontSize={l1FontSize}
          onL1FontSizeChange={setL1FontSize}
          l2FontSize={l2FontSize}
          onL2FontSizeChange={setL2FontSize}
          useDummyData={useDummyData}
          onUseDummyDataChange={setUseDummyData}
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

      <CardStyleGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        samples={gallerySamples}
        handledIds={handledIds}
        showAction={actionPlacement === 'card'}
        getClaim={actionModel === 'claim' ? claimBundle : undefined}
        activeStyle={cardStyle}
        onSelect={(v) => { setCardStyle(v); setGalleryOpen(false) }}
      />
    </div>
  )
}
