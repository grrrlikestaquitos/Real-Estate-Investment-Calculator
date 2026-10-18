import { useEffect, useMemo, useState } from 'react'
import { parseInput } from '../lib/calculations'
import { mergeDatasets, parseMlsCsv, type MlsDataset, type PropertyType } from '../lib/mls'
import {
  DEFAULT_ASSUMPTIONS,
  analyzeListings,
  matchesFilters,
  sortAnalyses,
  type ScreenAssumptions,
  type ScreenFilters,
  type SortKey,
} from '../lib/screening'

const STORAGE_KEY = 'brrr-calculator/listings/v2'

/** Numeric filters as the raw strings the inputs hold. */
export interface FilterStrings {
  minPrice: string
  maxPrice: string
  minSqft: string
  minBeds: string
  maxHoa: string
  types: PropertyType[]
  /** Cities to include (empty = every city). */
  cities: string[]
  priceCutOnly: boolean
  valueAddOnly: boolean
  hideRestricted: boolean
  shortlistOnly: boolean
}

export type AssumptionStrings = Record<keyof ScreenAssumptions, string>

const DEFAULT_FILTER_STRINGS: FilterStrings = {
  minPrice: '',
  maxPrice: '',
  minSqft: '',
  minBeds: '',
  maxHoa: '',
  types: [],
  cities: [],
  priceCutOnly: false,
  valueAddOnly: false,
  hideRestricted: true,
  shortlistOnly: false,
}

const DEFAULT_ASSUMPTION_STRINGS = Object.fromEntries(
  Object.entries(DEFAULT_ASSUMPTIONS).map(([k, v]) => [k, String(v)]),
) as AssumptionStrings

interface Saved {
  filters: FilterStrings
  assumptions: AssumptionStrings
  /** Dataset ids turned off (new datasets start on). */
  disabled: string[]
  shortlist: string[]
  sort: SortKey
  /** CSVs the user imported, already parsed. */
  imported: MlsDataset[]
}

/** Saved filters over the defaults; an earlier single `city` becomes a one-city list. */
function loadFilters(saved: unknown): FilterStrings {
  if (saved == null || typeof saved !== 'object') return { ...DEFAULT_FILTER_STRINGS }
  const { city, ...rest } = saved as Partial<FilterStrings> & { city?: unknown }
  const filters = { ...DEFAULT_FILTER_STRINGS, ...rest }
  if (!Array.isArray(filters.cities)) filters.cities = []
  if (typeof city === 'string' && city && filters.cities.length === 0) filters.cities = [city]
  return filters
}

function load(): Saved {
  const fallback: Saved = {
    filters: { ...DEFAULT_FILTER_STRINGS },
    assumptions: { ...DEFAULT_ASSUMPTION_STRINGS },
    disabled: [],
    shortlist: [],
    sort: 'score',
    imported: [],
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<Saved> | null
    if (saved == null || typeof saved !== 'object') return fallback
    return {
      filters: loadFilters(saved.filters),
      assumptions: { ...fallback.assumptions, ...saved.assumptions },
      disabled: Array.isArray(saved.disabled) ? saved.disabled : [],
      shortlist: Array.isArray(saved.shortlist) ? saved.shortlist : [],
      sort: typeof saved.sort === 'string' ? saved.sort : 'score',
      imported: Array.isArray(saved.imported) ? saved.imported : [],
    }
  } catch {
    // Storage blocked or data corrupt: start fresh.
    return fallback
  }
}

function toFilters(f: FilterStrings): ScreenFilters {
  return {
    minPrice: parseInput(f.minPrice),
    maxPrice: parseInput(f.maxPrice),
    minSqft: parseInput(f.minSqft),
    minBeds: parseInput(f.minBeds),
    maxHoa: parseInput(f.maxHoa),
    types: f.types,
    cities: f.cities,
    priceCutOnly: f.priceCutOnly,
    valueAddOnly: f.valueAddOnly,
    hideRestricted: f.hideRestricted,
    shortlistOnly: f.shortlistOnly,
  }
}

/** Empty or invalid assumption inputs fall back to the defaults. */
function toAssumptions(a: AssumptionStrings): ScreenAssumptions {
  const result = { ...DEFAULT_ASSUMPTIONS }
  for (const key of Object.keys(result) as (keyof ScreenAssumptions)[]) {
    const value = parseInput(a[key] ?? '')
    if (value != null && value >= 0) result[key] = value
  }
  return result
}

