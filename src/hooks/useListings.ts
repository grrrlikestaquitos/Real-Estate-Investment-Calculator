import { useEffect, useMemo, useState } from 'react'
import { parseInput } from '../lib/calculations'
import {
  mergeDatasets,
  parseMlsCsv,
  withPositions,
  type MlsDataset,
  type PropertyType,
} from '../lib/mls'
import {
  DEFAULT_INVESTOR_ASSUMPTIONS,
  DEFAULT_OWNER_ASSUMPTIONS,
  SORTS_FOR,
  analyzeListings,
  buildContext,
  matchesFilters,
  sortAnalyses,
  type Assumptions,
  type InvestorAssumptions,
  type OwnerAssumptions,
  type Perspective,
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
  /** ZIP codes to leave out. */
  hiddenZips: string[]
  priceCutOnly: boolean
  valueAddOnly: boolean
  hideRestricted: boolean
  shortlistOnly: boolean
}

export type InvestorAssumptionStrings = Record<keyof InvestorAssumptions, string>
export type OwnerAssumptionStrings = Record<keyof OwnerAssumptions, string>

const DEFAULT_FILTER_STRINGS: FilterStrings = {
  minPrice: '',
  maxPrice: '',
  minSqft: '',
  minBeds: '',
  maxHoa: '',
  types: [],
  cities: [],
  hiddenZips: [],
  priceCutOnly: false,
  valueAddOnly: false,
  hideRestricted: true,
  shortlistOnly: false,
}

/** Defaults as input strings; a 0 ("not entered") shows as an empty input. */
function asStrings<T extends object>(values: T): Record<keyof T, string> {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === 0 ? '' : String(v)]),
  ) as Record<keyof T, string>
}

const DEFAULT_INVESTOR_STRINGS = asStrings(DEFAULT_INVESTOR_ASSUMPTIONS)
const DEFAULT_OWNER_STRINGS = asStrings(DEFAULT_OWNER_ASSUMPTIONS)

interface Saved {
  perspective: Perspective
  filters: FilterStrings
  investor: InvestorAssumptionStrings
  owner: OwnerAssumptionStrings
  /** Dataset ids turned off (new datasets start on). */
  disabled: string[]
  shortlist: string[]
  sort: Record<Perspective, SortKey>
  /** CSVs the user imported, already parsed. */
  imported: MlsDataset[]
}

/** Saved settings from before perspectives: one set of (investor) assumptions and one sort. */
interface SavedV1 {
  assumptions?: Partial<InvestorAssumptionStrings>
  sort?: unknown
}

function savedSort(perspective: Perspective, value: unknown): SortKey {
  return SORTS_FOR[perspective].includes(value as SortKey) ? (value as SortKey) : 'score'
}

function loadFilters(saved: unknown): FilterStrings {
  if (saved == null || typeof saved !== 'object') return { ...DEFAULT_FILTER_STRINGS }
  const { city, ...rest } = saved as Partial<FilterStrings> & { city?: unknown }
  const filters = { ...DEFAULT_FILTER_STRINGS, ...rest }
  if (!Array.isArray(filters.cities)) filters.cities = []
  if (!Array.isArray(filters.hiddenZips)) filters.hiddenZips = []
  if (typeof city === 'string' && city && filters.cities.length === 0) filters.cities = [city]
  return filters
}

