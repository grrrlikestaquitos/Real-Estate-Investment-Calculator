/**
 * Zillow search URLs carry their whole state in the `searchQueryState`
 * query parameter (URL-encoded JSON): the region (`regionSelection` or a
 * `mapBounds` box), the filter state (property types, price, sort, …).
 * We never build these from scratch (a place's regionId isn't guessable),
 * but we can read the state of a search the user already made and rewrite
 * it — most usefully, to apply our price range to Zillow's own filters so
 * the page that loads is already scoped server-side.
 */

export interface ParsedZillowUrl {
  ok: true
  origin: string
  pathname: string
  params: URLSearchParams
  /** The decoded `searchQueryState` object. */
  state: Record<string, unknown>
}

export type ZillowUrlError = { ok: false; reason: 'not-zillow' | 'not-search-url' | 'bad-json' }

export type ZillowUrlResult = ParsedZillowUrl | ZillowUrlError

/** Decode a Zillow search URL and its embedded search state. */
export function parseZillowUrl(input: string): ZillowUrlResult {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return { ok: false, reason: 'not-zillow' }
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'zillow.com') return { ok: false, reason: 'not-zillow' }

  const raw = url.searchParams.get('searchQueryState')
  if (!raw) return { ok: false, reason: 'not-search-url' }

  let state: unknown
  try {
    state = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'bad-json' }
  }
  if (state == null || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, reason: 'bad-json' }
  }

  return {
    ok: true,
    origin: url.origin,
    pathname: url.pathname,
    params: url.searchParams,
    state: state as Record<string, unknown>,
  }
}

/** Human-readable reasons for the UI. */
export const ZILLOW_URL_ERRORS: Record<ZillowUrlError['reason'], string> = {
  'not-zillow': "That doesn't look like a Zillow URL.",
  'not-search-url':
    'Open a Zillow search (a place or a map) and copy that URL — this one carries no search state.',
  'bad-json': "Zillow's search state in that URL couldn't be read.",
}

function filterStateOf(state: Record<string, unknown>): Record<string, unknown> {
  const current = state.filterState
  if (current != null && typeof current === 'object' && !Array.isArray(current)) {
    return current as Record<string, unknown>
  }
  return {}
}

/**
 * Re-encode the search URL with our price range applied to Zillow's own
 * filters (`filterState.price`), optionally sorted price low → high.
 * Everything else in the state (region, map bounds, other filters) is kept.
 * Returns null when the input isn't a parseable Zillow search URL.
 */
export function withPriceAndSort(
  url: string,
  min: number | null,
  max: number | null,
  sortLowHigh: boolean,
): string | null {
  const parsed = parseZillowUrl(url)
  if (!parsed.ok) return null

  const state = parsed.state
  const filters = filterStateOf(state)

  const price: Record<string, number> = {}
  if (min != null && Number.isFinite(min) && min > 0) price.min = min
  if (max != null && Number.isFinite(max) && max > 0) price.max = max
  if (Object.keys(price).length > 0) filters.price = price

  if (sortLowHigh) {
    const sort = { value: 'price_asc' }
    filters.sort = sort
    // Older search pages use `sortSelection` instead of `sort`; mirror it when present.
    if ('sortSelection' in filters) filters.sortSelection = sort
  }

  state.filterState = filters

  const search = new URLSearchParams()
  parsed.params.forEach((value, key) => {
    if (key !== 'searchQueryState') search.append(key, value)
  })
  search.set('searchQueryState', JSON.stringify(state))
  return `${parsed.origin}${parsed.pathname}?${search.toString()}`
}
