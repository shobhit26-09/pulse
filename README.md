# PULSE

A live monitor of everything major happening on Earth right now - rendered as a single dark, quiet instrument panel.

A slowly rotating 3D globe shows the planet in real time: earthquakes pulsing where they struck, active storms, wildfires and volcanoes, the ISS threading its orbit, and the day/night terminator sweeping across the continents. A rail of instruments tracks the numbers behind it all.

## What it shows

- **Seismic activity** - every earthquake from the last 24 hours, magnitude-mapped (USGS)
- **Surface events** - active storms, wildfires and volcanoes (NASA EONET)
- **The ISS** - live position, altitude, velocity and orbital trail (wheretheiss.at)
- **Day/night terminator** - continents lit by an computed solar position, updated every minute
- **Space weather** - the current Kp geomagnetic index (NOAA SWPC)
- **Next launches** - upcoming orbital launches worldwide (Launch Library)

## Data sources

| Source | Used for |
| --- | --- |
| USGS earthquake feed | Seismic events, past 24h |
| NASA EONET | Storms, wildfires, volcanoes |
| wheretheiss.at | ISS telemetry and ground track |
| NOAA SWPC | Planetary Kp index |
| Launch Library 2 | Upcoming launches |

All public, key-free APIs. No backend - the browser talks to each source directly.

## Stack

React + TypeScript + Vite. The globe is hand-built with three.js: a rejection-sampled land dot-field from Natural Earth topo data, a fresnel atmosphere, and per-vertex day/night shading.

## Run it

```bash
npm install
npm run dev
```

Build with `npm run build`, output in `dist/`.
