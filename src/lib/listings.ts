/**
 * Listing data model and filtering for the Find-listings tool.
 * Listings are extracted from a Zillow search page by public/zillow-extractor.js
 * (run in the user's own browser) and imported here as JSON; all price-range and
 * buffer math happens in this file so it stays pure and unit-testable.
 */

export interface Listing {
  id: string
  price: number
  /** Primary address line (street). */
  address: string
  /** Secondary location, e.g. "Seattle, WA 98101". */
  location: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  photoUrl: string | null
  url: string
}

/** A payload the extractor (or a user) can hand us. */
export interface ListingsPayload {
  /** Epoch ms of when the listings were captured, if known. */
  fetchedAt: number | null
  /** Where the listings came from (Zillow URL), if known. */
  source: string | null
  listings: Listing[]
}

/** The search parameters the user controls. */
export interface ListingQuery {
  /** Lowest price to include (null = no floor). */
  min: number | null
  /** Highest price to include (null = no ceiling). */
  max: number | null
  /** Extra headroom over `max`, as a percent (null = none). */
  bufferPct: number | null
}

export const DEFAULT_BUFFER_PCT = 10

/** Listings split by how they relate to the price range. */
export interface BucketedListings {
  /** Within [min, max] (missing bounds open the side). */
  inRange: Listing[]
  /** Above max but within the buffer (max, max + bufferPct% of max]. */
  withinBuffer: Listing[]
}

const PRICE_KEYS = ['price', 'priceValue', 'amount', 'listPrice']
const ADDRESS_KEYS = ['address', 'street', 'address1', 'streetAddress']
const LOCATION_KEYS = ['location', 'city', 'area', 'address2', 'neighborhood']
const BEDS_KEYS = ['beds', 'bedCount', 'bd']
const BATHS_KEYS = ['baths', 'bathCount', 'ba', 'fullBaths']
const SQFT_KEYS = ['sqft', 'sq_feet', 'sq_ft', 'sqFeet', 'area']
const PHOTO_KEYS = ['photoUrl', 'photo', 'pic', 'img', 'image']
const URL_KEYS = ['url', 'link', 'href', 'canonicalUrl']

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.]/g, ''))
      if (Number.isFinite(parsed) && value.trim() !== '') return parsed
    }
  }
  return null
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return null
}

/** Small non-cryptographic hash for stable listing ids. */
function hashId(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

/** Coerce one raw row into a Listing, or null when it lacks the essentials. */
export function normalizeListing(raw: unknown): Listing | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>

  const price = firstNumber(source, PRICE_KEYS)
  if (price == null || price <= 0) return null
  const address = firstString(source, ADDRESS_KEYS)
  if (!address) return null

  const url = firstString(source, URL_KEYS) ?? ''
  const zpid = firstString(source, ['zpid', 'id'])
  const id = zpid ?? hashId(`${url || address}|${price}`)

  return {
    id,
    price,
    address,
    location: firstString(source, LOCATION_KEYS),
    beds: firstNumber(source, BEDS_KEYS),
    baths: firstNumber(source, BATHS_KEYS),
    sqft: firstNumber(source, SQFT_KEYS),
    photoUrl: firstString(source, PHOTO_KEYS),
    url,
  }
}

/**
 * Parse an imported payload (JSON text). Accepts a bare array of listings, or an
 * object with a `listings` array (optionally `fetchedAt`/`source`).
 * Rows that do not normalize are skipped; duplicates (by id) are dropped.
 */
export function parseListingsInput(text: string): ListingsPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  let rows: unknown[] | null = Array.isArray(parsed) ? parsed : null
  if (!rows && parsed != null && typeof parsed === 'object') {
    const maybe = (parsed as { listings?: unknown }).listings
    if (Array.isArray(maybe)) rows = maybe
  }
  if (!rows) return null

  const listings: Listing[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const listing = normalizeListing(row)
    if (!listing) continue
    if (seen.has(listing.id)) continue
    seen.add(listing.id)
    listings.push(listing)
  }

  if (listings.length === 0) return null

  const meta =
    !Array.isArray(parsed) && parsed != null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  const fetchedAtRaw = meta.fetchedAt
  const source = typeof meta.source === 'string' ? meta.source : null
  return {
    fetchedAt: typeof fetchedAtRaw === 'number' && Number.isFinite(fetchedAtRaw) ? fetchedAtRaw : null,
    source,
    listings,
  }
}

/** The ceiling of the buffer: max plus bufferPct percent of max. */
export function bufferedMax(max: number, bufferPct: number | null): number {
  if (bufferPct == null || !Number.isFinite(bufferPct) || bufferPct <= 0) return max
  return max * (1 + bufferPct / 100)
}

/**
 * Split listings against the price range:
 * - inRange: min <= price <= max (a missing bound opens that side)
 * - withinBuffer: max < price <= max + bufferPct% of max (requires a max)
 * Input order is preserved; listings outside both buckets are dropped.
 */
export function bucketListings(
  listings: Listing[],
  min: number | null,
  max: number | null,
  bufferPct: number | null,
): BucketedListings {
  const inRange: Listing[] = []
  const withinBuffer: Listing[] = []
  const ceiling = max == null ? null : bufferedMax(max, bufferPct)

  for (const listing of listings) {
    const { price } = listing
    if (min != null && price < min) continue
    if (max == null || price <= max) {
      inRange.push(listing)
      continue
    }
    if (ceiling != null && price <= ceiling) withinBuffer.push(listing)
  }

  return { inRange, withinBuffer }
}

/** Sale price per square foot, when both are known. */
export function pricePerSqFt(listing: Listing): number | null {
  if (listing.sqft == null || listing.sqft <= 0) return null
  return listing.price / listing.sqft
}
