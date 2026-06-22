// Shared data + pure logic for Live Tracking and Tracking 2.0.
// Both pages consume this single source of truth so they stay in sync.

// PRD MOVE-1608 §4.2.3: On Time / Late / To Check, plus Notified (after a
// push notification has been sent — see §4.5).
export type TripStatus = 'On Time' | 'Late' | 'To Check' | 'Notified'

export interface TripPoint {
  name: string
  code?: string // school/client code, used to derive the trip's Customer Code
  lat: number
  lng: number
}

export interface VehicleStop {
  id: string
  label: string // Bus Label (PRD §4.2.2)
  destination: string // = the trip's "to" name (kept for card display + search)
  customerCode: string // PRD §4.2.2 — client identifier (e.g. "ASL", "Dyson")
  scheduled: string
  eta: string | null
  driver: string
  fleetOwner: string // PRD §4.2.2 — Westpoint (own fleet) or sub-contractor name
  plate: string
  lastOnline?: string // PRD §4.2.4/BR-012 — only meaningful when offline
  online: boolean
  notified?: boolean // PRD §4.5 — push notification sent, awaiting driver response
  firstPointRegistered?: boolean // PRD §4.2.3/BR-002 — hides status + ETA once true
  // Each trip has its own origin & destination (they are NOT all the same)
  from?: TripPoint
  to?: TripPoint
  // Multi-point route from -> to; undefined when there is no live trip data
  route?: [number, number][]
  // How far along the route the bus currently is (0..1)
  phase: number
  // Current live position (derived from route + phase); null = no last seen
  lat: number | null
  lng: number | null
}

// Pickup points (trip origins)
const ORIGINS = {
  bukitTimahPlaza: { name: 'Bukit Timah Plaza', lat: 1.3402, lng: 103.7765 },
  sixthAvenue: { name: 'Sixth Avenue', lat: 1.3330, lng: 103.7880 },
  clementi: { name: 'Clementi Ave 3', lat: 1.3150, lng: 103.7660 },
  hollandV: { name: 'Holland Village', lat: 1.3112, lng: 103.7958 },
  adamRoad: { name: 'Adam Road', lat: 1.3232, lng: 103.8132 },
  botanicMrt: { name: 'Botanic Gardens MRT', lat: 1.3225, lng: 103.8155 },
  kingAlbert: { name: 'King Albert Park', lat: 1.3358, lng: 103.7833 },
  farrerRoad: { name: 'Farrer Road', lat: 1.3175, lng: 103.8070 },
} as const

// Schools (trip destinations) — `code` is the client/Customer Code (PRD §4.2.2)
const SCHOOLS = {
  japaneseKg: { name: 'Japanese Kindergarten', code: 'JPKG', lat: 1.3300, lng: 103.7740 },
  nanyangPri: { name: 'Nanyang Primary', code: 'NYPS', lat: 1.3206, lng: 103.8068 },
  hwaChong: { name: 'Hwa Chong Institution', code: 'HCI', lat: 1.3258, lng: 103.8042 },
  rafflesGirls: { name: "Raffles Girls' Primary", code: 'RGPS', lat: 1.3350, lng: 103.7805 },
  methodistGirls: { name: "Methodist Girls' School", code: 'MGS', lat: 1.3343, lng: 103.7715 },
  njc: { name: 'National Junior College', code: 'NJC', lat: 1.3247, lng: 103.8009 },
  henryPark: { name: 'Henry Park Primary', code: 'HPPS', lat: 1.3185, lng: 103.7855 },
  peiHwa: { name: 'Pei Hwa Presbyterian', code: 'PHPS', lat: 1.3402, lng: 103.7720 },
} as const

// Kept for backward-compat (Tracking 2.0 single demo destination marker)
export const DESTINATION: [number, number] = [SCHOOLS.japaneseKg.lat, SCHOOLS.japaneseKg.lng]
export const DESTINATION_NAME = SCHOOLS.japaneseKg.name

// Build a multi-point (curved) route between two points so a marker can be
// animated along several route points.
export function buildRoute(from: TripPoint, to: TripPoint): [number, number][] {
  const dy = to.lat - from.lat
  const dx = to.lng - from.lng
  const len = Math.hypot(dy, dx) || 1
  const perpLat = -dx / len
  const perpLng = dy / len
  const sign = Math.round((from.lat + from.lng + to.lng) * 10000) % 2 === 0 ? 1 : -1
  const amp = Math.min(len * 0.18, 0.006) * sign
  const N = 6 // → 7 route points
  const pts: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const curve = Math.sin(t * Math.PI) * amp
    pts.push([from.lat + dy * t + perpLat * curve, from.lng + dx * t + perpLng * curve])
  }
  return pts
}

