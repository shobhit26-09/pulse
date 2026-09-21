import { useEffect, useMemo, useState } from 'react'
import { countryByNumericId, fmtPop, fmtArea } from '../lib/countries'
import { fetchCountryNews, fetchCountryEvents, newsAge } from '../lib/news'
import { fetchCapitalNow } from '../lib/weather'
import { loadWorld, inCountry } from '../lib/world'
import { TIER_META, sortEvents } from '../lib/severity'

function ago(time) {
  if (!time) return ''
  const m = Math.max(1, Math.round((Date.now() - time) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Country deep-dive: what is happening there right now - major ongoing
// events, top stories from major outlets, live local context. Static facts
// demoted to a one-line footer.
export function CountryPanel({ countryId, fallbackName, onClose, sigQuakes, quakes, events }) {
  const info = countryId ? countryByNumericId(countryId) : null
  const name = info?.n || fallbackName || 'Unknown region'
  const [news, setNews] = useState({ status: 'loading', articles: [] })
  const [gdeltEvents, setGdeltEvents] = useState({ status: 'loading', events: [] })
  const [wx, setWx] = useState(null)
  const [feature, setFeature] = useState(null)

  useEffect(() => {
    if (!countryId) return
    let alive = true
    setNews({ status: 'loading', articles: [] })
    setGdeltEvents({ status: 'loading', events: [] })
    fetchCountryNews(name)
      .then(({ articles }) => alive && setNews({ status: 'ok', articles }))
      .catch(() => alive && setNews({ status: 'error', articles: [] }))
    fetchCountryEvents(name)
      .then(({ events: ev }) => alive && setGdeltEvents({ status: 'ok', events: ev }))
      .catch(() => alive && setGdeltEvents({ status: 'error', events: [] }))
    loadWorld().then((features) => {
      if (!alive) return
      setFeature(features.find((f) => String(f.id) === String(countryId)) ?? null)
    })
    return () => {
      alive = false
    }
  }, [countryId, name])

  useEffect(() => {
    if (!info?.ll) return
    let alive = true
    fetchCapitalNow(info.ll[0], info.ll[1])
      .then((w) => alive && setWx(w))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [countryId]) // eslint-disable-line

  // Physical events inside the country's borders, right now.
  const local = useMemo(() => {
    if (!feature) return { quakes: [], events: [] }
    const qs = (sigQuakes ?? [])
      .filter((q) => inCountry(feature, q.lon, q.lat))
      .map((q) => ({
        id: q.id, tier: q.tier,
        title: `M${q.mag.toFixed(1)} earthquake - ${q.place}${q.tsunami ? ' - tsunami threat' : ''}`,
        url: q.url, source: 'USGS', time: q.time, age: ago(q.time),
      }))
    const ev = (events ?? [])
      .filter((e) => inCountry(feature, e.lon, e.lat))
      .map((e) => ({
        id: e.id, tier: 2, title: e.title,
        url: 'https://eonet.gsfc.nasa.gov', source: 'NASA EONET',
        time: e.date ? Date.parse(e.date) : 0, age: e.date ? ago(Date.parse(e.date)) : '',
      }))
    return { quakes: qs, events: ev }
  }, [feature, sigQuakes, events])

  const happening = sortEvents([
    ...local.quakes,
    ...local.events,
    ...(gdeltEvents.events ?? []),
  ]).slice(0, 8)

  const factsLine = info
    ? [
        info.cap && `Capital ${info.cap}`,
        info.pop && `${fmtPop(info.pop)} people`,
        info.area > 0 && fmtArea(info.area),
        info.lang?.length > 0 && info.lang.slice(0, 3).join(', '),
      ]
        .filter(Boolean)
        .join('  ·  ')
    : ''

  return (
    <aside className="country-panel glass">
      <div className="cp-head">
        <div className="cp-title">
          {info?.flag && <span className="cp-flag">{info.flag}</span>}
          <div>
            <div className="cp-name">{name}</div>
            <div className="cp-sub">{[info?.sub || info?.reg].filter(Boolean).join('')}</div>
          </div>
        </div>
        <button className="cp-close" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {wx && info?.cap && (
        <div className="cp-live">
          <span className="cp-live-dot" />
          {info.cap}: {wx.localTime} local · {wx.temp}°C {wx.cond.toLowerCase()} · wind {wx.wind} km/h
        </div>
      )}

      <div className="cp-news-label">Happening now</div>
      {gdeltEvents.status === 'loading' && happening.length === 0 && (
        <div className="cp-note">Scanning major events…</div>
      )}
      {gdeltEvents.status === 'error' && happening.length === 0 && (
        <div className="cp-note warn">Live events unavailable right now (rate limit or network) - try again in a moment.</div>
      )}
      {gdeltEvents.status !== 'loading' && happening.length === 0 && gdeltEvents.status !== 'error' && (
        <div className="cp-note">No major ongoing events reported in {name}.</div>
      )}
      {happening.length > 0 && (
        <ul className="event-list">
          {happening.map((e) => (
            <li key={e.id}>
              <a href={e.url} target="_blank" rel="noreferrer" className="event-card">
                <span className={`tier-pill ${TIER_META[e.tier].cls}`}>{TIER_META[e.tier].label}</span>
                <span className="event-title">{e.title}</span>
                <span className="event-meta">{e.source}{(e.age || e.seen) ? ` · ${e.age || newsAge(e.seen)}` : ''}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="cp-news-label">Top stories · 48h</div>
      {news.status === 'loading' && <div className="cp-note">Loading live coverage…</div>}
      {news.status === 'error' && (
        <div className="cp-note warn">
          Live feed unavailable right now (rate limit or network). Nothing cached for this country yet - try again in a moment.
        </div>
      )}
      {news.status === 'ok' && news.articles.length === 0 && (
        <div className="cp-note">No major English-language coverage of {name} in the last 7 days.</div>
      )}
      {news.status === 'ok' && news.articles.length > 0 && (
        <ul className="cp-news lines">
          {news.articles.slice(0, 8).map((a, i) => (
            <li key={i}>
              <a href={a.url} target="_blank" rel="noreferrer" className="cp-news-item">
                <span className="line-place">{a.title}</span>
                <span className="line-time">{a.source} · {newsAge(a.seen)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {factsLine && <div className="cp-facts-line">{factsLine}</div>}
      <div className="cp-src">GDELT · USGS · NASA EONET · Open-Meteo</div>
    </aside>
  )
}
