// Regenerates src/lib/zipShapes.json: simplified ZIP Code Tabulation Area
// boundaries (2020 Census) for the greater Puget Sound area, from the Census
// Bureau's TIGERweb map service (no API key). Run with `node scripts/zip-shapes.mjs`.
import { writeFile } from 'node:fs/promises'

const SERVICE =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query'
/** West, south, east, north: Kitsap to the Cascade foothills, Tacoma to Stanwood. */
const BBOX = [-122.9, 47.0, -121.6, 48.3]

const params = new URLSearchParams({
  where: '1=1',
  geometry: BBOX.join(','),
  geometryType: 'esriGeometryEnvelope',
  inSR: '4326',
  spatialRel: 'esriSpatialRelIntersects',
  outFields: 'ZCTA5',
  returnGeometry: 'true',
  outSR: '4326',
  // ~100 m: plenty for picking neighborhoods, a fraction of the full detail.
  maxAllowableOffset: '0.001',
  geometryPrecision: '4',
  f: 'geojson',
})
const res = await fetch(`${SERVICE}?${params}`)
if (!res.ok) throw new Error(`TIGERweb: HTTP ${res.status}`)
const data = await res.json()
if (!Array.isArray(data.features)) throw new Error(`TIGERweb: ${JSON.stringify(data).slice(0, 200)}`)

const features = data.features
  .map((f) => ({ type: 'Feature', properties: { zip: f.properties.ZCTA5 }, geometry: f.geometry }))
  .sort((a, b) => a.properties.zip.localeCompare(b.properties.zip))
const out = {
  type: 'FeatureCollection',
  source: 'U.S. Census Bureau, 2020 ZIP Code Tabulation Areas (TIGERweb), simplified',
  features,
}
const path = new URL('../src/lib/zipShapes.json', import.meta.url)
await writeFile(path, `${JSON.stringify(out)}\n`)
console.log(`wrote ${features.length} ZIP shapes to ${path.pathname}`)
