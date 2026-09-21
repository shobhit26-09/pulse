import data from '../data/countries.json'

// world-atlas ids are ISO 3166-1 numeric strings, sometimes -99 for
// disputed areas - normalize to the 3-digit key used by the dataset
export function countryByNumericId(id) {
  const key = String(parseInt(id, 10)).padStart(3, '0')
  return data[key] || null
}

export function fmtPop(p) {
  if (!p) return null
  if (p >= 1e9) return (p / 1e9).toFixed(2) + 'B'
  if (p >= 1e6) return (p / 1e6).toFixed(1) + 'M'
  if (p >= 1e3) return Math.round(p / 1e3) + 'K'
  return String(p)
}

export function fmtArea(a) {
  if (!a) return null
  return a >= 1e6 ? (a / 1e6).toFixed(2) + 'M km²' : Math.round(a).toLocaleString('en-US') + ' km²'
}