// Interpolate a position along a route at fraction t (0..1) — used by the
// movement simulation.
export function pointAlong(route: [number, number][], t: number): [number, number] {
  if (route.length === 0) return DESTINATION
  if (t <= 0) return route[0]
  if (t >= 1) return route[route.length - 1]
  const segs = route.length - 1
  const scaled = t * segs
  const i = Math.floor(scaled)
  const local = scaled - i
  const a = route[i]
  const b = route[Math.min(i + 1, route.length - 1)]
  return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local]
}

// Each trip = a driver running from a pickup point to a school, on its own
// route. `tracked: false` means the bus has no live GPS (To Check, no last seen).
interface BaseTrip {
  id: string
  label: string
  scheduled: string
  eta: string | null
  driver: string
  plate: string
  lastOnline?: string
  online: boolean
  from: TripPoint
  to: TripPoint
  phase: number
  tracked?: boolean
  notified?: boolean
  firstPointRegistered?: boolean
}

// Vehicle → Fleet Owner (PRD §4.2.2). One vehicle belongs to one fleet
// owner — either Westpoint's own fleet or a sub-contractor.
const FLEET_OWNER_BY_PLATE: Record<string, string> = {
  PC165X: 'Westpoint Transit',
  PC166X: 'Westpoint Coach',
  PC170Y: 'Westpoint Tours',
  PC181A: 'Westpoint Rapid',
  PC182B: 'Golden Bus Services (Sub-con)',
  PC183C: 'ABC Transport Pte Ltd (Sub-con)',
  PC184D: 'Westpoint Transit',
  PC185E: 'Westpoint Coach',
  PC186F: 'Golden Bus Services (Sub-con)',
  PC187G: 'Westpoint Rapid',
  PC188H: 'ABC Transport Pte Ltd (Sub-con)',
  PC189J: 'Westpoint Tours',
  PC190K: 'Westpoint Transit',
}

