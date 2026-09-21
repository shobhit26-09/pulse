import { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'

const W = 1000
const H = 530
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const KIND_COLOR = {
  storm: '#64d2ff',
  fire: '#ff6b4a',
  volcano: '#d0875c',
  ice: '#a8dcec',
  other: '#8e8e93',
}

export function WorldMap({ quakes, events, iss, trail, layers, selectedId, onSelect }) {
  const [countries, setCountries] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const drag = useRef(null)
  const svgRef = useRef(null)

  useEffect(() => {
    let alive = true
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (!alive) return
        const fc = feature(topo, topo.objects.countries)
        setCountries(fc.features)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const { path, grat } = useMemo(() => {
    const proj = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' })
    return { path: geoPath(proj), grat: geoGraticule10(), proj }
  }, [])

  // reuse one projection instance for markers
  const projRef = useMemo(() => geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' }), [])
  const mark = (lat, lon) => projRef([lon, lat])

  const clampView = (v) => {
    const k = Math.min(8, Math.max(1, v.k))
    const maxX = (W * (k - 1)) / 2
    const maxY = (H * (k - 1)) / 2
    return { k, x: Math.min(maxX, Math.max(-maxX, v.x)), y: Math.min(maxY, Math.max(-maxY, v.y)) }
  }

  const zoomAt = (factor, cx = W / 2, cy = H / 2) => {
    setView((v) => {
      const k2 = Math.min(8, Math.max(1, v.k * factor))
      const s = k2 / v.k
      return clampView({ k: k2, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s })
    })
  }

  const onWheel = (e) => {
    e.preventDefault()
    const rect = svgRef.current.getBoundingClientRect()
    const cx = ((e.clientX - rect.left) / rect.width) * W
    const cy = ((e.clientY - rect.top) / rect.height) * H
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, cx, cy)
  }

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      drag.current.moved = true
      if (!drag.current.captured) {
        drag.current.captured = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }
    const rect = svgRef.current.getBoundingClientRect()
    setView((v) =>
      clampView({ ...v, x: v.x + (dx * W) / rect.width, y: v.y + (dy * H) / rect.height }),
    )
    drag.current.x = e.clientX
    drag.current.y = e.clientY
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const countryFill = (f) => {
    if (f.id === selectedId) return 'var(--blue)'
    if (f.id === hoverId) return '#2a323d'
    return '#1b212a'
  }

  return (
    <div className="map-stage">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="world-map"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={path({ type: 'Sphere' })} className="ocean" />
          <path d={path(grat)} className="grat" />
          {countries &&
            countries.map((f) => (
              <path
                key={f.id}
                d={path(f)}
                className="country"
                fill={countryFill(f)}
                onPointerEnter={() => setHoverId(f.id)}
                onPointerLeave={() => setHoverId(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (drag.current?.moved) return
                  onSelect(f.id === selectedId ? null : f.id, f.properties?.name)
                }}
              />
            ))}

          {layers.storms &&
            events
              .filter((e) => e.kind === 'storm' || e.kind === 'ice')
              .map((e) => {
                const p = mark(e.lat, e.lon)
                return p ? (
                  <circle key={e.id} cx={p[0]} cy={p[1]} r={3 / view.k + 2} fill={KIND_COLOR[e.kind]} opacity="0.9" />
                ) : null
              })}
          {layers.fires &&
            events
              .filter((e) => e.kind === 'fire' || e.kind === 'volcano')
              .map((e) => {
                const p = mark(e.lat, e.lon)
                return p ? (
                  <circle key={e.id} cx={p[0]} cy={p[1]} r={2.4 / view.k + 1.6} fill={KIND_COLOR[e.kind]} opacity="0.85" />
                ) : null
              })}
          {layers.quakes &&
            quakes
              .filter((q) => q.mag >= 3.5)
              .map((q) => {
                const p = mark(q.lat, q.lon)
                if (!p) return null
                const strong = q.mag >= 5
                return (
                  <g key={q.id}>
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={(2.6 + q.mag) / view.k + 1.5}
                      fill="none"
                      stroke={strong ? '#ff453a' : '#ff9f0a'}
                      strokeWidth={1.2 / view.k + 0.4}
                      opacity="0.9"
                    />
                    <circle cx={p[0]} cy={p[1]} r={1.6 / view.k + 0.8} fill={strong ? '#ff453a' : '#ff9f0a'} />
                  </g>
                )
              })}
          {layers.iss && trail.length > 1 && (
            <polyline
              points={trail.map((t) => mark(t.lat, t.lon)?.join(',')).filter(Boolean).join(' ')}
              fill="none"
              stroke="#ffd60a"
              strokeWidth={1 / view.k + 0.3}
              opacity="0.45"
            />
          )}
          {layers.iss && iss && (
            <g>
              {(() => {
                const p = mark(iss.lat, iss.lon)
                return p ? (
                  <>
                    <circle cx={p[0]} cy={p[1]} r={7 / view.k + 3} fill="#ffd60a" opacity="0.25" />
                    <circle cx={p[0]} cy={p[1]} r={2.6 / view.k + 1.4} fill="#ffd60a" />
                  </>
                ) : null
              })()}
            </g>
          )}
        </g>
      </svg>

      <div className="map-zoom">
        <button aria-label="Zoom in" onClick={() => zoomAt(1.4)}>+</button>
        <button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4)}>−</button>
        {view.k > 1 && (
          <button aria-label="Reset zoom" className="reset" onClick={() => setView({ k: 1, x: 0, y: 0 })}>
            Reset
          </button>
        )}
      </div>
      {hoverId && hoverId !== selectedId && countries && (
        <div className="map-hover-label">
          {countries.find((c) => c.id === hoverId)?.properties?.name}
        </div>
      )}
    </div>
  )
}
