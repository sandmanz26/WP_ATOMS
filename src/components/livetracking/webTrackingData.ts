// Web tracking links — MOVE-3676 (Live Tracking 2.0 → trip card "⋯" → Web
// Tracking Links), with link behaviour from the FMS ticket it points at
// (MOVE-1685) and the feature list agreed with the product team (13 Oct 2026):
//
//   driver    — Map + traffic, Driver's location, Routelist, Route points, Registration
//   passenger — Map + traffic, ETA, Driver's location, Passenger location,
//               Routelist, Route points, Registration
//
// Live Tracking is an older module that was never deployed, so the tickets may
// lag the product team's current intent; where they disagree the chat wins and
// the gap is logged in CHANGELOG.md.
//
// Everything here is demo data derived from the trip the link was copied from
// (Live Tracking 2.0's `DUMMY_STOPS`, falling back to `baseTrips`), so the page
// shows that same trip's route, driver and vehicle.

import { baseTrips, type TripPoint } from './trackingData'
import { DUMMY_STOPS } from './dummyLiveData'

export type WebTrackingAudience = 'driver' | 'passenger'

export interface WtPoint {
  id: string
  name: string
  lat: number
  lng: number
  /** Scheduled time at this point, "HH:mm". */
  scheduled: string
}

export interface WtRoute {
  id: string
  /** Route code + start time, the format used across ops: "WP 1 (3:00 PM)". */
  code: string
  start: string
  end: string
  points: WtPoint[]
}

export interface WtTrip {
  tripId: string
  date: string
  driver: string
  driverPhone: string
  plate: string
  fleetOwner: string
  customer: string
  routes: WtRoute[]
}

/** Extra pickup names so each route has 4–5 points, not just from → to. */
const WAYPOINTS: TripPoint[] = [
  { name: 'Beauty World MRT (Exit A)', lat: 1.3415, lng: 103.7760 },
  { name: 'Bukit Timah Shopping Centre', lat: 1.3428, lng: 103.7767 },
  { name: 'Coronation Plaza', lat: 1.3235, lng: 103.8075 },
  { name: 'Cluny Court', lat: 1.3220, lng: 103.8150 },
  { name: 'Blk 12 Toh Yi Drive', lat: 1.3378, lng: 103.7738 },
  { name: 'Sixth Avenue Centre', lat: 1.3305, lng: 103.7965 },
]

const pad = (n: number) => String(n).padStart(2, '0')
function addMin(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m + min
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`
}

export function formatAmPm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Deterministic, so "Generate" twice returns the same URLs (MOVE-1685 biz req 1.3). */
function shortHash(s: string): string {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0).toString(36).slice(0, 6)
}

export function webTrackingToken(tripId: string, audience: WebTrackingAudience): string {
  return `${tripId}-${shortHash(`${audience}:${tripId}`)}`
}

export function webTrackingUrl(tripId: string, audience: WebTrackingAudience): string {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''
  return `${base}#/web-tracking/${audience}/${webTrackingToken(tripId, audience)}`
}

/** Parses `#/web-tracking/<audience>/<token>`; null when the hash isn't a tracking link. */
export function parseWebTrackingHash(hash: string): { audience: WebTrackingAudience; tripId: string } | null {
  const m = hash.match(/^#\/web-tracking\/(driver|passenger)\/([^/?#]+)/)
  if (!m) return null
  const audience = m[1] as WebTrackingAudience
  const tripId = m[2].split('-')[0]
  return webTrackingToken(tripId, audience) === m[2] ? { audience, tripId } : null
}

function routeFrom(id: string, code: string, start: string, stops: TripPoint[]): WtRoute {
  const points = stops.map((p, i) => ({ id: `${id}-p${i + 1}`, name: p.name, lat: p.lat, lng: p.lng, scheduled: addMin(start, i * 8) }))
  return { id, code: `${code} (${formatAmPm(start)})`, start, end: points[points.length - 1].scheduled, points }
}

/** Pickup names for the dummy (Live Tracking 2.0) trips, which only carry a destination. */
const PICKUPS = ['Jurong East MRT (Exit C)', 'Blk 135 Jurong Gateway Rd', 'Boon Lay Interchange', 'Pioneer MRT (Exit B)', 'Joo Koon Interchange', 'Gul Circle MRT']

export function webTrip(tripId: string): WtTrip | null {
  const d = DUMMY_STOPS.find((s) => s.id === tripId)
  if (d && d.lat !== null && d.lng !== null) {
    const n = Number(d.id) || 0
    // Four points around the bus's current position, ending at the trip's destination.
    const offs: [number, number][] = [[-0.012, -0.018], [-0.004, -0.006], [0.004, 0.006], [0.011, 0.016]]
    const stops = offs.map(([a, b], i) => ({
      name: i === offs.length - 1 ? d.destination : PICKUPS[(n + i) % PICKUPS.length],
      lat: d.lat! + a,
      lng: d.lng! + b,
    }))
    const back = [...stops].reverse().map((p, i) => (i === stops.length - 1 ? { ...p, name: PICKUPS[(n + 4) % PICKUPS.length] } : p))
    return {
      tripId: d.id,
      date: '13 Oct 2026',
      driver: d.driver,
      driverPhone: d._driverPhone,
      plate: d.plate,
      fleetOwner: d.fleetOwner,
      customer: d.customerCode,
      routes: [
        routeFrom(`${d.id}-r1`, d.label, d.scheduled, stops),
        routeFrom(`${d.id}-r2`, `${d.label} (Return)`, addMin(d.scheduled, 60), back),
      ],
    }
  }
  const t = baseTrips.find((b) => b.id === tripId)
  if (!t) return null
  const n = Number(t.id)
  const w = (k: number) => WAYPOINTS[(n + k) % WAYPOINTS.length]
  const second = addMin(t.scheduled, 50)
  return {
    tripId: t.id,
    date: '13 Oct 2026',
    driver: t.driver,
    driverPhone: '+65 8888 1234',
    plate: t.plate,
    fleetOwner: 'Westpoint Transit',
    customer: t.to.code ? `${t.to.name} (${t.to.code})` : t.to.name,
    routes: [
      routeFrom(`${t.id}-r1`, t.label, t.scheduled, [t.from, w(0), w(1), t.to]),
      routeFrom(`${t.id}-r2`, `${t.label}R`, second, [t.to, w(2), w(3), t.from]),
    ],
  }
}

/** Straight-line interpolation between consecutive points (no Directions API needed). */
export function positionAlong(points: WtPoint[], progress: number): [number, number] {
  if (points.length === 0) return [1.3521, 103.8198]
  const segs = points.length - 1
  const p = Math.max(0, Math.min(segs, progress))
  const i = Math.min(segs - 1, Math.floor(p))
  const f = p - i
  const a = points[i]
  const b = points[i + 1] ?? a
  return [a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f]
}
