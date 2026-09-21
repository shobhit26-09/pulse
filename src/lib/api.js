// Live earth data: USGS quakes, NASA EONET events, ISS, NOAA Kp, launches.
// All free, keyless, CORS-clean public APIs.

export async function fetchIss() {
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

export async function fetchIssTrail() {
  const now = Math.floor(Date.now() / 1000)
  const step = 60
  const stamps = []
  for (let i = 92; i >= 0; i--) stamps.push(now - i * step)
  const chunks = []
  for (let i = 0; i < stamps.length; i += 40) chunks.push(stamps.slice(i, i + 40))
  const out = []
  for (const c of chunks) {
    const res = await fetch(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${c.join(',')}`)
    if (!res.ok) throw new Error('iss trail fetch failed')
    const d = await res.json()
    for (const p of d) out.push({ lat: p.latitude, lon: p.longitude })
  }
  return out
}

export async function fetchQuakes() {
  const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')
  if (!res.ok) throw new Error('quake fetch failed')
  const d = await res.json()
  return (d.features ?? []).map((f) => ({
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

const EONET_KIND = {
  'Severe Storms': 'storm',
  Wildfires: 'fire',
  Volcanoes: 'volcano',
  'Sea and Lake Ice': 'ice',
}

export async function fetchEarthEvents() {
  const res = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60')
  if (!res.ok) throw new Error('eonet fetch failed')
  const d = await res.json()
  const out = []
  for (const e of d.events ?? []) {
    const cat = e.categories?.[0]?.title ?? ''
    const kind = EONET_KIND[cat]
    if (!kind) continue
    const geo = e.geometry?.[e.geometry.length - 1]
    if (!geo) continue
    let lon, lat
    if (typeof geo.coordinates[0] === 'number') {
      ;[lon, lat] = geo.coordinates
    } else {
      ;[lon, lat] = geo.coordinates[0][0]
    }
    out.push({ id: e.id, title: e.title, kind, lat, lon, date: geo.date })
  }
  return out
}

export async function fetchKpIndex() {
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

export async function fetchLaunches() {
  const res = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=4')
  if (!res.ok) throw new Error('launch fetch failed')
  const d = await res.json()
  return (d.results ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    net: l.net,
    pad: l.pad?.location?.name ?? '',
    provider: l.launch_service_provider?.name ?? '',
  }))
}
