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

export const mockStops: VehicleStop[] = [
  { id: '1', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:10', eta: null, driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: false, lat: 1.3360, lng: 103.7790, route: [[1.3360, 103.7790], [1.3336, 103.7772], [1.3312, 103.7754], [1.3300, 103.7740]] },
  { id: '2', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:10', eta: '17:15', driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3300, lng: 103.8060, route: [[1.3300, 103.8060], [1.3305, 103.7960], [1.3302, 103.7850], [1.3300, 103.7740]] },
  { id: '3', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:30', eta: '17:20', driver: 'Ronny Chan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3235, lng: 103.8085, route: [[1.3235, 103.8085], [1.3262, 103.7950], [1.3285, 103.7840], [1.3300, 103.7740]] },
  { id: '4', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:10', eta: '18:00', driver: 'Geraldy Tan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3215, lng: 103.8120, route: [[1.3215, 103.8120], [1.3255, 103.7960], [1.3285, 103.7850], [1.3300, 103.7740]] },
  { id: '5', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:40', eta: '18:30', driver: 'Aldan Kwok', company: 'Westpoint Transit Ptd L...', plate: 'PC166X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3175, lng: 103.7945, route: [[1.3175, 103.7945], [1.3230, 103.7860], [1.3275, 103.7795], [1.3300, 103.7740]] },
  { id: '6', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:00', eta: '19:10', driver: 'Monica Leo', company: 'Westpoint Transit Ptd L...', plate: 'PC166X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3125, lng: 103.7990, route: [[1.3125, 103.7990], [1.3200, 103.7880], [1.3265, 103.7800], [1.3300, 103.7740]] },
  // To Check with NO last seen → no marker, selecting zooms the map out
  { id: '7', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:30', eta: null, driver: 'Richard Jen', company: 'Westpoint Transit Ptd L...', plate: 'PC170Y', lastOnline: 'Last Online 5 Sep 15:30', online: false, lat: null, lng: null },
  { id: '8', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '20:00', eta: '19:55', driver: 'Nicholas Maung', company: 'Westpoint Transit Ptd L...', plate: 'PC170Y', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3340, lng: 103.7880, route: [[1.3340, 103.7880], [1.3328, 103.7820], [1.3312, 103.7770], [1.3300, 103.7740]] },
]

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
