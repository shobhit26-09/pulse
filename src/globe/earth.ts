import * as THREE from 'three'
import { feature } from 'topojson-client'
import { latLonToVec3 } from '../lib/geo'

export interface GlobeEvent {
  id: string
  lat: number
  lon: number
  color: number
  strength: number // 0..1 scales the ping size
}

const R = 1

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointInPolygon(lon: number, lat: number, polygon: number[][][]): boolean {
  if (!pointInRing(lon, lat, polygon[0])) return false
  for (let k = 1; k < polygon.length; k++) {
    if (pointInRing(lon, lat, polygon[k])) return false
  }
  return true
}

export class EarthGlobe {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private globe = new THREE.Group()
  private frame = 0
  private disposed = false

  private landPoints: THREE.Points | null = null
  private landDirs: THREE.Vector3[] = []
  private issMesh: THREE.Mesh
  private issGlow: THREE.Sprite
  private trail: THREE.Line
  private trailPositions: Float32Array
  private pings: { mesh: THREE.Mesh; born: number; delay: number; strength: number }[] = []
  private eventGroup = new THREE.Group()

  private targetRotY = 0.6
  private targetRotX = 0.35
  private dragging = false
  private lastX = 0
  private lastY = 0
  private autoRotate = true

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    this.camera.position.set(0, 0, 3.1)