const baseTrips: BaseTrip[] = [
  // "To Check" that has already been notified (PRD §4.5) → shows as "Notified"
  { id: '1', label: 'BT-01', scheduled: '17:10', eta: null, driver: 'Ronald Abdulah', plate: 'PC165X', lastOnline: '21 Jun 2026, 03:30 PM', online: false, from: ORIGINS.bukitTimahPlaza, to: SCHOOLS.methodistGirls, phase: 0.35, notified: true },
  { id: '2', label: 'AR-04', scheduled: '17:10', eta: '17:15', driver: 'Ronald Abdulah', plate: 'PC165X', online: true, from: ORIGINS.adamRoad, to: SCHOOLS.nanyangPri, phase: 0.5 },
  { id: '3', label: 'AR-09', scheduled: '17:30', eta: '17:20', driver: 'Ronny Chan', plate: 'PC165X', online: true, from: ORIGINS.adamRoad, to: SCHOOLS.njc, phase: 0.45 },
  { id: '4', label: 'BG-02', scheduled: '18:10', eta: '18:00', driver: 'Geraldy Tan', plate: 'PC165X', online: true, from: ORIGINS.botanicMrt, to: SCHOOLS.hwaChong, phase: 0.4 },
  { id: '5', label: 'HV-07', scheduled: '18:40', eta: '18:30', driver: 'Aldan Kwok', plate: 'PC166X', online: true, from: ORIGINS.hollandV, to: SCHOOLS.henryPark, phase: 0.5 },
  { id: '6', label: 'HV-03', scheduled: '19:00', eta: '19:10', driver: 'Monica Leo', plate: 'PC166X', online: true, from: ORIGINS.hollandV, to: SCHOOLS.japaneseKg, phase: 0.4 },
  // To Check with NO last seen → no marker, selecting zooms the map out
  { id: '7', label: 'KA-05', scheduled: '19:30', eta: null, driver: 'Richard Jen', plate: 'PC170Y', lastOnline: '21 Jun 2026, 11:05 AM', online: false, from: ORIGINS.kingAlbert, to: SCHOOLS.rafflesGirls, phase: 0, tracked: false },
  // Driver has registered the first point → status + ETA hidden (BR-002)
  { id: '8', label: 'KA-08', scheduled: '20:00', eta: '19:55', driver: 'Nicholas Maung', plate: 'PC170Y', online: true, from: ORIGINS.kingAlbert, to: SCHOOLS.peiHwa, phase: 0.35, firstPointRegistered: true },

  // ── 15 currently-active (online) drivers ──
  { id: '9', label: 'SA-01', scheduled: '16:20', eta: '16:15', driver: 'Hafiz Rahman', plate: 'PC181A', online: true, from: ORIGINS.sixthAvenue, to: SCHOOLS.rafflesGirls, phase: 0.3 },
  { id: '10', label: 'SA-05', scheduled: '16:40', eta: '16:50', driver: 'Tan Wei Ming', plate: 'PC181A', online: true, from: ORIGINS.sixthAvenue, to: SCHOOLS.methodistGirls, phase: 0.5 },
  { id: '11', label: 'AR-02', scheduled: '17:00', eta: '16:55', driver: 'Kumar Raj', plate: 'PC182B', online: true, from: ORIGINS.adamRoad, to: SCHOOLS.hwaChong, phase: 0.4 },
  { id: '12', label: 'BG-06', scheduled: '17:20', eta: '17:10', driver: 'Siti Nurhaliza', plate: 'PC182B', online: true, from: ORIGINS.botanicMrt, to: SCHOOLS.njc, phase: 0.55 },
  { id: '13', label: 'FR-03', scheduled: '17:40', eta: '17:35', driver: 'Lim Jia Hao', plate: 'PC183C', online: true, from: ORIGINS.farrerRoad, to: SCHOOLS.henryPark, phase: 0.45 },
  { id: '14', label: 'CL-04', scheduled: '18:00', eta: '18:05', driver: 'Daniel Wong', plate: 'PC183C', online: true, from: ORIGINS.clementi, to: SCHOOLS.henryPark, phase: 0.5 },
  { id: '15', label: 'FR-07', scheduled: '18:20', eta: '18:15', driver: 'Arjun Pillai', plate: 'PC184D', online: true, from: ORIGINS.farrerRoad, to: SCHOOLS.nanyangPri, phase: 0.4 },
  { id: '16', label: 'AR-11', scheduled: '16:30', eta: '16:20', driver: 'Chua Beng Huat', plate: 'PC185E', online: true, from: ORIGINS.adamRoad, to: SCHOOLS.njc, phase: 0.6 },
  { id: '17', label: 'HV-09', scheduled: '16:50', eta: '16:45', driver: 'Faizal Osman', plate: 'PC185E', online: true, from: ORIGINS.hollandV, to: SCHOOLS.henryPark, phase: 0.35 },
  { id: '18', label: 'HV-12', scheduled: '17:10', eta: '17:25', driver: 'Grace Ng', plate: 'PC186F', online: true, from: ORIGINS.hollandV, to: SCHOOLS.japaneseKg, phase: 0.5 },
  { id: '19', label: 'KA-02', scheduled: '17:35', eta: '17:30', driver: 'Marcus Lee', plate: 'PC187G', online: true, from: ORIGINS.kingAlbert, to: SCHOOLS.rafflesGirls, phase: 0.4 },
  { id: '20', label: 'SA-08', scheduled: '18:30', eta: '18:25', driver: 'Priya Devi', plate: 'PC187G', online: true, from: ORIGINS.sixthAvenue, to: SCHOOLS.japaneseKg, phase: 0.45 },
  { id: '21', label: 'BG-10', scheduled: '18:50', eta: '18:45', driver: 'Zul Hakim', plate: 'PC188H', online: true, from: ORIGINS.botanicMrt, to: SCHOOLS.hwaChong, phase: 0.5 },
  { id: '22', label: 'FR-11', scheduled: '19:10', eta: '19:20', driver: 'Vincent Goh', plate: 'PC189J', online: true, from: ORIGINS.farrerRoad, to: SCHOOLS.henryPark, phase: 0.4 },
  { id: '23', label: 'CL-09', scheduled: '19:30', eta: '19:25', driver: 'Nuraini Binte', plate: 'PC190K', online: true, from: ORIGINS.clementi, to: SCHOOLS.methodistGirls, phase: 0.45 },
]

