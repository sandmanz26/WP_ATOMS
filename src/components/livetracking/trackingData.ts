// Shared data + pure logic for Live Tracking and Tracking 2.0.
// Both pages consume this single source of truth so they stay in sync.

export type TripStatus = 'On Time' | 'Late' | 'To Check'

export interface VehicleStop {
  id: string
  label: string
  destination: string
  scheduled: string
  eta: string | null
  driver: string
  company: string
  plate: string
  lastOnline: string
  online: boolean
  // current position for available drivers, or last-seen for To Check.
  // null = no known location (no driver last seen)
  lat: number | null
  lng: number | null
  // planned route from current position to the destination (school).
  // undefined when there is no known live position.
  route?: [number, number][]
}

// Shared trip destination (the school the buses are heading to)
export const DESTINATION: [number, number] = [1.3300, 103.7740]
export const DESTINATION_NAME = 'Japanese Kindergarten'

// Build a multi-point (curved) route from a live position to the destination.
// Each route has several waypoints so markers can be animated along it.
export function routeTo(lat: number, lng: number): [number, number][] {
  const [dLat, dLng] = DESTINATION
  const dy = dLat - lat
  const dx = dLng - lng
  const len = Math.hypot(dy, dx) || 1
  // unit perpendicular vector (for a gentle bend)
  const perpLat = -dx / len
  const perpLng = dy / len
  // deterministic curve direction + amplitude so each driver bends differently
  const sign = Math.round((lat + lng) * 10000) % 2 === 0 ? 1 : -1
  const amp = 0.006 * sign
  const N = 6 // → 7 route points
  const pts: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const curve = Math.sin(t * Math.PI) * amp
    pts.push([lat + dy * t + perpLat * curve, lng + dx * t + perpLng * curve])
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

// Base fleet data (positions only). Routes are generated centrally below so
// every located driver gets a consistent multi-point route.
const baseStops: Omit<VehicleStop, 'route'>[] = [
  { id: '1', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:10', eta: null, driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: false, lat: 1.3360, lng: 103.7790 },
  { id: '2', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:10', eta: '17:15', driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3300, lng: 103.8060 },
  { id: '3', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:30', eta: '17:20', driver: 'Ronny Chan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3235, lng: 103.8085 },
  { id: '4', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:10', eta: '18:00', driver: 'Geraldy Tan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3215, lng: 103.8120 },
  { id: '5', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:40', eta: '18:30', driver: 'Aldan Kwok', company: 'Westpoint Transit Ptd L...', plate: 'PC166X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3175, lng: 103.7945 },
  { id: '6', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:00', eta: '19:10', driver: 'Monica Leo', company: 'Westpoint Transit Ptd L...', plate: 'PC166X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3125, lng: 103.7990 },
  // To Check with NO last seen → no marker, selecting zooms the map out
  { id: '7', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:30', eta: null, driver: 'Richard Jen', company: 'Westpoint Transit Ptd L...', plate: 'PC170Y', lastOnline: 'Last Online 5 Sep 15:30', online: false, lat: null, lng: null },
  { id: '8', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '20:00', eta: '19:55', driver: 'Nicholas Maung', company: 'Westpoint Transit Ptd L...', plate: 'PC170Y', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3340, lng: 103.7880 },

  // ── 15 currently-active (online) drivers ──
  { id: '9', label: 'Dyson 2', destination: 'Japanese Kindergarten', scheduled: '16:20', eta: '16:15', driver: 'Hafiz Rahman', company: 'Westpoint Transit Ptd L...', plate: 'PC181A', lastOnline: 'Online now', online: true, lat: 1.3385, lng: 103.7850 },
  { id: '10', label: 'Dyson 2', destination: 'Japanese Kindergarten', scheduled: '16:40', eta: '16:50', driver: 'Tan Wei Ming', company: 'Westpoint Transit Ptd L...', plate: 'PC181A', lastOnline: 'Online now', online: true, lat: 1.3350, lng: 103.7990 },
  { id: '11', label: 'Dyson 3', destination: 'Japanese Kindergarten', scheduled: '17:00', eta: '16:55', driver: 'Kumar Raj', company: 'Westpoint Transit Ptd L...', plate: 'PC182B', lastOnline: 'Online now', online: true, lat: 1.3320, lng: 103.8090 },
  { id: '12', label: 'Dyson 3', destination: 'Japanese Kindergarten', scheduled: '17:20', eta: '17:10', driver: 'Siti Nurhaliza', company: 'Westpoint Transit Ptd L...', plate: 'PC182B', lastOnline: 'Online now', online: true, lat: 1.3280, lng: 103.8140 },
  { id: '13', label: 'Marina 1', destination: 'Japanese Kindergarten', scheduled: '17:40', eta: '17:35', driver: 'Lim Jia Hao', company: 'Westpoint Transit Ptd L...', plate: 'PC183C', lastOnline: 'Online now', online: true, lat: 1.3250, lng: 103.7900 },
  { id: '14', label: 'Marina 1', destination: 'Japanese Kindergarten', scheduled: '18:00', eta: '18:05', driver: 'Daniel Wong', company: 'Westpoint Transit Ptd L...', plate: 'PC183C', lastOnline: 'Online now', online: true, lat: 1.3225, lng: 103.7820 },
  { id: '15', label: 'Marina 2', destination: 'Japanese Kindergarten', scheduled: '18:20', eta: '18:15', driver: 'Arjun Pillai', company: 'Westpoint Transit Ptd L...', plate: 'PC184D', lastOnline: 'Online now', online: true, lat: 1.3190, lng: 103.8060 },
  { id: '16', label: 'Apple 1', destination: 'Japanese Kindergarten', scheduled: '16:30', eta: '16:20', driver: 'Chua Beng Huat', company: 'Westpoint Transit Ptd L...', plate: 'PC185E', lastOnline: 'Online now', online: true, lat: 1.3160, lng: 103.8120 },
  { id: '17', label: 'Apple 1', destination: 'Japanese Kindergarten', scheduled: '16:50', eta: '16:45', driver: 'Faizal Osman', company: 'Westpoint Transit Ptd L...', plate: 'PC185E', lastOnline: 'Online now', online: true, lat: 1.3140, lng: 103.7880 },
  { id: '18', label: 'Apple 2', destination: 'Japanese Kindergarten', scheduled: '17:10', eta: '17:25', driver: 'Grace Ng', company: 'Westpoint Transit Ptd L...', plate: 'PC186F', lastOnline: 'Online now', online: true, lat: 1.3110, lng: 103.7950 },
  { id: '19', label: 'Orchard 1', destination: 'Japanese Kindergarten', scheduled: '17:35', eta: '17:30', driver: 'Marcus Lee', company: 'Westpoint Transit Ptd L...', plate: 'PC187G', lastOnline: 'Online now', online: true, lat: 1.3370, lng: 103.7920 },
  { id: '20', label: 'Orchard 1', destination: 'Japanese Kindergarten', scheduled: '18:30', eta: '18:25', driver: 'Priya Devi', company: 'Westpoint Transit Ptd L...', plate: 'PC187G', lastOnline: 'Online now', online: true, lat: 1.3290, lng: 103.7970 },
  { id: '21', label: 'Sentosa 1', destination: 'Japanese Kindergarten', scheduled: '18:50', eta: '18:45', driver: 'Zul Hakim', company: 'Westpoint Transit Ptd L...', plate: 'PC188H', lastOnline: 'Online now', online: true, lat: 1.3260, lng: 103.8030 },
  { id: '22', label: 'Sentosa 1', destination: 'Japanese Kindergarten', scheduled: '19:10', eta: '19:20', driver: 'Vincent Goh', company: 'Westpoint Transit Ptd L...', plate: 'PC189J', lastOnline: 'Online now', online: true, lat: 1.3205, lng: 103.7960 },
  { id: '23', label: 'Changi 1', destination: 'Japanese Kindergarten', scheduled: '19:30', eta: '19:25', driver: 'Nuraini Binte', company: 'Westpoint Transit Ptd L...', plate: 'PC190K', lastOnline: 'Online now', online: true, lat: 1.3155, lng: 103.7830 },
]

export const mockStops: VehicleStop[] = baseStops.map((s) => ({
  ...s,
  route: s.lat != null && s.lng != null ? routeTo(s.lat, s.lng) : undefined,
}))

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

export function deriveStatus(scheduled: string, eta: string | null): TripStatus {
  if (!eta) return 'To Check'
  return toMinutes(eta) > toMinutes(scheduled) ? 'Late' : 'On Time'
}

export const STATUS_STYLE: Record<TripStatus, { color: string; bg: string; border: string }> = {
  'On Time': { color: '#52c41a', bg: '#f6ffed', border: '#d9f7be' },
  Late: { color: '#d4b106', bg: '#fffbe6', border: '#ffe58f' },
  'To Check': { color: '#ffffff', bg: '#ff4d4f', border: '#ff4d4f' },
}
