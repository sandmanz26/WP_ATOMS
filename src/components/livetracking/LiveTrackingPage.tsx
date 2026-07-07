import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from 'react'
import { GoogleMap, Marker, Polyline, InfoWindow, TrafficLayer, useJsApiLoader } from '@react-google-maps/api'
import { Typography, Input, Button, Select, Popover, Switch, Slider, Tooltip, Checkbox, Drawer } from 'antd'
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
  BgColorsOutlined,
  PushpinOutlined,
  AppstoreOutlined,
  SortAscendingOutlined,
  DownOutlined,
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
  mapTheme,
  onMapThemeChange,
  cardDesign,
  onCardDesignChange,
  markerStyle,
  onMarkerStyleChange,
  listCardStyle,
  onListCardStyleChange,
  tabStyle,
  onTabStyleChange,
  doubleHighlight,
  onDoubleHighlightChange,
  showUrgencyTicker,
  onShowUrgencyTickerChange,
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
  mapTheme: MapTheme
  onMapThemeChange: (v: MapTheme) => void
  cardDesign: CardDesign
  onCardDesignChange: (v: CardDesign) => void
  markerStyle: MarkerStyle
  onMarkerStyleChange: (v: MarkerStyle) => void
  listCardStyle: ListCardStyle
  onListCardStyleChange: (v: ListCardStyle) => void
  tabStyle: TabStyle
  onTabStyleChange: (v: TabStyle) => void
  doubleHighlight: boolean
  onDoubleHighlightChange: (v: boolean) => void
  showUrgencyTicker: boolean
  onShowUrgencyTickerChange: (v: boolean) => void
  showRoutes: boolean
  onShowRoutesChange: (v: boolean) => void
  showTraffic: boolean
  onShowTrafficChange: (v: boolean) => void
  simulating: boolean
  onToggleSimulate: () => void
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
        {/* Map & display controls — merged in from the old floating map panel
            so all of the page's knobs live in one place */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>
              <BgColorsOutlined style={{ marginRight: 6 }} />
              Map theme
            </Text>
            <Select size="small" value={mapTheme} onChange={onMapThemeChange} options={MAP_THEME_OPTIONS} style={{ width: 96 }} dropdownStyle={{ zIndex: 2100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>
              <AppstoreOutlined style={{ marginRight: 6 }} />
              Urgent card variation
            </Text>
            <Select size="small" value={cardDesign} onChange={onCardDesignChange} options={CARD_DESIGN_OPTIONS} style={{ width: 96 }} dropdownStyle={{ zIndex: 2100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>
              <AppstoreOutlined style={{ marginRight: 6 }} />
              Vertical card variation
            </Text>
            <Select size="small" value={listCardStyle} onChange={onListCardStyleChange} options={LIST_CARD_STYLE_OPTIONS} style={{ width: 96 }} dropdownStyle={{ zIndex: 2100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>
              <AppstoreOutlined style={{ marginRight: 6 }} />
              Tab style
            </Text>
            <Select size="small" value={tabStyle} onChange={onTabStyleChange} options={TAB_STYLE_OPTIONS} style={{ width: 96 }} dropdownStyle={{ zIndex: 2100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>Double highlight</Text>
            <Switch size="small" checked={doubleHighlight} onChange={onDoubleHighlightChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>Show urgency cards</Text>
            <Switch size="small" checked={showUrgencyTicker} onChange={onShowUrgencyTickerChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>
              <EnvironmentOutlined style={{ marginRight: 6 }} />
              Marker style
            </Text>
            <Select size="small" value={markerStyle} onChange={onMarkerStyleChange} options={MARKER_STYLE_OPTIONS} style={{ width: 96 }} dropdownStyle={{ zIndex: 2100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>Show routes</Text>
            <Switch size="small" checked={showRoutes} onChange={onShowRoutesChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>Show traffic</Text>
            <Switch size="small" checked={showTraffic} onChange={onShowTrafficChange} />
          </div>
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
  design,
  onSelect,
  onTakeIt,
}: {
  stops: VehicleStop[]
  selectedId: string | null
  design: CardDesign
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
        const cardCls = `urgency-card ${offline ? 'urgency-card-offline' : 'urgency-card-late'}`
        const StatusIcon = offline ? WifiOutlined : ClockCircleOutlined
        const takeBtn = (
          <Button
            size="small"
            icon={<CheckOutlined style={{ fontSize: 10 }} />}
            onClick={(e) => { e.stopPropagation(); onTakeIt(s.id) }}
            style={{ width: '100%', marginTop: 6, fontSize: 11, height: 24 }}
          >
            Take it
          </Button>
        )

        // ── Minimal: an icon-first chip; the details + Take it live in a
        //    hover popover so the strip stays compact ──
        if (design === 'minimal') {
          const popContent = (
            <div style={{ width: 168 }} onClick={(e) => e.stopPropagation()}>
              <Text style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>
                {s.label} · {s.driver}
              </Text>
              <Text style={{ fontSize: 11.5, fontWeight: 600, color: accent, display: 'block', marginTop: 2 }}>
                {offline ? 'Offline' : `Late · ETA ${s.eta ? formatTimeAmPm(s.eta) : '-'}`}
              </Text>
              {offline && s.lastOnline && (
                <Text style={{ fontSize: 10.5, color: '#8c8c8c', display: 'block', marginTop: 1 }}>
                  Last seen {s.lastOnline}
                </Text>
              )}
              {takeBtn}
            </div>
          )
          return (
            <Popover key={s.id} content={popContent} trigger="hover" placement="bottom" mouseEnterDelay={0.05}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id) }}
                className={cardCls}
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  background: '#fff',
                  border: `1px solid ${selected ? accent : '#f0f0f0'}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div className="urgency-strip" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent }} />
                <span className="urgency-ping" style={{ color: accent }} />
                <StatusIcon style={{ color: accent, fontSize: 17, marginTop: 4 }} />
                <Text style={{ fontSize: 10.5, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{s.label}</Text>
              </div>
            </Popover>
          )
        }

        // ── Tidy: same info as default but in an aligned header/body layout ──
        if (design === 'tidy') {
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id) }}
              className={cardCls}
              style={{
                flexShrink: 0,
                width: 184,
                textAlign: 'left',
                background: '#fff',
                border: `1px solid ${selected ? accent : '#f0f0f0'}`,
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div className="urgency-strip" style={{ height: 4, background: accent }} />
              <div style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StatusIcon style={{ color: accent, fontSize: 13 }} />
                    <Text style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a1a' }}>{s.label}</Text>
                  </div>
                  <span
                    style={{
                      background: offline ? '#fff1f0' : '#fffbe6',
                      color: accent,
                      border: `1px solid ${offline ? '#ffccc7' : '#ffe58f'}`,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 7px',
                      borderRadius: 5,
                    }}
                  >
                    {offline ? 'Offline' : 'Late'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', flex: 1, minWidth: 0 }} ellipsis title={s.driver}>
                    {s.driver}
                  </Text>
                  {!offline && (
                    <Text style={{ fontSize: 11, fontWeight: 600, color: accent, whiteSpace: 'nowrap' }}>
                      ETA {s.eta ? formatTimeAmPm(s.eta) : '-'}
                    </Text>
                  )}
                </div>
                {offline && s.lastOnline && (
                  <Text style={{ fontSize: 10.5, color: '#8c8c8c', display: 'block', marginTop: 2 }}>
                    Last seen {s.lastOnline}
                  </Text>
                )}
                {takeBtn}
              </div>
            </div>
          )
        }

        // ── Stripe: left accent bar, notification-style aligned rows ──
        if (design === 'stripe') {
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id) }}
              className={cardCls}
              style={{
                flexShrink: 0,
                width: 190,
                display: 'flex',
                textAlign: 'left',
                background: '#fff',
                border: `1px solid ${selected ? accent : '#f0f0f0'}`,
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div className="urgency-strip" style={{ width: 4, background: accent, flexShrink: 0 }} />
              <div style={{ padding: '8px 10px', flex: 1, minWidth: 0, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <StatusIcon style={{ color: accent, fontSize: 13 }} />
                    <Text style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a1a' }}>{s.label}</Text>
                  </div>
                  <span
                    style={{
                      background: offline ? '#fff1f0' : '#fffbe6',
                      color: accent,
                      border: `1px solid ${offline ? '#ffccc7' : '#ffe58f'}`,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 7px',
                      borderRadius: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {offline ? 'Offline' : 'Late'}
                  </span>
                </div>
                <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginTop: 4 }} ellipsis title={s.driver}>
                  {s.driver}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: 600, color: offline ? '#8c8c8c' : accent, display: 'block', marginTop: 1 }}>
                  {offline
                    ? (s.lastOnline ? `Last seen ${s.lastOnline}` : 'Position unknown')
                    : `ETA ${s.eta ? formatTimeAmPm(s.eta) : '-'}`}
                </Text>
                {takeBtn}
              </div>
            </div>
          )
        }

        // ── Solid: filled colored header band, status-forward and scannable ──
        if (design === 'solid') {
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id) }}
              className={cardCls}
              style={{
                flexShrink: 0,
                width: 172,
                textAlign: 'left',
                background: '#fff',
                border: `1px solid ${selected ? accent : '#f0f0f0'}`,
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div
                style={{
                  background: accent,
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <StatusIcon style={{ color: '#fff', fontSize: 13 }} />
                  <Text style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{s.label}</Text>
                </div>
                <Text style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                  {offline ? 'OFFLINE' : 'LATE'}
                </Text>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <Text style={{ fontSize: 11, color: '#595959', display: 'block' }} ellipsis title={s.driver}>
                  {s.driver}
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: 600, color: '#1a1a1a', display: 'block', marginTop: 1 }}>
                  {offline
                    ? (s.lastOnline ? `Last seen ${s.lastOnline}` : 'Position unknown')
                    : `ETA ${s.eta ? formatTimeAmPm(s.eta) : '-'}`}
                </Text>
                {takeBtn}
              </div>
            </div>
          )
        }

        // ── Compact: single short row, smallest vertical footprint ──
        if (design === 'compact') {
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id) }}
              className={cardCls}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 42,
                paddingRight: 8,
                background: '#fff',
                border: `1px solid ${selected ? accent : '#f0f0f0'}`,
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div className="urgency-strip" style={{ width: 4, alignSelf: 'stretch', background: accent, flexShrink: 0 }} />
              <StatusIcon style={{ color: accent, fontSize: 15, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{s.label}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: 600, color: accent, whiteSpace: 'nowrap' }}>
                  {offline ? 'Offline' : `ETA ${s.eta ? formatTimeAmPm(s.eta) : '-'}`}
                </Text>
              </div>
              <Button
                size="small"
                icon={<CheckOutlined style={{ fontSize: 10 }} />}
                onClick={(e) => { e.stopPropagation(); onTakeIt(s.id) }}
                style={{ marginLeft: 4, fontSize: 11, height: 24, flexShrink: 0 }}
              >
                Take it
              </Button>
            </div>
          )
        }

        // ── Default: the original full card ──
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id) }}
            className={cardCls}
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
                <StatusIcon style={{ color: accent, fontSize: 12 }} />
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
              {offline && s.lastOnline && (
                <Text style={{ fontSize: 10.5, color: '#8c8c8c', display: 'block', marginTop: 1 }}>
                  Last seen {s.lastOnline}
                </Text>
              )}
              {takeBtn}
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

/* ── Filter tab bar — switchable visual styles, switchable from the Test
   Console. The "Offline/Late" tab carries a live counter + pulse so an
   offline or late trip pulls the dispatcher's eye and gets checked. ── */
type FilterKey = 'All' | 'Offline' | 'Online' | 'To Check'
type TabStyle = 'default' | 'segment' | 'color'

const TAB_STYLE_OPTIONS: { value: TabStyle; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'segment', label: 'Segment' },
  { value: 'color', label: 'Color' },
]

type TabItem = { key: FilterKey; label: string; count?: number; urgent?: boolean }

const TAB_COLORS: Record<FilterKey, { c: string; soft: string; border: string }> = {
  All: { c: '#1677ff', soft: '#e6f4ff', border: '#91caff' },
  Offline: { c: '#ff4d4f', soft: '#fff1f0', border: '#ffccc7' },
  Online: { c: '#16a34a', soft: '#f6ffed', border: '#b7eb8f' },
  'To Check': { c: '#faad14', soft: '#fffbe6', border: '#ffe58f' },
}

function CountBadge({ count, active, urgent }: { count: number; active: boolean; urgent?: boolean }) {
  return (
    <span
      style={{
        marginLeft: 6,
        minWidth: 16,
        height: 16,
        padding: '0 5px',
        borderRadius: 8,
        fontSize: 10.5,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'rgba(255,255,255,0.28)' : urgent ? '#ff4d4f' : '#bfbfbf',
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  )
}

function FilterTabs({
  tabStyle,
  value,
  onChange,
  items,
}: {
  tabStyle: TabStyle
  value: FilterKey
  onChange: (key: FilterKey) => void
  items: TabItem[]
}) {
  // Segment style — one connected track, active segment lifts as a white card.
  if (tabStyle === 'segment') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: '#f5f5f5', borderRadius: 10, padding: 3, marginBottom: 12 }}>
        {items.map((it) => {
          const active = value === it.key
          const urgent = it.urgent && (it.count ?? 0) > 0
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={urgent ? 'tab-urgent-pulse' : undefined}
              style={{
                flex: '1 1 auto',
                padding: '6px 10px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: active ? '#fff' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                color: urgent ? '#ff4d4f' : active ? '#1a1a1a' : '#8c8c8c',
                fontSize: 12.5,
                fontWeight: active || urgent ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .15s',
              }}
            >
              {it.label}
              {(it.count ?? 0) > 0 && <CountBadge count={it.count!} active={false} urgent={it.urgent} />}
            </button>
          )
        })}
      </div>
    )
  }

  // Color style — each tab carries its own status hue, so Offline/Late reads
  // red and urgent at a glance even before you read it.
  if (tabStyle === 'color') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {items.map((it) => {
          const active = value === it.key
          const urgent = it.urgent && (it.count ?? 0) > 0
          const { c, soft, border } = TAB_COLORS[it.key]
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={urgent ? 'tab-urgent-pulse' : undefined}
              style={{
                flex: '1 1 auto',
                padding: '7px 12px',
                borderRadius: 18,
                whiteSpace: 'nowrap',
                border: `1px solid ${active || urgent ? c : border}`,
                background: active ? c : urgent ? soft : '#fff',
                color: active ? '#fff' : urgent ? c : '#595959',
                fontSize: 12.5,
                fontWeight: urgent ? 600 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .15s',
              }}
            >
              {it.label}
              {(it.count ?? 0) > 0 && <CountBadge count={it.count!} active={active} urgent={it.urgent} />}
            </button>
          )
        })}
      </div>
    )
  }

  // Default — improved outline pills; the urgent tab switches to a red accent.
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {items.map((it) => {
        const active = value === it.key
        const urgent = it.urgent && (it.count ?? 0) > 0
        const accent = urgent ? '#ff4d4f' : '#1677ff'
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={urgent ? 'tab-urgent-pulse' : undefined}
            style={{
              flex: '1 1 auto',
              padding: '7px 12px',
              borderRadius: 18,
              whiteSpace: 'nowrap',
              border: active ? 'none' : `1px solid ${urgent ? '#ffccc7' : '#e8e8e8'}`,
              background: active ? accent : '#fff',
              color: active ? '#fff' : urgent ? '#ff4d4f' : '#595959',
              fontSize: 13,
              fontWeight: urgent ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all .15s',
            }}
          >
            {it.label}
            {(it.count ?? 0) > 0 && <CountBadge count={it.count!} active={active} urgent={it.urgent} />}
          </button>
        )
      })}
    </div>
  )
}

/* ── Double highlight — two levels of highlights over the trip list.
   Level 1: Immediate attention / At risk / Stable. Selecting one filters
   the cards and reveals its level-2 highlights, which refine further.
   NOTE: the real definitions depend on trip status + schedule margin/slack
   and are still being worked out by the requester — everything below
   derived from `dhDemo*` is deterministic PLACEHOLDER logic so the UI can
   be exercised now, and swapped for the real calculation later. ── */
type DhLevel1 = 'immediate' | 'risk' | 'stable'
type DhLevel2 =
  | 'cur-first' | 'cur-other' | 'next' | 'offline'
  | 'will-first' | 'will-other' | 'no-slack'

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

// Stable pseudo-random per trip so the demo numbers don't jump between renders
function dhHash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return h
}

function dhInfo(stop: VehicleStop): DhInfo {
  const h = dhHash(stop.id)
  const currentDelayMin =
    stop.online && stop.eta ? Math.max(0, toMinutes(stop.eta) - toMinutes(stop.scheduled)) : 0
  // PLACEHOLDER schedule slack: real value = margin between this trip's
  // planned end and the next trip's start, from the scheduling data
  const slackMin = (h % 13) * 5 - 15 - currentDelayMin
  const nextTripDelayMin = Math.max(0, -slackMin)
  // PLACEHOLDER prediction: real value comes from ETA projection vs schedule
  const predictedDelayMin = stop.online && currentDelayMin === 0 && h % 4 === 0 ? (h % 3) * 5 + 5 : 0
  // "First point" vs "other points": early in the route ≈ still heading to
  // the first pickup (placeholder — real flag comes from point registration)
  const atFirstPoint = stop.phase < 0.45

  if (!stop.online) {
    return { l1: 'immediate', l2: 'offline', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  }
  if (currentDelayMin > 0) {
    return { l1: 'immediate', l2: atFirstPoint ? 'cur-first' : 'cur-other', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  }
  if (nextTripDelayMin > 0) {
    return { l1: 'immediate', l2: 'next', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  }
  if (predictedDelayMin > 0) {
    return { l1: 'risk', l2: atFirstPoint ? 'will-first' : 'will-other', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  }
  if (slackMin <= 5) {
    return { l1: 'risk', l2: 'no-slack', currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
  }
  return { l1: 'stable', l2: null, currentDelayMin, nextTripDelayMin, predictedDelayMin, slackMin }
}

function slackChipColors(slackMin: number): { color: string; bg: string; border: string } {
  if (slackMin < 0) return { color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' }
  if (slackMin <= 5) return { color: '#d48806', bg: '#fffbe6', border: '#ffe58f' }
  return { color: '#16a34a', bg: '#f6ffed', border: '#b7eb8f' }
}

/* ── Double-highlight trip card: basic info + slack minutes; delay figures
   appear only when the trip is under Immediate attention / At risk ── */
function DhCard({
  stop,
  info,
  selected,
  onSelect,
  innerRef,
}: {
  stop: VehicleStop
  info: DhInfo
  selected: boolean
  onSelect: () => void
  innerRef: (el: HTMLDivElement | null) => void
}) {
  const accent = info.l1 === 'immediate' ? '#ff4d4f' : info.l1 === 'risk' ? '#faad14' : '#16a34a'
  // Trip status per the requirement: on time / will be late / late / offline…
  const baseStatus = deriveStatus(stop)
  const statusLabel = !stop.online
    ? 'Offline'
    : info.currentDelayMin > 0
      ? 'Late'
      : info.predictedDelayMin > 0
        ? 'Will be late'
        : baseStatus
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
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      style={{
        display: 'flex',
        background: selected ? '#e6f4ff' : '#fff',
        border: `1px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
        borderRadius: 10,
        marginBottom: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <span style={{ width: 4, background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
        {/* Basic info: route code + start time + trip status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {stop.label}
          </span>
          <ClockCircleOutlined style={{ fontSize: 11.5, color: '#8c8c8c', flexShrink: 0 }} />
          <Text style={{ fontSize: 12.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{formatTimeAmPm(stop.scheduled)}</Text>
          <span
            style={{
              marginLeft: 'auto',
              background: statusStyle.bg,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
              fontSize: 11,
              fontWeight: 500,
              padding: '1px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Driver (first name) + driver status + plate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, minWidth: 0 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 13, flexShrink: 0 }} />
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{firstName(stop.driver)}</Text>
          <Text style={{ fontSize: 11.5, color: stop.online ? '#16a34a' : '#ff4d4f', flexShrink: 0 }}>
            {stop.online ? 'Online' : 'Offline'}
          </Text>
          <Text style={{ fontSize: 12.5, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
        </div>

        {/* Schedule slack in minutes (+30 min / 0 min / -10 min) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              background: slack.bg,
              color: slack.color,
              border: `1px solid ${slack.border}`,
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}
          >
            Slack {info.slackMin > 0 ? `+${info.slackMin}` : info.slackMin} min
          </span>
          {/* Delay figures only when under Immediate attention / At risk */}
          {showDelays && (
            <>
              {(info.currentDelayMin > 0 || info.predictedDelayMin > 0) && (
                <Text style={{ fontSize: 11.5, color: '#ff4d4f', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Current trip {info.currentDelayMin > 0 ? `+${info.currentDelayMin}` : `~+${info.predictedDelayMin}`} min
                </Text>
              )}
              {info.nextTripDelayMin > 0 && (
                <Text style={{ fontSize: 11.5, color: '#d48806', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Next trip +{info.nextTripDelayMin} min
                </Text>
              )}
            </>
          )}
        </div>
      </div>
    </div>
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
/* ── Driver list sorting ── */
type SortKey = 'default' | 'status' | 'eta' | 'label' | 'driver'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Default order' },
  { key: 'status', label: 'Status (urgent first)' },
  { key: 'eta', label: 'ETA (earliest first)' },
  { key: 'label', label: 'Bus label (A–Z)' },
  { key: 'driver', label: 'Driver name (A–Z)' },
]

// Lower rank = more urgent, so it sorts to the top.
function statusRank(s: VehicleStop): number {
  if (!s.online) return 0
  switch (deriveStatus(s)) {
    case 'Late': return 1
    case 'To Check': return 2
    case 'Notified': return 3
    default: return 4 // On Time
  }
}

/* ── Which fields each driver card shows — user-controlled from the filter
   popover so the list can be made as dense or as detailed as needed ── */
type CardFields = {
  route: boolean
  startTime: boolean
  etaStatus: boolean
  driverPlate: boolean
  fleetOwner: boolean
}

const DEFAULT_CARD_FIELDS: CardFields = {
  route: true,
  startTime: true,
  etaStatus: true,
  driverPlate: true,
  fleetOwner: true,
}

const CARD_FIELD_OPTIONS: { key: keyof CardFields; label: string }[] = [
  { key: 'route', label: 'Route' },
  { key: 'startTime', label: 'Trip start time' },
  { key: 'etaStatus', label: 'ETA & status' },
  { key: 'driverPlate', label: 'Driver & plate' },
  { key: 'fleetOwner', label: 'Fleet owner' },
]

/* ── Vertical driver-list card variations (the cards next to the map). Every
   variation shows the route code, trip start time, the driver's first name and
   the vehicle plate, with a status-colour accent — switchable from the Test
   Console. "detailed" reuses the fuller DriverCard below. ── */
type ListCardStyle = 'detailed' | 'compact' | 'split' | 'minimal' | 'accordion'

const LIST_CARD_STYLE_OPTIONS: { value: ListCardStyle; label: string }[] = [
  { value: 'detailed', label: 'Detailed' },
  { value: 'compact', label: 'Compact' },
  { value: 'split', label: 'Split' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'accordion', label: 'Accordion' },
]

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0]
}

function listCardColor(stop: VehicleStop): string {
  if (!stop.online) return '#ff4d4f'
  switch (deriveStatus(stop)) {
    case 'Late': return '#faad14'
    case 'Notified': return '#1677ff'
    case 'To Check': return '#ff4d4f'
    default: return '#16a34a'
  }
}

function ListCard({
  stop,
  selected,
  onSelect,
  variant,
}: {
  stop: VehicleStop
  selected: boolean
  onSelect: () => void
  variant: Exclude<ListCardStyle, 'detailed'>
}) {
  const color = listCardColor(stop)
  const name = firstName(stop.driver)
  const start = formatTimeAmPm(stop.scheduled)
  const border = selected ? '#1677ff' : '#f0f0f0'
  const routeChip = (
    <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 4 }}>
      {stop.label}
    </span>
  )

  // Accordion: a lean collapsed row; clicking expands the detail inline in
  // the list (selection doubles as the expanded state) — no drawer needed.
  if (variant === 'accordion') {
    const status = deriveStatus(stop)
    const s = STATUS_STYLE[status]
    const statusLabel = stop.online ? status : 'Offline'
    const lateMin = stop.online && status === 'Late' && stop.eta ? toMinutes(stop.eta) - toMinutes(stop.scheduled) : 0
    const detailRow = (label: string, value: React.ReactNode) => (
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', minWidth: 0 }}>
        <Text style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, width: 76, flexShrink: 0 }}>
          {label}
        </Text>
        <div style={{ fontSize: 12.5, color: '#1a1a1a', minWidth: 0, flex: 1 }}>{value}</div>
      </div>
    )
    return (
      <div
        onClick={onSelect}
        style={{ display: 'flex', background: selected ? '#f0f7ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, marginBottom: 8, cursor: 'pointer', overflow: 'hidden', transition: 'background .15s, border-color .15s' }}
      >
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
          {/* Collapsed row — the minimum to recognise the trip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {routeChip}
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
            <Text style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>{stop.plate}</Text>
            <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10.5, fontWeight: 500, padding: '0 7px', borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {statusLabel}
            </span>
            <DownOutlined
              style={{ fontSize: 10, color: '#bfbfbf', flexShrink: 0, transform: selected ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
            />
          </div>

          {/* Expanded detail — shown inline when the card is selected */}
          {selected && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e6f0fa', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {detailRow(
                'Route',
                stop.from && stop.to ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Text style={{ fontSize: 12.5, color: '#595959' }} ellipsis>{stop.from.name}</Text>
                    <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 10, flexShrink: 0 }} />
                    <Text style={{ fontSize: 12.5, fontWeight: 600 }} ellipsis>{stop.to.name}</Text>
                  </div>
                ) : (
                  <Text style={{ fontSize: 12.5, fontWeight: 600 }}>{stop.destination}</Text>
                ),
              )}
              {detailRow('Trip start', start)}
              {detailRow(
                'ETA',
                stop.online && stop.eta ? (
                  <span style={{ color: lateMin > 0 ? '#ff4d4f' : '#1677ff', fontWeight: 700 }}>
                    {formatTimeAmPm(stop.eta)}
                    {lateMin > 0 && <span style={{ fontWeight: 500 }}> · {lateMin} min late</span>}
                  </span>
                ) : !stop.online ? (
                  <span style={{ color: '#ff4d4f', fontWeight: 600 }}>Last seen {stop.lastOnline ?? 'unknown'}</span>
                ) : (
                  <span style={{ color: '#8c8c8c' }}>—</span>
                ),
              )}
              {detailRow('Driver', <span style={{ fontWeight: 600 }}>{stop.driver}</span>)}
              {detailRow('Fleet owner', stop.fleetOwner)}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'split') {
    return (
      <div
        onClick={onSelect}
        style={{ display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, marginBottom: 12, cursor: 'pointer', overflow: 'hidden' }}
      >
        <span style={{ width: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {routeChip}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <ClockCircleOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
              <Text style={{ fontSize: 12.5, color: '#8c8c8c' }}>{start}</Text>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, borderLeft: '1px solid #f0f0f0', paddingLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{name}</Text>
            <Text style={{ fontSize: 12.5, color: '#8c8c8c' }}>{stop.plate}</Text>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div
        onClick={onSelect}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {routeChip}
        <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', minWidth: 0 }} ellipsis>{name}</Text>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>{stop.plate}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{start}</Text>
        </div>
      </div>
    )
  }

  // compact
  return (
    <div
      onClick={onSelect}
      style={{ display: 'flex', background: selected ? '#e6f4ff' : '#fff', border: `1px solid ${border}`, borderRadius: 10, marginBottom: 12, cursor: 'pointer', overflow: 'hidden' }}
    >
      <span style={{ width: 4, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {routeChip}
          <Text style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1a1a' }}>{stop.plate}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <ClockCircleOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
            <Text style={{ fontSize: 12.5, color: '#8c8c8c' }}>{start}</Text>
          </div>
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{name}</Text>
        </div>
      </div>
    </div>
  )
}

function DriverCard({
  stop,
  selected,
  onSelect,
  innerRef,
  overridden,
  onClearOverride,
  fields,
}: {
  stop: VehicleStop
  selected: boolean
  onSelect: () => void
  innerRef: (el: HTMLDivElement | null) => void
  // Set when this trip's status was force-set via the Test Console switcher
  // rather than computed live — surfaced here so ops scanning the list can
  // tell at a glance which rows aren't trustworthy live data.
  overridden: boolean
  onClearOverride: () => void
  fields: CardFields
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
      {fields.route && (stop.from && stop.to ? (
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
      ))}

      {/* Trip Start Time (PRD §4.2.2) */}
      {fields.startTime && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
          <Text style={{ fontSize: 13, color: '#8c8c8c' }}>{formatTimeAmPm(stop.scheduled)}</Text>
        </div>
      )}

      {/* ETA + Trip Status — hidden once first point is registered (BR-002) */}
      {fields.etaStatus && (showStatusAndEta ? (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {overridden && (
              <Tooltip title="Status manually pinned via Test Console — not live. Click to revert to Auto.">
                <PushpinOutlined
                  onClick={(e) => {
                    e.stopPropagation()
                    onClearOverride()
                  }}
                  style={{ color: '#8c8c8c', fontSize: 13, cursor: 'pointer' }}
                />
              </Tooltip>
            )}
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
      ))}

      {/* Driver + plate */}
      {fields.driverPlate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <WifiOutlined style={{ color: stop.online ? '#52c41a' : '#ff4d4f', fontSize: 15 }} />
          <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{stop.driver}</Text>
          <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginLeft: 'auto' }}>{stop.plate}</Text>
        </div>
      )}

      {/* Fleet Owner + last online (offline drivers only, per BR-012) */}
      {fields.fleetOwner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: '#bfbfbf' }}>{stop.fleetOwner}</Text>
          {!stop.online && stop.lastOnline && (
            <Text style={{ fontSize: 12, color: '#bfbfbf' }}>Last online {stop.lastOnline}</Text>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Small labelled block used inside the detail bottom sheet ── */
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
        <div style={{ height: '100%', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#ff4d4f', textAlign: 'center', padding: 24 }}>
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

/* ── Map color themes — applied via the GoogleMap `styles` option. "Default"
   sends an empty array (Google's stock look); the rest recolor roads,
   water, land and POI so ops can switch to something easier on the eyes
   for long shifts or low-light rooms ── */
const MAP_THEMES = {
  default: [],
  silver: [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
    { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  ],
  night: [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
    { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
    { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
  ],
  retro: [
    { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#523735' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f1e6' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9b2a6' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#a5b076' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f1e6' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdfcf8' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e9bc62' }] },
    { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#b9d3c2' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#92998d' }] },
  ],
} as const satisfies Record<string, google.maps.MapTypeStyle[]>

type MapTheme = keyof typeof MAP_THEMES

const MAP_THEME_OPTIONS: { value: MapTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'silver', label: 'Silver' },
  { value: 'night', label: 'Night' },
  { value: 'retro', label: 'Retro' },
]

/* ── Urgency ticker card layout variants, switchable from the map controls ──
   default = full card (label + driver + ETA + Take it)
   minimal = icon-first chip, the rest revealed on hover
   tidy    = same info as default but in a cleaner, aligned layout
   stripe  = left accent bar, notification-style aligned rows
   solid   = filled colored header band, status-forward and scannable
   compact = single short row, smallest vertical footprint */
type CardDesign = 'default' | 'minimal' | 'tidy' | 'stripe' | 'solid' | 'compact'

const CARD_DESIGN_OPTIONS: { value: CardDesign; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'tidy', label: 'Tidy' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'solid', label: 'Solid' },
  { value: 'compact', label: 'Compact' },
]

/* ── Driver marker styles, switchable from the map controls ──
   vehicle = steering-wheel pin (familiar, online/offline aware)
   label   = pin showing the bus code so each marker is identifiable at a glance
   status  = colored dot conveying the trip's status (urgency) without a click */
type MarkerStyle = 'vehicle' | 'label' | 'status' | 'bus'

const MARKER_STYLE_OPTIONS: { value: MarkerStyle; label: string }[] = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'label', label: 'Label' },
  { value: 'status', label: 'Status' },
  { value: 'bus', label: 'Bus' },
]

// Saturated, status-meaningful colors for the label/status marker styles —
// offline always reads red since its live position is stale.
function markerColor(stop: VehicleStop): string {
  if (!stop.online) return '#ff4d4f'
  switch (deriveStatus(stop)) {
    case 'On Time':
      return '#16a34a'
    case 'Late':
      return '#faad14'
    case 'Notified':
      return '#1677ff'
    default:
      return '#ff4d4f' // To Check
  }
}

/* ── Marker: rounded "tag" showing the bus code, color-coded by status ── */
function makeLabelIcon(label: string, color: string, selected: boolean): google.maps.Icon {
  const w = Math.max(46, 16 + label.length * 8.4)
  const h = 24
  const totalH = h + 8
  const stroke = selected ? '#1677ff' : '#ffffff'
  const sw = selected ? 3 : 2
  const cx = w / 2
  const svg = `
    <svg width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <path d="M${cx - 7} ${h - 2} L${cx} ${totalH - 1} L${cx + 7} ${h - 2} Z" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h}" rx="7" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <text x="${cx}" y="${h / 2 + 4.5}" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" font-weight="700" fill="#ffffff">${label}</text>
    </svg>
  `
  return {
    url: svgDataUrl(svg),
    scaledSize: new google.maps.Size(w, totalH),
    anchor: new google.maps.Point(cx, totalH),
  }
}

/* ── Marker: status dot — solid colored circle (online) or hollow with a slash
   (offline, position is stale) ── */
function makeStatusDotIcon(color: string, selected: boolean, offline: boolean): google.maps.Icon {
  const size = selected ? 30 : 24
  const c = size / 2
  const r = c - 3
  const ring = selected ? '#1677ff' : '#ffffff'
  const inner = offline
    ? `<line x1="${c - r * 0.5}" y1="${c - r * 0.5}" x2="${c + r * 0.5}" y2="${c + r * 0.5}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<circle cx="${c}" cy="${c}" r="${r * 0.34}" fill="#ffffff"/>`
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${c}" cy="${c}" r="${r}" fill="${offline ? '#ffffff' : color}" stroke="${offline ? color : ring}" stroke-width="${selected ? 3 : 2.4}"/>
      ${inner}
    </svg>
  `
  return {
    url: svgDataUrl(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(c, c),
  }
}

/* ── Marker: circular badge with a bus glyph, filled by trip-status color
   (green on time, amber late, red offline/to-check) with a white ring and a
   soft drop shadow; turns blue when selected. Reads as "a bus is here, and
   here's how it's doing" at a glance without opening the tooltip. ── */
function makeBusBadgeIcon(color: string, selected: boolean): google.maps.Icon {
  const size = selected ? 44 : 36
  const pad = 6 // breathing room so the drop shadow isn't clipped
  const total = size + pad * 2
  const c = total / 2
  const r = size / 2 - (selected ? 2 : 1.5)
  const fill = selected ? '#1677ff' : color
  const sw = selected ? 3 : 2.5
  const g = size * 0.56 // bus glyph box, centered in the circle
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

/* ── Google Maps view: only mounted once an API key is configured, so the
   loader script is never requested otherwise ── */
function LiveMapView({
  filtered,
  selectedId,
  selectedStop,
  posRef,
  showRoutes,
  showTraffic,
  mapTheme,
  markerStyle,
  onSelect,
  onClose,
  onRouteResolved,
}: {
  filtered: VehicleStop[]
  selectedId: string | null
  selectedStop: VehicleStop | null
  posRef: React.MutableRefObject<Record<string, [number, number] | null>>
  showRoutes: boolean
  showTraffic: boolean
  mapTheme: MapTheme
  markerStyle: MarkerStyle
  onSelect: (id: string) => void
  onClose: () => void
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
      <div style={{ height: '100%', minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f' }}>
        Failed to load Google Maps: {loadError.message}
      </div>
    )
  }
  if (!isLoaded) {
    return (
      <div style={{ height: '100%', minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
        Loading Google Maps…
      </div>
    )
  }

  return (
    <GoogleMap
      center={{ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }}
      zoom={DEFAULT_ZOOM}
      mapContainerStyle={{ height: '100%', minHeight: 0, width: '100%' }}
      onLoad={(map) => { mapRef.current = map }}
      options={{
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        styles: MAP_THEMES[mapTheme],
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
                    ? { strokeColor: '#1677ff', strokeWeight: 7.5, strokeOpacity: 0.95 }
                    : { strokeColor: '#64748b', strokeWeight: 4.5, strokeOpacity: dim ? 0.1 : 0.4 }
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
          // Vehicle style reuses the four memoized steering-wheel pins; label
          // and status styles are cheap per-marker SVGs colored by trip status.
          const icon =
            markerStyle === 'label'
              ? makeLabelIcon(stop.label, markerColor(stop), sel)
              : markerStyle === 'status'
                ? makeStatusDotIcon(markerColor(stop), sel, !stop.online)
                : markerStyle === 'bus'
                  ? makeBusBadgeIcon(markerColor(stop), sel)
                  : stop.online
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
                  <InfoWindow position={{ lat, lng }} onCloseClick={onClose} options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -38) }}>
                    <div style={{ minWidth: 188, fontSize: 12.5, position: 'relative' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onClose() }}
                        aria-label="Close"
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          background: 'transparent',
                          color: '#bfbfbf',
                          cursor: 'pointer',
                          padding: 0,
                          borderRadius: 4,
                        }}
                      >
                        <CloseOutlined style={{ fontSize: 12 }} />
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 18 }}>
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
                          <Text style={{ fontSize: 12, color: tripStatus === 'Late' ? '#ff4d4f' : '#8c8c8c' }}>
                            ETA{' '}
                            <strong style={{ color: tripStatus === 'Late' ? '#ff4d4f' : '#1a1a1a' }}>
                              {stop.eta ? formatTimeAmPm(stop.eta) : '-'}
                            </strong>
                            {tripStatus === 'Late' && stop.eta && (
                              <> · {toMinutes(stop.eta) - toMinutes(stop.scheduled)} min late</>
                            )}
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
  const [sortOpen, setSortOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('default')
  const [cardFields, setCardFields] = useState<CardFields>(DEFAULT_CARD_FIELDS)
  const [customerCode, setCustomerCode] = useState('')
  const [fleetOwner, setFleetOwner] = useState('')
  const [driverFilter, setDriverFilter] = useState<string | undefined>()
  const [vehicleFilter, setVehicleFilter] = useState<string | undefined>()
  const [driverStatus, setDriverStatus] = useState<string | undefined>()
  const [tripStatus, setTripStatus] = useState<string | undefined>()

  // Map layer toggles + movement simulation
  const [showRoutes, setShowRoutes] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)
  const [mapTheme, setMapTheme] = useState<MapTheme>('silver')
  const [cardDesign, setCardDesign] = useState<CardDesign>('default')
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>('bus')
  const [tabStyle, setTabStyle] = useState<TabStyle>('default')
  const [listCardStyle, setListCardStyle] = useState<ListCardStyle>('detailed')
  // Double highlight mode — default view per the requirement: level 1
  // "Immediate attention" with level 2 "Current trip delayed (first point)"
  const [doubleHighlight, setDoubleHighlight] = useState(false)
  const [dhLevel1, setDhLevel1] = useState<DhLevel1>('immediate')
  const [dhLevel2, setDhLevel2] = useState<DhLevel2 | null>('cur-first')
  // Urgency ticker is hidden by default to keep the view clean; toggled on
  // from the Test Console "Map & display" section when needed.
  const [showUrgencyTicker, setShowUrgencyTicker] = useState(false)
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

  // The "Offline/Late" tab groups everything that needs attention — offline
  // trips and on-time-but-running-late trips — matching the urgency ticker set.
  const isOfflineOrLate = (s: VehicleStop) => !s.online || deriveStatus(s) === 'Late'
  const offlineLateCount = stops.filter(isOfflineOrLate).length

  // Double-highlight classification for every trip (placeholder logic in
  // dhInfo until the real slack/margin calculation lands)
  const dhByld: Record<string, DhInfo> = Object.fromEntries(stops.map((s) => [s.id, dhInfo(s)]))
  const dhL1Counts: Record<DhLevel1, number> = { immediate: 0, risk: 0, stable: 0 }
  const dhL2Counts: Record<string, number> = {}
  stops.forEach((s) => {
    const info = dhByld[s.id]
    dhL1Counts[info.l1] += 1
    if (info.l2) dhL2Counts[info.l2] = (dhL2Counts[info.l2] ?? 0) + 1
  })

  const filtered = stops.filter((s) => {
    if (doubleHighlight) {
      // Level 1 filters the cards; a selected level 2 refines further
      const info = dhByld[s.id]
      if (info.l1 !== dhLevel1) return false
      if (dhLevel1 !== 'stable' && dhLevel2 && info.l2 !== dhLevel2) return false
    } else {
      if (filter === 'Online' && !s.online) return false
      if (filter === 'Offline' && !isOfflineOrLate(s)) return false
      if (filter === 'To Check' && !takenIds.has(s.id)) return false
    }
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

  const sorted = sortBy === 'default' ? filtered : [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'status': return statusRank(a) - statusRank(b)
      case 'eta': {
        const av = a.online && a.eta ? toMinutes(a.eta) : Infinity
        const bv = b.online && b.eta ? toMinutes(b.eta) : Infinity
        return av - bv
      }
      case 'label': return a.label.localeCompare(b.label)
      case 'driver': return a.driver.localeCompare(b.driver)
      default: return 0
    }
  })

  const sortContent = (
    <div style={{ width: 196 }}>
      {SORT_OPTIONS.map((o) => (
        <div
          key={o.key}
          onClick={() => { setSortBy(o.key); setSortOpen(false) }}
          style={{
            padding: '7px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            background: sortBy === o.key ? '#e6f4ff' : 'transparent',
            color: sortBy === o.key ? '#1677ff' : '#595959',
            fontSize: 13,
          }}
        >
          {o.label}
          {sortBy === o.key && <CheckOutlined style={{ fontSize: 12 }} />}
        </div>
      ))}
    </div>
  )

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

      {/* Card field visibility — lets the user control how much detail each
          card in the vertical list shows */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>Show in card</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
          {CARD_FIELD_OPTIONS.map((f) => (
            <Checkbox
              key={f.key}
              checked={cardFields[f.key]}
              onChange={(e) => setCardFields((prev) => ({ ...prev, [f.key]: e.target.checked }))}
            >
              {f.label}
            </Checkbox>
          ))}
        </div>
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
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 96px)',
        }}
      >
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* ── Left column: stat cards + map ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Stat cards (Late / To Check) hidden for now per request — keep
                the markup so it can be brought back without rebuilding it. */}
            {false && (
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
            )}

            {showUrgencyTicker && (
              <UrgencyTicker stops={urgentStops} selectedId={selectedId} design={cardDesign} onSelect={setSelectedId} onTakeIt={onTakeIt} />
            )}

            {/* Map */}
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #f0f0f0',
                flex: 1,
                minHeight: 0,
              }}
            >
              {!GOOGLE_MAPS_API_KEY ? (
                <div
                  style={{
                    height: '100%',
                    minHeight: 0,
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
                    mapTheme={mapTheme}
                    markerStyle={markerStyle}
                    onSelect={setSelectedId}
                    onClose={() => setSelectedId(null)}
                    onRouteResolved={onRouteResolved}
                  />
                </MapErrorBoundary>
              )}

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
            <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
                  content={sortContent}
                  trigger="click"
                  open={sortOpen}
                  onOpenChange={setSortOpen}
                  placement="bottomRight"
                >
                  <Button
                    icon={<SortAscendingOutlined />}
                    style={{
                      borderColor: sortBy !== 'default' ? '#1677ff' : '#e8e8e8',
                      color: sortBy !== 'default' ? '#1677ff' : '#595959',
                    }}
                    title="Sort"
                  />
                </Popover>
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

              {doubleHighlight ? (
                <>
                  {/* Level 1 highlights */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {DH_L1_META.map((m) => {
                      const active = dhLevel1 === m.key
                      return (
                        <button
                          key={m.key}
                          onClick={() => {
                            // Picking a level 1 resets level 2 — its own
                            // sub-highlights then refine from there
                            setDhLevel1(m.key)
                            setDhLevel2(null)
                          }}
                          className={m.key === 'immediate' && dhL1Counts.immediate > 0 && !active ? 'tab-urgent-pulse' : undefined}
                          style={{
                            flex: '1 1 auto',
                            padding: '6px 8px',
                            borderRadius: 16,
                            whiteSpace: 'nowrap',
                            border: `1px solid ${active ? m.color : m.border}`,
                            background: active ? m.color : m.soft,
                            color: active ? '#fff' : m.color,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all .15s',
                          }}
                        >
                          {m.label} ({dhL1Counts[m.key]})
                        </button>
                      )
                    })}
                  </div>
                  {/* Level 2 highlights — none for "Stable" */}
                  {dhLevel1 !== 'stable' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {DH_L2_META[dhLevel1].map((m) => {
                        const active = dhLevel2 === m.key
                        const count = dhL2Counts[m.key] ?? 0
                        return (
                          <button
                            key={m.key}
                            onClick={() => setDhLevel2(active ? null : m.key)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: `1px solid ${active ? '#1677ff' : '#e8e8e8'}`,
                              background: active ? '#e6f4ff' : '#fff',
                              color: active ? '#1677ff' : count === 0 ? '#bfbfbf' : '#595959',
                              fontSize: 11.5,
                              fontWeight: active ? 600 : 500,
                              cursor: 'pointer',
                              transition: 'all .15s',
                            }}
                          >
                            {m.label} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {dhLevel1 === 'stable' && <div style={{ marginBottom: 12 }} />}
                </>
              ) : (
                /* Filter tabs (style switchable from the Test Console) */
                <FilterTabs
                  tabStyle={tabStyle}
                  value={filter}
                  onChange={setFilter}
                  items={[
                    { key: 'All', label: 'All' },
                    { key: 'Offline', label: 'Offline/Late', count: offlineLateCount, urgent: true },
                    { key: 'Online', label: 'Online' },
                    { key: 'To Check', label: 'To Check', count: takenIds.size },
                  ]}
                />
              )}

              {/* Driver list */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 2 }}>
                {sorted.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf', fontSize: 13 }}>
                    No drivers found
                  </div>
                ) : (
                  sorted.map((stop) =>
                    doubleHighlight ? (
                      <DhCard
                        key={stop.id}
                        stop={stop}
                        info={dhByld[stop.id]}
                        selected={selectedId === stop.id}
                        onSelect={() => setSelectedId(stop.id)}
                        innerRef={(el) => {
                          cardRefs.current[stop.id] = el
                        }}
                      />
                    ) : listCardStyle === 'detailed' ? (
                      <DriverCard
                        key={stop.id}
                        stop={stop}
                        selected={selectedId === stop.id}
                        onSelect={() => setSelectedId(stop.id)}
                        innerRef={(el) => {
                          cardRefs.current[stop.id] = el
                        }}
                        overridden={(statusOverrides[stop.id] ?? 'auto') !== 'auto'}
                        onClearOverride={() => setOverride(stop.id, 'auto')}
                        fields={cardFields}
                      />
                    ) : (
                      <ListCard
                        key={stop.id}
                        stop={stop}
                        selected={selectedId === stop.id}
                        onSelect={() =>
                          // Accordion: clicking the expanded card collapses it
                          setSelectedId(listCardStyle === 'accordion' && selectedId === stop.id ? null : stop.id)
                        }
                        variant={listCardStyle}
                      />
                    ),
                  )
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

      {/* Detail drawer — opens from the right when a card or marker is
          selected, showing the selected trip's full detail */}
      <Drawer
        title="Trip detail"
        placement="right"
        width={380}
        // Accordion cards show the detail inline, so the drawer stays shut
        // there — except in double-highlight mode, which uses its own cards
        open={!!selectedStop && (doubleHighlight || listCardStyle !== 'accordion')}
        onClose={() => setSelectedId(null)}
      >
        {selectedStop && (() => {
          const st = selectedStop
          const status = deriveStatus(st)
          const style = STATUS_STYLE[status]
          const statusLabel = st.online ? status : 'Offline'
          const lateMin = st.online && status === 'Late' && st.eta ? toMinutes(st.eta) - toMinutes(st.scheduled) : 0
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WifiOutlined style={{ color: st.online ? '#52c41a' : '#ff4d4f', fontSize: 16 }} />
                <span style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 12.5, fontWeight: 600, padding: '2px 9px', borderRadius: 5 }}>{st.label}</span>
                <span style={{ background: '#f5f5f5', color: '#595959', fontSize: 12.5, fontWeight: 500, padding: '2px 9px', borderRadius: 5 }}>{st.customerCode}</span>
                <span style={{ marginLeft: 'auto', background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 6 }}>{statusLabel}</span>
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
          mapTheme={mapTheme}
          onMapThemeChange={setMapTheme}
          cardDesign={cardDesign}
          onCardDesignChange={setCardDesign}
          markerStyle={markerStyle}
          onMarkerStyleChange={setMarkerStyle}
          listCardStyle={listCardStyle}
          onListCardStyleChange={setListCardStyle}
          tabStyle={tabStyle}
          onTabStyleChange={setTabStyle}
          doubleHighlight={doubleHighlight}
          onDoubleHighlightChange={setDoubleHighlight}
          showUrgencyTicker={showUrgencyTicker}
          onShowUrgencyTickerChange={setShowUrgencyTicker}
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