/**
 * State for the listings screen: the NWMLS exports bundled from Data/ (loaded
 * lazily) plus any CSVs the user imports, which datasets are on, the filters,
 * the rental assumptions, the sort and the shortlist. Everything but the
 * bundled data is remembered in localStorage.
 */
export function useListings() {
  const [initial] = useState(load)
  const [bundled, setBundled] = useState<MlsDataset[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [imported, setImported] = useState<MlsDataset[]>(initial.imported)
  const [disabled, setDisabled] = useState<string[]>(initial.disabled)
  const [filters, setFilters] = useState<FilterStrings>(initial.filters)
  const [assumptionStrings, setAssumptionStrings] = useState<AssumptionStrings>(initial.assumptions)
  const [shortlist, setShortlist] = useState<string[]>(initial.shortlist)
  const [sort, setSort] = useState<SortKey>(initial.sort)

  useEffect(() => {
    let cancelled = false
    import('virtual:mls-data')
      .then((mod) => {
        if (!cancelled) setBundled(mod.default)
      })
      .catch(() => {
        if (!cancelled) {
          setBundled([])
          setLoadError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const saved: Saved = {
      filters,
      assumptions: assumptionStrings,
      disabled,
      shortlist,
      sort,
      imported,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
      // Storage blocked or full (a big import): the view still works in memory.
    }
  }, [filters, assumptionStrings, disabled, shortlist, sort, imported])

  const datasets = useMemo(() => [...(bundled ?? []), ...imported], [bundled, imported])
  const enabled = useMemo(
    () => datasets.filter((d) => !disabled.includes(d.id)),
    [datasets, disabled],
  )
  const listings = useMemo(() => mergeDatasets(enabled), [enabled])
  const assumptions = useMemo(() => toAssumptions(assumptionStrings), [assumptionStrings])
  const analyses = useMemo(() => analyzeListings(listings, assumptions), [listings, assumptions])
  const shortlistSet = useMemo(() => new Set(shortlist), [shortlist])
  const parsedFilters = useMemo(() => toFilters(filters), [filters])
  const results = useMemo(
    () =>
      sortAnalyses(
        analyses.filter((a) => matchesFilters(a, parsedFilters, shortlistSet)),
        sort,
      ),
    [analyses, parsedFilters, shortlistSet, sort],
  )

  /** Cities with how many listings each, most first. */
  const cities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of listings) counts.set(l.city, (counts.get(l.city) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [listings])

  function updateFilters(patch: Partial<FilterStrings>) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function updateAssumptions(patch: Partial<AssumptionStrings>) {
    setAssumptionStrings((current) => ({ ...current, ...patch }))
  }

  function toggleDataset(id: string) {
    setDisabled((current) =>
      current.includes(id) ? current.filter((d) => d !== id) : [...current, id],
    )
  }

  function toggleShortlist(id: string) {
    setShortlist((current) =>
      current.includes(id) ? current.filter((d) => d !== id) : [...current, id],
    )
  }

  /** Import an NWMLS CSV export. Returns how many listings it held, or null when it isn't one. */
  async function importFile(file: File): Promise<number | null> {
    const parsed = parseMlsCsv(await file.text())
    if (!parsed || parsed.length === 0) return null
    const name = file.name.replace(/\.csv$/i, '')
    const id = `import:${name}`
    setImported((current) => [...current.filter((d) => d.id !== id), { id, name, listings: parsed }])
    setDisabled((current) => current.filter((d) => d !== id))
    return parsed.length
  }

  function removeImported(id: string) {
    setImported((current) => current.filter((d) => d.id !== id))
  }

  return {
    loading: bundled == null,
    loadError,
    datasets,
    isEnabled: (id: string) => !disabled.includes(id),
    isImported: (id: string) => id.startsWith('import:'),
    toggleDataset,
    importFile,
    removeImported,
    listings,
    analyses,
    results,
    cities,
    filters,
    updateFilters,
    resetFilters: () => setFilters({ ...DEFAULT_FILTER_STRINGS }),
    assumptionStrings,
    assumptions,
    updateAssumptions,
    resetAssumptions: () => setAssumptionStrings({ ...DEFAULT_ASSUMPTION_STRINGS }),
    sort,
    setSort,
    isShortlisted: (id: string) => shortlistSet.has(id),
    shortlistCount: shortlist.length,
    toggleShortlist,
  }
}

export type ListingsApi = ReturnType<typeof useListings>
