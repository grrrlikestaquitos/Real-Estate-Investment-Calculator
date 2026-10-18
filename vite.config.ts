/// <reference types="vitest/config" />
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { parseMlsCsv, type MlsDataset } from './src/lib/mls.ts'

const MLS_MODULE = 'virtual:mls-data'

/**
 * Serves the NWMLS CSV exports in Data/ as `virtual:mls-data`: parsed at build
 * time, so only the fields the app shows reach the bundle (never the
 * agent-only remarks), and loaded lazily by the listings view. Map positions
 * saved by scripts/geocode.mjs in Data/geocodes.json ride along as `geocodes`.
 */
function mlsData(): Plugin {
  const dir = fileURLToPath(new URL('./Data', import.meta.url))
  const resolved = `\0${MLS_MODULE}`
  return {
    name: 'mls-data',
    resolveId(id) {
      return id === MLS_MODULE ? resolved : undefined
    },
    load(id) {
      if (id !== resolved) return undefined
      const files = existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.toLowerCase().endsWith('.csv'))
            .sort()
        : []
      const datasets: MlsDataset[] = []
      // Radius exports overlap heavily: ship each listing once, datasets as id lists.
      const unique = new Map<string, MlsDataset['listings'][number]>()
      for (const file of files) {
        const path = join(dir, file)
        this.addWatchFile(path)
        const listings = parseMlsCsv(readFileSync(path, 'utf8'))
        if (!listings) {
          this.warn(`${file} is not an NWMLS export (no ListingNumber/CurrentPrice columns); skipped`)
          continue
        }
        const name = basename(file, '.csv')
        for (const listing of listings) if (!unique.has(listing.id)) unique.set(listing.id, listing)
        datasets.push({ id: name, name, listings })
      }
      const sets = datasets.map((d) => ({ id: d.id, name: d.name, ids: d.listings.map((l) => l.id) }))
      // Map positions from scripts/geocode.mjs, keyed by address|zip.
      const geocodes = join(dir, 'geocodes.json')
      let points = {}
      if (existsSync(geocodes)) {
        this.addWatchFile(geocodes)
        points = (JSON.parse(readFileSync(geocodes, 'utf8')) as { points?: object }).points ?? {}
      }
      return [
        `export const geocodes = ${JSON.stringify(points)}`,
        `const listings = new Map(${JSON.stringify([...unique.values()])}.map((l) => [l.id, l]))`,
        `export default ${JSON.stringify(sets)}.map(({ ids, ...d }) => ({ ...d, listings: ids.map((id) => listings.get(id)) }))`,
      ].join('\n')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mlsData()],
  // The listings data is its own lazily loaded chunk (~1 MB, ~240 kB gzipped).
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