    // Ocean body
    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.995, 72, 72),
      new THREE.MeshBasicMaterial({ color: 0x0a151f }),
    )
    this.globe.add(ocean)

    // Atmosphere: backside fresnel shell
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.06, 72, 72),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { c: { value: new THREE.Color(0x274b63) } },
        vertexShader: `
          varying vec3 vN; varying vec3 vP;
          void main() {
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vP = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 c; varying vec3 vN; varying vec3 vP;
          void main() {
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 3.5);
            gl_FragColor = vec4(c, f * 0.9);
          }`,
      }),
    )
    this.scene.add(atmo)

    this.globe.add(this.graticule())
    this.globe.add(this.eventGroup)

    // ISS marker
    this.issMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf5c76a }),
    )
    this.issGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xf5c76a,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    )
    this.issGlow.scale.setScalar(0.09)
    this.globe.add(this.issMesh, this.issGlow)

    // ISS trail
    this.trailPositions = new Float32Array(300 * 3)
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3))
    this.trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0xf5c76a, transparent: true, opacity: 0.4 }),
    )
    this.trail.frustumCulled = false
    this.globe.add(this.trail)

    this.scene.add(this.globe)
    this.attachInput()
    this.resize()
    this.loadLand()
    this.loop()
  }

  private graticule(): THREE.LineSegments {
    const pts: number[] = []
    const step = 2
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += step) {
        const a = latLonToVec3(lat, lon, R)
        const b = latLonToVec3(lat, lon + step, R)
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    for (let lon = -180; lon < 180; lon += 15) {
      for (let lat = -88; lat < 88; lat += step) {
        const a = latLonToVec3(lat, lon, R)
        const b = latLonToVec3(lat + step, lon, R)
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x14222e, transparent: true, opacity: 0.55 }),
    )
  }

  private async loadLand() {
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
      const topo = await res.json()
      const fc = feature(topo, topo.objects.land) as any
      const geoms = fc.type === 'FeatureCollection' ? fc.features.map((f: any) => f.geometry) : [fc.geometry]
      const polygons: number[][][][] = geoms.flatMap((g: any) =>
        g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates],
      )

      // Per-polygon bboxes and approximate areas (cos-lat corrected)
      const boxes = polygons.map((poly) => {
        let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90
        for (const [lon, lat] of poly[0]) {
          if (lon < minLon) minLon = lon
          if (lon > maxLon) maxLon = lon
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
        const midLat = (minLat + maxLat) / 2
        const area = (maxLon - minLon) * (maxLat - minLat) * Math.cos((midLat * Math.PI) / 180)
        return { minLon, maxLon, minLat, maxLat, area: Math.max(area, 0.0001) }
      })
      const totalArea = boxes.reduce((a, b) => a + b.area, 0)

      // Allocate dots to polygons in proportion to their area, then
      // rejection-sample inside each polygon's own bbox - dense where the
      // land is big, but every island still gets its dots
      const positions: number[] = []
      const TARGET = 60000
      for (let p = 0; p < polygons.length; p++) {
        const b = boxes[p]
        const share = Math.round((b.area / totalArea) * TARGET)
        const n = Math.max(2, Math.min(share, 20000))
        let placed = 0
        let guard = 0
        while (placed < n && guard < n * 60) {
          guard++
          const lon = b.minLon + Math.random() * (b.maxLon - b.minLon)
          const lat = b.minLat + Math.random() * (b.maxLat - b.minLat)
          if (!pointInPolygon(lon, lat, polygons[p])) continue
          const v = latLonToVec3(lat, lon, R * 1.001)
          positions.push(v.x, v.y, v.z)
          this.landDirs.push(v.clone().normalize())
          placed++
        }
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      const colors = new Float32Array((positions.length / 3) * 3)
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      this.landPoints = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size: 0.008, vertexColors: true, sizeAttenuation: true }),
      )
      this.globe.add(this.landPoints)
    } catch {
      // Globe still works (graticule + events) if the land fetch fails
    }
  }

  setSun(sunLat: number, sunLon: number) {
    if (!this.landPoints) return
    const sunDir = latLonToVec3(sunLat, sunLon, 1).normalize()
    const attr = this.landPoints.geometry.getAttribute('color') as THREE.BufferAttribute
    const day = new THREE.Color(0xe8eef0)
    const night = new THREE.Color(0x55707f)
    const tmp = new THREE.Color()
    for (let i = 0; i < this.landDirs.length; i++) {
      const d = this.landDirs[i].dot(sunDir)
      const t = THREE.MathUtils.smoothstep(d, -0.18, 0.3)
      tmp.copy(night).lerp(day, t)
      attr.setXYZ(i, tmp.r, tmp.g, tmp.b)
    }
    attr.needsUpdate = true
  }

  setIss(lat: number, lon: number, altitudeKm: number) {
    const v = latLonToVec3(lat, lon, R * (1 + altitudeKm / 6371 / 3))
    this.issMesh.position.copy(v)
    this.issGlow.position.copy(v)
  }

  setIssTrail(points: { lat: number; lon: number }[]) {
    const n = Math.min(points.length, 300)
    for (let i = 0; i < n; i++) {
      const v = latLonToVec3(points[i].lat, points[i].lon, R * 1.02)
      this.trailPositions[i * 3] = v.x
      this.trailPositions[i * 3 + 1] = v.y
      this.trailPositions[i * 3 + 2] = v.z
    }
    this.trail.geometry.setDrawRange(0, n)
    ;(this.trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  }

  setEvents(events: GlobeEvent[]) {
    for (const p of this.pings) {
      this.eventGroup.remove(p.mesh)
      p.mesh.geometry.dispose()
      ;(p.mesh.material as THREE.Material).dispose()
    }
    this.pings = []
    const now = performance.now()
    events.forEach((e, i) => {
      const geo = new THREE.RingGeometry(0.006, 0.008, 40)
      const mat = new THREE.MeshBasicMaterial({
        color: e.color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      const v = latLonToVec3(e.lat, e.lon, R * 1.004)
      mesh.position.copy(v)
      mesh.lookAt(v.clone().multiplyScalar(2))
      this.eventGroup.add(mesh)
      this.pings.push({ mesh, born: now, delay: i * 260, strength: e.strength })
    })
  }

  private attachInput() {
    const el = this.canvas
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true
      this.autoRotate = false
      this.lastX = e.clientX
      this.lastY = e.clientY
      el.setPointerCapture(e.pointerId)
    })
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      this.targetRotY += (e.clientX - this.lastX) * 0.005
      this.targetRotX += (e.clientY - this.lastY) * 0.003
      this.targetRotX = THREE.MathUtils.clamp(this.targetRotX, -1.1, 1.1)
      this.lastX = e.clientX
      this.lastY = e.clientY
    })
    const end = () => {
      this.dragging = false
      window.setTimeout(() => (this.autoRotate = true), 6000)
    }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  resize() {
    const parent = this.canvas.parentElement
    if (!parent) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private loop = () => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.loop)
    if (this.autoRotate) this.targetRotY += 0.0006
    this.globe.rotation.y += (this.targetRotY - this.globe.rotation.y) * 0.06
    this.globe.rotation.x += (this.targetRotX - this.globe.rotation.x) * 0.06

    const now = performance.now()
    for (const p of this.pings) {
      const t = ((now - p.born - p.delay) % 2800) / 2800
      if (t < 0) continue
      const s = 1 + t * (2.5 + p.strength * 3.5)
      p.mesh.scale.setScalar(s)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55
    }
    this.renderer.render(this.scene, this.camera)
  }

  destroy() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.renderer.dispose()
  }
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.28)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
