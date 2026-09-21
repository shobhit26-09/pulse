// Severity engine - the whole point of PULSE. Only genuinely major events
// pass; everything else is noise and never renders.

export const TIER = { CRITICAL: 3, MAJOR: 2, WATCH: 1 }

export const TIER_META = {
  3: { label: 'Critical', cls: 'tier-critical' },
  2: { label: 'Major', cls: 'tier-major' },
  1: { label: 'Watch', cls: 'tier-watch' },
}

const CRITICAL = [
  'declares war', 'declaration of war', 'airstrike', 'air strike', 'missile strike',
  'missile attack', 'invasion', 'coup', 'tsunami', 'mass casualty', 'mass shooting',
  'terror attack', 'hostage', 'state of emergency', 'plane crash', 'death toll',
  'kills dozens', 'bombing', 'assassination', 'nationwide blackout', 'grid collapse',
  'evacuations ordered', 'evacuation order', 'nuclear plant',
]
const MAJOR = [
  ' war ', 'warfare', 'killed', 'kills', 'dead', 'death', 'strike', 'missile',
  'earthquake', 'quake', 'hurricane', 'typhoon', 'cyclone', 'volcano', 'eruption',
  'wildfire', 'flood', 'landslide', 'sanctions', 'clashes', 'explosion', 'crash',
  'offensive', 'shelling', 'drone attack', 'landfall', 'emergency', 'protest',
  'blackout', 'shooting', 'avalanche', 'storm',
]
const WATCH = [
  'election', 'summit', 'ceasefire', 'resigns', 'resignation', 'impeach', 'verdict',
  'talks', 'prime minister', 'president', 'parliament', 'referendum', 'arrest',
  'indicted', 'central bank', 'interest rate', 'dies', 'minister', 'treaty',
]

// Returns TIER value or null when the headline is not a major event.
export function classifyTitle(title) {
  if (!title) return null
  const t = ` ${title.toLowerCase()} `
  for (const k of CRITICAL) if (t.includes(k)) return TIER.CRITICAL
  for (const k of MAJOR) if (t.includes(k)) return TIER.MAJOR
  for (const k of WATCH) if (t.includes(k)) return TIER.WATCH
  return null
}

export function sortEvents(list) {
  return [...list].sort((a, b) => (b.tier - a.tier) || ((b.time ?? 0) - (a.time ?? 0)))
}
