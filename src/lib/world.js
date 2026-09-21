// Shared world geometry (world-atlas 110m), loaded once and cached.
import { feature } from 'topojson-client'
import { geoContains } from 'd3-geo'

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

let worldPromise = null
export function loadWorld() {
  if (!worldPromise) {
    worldPromise = fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo) => feature(topo, topo.objects.countries).features)
  }
  return worldPromise
}

// Numeric-id feature containing [lon, lat], or null.
export function countryFeatureAt(features, lon, lat) {
  if (!features) return null
  for (const f of features) {
    try {
      if (geoContains(f, [lon, lat])) return f
    } catch {}
  }
  return null
}

export function inCountry(feature, lon, lat) {
  if (!feature) return false
  try {
    return geoContains(feature, [lon, lat])
  } catch {
    return false
  }
}
