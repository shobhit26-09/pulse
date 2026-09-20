import { EarthEvent, IssPosition, Launch, Quake } from '../lib/api'

function fmt(n: number, digits = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function ago(ts: number, now: Date) {
  const m = Math.max(0, Math.round((now.getTime() - ts) / 60000))
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ${m % 60}m ago`
}

const KIND_LABEL: Record<EarthEvent['kind'], string> = {
  storm: 'STORM',
  fire: 'WILDFIRE',
  volcano: 'VOLCANO',
  ice: 'ICE',
  other: 'EVENT',
}

interface Props {
  iss: IssPosition | null
  quakes: Quake[]
  events: EarthEvent[]
  kp: number | null
  launches: Launch[]
  now: Date
}

export function Rail({ iss, quakes, events, kp, launches, now }: Props) {
  const strongest = quakes.reduce<Quake | null>((a, q) => (!a || q.mag > a.mag ? q : a), null)
  const significant = quakes.filter((q) => q.mag >= 4.5).slice(0, 4)
  const storms = events.filter((e) => e.kind === 'storm')
  const fires = events.filter((e) => e.kind === 'fire')
  const volcanoes = events.filter((e) => e.kind === 'volcano')

  return (
    <aside className="rail">
      <section className="panel">
        <div className="panel-label">ORBIT / ISS</div>
        {iss ? (
          <div className="iss-grid">
            <div>
              <div className="stat-value">{fmt(iss.lat)}°</div>
              <div className="stat-key">LAT</div>
            </div>
            <div>
              <div className="stat-value">{fmt(iss.lon)}°</div>
              <div className="stat-key">LON</div>
            </div>
            <div>
              <div className="stat-value">{fmt(iss.altitudeKm, 1)}</div>
              <div className="stat-key">ALT KM</div>
            </div>
            <div>
              <div className="stat-value">{fmt(iss.velocityKmh, 0)}</div>
              <div className="stat-key">KM/H</div>
            </div>
          </div>
        ) : (
          <div className="panel-empty">ACQUIRING SIGNAL</div>
        )}
        <div className="panel-foot">{iss?.visibility === 'daylight' ? 'IN DAYLIGHT' : 'IN EARTH SHADOW'}</div>
      </section>

      <section className="panel">
        <div className="panel-label">SEISMIC / 24H</div>
        <div className="quake-headline">
          <div className="big-number">{quakes.length}</div>
          {strongest && (
            <div className="quake-strongest">
              <span className="mag">M{fmt(strongest.mag, 1)}</span> {strongest.place}
              <div className="stat-key">STRONGEST - {ago(strongest.time, now)}</div>
            </div>
          )}
        </div>
        <ul className="lines">
          {significant.map((q) => (
            <li key={q.id}>
              <span className="mag">M{fmt(q.mag, 1)}</span>
              <span className="line-place">{q.place}</span>
              <span className="line-time">{ago(q.time, now)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-label">SURFACE EVENTS</div>
        <div className="event-counts">
          <div>
            <div className="stat-value storm">{storms.length}</div>
            <div className="stat-key">STORMS</div>
          </div>
          <div>
            <div className="stat-value fire">{fires.length}</div>
            <div className="stat-key">FIRES</div>
          </div>
          <div>
            <div className="stat-value volcano">{volcanoes.length}</div>
            <div className="stat-key">VOLCANOES</div>
          </div>
        </div>
        <ul className="lines">
          {events.slice(0, 5).map((e) => (
            <li key={e.id}>
              <span className={`kind ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
              <span className="line-place">{e.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-label">SPACE WEATHER</div>
        {kp !== null ? (
          <>
            <div className="kp-row">
              <div className="big-number">{fmt(kp, 0)}</div>
              <div className="kp-scale">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className={`kp-cell ${kp >= i + 0.5 ? 'on' : ''} ${i >= 4 ? 'hot' : ''}`} />
                ))}
              </div>
            </div>
            <div className="stat-key">KP INDEX - GEOMAGNETIC ACTIVITY</div>
          </>
        ) : (
          <div className="panel-empty">NO DATA</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-label">NEXT LAUNCHES</div>
        <ul className="lines launches">
          {launches.map((l) => (
            <li key={l.id}>
              <div className="launch-name">{l.name}</div>
              <div className="stat-key">
                {new Date(l.net).toUTCString().slice(0, 22)} - {l.provider}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel sources">
        <div className="panel-label">SOURCES</div>
        <div className="stat-key">USGS / NASA EONET / NOAA SWPC / WHERETHEISS.AT / LAUNCH LIBRARY</div>
      </section>
    </aside>
  )
}