function load(): Saved {
  const fallback: Saved = {
    perspective: 'investment',
    filters: { ...DEFAULT_FILTER_STRINGS },
    investor: { ...DEFAULT_INVESTOR_STRINGS },
    owner: { ...DEFAULT_OWNER_STRINGS },
    disabled: [],
    shortlist: [],
    sort: { investment: 'score', owner: 'score' },
    imported: [],
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as (Partial<Saved> & SavedV1) | null
    if (saved == null || typeof saved !== 'object') return fallback
    const sort = saved.sort as Partial<Record<Perspective, unknown>> | string | undefined
    return {
      perspective: saved.perspective === 'owner' ? 'owner' : 'investment',
      filters: loadFilters(saved.filters),
      investor: { ...fallback.investor, ...(saved.investor ?? saved.assumptions) },
      owner: { ...fallback.owner, ...saved.owner },
      disabled: Array.isArray(saved.disabled) ? saved.disabled : [],
      shortlist: Array.isArray(saved.shortlist) ? saved.shortlist : [],
      sort:
        typeof sort === 'object' && sort != null
          ? { investment: savedSort('investment', sort.investment), owner: savedSort('owner', sort.owner) }
          : { investment: savedSort('investment', sort), owner: 'score' },
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
    hiddenZips: f.hiddenZips,
    priceCutOnly: f.priceCutOnly,
    valueAddOnly: f.valueAddOnly,
    hideRestricted: f.hideRestricted,
    shortlistOnly: f.shortlistOnly,
  }
}

/** Empty or invalid assumption inputs fall back to the defaults. */
function parseAssumptions<T extends object>(strings: Record<keyof T, string>, defaults: T): T {
  const result = { ...defaults }
  for (const key of Object.keys(result) as (keyof T)[]) {
    const value = parseInput(strings[key] ?? '')
    if (value != null && value >= 0) result[key] = value as T[keyof T]
  }
  return result
}

/**
 * State for the listings screen: the NWMLS exports bundled from Data/ (loaded
 * lazily) plus any CSVs the user imports, which datasets are on, the
 * perspective (investor or homeowner) with its own assumptions and sort, the
 * filters and the shortlist. Everything but the
 * bundled data is remembered in localStorage.
 */
export function useListings() {
  const [initial] = useState(load)
  const [bundled, setBundled] = useState<MlsDataset[] | null>(null)
  const [geocodes, setGeocodes] = useState<Record<string, [number, number]>>({})
  const [loadError, setLoadError] = useState(false)
  const [imported, setImported] = useState<MlsDataset[]>(initial.imported)
  const [disabled, setDisabled] = useState<string[]>(initial.disabled)
  const [filters, setFilters] = useState<FilterStrings>(initial.filters)
  const [perspective, setPerspective] = useState<Perspective>(initial.perspective)
  const [investor, setInvestor] = useState<InvestorAssumptionStrings>(initial.investor)
  const [owner, setOwner] = useState<OwnerAssumptionStrings>(initial.owner)
  const [shortlist, setShortlist] = useState<string[]>(initial.shortlist)
  const [sorts, setSorts] = useState<Record<Perspective, SortKey>>(initial.sort)
  const sort = sorts[perspective]

  useEffect(() => {
    let cancelled = false
    import('virtual:mls-data')
      .then((mod) => {
        if (cancelled) return
        setBundled(mod.default)
        setGeocodes(mod.geocodes ?? {})
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
      perspective,
      filters,
      investor,
      owner,
      disabled,
      shortlist,
      sort: sorts,
      imported,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
      // Storage blocked or full (a big import): the view still works in memory.
    }
  }, [perspective, filters, investor, owner, disabled, shortlist, sorts, imported])

  const datasets = useMemo(() => [...(bundled ?? []), ...imported], [bundled, imported])
  const enabled = useMemo(
    () => datasets.filter((d) => !disabled.includes(d.id)),
    [datasets, disabled],
  )
  const listings = useMemo(() => withPositions(mergeDatasets(enabled), geocodes), [enabled, geocodes])
  const context = useMemo(() => buildContext(listings), [listings])
  const assumptions: Assumptions = useMemo(
    () =>
      perspective === 'owner'
        ? { perspective, values: parseAssumptions(owner, DEFAULT_OWNER_ASSUMPTIONS) }
        : { perspective, values: parseAssumptions(investor, DEFAULT_INVESTOR_ASSUMPTIONS) },
    [perspective, investor, owner],
  )
  const analyses = useMemo(
    () => analyzeListings(listings, context, assumptions),
    [listings, context, assumptions],
  )
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

  /** ZIPs in the data: how many listings each has, its cities and its most common NWMLS area. */
  const zips = useMemo(() => {
    const byZip = new Map<string, { count: number; cities: Map<string, number>; areas: Map<string, number> }>()
    const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)
    for (const l of listings) {
      let entry = byZip.get(l.zip)
      if (!entry) {
        entry = { count: 0, cities: new Map(), areas: new Map() }
        byZip.set(l.zip, entry)
      }
      entry.count++
      bump(entry.cities, l.city)
      if (l.area) bump(entry.areas, l.area)
    }
    const ranked = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    return [...byZip.entries()]
      .map(([zip, e]) => ({ zip, count: e.count, cities: ranked(e.cities), area: ranked(e.areas)[0] ?? '' }))
      .sort((a, b) => a.zip.localeCompare(b.zip))
  }, [listings])

  function toggleZip(zip: string) {
    setFilters((current) => ({
      ...current,
      hiddenZips: current.hiddenZips.includes(zip)
        ? current.hiddenZips.filter((z) => z !== zip)
        : [...current.hiddenZips, zip],
    }))
  }

  function updateFilters(patch: Partial<FilterStrings>) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function updateInvestor(patch: Partial<InvestorAssumptionStrings>) {
    setInvestor((current) => ({ ...current, ...patch }))
  }

  function updateOwner(patch: Partial<OwnerAssumptionStrings>) {
    setOwner((current) => ({ ...current, ...patch }))
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
    zips,
    toggleZip,
    filters,
    updateFilters,
    resetFilters: () => setFilters({ ...DEFAULT_FILTER_STRINGS }),
    perspective,
    setPerspective,
    investor,
    updateInvestor,
    owner,
    updateOwner,
    assumptions,
    resetAssumptions: () =>
      perspective === 'owner'
        ? setOwner({ ...DEFAULT_OWNER_STRINGS })
        : setInvestor({ ...DEFAULT_INVESTOR_STRINGS }),
    sort,
    setSort: (key: SortKey) => setSorts((current) => ({ ...current, [perspective]: key })),
    isShortlisted: (id: string) => shortlistSet.has(id),
    shortlistCount: shortlist.length,
    toggleShortlist,
  }
}

export type ListingsApi = ReturnType<typeof useListings>
