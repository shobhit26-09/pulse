export interface IssPosition {
  lat: number
  lon: number
  altitudeKm: number
  velocityKmh: number
  visibility: string
  timestamp: number
}

export interface Quake {
  id: string
  mag: number
  place: string
  time: number
  lat: number
  lon: number
  depthKm: number
  tsunami: boolean
}

export type EventKind = 'storm' | 'fire' | 'volcano' | 'ice' | 'other'

export interface EarthEvent {
  id: string
  title: string
  kind: EventKind
  lat: number
  lon: number
  date: string
}

export interface Launch {
  id: string
  name: string
  net: string
  pad: string
  provider: string
}

export async function fetchIss(): Promise<IssPosition> {
  const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544')
  if (!res.ok) throw new Error('iss fetch failed')
  const d = await res.json()
  return {
    lat: d.latitude,
    lon: d.longitude,
    altitudeKm: d.altitude,
    velocityKmh: d.velocity,
    visibility: d.visibility,
    timestamp: d.timestamp,
  }
}

export async function fetchIssTrail(): Promise<{ lat: number; lon: number }[]> {
  const now = Math.floor(Date.now() / 1000)
  const step = 60
  const stamps: number[] = []
  for (let i = 92; i >= 0; i--) stamps.push(now - i * step)
  const chunks: number[][] = []
  for (let i = 0; i < stamps.length; i += 40) chunks.push(stamps.slice(i, i + 40))
  const out: { lat: number; lon: number }[] = []
  for (const c of chunks) {
    const res = await fetch(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${c.join(',')}`)
    if (!res.ok) throw new Error('iss trail fetch failed')
    const d = await res.json()
    for (const p of d) out.push({ lat: p.latitude, lon: p.longitude })
  }
  return out
}

export async function fetchQuakes(): Promise<Quake[]> {
  const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')
  if (!res.ok) throw new Error('quake fetch failed')
  const d = await res.json()
  return (d.features ?? []).map((f: any) => ({
    id: f.id,
    mag: f.properties.mag ?? 0,
    place: f.properties.place ?? 'Unknown region',
    time: f.properties.time,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    depthKm: f.geometry.coordinates[2],
    tsunami: f.properties.tsunami === 1,
  }))
}

const EONET_KIND: Record<string, EventKind> = {
  'Severe Storms': 'storm',
  Wildfires: 'fire',
  Volcanoes: 'volcano',
  'Sea and Lake Ice': 'ice',
}

export async function fetchEarthEvents(): Promise<EarthEvent[]> {
  const res = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60')
  if (!res.ok) throw new Error('eonet fetch failed')
  const d = await res.json()
  const out: EarthEvent[] = []
  for (const e of d.events ?? []) {
    const cat = e.categories?.[0]?.title ?? ''
    const kind = EONET_KIND[cat]
    if (!kind) continue
    const geo = e.geometry?.[e.geometry.length - 1]
    if (!geo) continue
    // Some geometries are polygons ([ [ [lon,lat], ... ] ]); take the first coordinate pair
    let lon: number, lat: number
    if (typeof geo.coordinates[0] === 'number') {
      ;[lon, lat] = geo.coordinates
    } else {
      ;[lon, lat] = geo.coordinates[0][0]
    }
    out.push({ id: e.id, title: e.title, kind, lat, lon, date: geo.date })
  }
  return out
}

export async function fetchKpIndex(): Promise<number | null> {
  try {
    const res = await fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json')
    if (!res.ok) return null
    const d = await res.json()
    const last = d[d.length - 1]
    return typeof last?.kp_index === 'number' ? last.kp_index : null
  } catch {
    return null
  }
}

export async function fetchLaunches(): Promise<Launch[]> {
  const res = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=4')
  if (!res.ok) throw new Error('launch fetch failed')
  const d = await res.json()
  return (d.results ?? []).map((l: any) => ({
    id: l.id,
    name: l.name,
    net: l.net,
    pad: l.pad?.location?.name ?? '',
    provider: l.launch_service_provider?.name ?? '',
  }))
}
