import { EarthEvent, Quake } from '../lib/api'

export function Ticker({ quakes, events }: { quakes: Quake[]; events: EarthEvent[] }) {
  const items: string[] = [
    ...quakes.slice(0, 6).map((q) => `M${q.mag.toFixed(1)} - ${q.place}`),
    ...events.slice(0, 6).map((e) => e.title.toUpperCase()),
  ]
  if (items.length === 0) return <footer className="ticker" />
  const line = items.join('\u2003\u2003◆\u2003\u2003')
  return (
    <footer className="ticker">
      <div className="ticker-track">
        <span>{line}</span>
        <span aria-hidden="true">{line}</span>
      </div>
    </footer>
  )
}