export const mockStops: VehicleStop[] = baseTrips.map((t) => {
  const tracked = t.tracked !== false
  const route = tracked ? buildRoute(t.from, t.to) : undefined
  const pos = route ? pointAlong(route, t.phase) : null
  return {
    id: t.id,
    label: t.label,
    destination: t.to.name,
    customerCode: t.to.code ?? '—',
    scheduled: t.scheduled,
    eta: t.eta,
    driver: t.driver,
    fleetOwner: FLEET_OWNER_BY_PLATE[t.plate] ?? 'Westpoint Transit',
    plate: t.plate,
    lastOnline: t.lastOnline,
    online: t.online,
    notified: t.notified,
    firstPointRegistered: t.firstPointRegistered,
    from: t.from,
    to: t.to,
    route,
    phase: t.phase,
    lat: pos ? pos[0] : null,
    lng: pos ? pos[1] : null,
  }
})

export const routePath: [number, number][] = [
  [1.3380, 103.7720],
  [1.3360, 103.7790],
  [1.3320, 103.7950],
  [1.3300, 103.8060],
  [1.3235, 103.8085],
  [1.3215, 103.8120],
]

export const routePath2: [number, number][] = [
  [1.3300, 103.8060],
  [1.3250, 103.8020],
  [1.3175, 103.7945],
  [1.3125, 103.7990],
]

export const DEFAULT_CENTER: [number, number] = [1.3270, 103.7950]
export const DEFAULT_ZOOM = 14
export const FOCUS_ZOOM = 16
export const ZOOM_OUT = 12

/* ── Live road conditions (traffic) ── */
export type TrafficLevel = 'smooth' | 'moderate' | 'heavy'

export interface TrafficSegment {
  id: string
  road: string
  level: TrafficLevel
  path: [number, number][]
}

export const TRAFFIC_COLOR: Record<TrafficLevel, string> = {
  smooth: '#16a34a',
  moderate: '#f59e0b',
  heavy: '#ef4444',
}

export const TRAFFIC_LABEL: Record<TrafficLevel, string> = {
  smooth: 'Smooth',
  moderate: 'Moderate',
  heavy: 'Heavy',
}

// Mock live traffic along the main corridors the fleet uses.
export const trafficSegments: TrafficSegment[] = [
  { id: 't1', road: 'PIE', level: 'heavy', path: [[1.3392, 103.8030], [1.3360, 103.8120], [1.3318, 103.8175]] },
  { id: 't2', road: 'Bukit Timah Rd', level: 'moderate', path: [[1.3382, 103.7720], [1.3352, 103.7840], [1.3320, 103.7950]] },
  { id: 't3', road: 'Dunearn Rd', level: 'smooth', path: [[1.3300, 103.8060], [1.3268, 103.8072], [1.3235, 103.8085]] },
  { id: 't4', road: 'Adam Rd', level: 'moderate', path: [[1.3262, 103.8135], [1.3238, 103.8128], [1.3215, 103.8120]] },
  { id: 't5', road: 'Holland Rd', level: 'smooth', path: [[1.3125, 103.7990], [1.3150, 103.7968], [1.3175, 103.7945]] },
  { id: 't6', road: 'Farrer Rd', level: 'heavy', path: [[1.3215, 103.8120], [1.3185, 103.8030], [1.3160, 103.7960]] },
]

// Derive trip status from ETA vs scheduled start time
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// PRD §4.2.3: On Time/Late require the driver to be online with an ETA;
// To Check covers both "online, no ETA yet" and "offline"; Notified
// overrides everything once a push notification has been sent (§4.5).
export function deriveStatus(stop: { online: boolean; eta: string | null; scheduled: string; notified?: boolean }): TripStatus {
  if (stop.notified) return 'Notified'
  if (!stop.online || !stop.eta) return 'To Check'
  return toMinutes(stop.eta) > toMinutes(stop.scheduled) ? 'Late' : 'On Time'
}

// PRD §4.2.5 — ETA / Trip Start Time are displayed as "HH:MM AM/PM"
export function formatTimeAmPm(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export const STATUS_STYLE: Record<TripStatus, { color: string; bg: string; border: string }> = {
  'On Time': { color: '#52c41a', bg: '#f6ffed', border: '#d9f7be' },
  Late: { color: '#d4b106', bg: '#fffbe6', border: '#ffe58f' },
  'To Check': { color: '#ffffff', bg: '#ff4d4f', border: '#ff4d4f' },
  Notified: { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
}
