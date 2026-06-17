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
}

export const mockStops: VehicleStop[] = [
  { id: '1', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:10', eta: null, driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: false, lat: 1.3360, lng: 103.7790 },
  { id: '2', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:10', eta: '17:15', driver: 'Ronald Abdulah', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3300, lng: 103.8060 },
  { id: '3', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '17:30', eta: '17:20', driver: 'Ronny Chan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3235, lng: 103.8085 },
  { id: '4', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:10', eta: '18:00', driver: 'Geraldy Tan', company: 'Westpoint Transit Ptd L...', plate: 'PC165X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3215, lng: 103.8120 },
  { id: '5', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '18:40', eta: '18:30', driver: 'Aldan Kwok', company: 'Westpoint Transit Ptd L...', plate: 'PC166X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3175, lng: 103.7945 },
  { id: '6', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:00', eta: '19:10', driver: 'Monica Leo', company: 'Westpoint Transit Ptd L...', plate: 'PC166X', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3125, lng: 103.7990 },
  // To Check with NO last seen → no marker, selecting zooms the map out
  { id: '7', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '19:30', eta: null, driver: 'Richard Jen', company: 'Westpoint Transit Ptd L...', plate: 'PC170Y', lastOnline: 'Last Online 5 Sep 15:30', online: false, lat: null, lng: null },
  { id: '8', label: 'Dyson 1', destination: 'Japanese Kindergarten', scheduled: '20:00', eta: '19:55', driver: 'Nicholas Maung', company: 'Westpoint Transit Ptd L...', plate: 'PC170Y', lastOnline: 'Last Online 5 Sep 15:30', online: true, lat: 1.3340, lng: 103.7880 },
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
