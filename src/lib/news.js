// GDELT DOC 2.0 API client - free, keyless, CORS-clean, built for global news.
// GDELT rate-limits to roughly one request per 5 seconds per IP, so every
// call goes through a serial queue with generous spacing and results are
// cached in memory. Errors surface to the UI as labeled fallbacks.

const API = 'https://api.gdeltproject.org/api/v2/doc/doc'
const MIN_GAP_MS = 6500
const CACHE_TTL_MS = 15 * 60 * 1000

const cache = new Map()
let queue = Promise.resolve()
let lastStart = 0

function enqueue(fn) {
  const run = async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastStart))
    if (wait) await new Promise((r) => setTimeout(r, wait))
    lastStart = Date.now()
    return fn()
  }
  const p = queue.then(run, run)
  queue = p.catch(() => {})
  return p
}

async function gdelt(query, { max = 12, timespan = '48h', sort = 'hybridrel' } = {}) {
  const url =
    `${API}?query=${encodeURIComponent(query)}` +
    `&mode=artlist&maxrecords=${max}&format=json&sort=${sort}&timespan=${timespan}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`gdelt ${res.status}`)
  const d = await res.json()
  return (d.articles ?? []).map((a) => ({
    title: a.title ?? '',
    url: a.url ?? '',
    source: a.domain ?? '',
    seen: a.seendate ?? '',
  }))
}

function cached(key) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data
  return null
}

// News mentioning a country, newest/relevant blend. Retries once with a
// wider window when the country has thin English coverage.
export function fetchCountryNews(name) {
  const key = `c:${name}`
  const hit = cached(key)
  if (hit) return Promise.resolve({ articles: hit, stale: false })
  return enqueue(async () => {
    let articles = await gdelt(`"${name}" sourcelang:english`, { max: 12, timespan: '48h' })
    if (articles.length === 0) {
      articles = await gdelt(`"${name}" sourcelang:english`, { max: 12, timespan: '7d' })
    }
    cache.set(key, { ts: Date.now(), data: articles })
    return { articles, stale: false }
  })
}

// Global "major things happening" feed - curated hard-news query.
export function fetchGlobalNews() {
  const key = 'global'
  const hit = cached(key)
  if (hit) return Promise.resolve({ articles: hit, stale: false })
  return enqueue(async () => {
    const q =
      '(earthquake OR tsunami OR hurricane OR typhoon OR cyclone OR wildfire OR flood OR ' +
      'election OR "prime minister" OR president OR ceasefire OR summit OR protest OR ' +
      '"state of emergency" OR sanctions) sourcelang:english'
    const articles = await gdelt(q, { max: 20, timespan: '24h' })
    cache.set(key, { ts: Date.now(), data: articles })
    return { articles, stale: false }
  })
}

// "20260921T131500Z" -> relative label
export function newsAge(seen) {
  if (!seen || seen.length < 14) return ''
  const t = Date.UTC(
    +seen.slice(0, 4), +seen.slice(4, 6) - 1, +seen.slice(6, 8),
    +seen.slice(9, 11), +seen.slice(11, 13),
  )
  const m = Math.max(1, Math.round((Date.now() - t) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
