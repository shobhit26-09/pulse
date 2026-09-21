import { useEffect, useRef, useState } from 'react'
import {
  fetchEarthEvents,
  fetchIss,
  fetchIssTrail,
  fetchKpIndex,
  fetchLaunches,
  fetchQuakes,
} from './lib/api'
import { WorldMap } from './map/WorldMap'
import { CountryPanel } from './components/CountryPanel'
import { Feed } from './components/Feed'
import { Ticker } from './components/Ticker'

export default function App() {
  const [iss, setIss] = useState(null)
  const [trail, setTrail] = useState([])
  const [quakes, setQuakes] = useState([])
  const [events, setEvents] = useState([])
  const [now, setNow] = useState(() => new Date())
  const [selected, setSelected] = useState(null) // { id, name }
  const [layers, setLayers] = useState({ quakes: true, fires: true, storms: true, iss: true })

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const p = await fetchIss()
        if (alive) setIss(p)
      } catch {}
    }
    tick()
    const id = window.setInterval(tick, 5000)
    fetchIssTrail().then((t) => alive && setTrail(t)).catch(() => {})
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const q = await fetchQuakes()
        if (alive) setQuakes(q)
      } catch {}
    }
    load()
    const id = window.setInterval(load, 60000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const e = await fetchEarthEvents()
        if (alive) setEvents(e)
      } catch {}
    }
    load()
    const id = window.setInterval(load, 5 * 60000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const toggle = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }))

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark">
          PULSE<span className="wordmark-dot">.</span>
        </div>
        <div className="topbar-sub">Live Earth Dashboard</div>
        <div className="topbar-clock">
          {now.toUTCString().slice(17, 25)} <span>UTC</span>
        </div>
      </header>

      <main className="stage">
        <WorldMap
          quakes={quakes}
          events={events}
          iss={iss}
          trail={trail}
          layers={layers}
          selectedId={selected?.id ?? null}
          onSelect={(id, name) => setSelected(id ? { id, name } : null)}
        />

        <div className="layer-chips glass">
          {[
            ['quakes', 'Quakes'],
            ['fires', 'Fires'],
            ['storms', 'Storms'],
            ['iss', 'ISS'],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`chip ${layers[k] ? 'on' : ''}`}
              onClick={() => toggle(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rail glass">
          {selected ? (
            <CountryPanel
              countryId={selected.id}
              fallbackName={selected.name}
              onClose={() => setSelected(null)}
            />
          ) : (
            <Feed />
          )}
        </div>
      </main>

      <Ticker quakes={quakes} events={events} />
    </div>
  )
}
