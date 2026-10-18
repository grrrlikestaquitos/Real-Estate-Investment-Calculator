// Regenerates src/lib/zipStats.json: median gross rent (B25064) and median
// household income (B19013) for every Washington ZIP (ZCTA 98xxx/99xxx) from
// the Census Bureau's ACS 5-year table-based summary files, which need no API
// key. Run with `node scripts/zip-stats.mjs [year]` (default 2024, i.e. 2020–2024).
import { writeFile } from 'node:fs/promises'

const year = Number(process.argv[2] ?? 2024)
const base = `https://www2.census.gov/programs-surveys/acs/summary_file/${year}/table-based-SF/data/5YRData`

/** ZIP → estimate, skipping suppressed values (the files use negative codes). */
async function table(id) {
  const res = await fetch(`${base}/acsdt5y${year}-${id}.dat`)
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
  const values = new Map()
  for (const line of (await res.text()).split('\n')) {
    const [geo, estimate] = line.split('|')
    const zip = geo?.startsWith('860Z200US') ? geo.slice(9) : ''
    const value = Number(estimate)
    if (/^9[89]\d{3}$/.test(zip) && estimate !== '' && Number.isFinite(value) && value > 0) {
      values.set(zip, value)
    }
  }
  return values
}

const [rent, income] = await Promise.all([table('b25064'), table('b19013')])
const zips = {}
for (const zip of [...new Set([...rent.keys(), ...income.keys()])].sort()) {
  zips[zip] = [rent.get(zip) ?? null, income.get(zip) ?? null]
}
const out = {
  source: `U.S. Census Bureau, American Community Survey ${year - 4}–${year} 5-year estimates, tables B25064 (median gross rent) and B19013 (median household income), by ZIP Code Tabulation Area`,
  years: `${year - 4}–${year}`,
  fields: ['medianGrossRent', 'medianHouseholdIncome'],
  zips,
}
const path = new URL('../src/lib/zipStats.json', import.meta.url)
await writeFile(path, `${JSON.stringify(out)}\n`)
console.log(`wrote ${Object.keys(zips).length} ZIPs to ${path.pathname}`)
