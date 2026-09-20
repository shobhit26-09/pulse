import * as THREE from 'three'

export function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

// Approximate subsolar point: where the sun is directly overhead.
// Good to well under a degree, plenty for a day/night terminator.
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600

  const decl = -23.44 * Math.cos(((360 / 365) * (dayOfYear + 10)) * (Math.PI / 180))

  // Equation of time (minutes), standard approximation
  const b = ((360 / 364) * (dayOfYear - 81)) * (Math.PI / 180)
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)

  const lon = 180 - (utcHours * 60 + eot) / 4
  const normalizedLon = ((lon + 540) % 360) - 180
  return { lat: decl, lon: normalizedLon }
}
