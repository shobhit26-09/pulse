import { useEffect, useRef, useState } from 'react'
import { EarthGlobe, GlobeEvent } from './globe/earth'
import { subsolarPoint } from './lib/geo'
import {
  EarthEvent,
  IssPosition,
  Launch,
  Quake,
  fetchEarthEvents,
  fetchIss,
  fetchIssTrail,
  fetchKpIndex,
  fetchLaunches,
  fetchQuakes,
} from './lib/api'
import { Rail } from './components/Rail'
import { Ticker } from './components/Ticker'

const QUAKE_COLOR = 0xe2a35c
const KIND_COLOR: Record<EarthEvent['kind'], number> = {
  storm: 0x6f9ec4,
  fire: 0xd95f3b,
  volcano: 0xc97b4a,
  ice: 0x9fc6d8,
  other: 0x8b98a3,
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const globeRef = useRef<EarthGlobe | null>(null)
  const [iss, setIss] = useState<IssPosition | null>(null)
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [events, setEvents] = useState<EarthEvent[]>([])
  const [kp, setKp] = useState<number | null>(null)
  const [launches, setLaunches] = useState<Launch[]>([])
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const globe = new EarthGlobe(canvasRef.current!)
    globeRef.current = globe
    const onResize = () => globe.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      globe.destroy()
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const p = await fetchIss()
        if (!alive) return
        setIss(p)
        globeRef.current?.setIss(p.lat, p.lon, p.altitudeKm)
      } catch {
        /* keep last fix */
      }
    }
    tick()
    const id = window.setInterval(tick, 5000)
    fetchIssTrail()
      .then((t) => alive && globeRef.current?.setIssTrail(t))
      .catch(() => {})
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

  useEffect(() => {
    let alive = true
    const load = async () => {
      const k = await fetchKpIndex()
      if (alive) setKp(k)
      try {
        const l = await fetchLaunches()
        if (alive) setLaunches(l)
      } catch {}
    }
    load()
    const id = window.setInterval(load, 10 * 60000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  // Day/night terminator, refreshed once a minute
  useEffect(() => {
    const update = () => {
      const s = subsolarPoint(new Date())
      globeRef.current?.setSun(s.lat, s.lon)
    }
    update()
    const id = window.setInterval(update, 60000)
    return () => window.clearInterval(id)
  }, [])

  // Paint events onto the globe
  useEffect(() => {
    const globeEvents: GlobeEvent[] = [
      ...quakes
        .filter((q) => q.mag >= 3.5)
        .map((q) => ({
          id: q.id,
          lat: q.lat,
          lon: q.lon,
          color: q.mag >= 5 ? 0xd95f3b : QUAKE_COLOR,
          strength: Math.min(1, q.mag / 7),
        })),
      ...events.map((e) => ({
        id: e.id,
        lat: e.lat,
        lon: e.lon,
        color: KIND_COLOR[e.kind],
        strength: 0.5,
      })),
    ]
    globeRef.current?.setEvents(globeEvents)
  }, [quakes, events])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark">
          PULSE<span className="wordmark-dot">.</span>
        </div>
        <div className="topbar-sub">LIVE EARTH MONITOR</div>
        <div className="topbar-clock">
          {now.toUTCString().slice(17, 25)} <span>UTC</span>
        </div>
      </header>

      <main className="stage">
        <div className="globe-wrap">
          <canvas ref={canvasRef} className="globe-canvas" />
          <div className="globe-hint">DRAG TO ROTATE</div>
        </div>
        <Rail iss={iss} quakes={quakes} events={events} kp={kp} launches={launches} now={now} />
      </main>

      <Ticker quakes={quakes} events={events} />
      <div className="grain" aria-hidden="true" />
    </div>
  )
}
