import { describe, expect, it } from 'vitest'
import { parseZillowUrl, withPriceAndSort } from './zillowUrl'

// A real Zillow "semantic" search URL (place-based region selection).
const PLACE_URL =
  'https://www.zillow.com/homes/?category=SEMANTIC&searchQueryState=%7B%22filterState%22%3A%7B%22isTownhouse%22%3A%7B%22value%22%3Atrue%7D%2C%22isLotLand%22%3A%7B%22value%22%3Atrue%7D%2C%22isManufactured%22%3A%7B%22value%22%3Atrue%7D%2C%22isMultiFamily%22%3A%7B%22value%22%3Atrue%7D%2C%22isApartment%22%3A%7B%22value%22%3Atrue%7D%2C%22isCondo%22%3A%7B%22value%22%3Atrue%7D%2C%22isSingleFamily%22%3A%7B%22value%22%3Atrue%7D%2C%22isApartmentOrCondo%22%3A%7B%22value%22%3Atrue%7D%2C%22isRecentlySold%22%3A%7B%22value%22%3Afalse%7D%2C%22isPreMarketPreForeclosure%22%3A%7B%22value%22%3Afalse%7D%2C%22isPreMarketForeclosure%22%3A%7B%22value%22%3Afalse%7D%2C%22isForRent%22%3A%7B%22value%22%3Afalse%7D%2C%22isForSaleByAgent%22%3A%7B%22value%22%3Atrue%7D%2C%22isForSaleByOwner%22%3A%7B%22value%22%3Atrue%7D%2C%22isAuction%22%3A%7B%22value%22%3Atrue%7D%2C%22isComingSoon%22%3A%7B%22value%22%3Atrue%7D%2C%22isForSaleForeclosure%22%3A%7B%22value%22%3Atrue%7D%2C%22isNewConstruction%22%3A%7B%22value%22%3Atrue%7D%2C%22sortSelection%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A16037%2C%22regionType%22%3A6%7D%5D%2C%22usersSearchTerm%22%3A%22Seattle%20WA%20homes%22%7D'

// A real Zillow map search URL (the area is a bounding box).
const MAP_URL =
  'https://www.zillow.com/homes/for_sale/?category=SEMANTIC&searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-122.38707035134401%2C%22east%22%3A-122.2325751120862%2C%22south%22%3A47.668900406942974%2C%22north%22%3A47.76037464289794%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%7D'

describe('parseZillowUrl', () => {
  it('decodes the embedded search state from a place search URL', () => {
    const parsed = parseZillowUrl(PLACE_URL)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const state = parsed.state as {
      regionSelection: { regionId: number; regionType: number }[]
      usersSearchTerm: string
      filterState: Record<string, unknown>
    }
    expect(state.regionSelection).toEqual([{ regionId: 16037, regionType: 6 }])
    expect(state.usersSearchTerm).toBe('Seattle WA homes')
    expect(state.filterState.isSingleFamily).toEqual({ value: true })
  })

  it('decodes a map-bounds search URL', () => {
    const parsed = parseZillowUrl(MAP_URL)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.pathname).toBe('/homes/for_sale/')
    const state = parsed.state as {
      mapBounds: { west: number; east: number; south: number; north: number }
      mapZoom: number
      filterState: { sort: { value: string } }
    }
    expect(state.mapBounds.west).toBeCloseTo(-122.38707035134401)
    expect(state.mapZoom).toBe(13)
    expect(state.filterState.sort).toEqual({ value: 'globalrelevanceex' })
  })

  it('rejects non-Zillow URLs, plain Zillow pages, and corrupt state', () => {
    expect(parseZillowUrl('https://www.redfin.com/homes')).toEqual({ ok: false, reason: 'not-zillow' })
    expect(parseZillowUrl('not a url')).toEqual({ ok: false, reason: 'not-zillow' })
    expect(parseZillowUrl('https://www.zillow.com/')).toEqual({ ok: false, reason: 'not-search-url' })
    expect(
      parseZillowUrl('https://www.zillow.com/homes/?searchQueryState=%7B%22filterState%22'),
    ).toEqual({ ok: false, reason: 'bad-json' })
  })
})

describe('withPriceAndSort', () => {
  it('applies the price range and low-to-high sort while keeping the rest of the state', () => {
    const rewritten = withPriceAndSort(PLACE_URL, 200000, 550000, true)
    expect(rewritten).not.toBeNull()

    const parsed = parseZillowUrl(rewritten!)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const state = parsed.state as {
      filterState: {
        price: { min: number; max: number }
        sort: { value: string }
        sortSelection: { value: string }
        isCondo: { value: boolean }
      }
      regionSelection: unknown[]
      usersSearchTerm: string
    }
    expect(state.filterState.price).toEqual({ min: 200000, max: 550000 })
    expect(state.filterState.sort).toEqual({ value: 'price_asc' })
    // The place page used `sortSelection`; it is mirrored so the sort sticks.
    expect(state.filterState.sortSelection).toEqual({ value: 'price_asc' })
    // Untouched parts of the search survive the rewrite.
    expect(state.filterState.isCondo).toEqual({ value: true })
    expect(state.regionSelection).toEqual([{ regionId: 16037, regionType: 6 }])
    expect(state.usersSearchTerm).toBe('Seattle WA homes')
  })

  it('keeps map bounds and zoom on a map search, and only sets sort when asked', () => {
    const rewritten = withPriceAndSort(MAP_URL, null, 500000, false)
    expect(rewritten).not.toBeNull()

    const parsed = parseZillowUrl(rewritten!)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const state = parsed.state as {
      mapBounds: { west: number; east: number }
      mapZoom: number
      filterState: { price?: { max: number }; sort: { value: string } }
    }
    expect(state.filterState.price).toEqual({ max: 500000 })
    expect(state.filterState.sort).toEqual({ value: 'globalrelevanceex' })
    expect(state.mapZoom).toBe(13)
    expect(state.mapBounds.east).toBeCloseTo(-122.2325751120862)
  })

  it('omits the price filter entirely when neither bound is usable', () => {
    const rewritten = withPriceAndSort(MAP_URL, null, null, false)
    expect(rewritten).not.toBeNull()
    const parsed = parseZillowUrl(rewritten!)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const filters = (parsed.state as { filterState: Record<string, unknown> }).filterState
    expect(filters.price).toBeUndefined()
  })

  it('returns null for URLs that do not parse', () => {
    expect(withPriceAndSort('https://www.redfin.com/', 100, 200, true)).toBeNull()
    expect(withPriceAndSort('https://www.zillow.com/', 100, 200, true)).toBeNull()
  })
})
