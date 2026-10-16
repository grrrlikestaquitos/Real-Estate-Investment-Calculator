import { useEffect, useMemo, useState } from 'react'
import { parseInput } from '../lib/calculations'
import {
  DEFAULT_BUFFER_PCT,
  bucketListings,
  parseListingsInput,
  type BucketedListings,
  type ListingsPayload,
} from '../lib/listings'

const STORAGE_KEY = 'brrr-calculator/listings/v1'

/** The search parameters as raw input strings. */
export interface ListingsQueryStrings {
  min: string
  max: string
  bufferPct: string
}

const DEFAULT_QUERY: ListingsQueryStrings = {
  min: '',
  max: '',
  bufferPct: String(DEFAULT_BUFFER_PCT),
}

function isQueryStrings(value: unknown): value is ListingsQueryStrings {
  if (value == null || typeof value !== 'object') return false
  const { min, max, bufferPct } = value as Record<string, unknown>
  return typeof min === 'string' && typeof max === 'string' && typeof bufferPct === 'string'
}

function loadQuery(): ListingsQueryStrings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const query = (parsed as { query?: unknown } | null)?.query
      if (isQueryStrings(query)) return query
    }
  } catch {
    // Storage blocked or data corrupt: fall through to the defaults.
  }
  return { ...DEFAULT_QUERY }
}

/**
 * State for the Find-listings view: the price range/buffer the user is
 * filtering by (persisted) and the imported listings payload. Filtering is
 * derived, so it recomputes live as the inputs change.
 */
export function useListings() {
  const [query, setQuery] = useState<ListingsQueryStrings>(loadQuery)
  const [payload, setPayload] = useState<ListingsPayload | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ query }))
    } catch {
      // Storage blocked (private mode): the view still works in memory.
    }
  }, [query])

  const min = useMemo(() => parseInput(query.min), [query.min])
  const max = useMemo(() => parseInput(query.max), [query.max])
  const bufferPct = useMemo(() => parseInput(query.bufferPct), [query.bufferPct])

  const buckets: BucketedListings = useMemo(
    () => bucketListings(payload?.listings ?? [], min, max, bufferPct),
    [payload, min, max, bufferPct],
  )

  function updateQuery(patch: Partial<ListingsQueryStrings>) {
    setQuery((current) => ({ ...current, ...patch }))
  }

  /** Import listings from JSON text (clipboard paste or file). True on success. */
  function importText(text: string): boolean {
    const parsed = parseListingsInput(text)
    if (!parsed) {
      setImportError(
        "That doesn't look like listings JSON. Run the snippet on a Zillow search page, then paste its output or import the downloaded file.",
      )
      return false
    }
    setPayload(parsed)
    setImportError(null)
    return true
  }

  async function importFile(file: File): Promise<boolean> {
    return importText(await file.text())
  }

  function clearResults() {
    setPayload(null)
    setImportError(null)
  }

  return {
    query,
    updateQuery,
    min,
    max,
    bufferPct,
    payload,
    importError,
    importText,
    importFile,
    clearResults,
    buckets,
    total: payload?.listings.length ?? 0,
  }
}

export type ListingsApi = ReturnType<typeof useListings>
