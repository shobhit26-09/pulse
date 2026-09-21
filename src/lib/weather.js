// Open-Meteo: free, keyless, CORS-clean. Capital weather + local time.
const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Storm + hail', 99: 'Storm + hail',
}

const cache = new Map()
export async function fetchCapitalNow(lat, lon) {
  const key = `${lat},${lon}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < 15 * 60000) return hit.data
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather failed')
  const d = await res.json()
  const off = d.utc_offset_seconds ?? 0
  const now = new Date(Date.now() + off * 1000)
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  const data = {
    temp: Math.round(d.current?.temperature_2m ?? 0),
    cond: WMO[d.current?.weather_code] ?? 'Unknown',
    wind: Math.round(d.current?.wind_speed_10m ?? 0),
    localTime: `${hh}:${mm}`,
    tz: d.timezone ?? '',
  }
  cache.set(key, { ts: Date.now(), data })
  return data
}
