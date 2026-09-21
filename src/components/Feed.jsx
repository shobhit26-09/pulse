import { useEffect, useState } from 'react'
import { fetchBreakingGlobal, newsAge } from '../lib/news'
import { TIER_META, sortEvents } from '../lib/severity'

function quakeAge(time) {
  if (!time) return ''
  const m = Math.max(1, Math.round((Date.now() - time) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Breaking board: GDELT majors + significant USGS quakes + severe EONET
// events, merged and severity-ranked. Zero noise by construction.
export function Feed({ sigQuakes, events }) {
  const [state, setState] = useState({ status: 'loading', events: [] })

  useEffect(() => {
    let alive = true
    let timer
    const load = () =>
      fetchBreakingGlobal()
        .then(({ events: ev }) => {
          if (!alive) return
          setState({ status: 'ok', events: ev })
          timer = window.setTimeout(load, 10 * 60000)
        })
        .catch(() => {
          if (!alive) return
          setState((s) => (s.events.length ? s : { status: 'error', events: [] }))
          timer = window.setTimeout(load, 30000)
        })
    load()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [])

  const quakeEvents = (sigQuakes ?? []).map((q) => ({
    id: q.id,
    tier: q.tier,
    title: `M${q.mag.toFixed(1)} earthquake - ${q.place}${q.tsunami ? ' - tsunami threat' : ''}`,
    url: q.url,
    source: 'USGS',
    age: quakeAge(q.time),
    time: q.time,
  }))
  const eonetEvents = (events ?? [])
    .filter((e) => e.kind === 'storm' || e.kind === 'volcano')
    .map((e) => ({
      id: e.id,
      tier: 2,
      title: e.title,
      url: 'https://eonet.gsfc.nasa.gov',
      source: 'NASA EONET',
      age: e.date ? quakeAge(Date.parse(e.date)) : '',
      time: e.date ? Date.parse(e.date) : 0,
    }))

  const merged = sortEvents([...state.events, ...quakeEvents, ...eonetEvents]).slice(0, 24)

  return (
    <section className="panel feed-panel">
      <div className="panel-label">Breaking · worldwide</div>
      {state.status === 'loading' && <div className="cp-note">Scanning global coverage…</div>}
      {state.status === 'error' && (
        <div className="cp-note warn">Global feed rate-limited. Retrying automatically.</div>
      )}
      {state.status === 'ok' && merged.length === 0 && (
        <div className="cp-note">No major events in the last 24 hours.</div>
      )}
      <ul className="event-list">
        {merged.map((e) => (
          <li key={e.id}>
            <a href={e.url} target="_blank" rel="noreferrer" className="event-card">
              <span className={`tier-pill ${TIER_META[e.tier].cls}`}>{TIER_META[e.tier].label}</span>
              <span className="event-title">{e.title}</span>
              <span className="event-meta">{e.source}{e.age || e.seen ? ` · ${e.age || newsAge(e.seen)}` : ''}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="panel-foot">GDELT · USGS · NASA EONET — ONLY MAJOR EVENTS · CLICK A COUNTRY FOR THE DEEP-DIVE</div>
    </section>
  )
}
