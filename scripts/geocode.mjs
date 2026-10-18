// Places the listings in Data/*.csv on the map: geocodes each address with the
// Census Bureau's batch geocoder (free, no key), falls back to OpenStreetMap's
// Nominatim for streets too new for the Census (one request a second, per its
// usage policy; it may answer with the street rather than the house), and
// saves the results in Data/geocodes.json, which the build attaches to listings (vite.config.ts).
// Addresses already in the file are not looked up again. Run after adding or
// replacing an export: `node scripts/geocode.mjs`.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { parseMlsCsv, geocodeKey } from '../src/lib/mls.ts'

const DATA = new URL('../Data/', import.meta.url)
const OUT = new URL('geocodes.json', DATA)
const BATCH = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'

let saved = { points: {} }
try {
  saved = JSON.parse(await readFile(OUT, 'utf8'))
} catch {
  // First run.
}
const points = { ...saved.points }

const wanted = new Map()
for (const file of (await readdir(DATA)).filter((f) => f.toLowerCase().endsWith('.csv'))) {
  for (const listing of parseMlsCsv(await readFile(new URL(file, DATA), 'utf8')) ?? []) {
    const key = geocodeKey(listing)
    if (!(key in points)) wanted.set(key, listing)
  }
}

const quote = (s) => `"${String(s).replace(/"/g, '""')}"`

/** Geocode [key, street] pairs; returns the keys that matched. */
async function geocode(entries) {
  const found = new Set()
  for (let start = 0; start < entries.length; start += 2000) {
    const chunk = entries.slice(start, start + 2000)
    const csv = chunk
      .map(([key, street], i) => {
        const l = wanted.get(key)
        return [i, quote(street), quote(l.city), 'WA', l.zip].join(',')
      })
      .join('\n')
    const form = new FormData()
    form.append('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv')
    form.append('benchmark', 'Public_AR_Current')
    const res = await fetch(BATCH, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`Census geocoder: HTTP ${res.status}`)
    // Each line: "id","input","Match","Exact","matched address","lon,lat","tiger id","side"
    for (const line of (await res.text()).split('\n')) {
      const cells = [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1])
      if (cells[2] !== 'Match') continue
      const [lon, lat] = cells[5].split(',').map(Number)
      const key = chunk[Number(cells[0])]?.[0]
      if (key && Number.isFinite(lat) && Number.isFinite(lon)) {
        points[key] = [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5]
        found.add(key)
      }
    }
  }
  return found
}

const ids = [...wanted.keys()]
const first = await geocode(ids.map((key) => [key, wanted.get(key).address]))
// Unit numbers and builder notes ("#B2", "(Homesite #30)") often stop a match: retry without them.
const retry = ids
  .filter((key) => !first.has(key))
  .map((key) => [key, wanted.get(key).address.replace(/\s*\(.*?\)|\s*#\s*\S+/g, '').trim()])
  .filter(([key, street]) => street !== wanted.get(key).address)
const second = await geocode(retry)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let fromOsm = 0
for (const key of ids.filter((k) => !first.has(k) && !second.has(k))) {
  const l = wanted.get(key)
  const params = new URLSearchParams({
    format: 'jsonv2',
    countrycodes: 'us',
    limit: '1',
    street: l.address.replace(/\s*\(.*?\)|\s*#\s*\S+/g, '').trim(),
    city: l.city,
    state: 'WA',
    postalcode: l.zip,
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'brrr-calculator/2.0 (personal listing screener)' },
  })
  const [hit] = res.ok ? await res.json() : []
  if (hit) {
    points[key] = [Math.round(Number(hit.lat) * 1e5) / 1e5, Math.round(Number(hit.lon) * 1e5) / 1e5]
    fromOsm++
  }
  await sleep(1100)
}
const matched = first.size + second.size + fromOsm

// A point well outside its own ZIP is a wrong match (a same-named street in
// another town): drop it. ZIP Code Tabulation Areas don't follow postal ZIPs
// exactly, so allow about a kilometer of slack around the ZIP's bounding box.
const shapes = JSON.parse(await readFile(new URL('../src/lib/zipShapes.json', import.meta.url), 'utf8'))
const boxes = new Map()
for (const f of shapes.features) {
  const coords = f.geometry.coordinates.flat(f.geometry.type === 'Polygon' ? 1 : 2)
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  boxes.set(f.properties.zip, [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)])
}
const SLACK = 0.012
let dropped = 0
for (const [key, [lat, lng]] of Object.entries(points)) {
  const box = boxes.get(key.split('|')[1])
  if (box && (lng < box[0] - SLACK || lat < box[1] - SLACK || lng > box[2] + SLACK || lat > box[3] + SLACK)) {
    delete points[key]
    dropped++
  }
}

const out = {
  source:
    'U.S. Census Bureau Geocoder (Public_AR_Current); fallback © OpenStreetMap contributors (ODbL) via Nominatim',
  points: Object.fromEntries(Object.entries(points).sort(([a], [b]) => a.localeCompare(b))),
}
await writeFile(OUT, `${JSON.stringify(out, null, 0)}\n`)
console.log(
  `looked up ${ids.length}, matched ${matched}, dropped ${dropped} outside their ZIP; ${Object.keys(points).length} addresses placed`,
)
