import { describe, expect, it } from 'vitest'
import {
  bufferedMax,
  bucketListings,
  normalizeListing,
  parseListingsInput,
  pricePerSqFt,
  type Listing,
} from './listings'

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'a1',
    price: 500000,
    address: '123 Pine St',
    location: 'Seattle, WA 98101',
    beds: 3,
    baths: 2,
    sqft: 1500,
    photoUrl: null,
    url: 'https://www.zillow.com/homes/123-Pine-St_Seattle_WA-98101/_zpb/',
    ...overrides,
  }
}

describe('normalizeListing', () => {
  it('normalizes a well-formed row', () => {
    const row = {
      price: 500000,
      address: '123 Pine St',
      location: 'Seattle, WA 98101',
      beds: 3,
      baths: 2,
      sqft: 1500,
      url: 'https://www.zillow.com/homes/x/_zpb/',
    }
    const normalized = normalizeListing(row)
    expect(normalized).toMatchObject(row)
    expect(normalized?.id).toMatch(/^[a-z0-9]+$/)
    expect(normalized?.id).toBe(normalizeListing(row)?.id)
  })

  it('accepts alternate key spellings and numeric strings', () => {
    const l = normalizeListing({
      priceValue: '$485,000',
      street: '9 Alder Ave',
      city: 'Kirkland, WA 98033',
      bedCount: '4',
      bathCount: 2.5,
      sq_feet: '1,200',
      photo: 'https://example.com/p.jpg',
      href: 'https://www.zillow.com/homes/y/_zpb/',
    })
    expect(l).toEqual(
      listing({
        id: l!.id,
        price: 485000,
        address: '9 Alder Ave',
        location: 'Kirkland, WA 98033',
        beds: 4,
        baths: 2.5,
        sqft: 1200,
        photoUrl: 'https://example.com/p.jpg',
        url: 'https://www.zillow.com/homes/y/_zpb/',
      }),
    )
  })

  it('skips rows without a positive price or an address', () => {
    expect(normalizeListing(null)).toBeNull()
    expect(normalizeListing('nope')).toBeNull()
    expect(normalizeListing({ address: '123 Pine St' })).toBeNull()
    expect(normalizeListing({ price: 0, address: '123 Pine St' })).toBeNull()
    expect(normalizeListing({ price: -5, address: '123 Pine St' })).toBeNull()
    expect(normalizeListing({ price: 500000 })).toBeNull()
    expect(normalizeListing([{ price: 500000, address: 'x' }])).toBeNull()
  })

  it('prefers an explicit zpid for the id and falls back to a stable hash', () => {
    const withZpid = normalizeListing({ price: 1000, address: '1 Main St', zpid: '2415008946' })
    expect(withZpid?.id).toBe('2415008946')
    const hashed = normalizeListing({ price: 1000, address: '1 Main St', url: 'https://z/x' })
    const again = normalizeListing({ price: 1000, address: '1 Main St', url: 'https://z/x' })
    expect(hashed?.id).toMatch(/^[a-z0-9]+$/)
    expect(hashed?.id).toBe(again?.id)
  })
})

describe('parseListingsInput', () => {
  const payload = JSON.stringify({
    fetchedAt: 1700000000000,
    source: 'https://www.zillow.com/homes/for-sale/98101_rb/',
    total: 13000,
    listings: [
      { price: 500000, address: '123 Pine St', url: 'https://z/a' },
      { price: 520000, address: '456 Maple St', url: 'https://z/b' },
      { address: 'no price, skipped' },
      { price: 500000, address: '123 Pine St', url: 'https://z/a' },
    ],
  })

  it('parses a payload object, skips bad rows, and dedupes by id', () => {
    const parsed = parseListingsInput(payload)
    expect(parsed?.fetchedAt).toBe(1700000000000)
    expect(parsed?.source).toBe('https://www.zillow.com/homes/for-sale/98101_rb/')
    expect(parsed?.total).toBe(13000)
    expect(parsed?.listings.map((l) => l.address)).toEqual(['123 Pine St', '456 Maple St'])
  })

  it('parses a bare array of listings', () => {
    const parsed = parseListingsInput(JSON.stringify([{ price: 100, address: 'x' }]))
    expect(parsed?.listings).toHaveLength(1)
    expect(parsed?.fetchedAt).toBeNull()
    expect(parsed?.source).toBeNull()
    expect(parsed?.total).toBeNull()
  })

  it('returns null for invalid JSON, non-listing data, or no valid rows', () => {
    expect(parseListingsInput('not json')).toBeNull()
    expect(parseListingsInput('42')).toBeNull()
    expect(parseListingsInput('{}')).toBeNull()
    expect(parseListingsInput('[]')).toBeNull()
    expect(parseListingsInput('[{"nope": true}]')).toBeNull()
  })
})

describe('bufferedMax', () => {
  it('adds the buffer as a percent of max', () => {
    expect(bufferedMax(500000, 10)).toBe(550000)
    expect(bufferedMax(500000, 0)).toBe(500000)
  })

  it('treats missing or invalid buffer as no headroom', () => {
    expect(bufferedMax(500000, null)).toBe(500000)
    expect(bufferedMax(500000, -5)).toBe(500000)
    expect(bufferedMax(500000, Number.NaN)).toBe(500000)
  })
})

describe('bucketListings', () => {
  const prices = (n: number) =>
    Array.from({ length: n }, (_, i) => listing({ id: `l${i}`, price: 400000 + i * 10000 }))

  it('splits in-range from buffer listings', () => {
    const { inRange, withinBuffer } = bucketListings(prices(13), null, 500000, 10)
    expect(inRange.map((l) => l.price)).toEqual([
      400000, 410000, 420000, 430000, 440000, 450000, 460000, 470000, 480000, 490000, 500000,
    ])
    expect(withinBuffer.map((l) => l.price)).toEqual([510000, 520000])
  })

  it('keeps input order and applies boundaries inclusively', () => {
    const listings = [
      listing({ id: 'a', price: 540000 }),
      listing({ id: 'b', price: 500000 }),
      listing({ id: 'c', price: 550000 }),
      listing({ id: 'd', price: 550001 }),
    ]
    const { inRange, withinBuffer } = bucketListings(listings, null, 500000, 10)
    expect(inRange.map((l) => l.id)).toEqual(['b'])
    expect(withinBuffer.map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('respects a minimum price on both sides', () => {
    const listings = [
      listing({ id: 'a', price: 300000 }),
      listing({ id: 'b', price: 450000 }),
      listing({ id: 'c', price: 520000 }),
    ]
    const { inRange, withinBuffer } = bucketListings(listings, 400000, 500000, 10)
    expect(inRange.map((l) => l.id)).toEqual(['b'])
    expect(withinBuffer.map((l) => l.id)).toEqual(['c'])
  })

  it('opens the range when bounds are missing and drops buffer without a max', () => {
    const listings = [listing({ id: 'a', price: 100 }), listing({ id: 'b', price: 900 })]
    expect(bucketListings(listings, null, null, 10).inRange.map((l) => l.id)).toEqual(['a', 'b'])
    expect(bucketListings(listings, null, null, 10).withinBuffer).toEqual([])
    expect(bucketListings(listings, 950, null, 10).inRange).toEqual([])
  })
})

describe('pricePerSqFt', () => {
  it('divides price by square footage', () => {
    expect(pricePerSqFt(listing({ price: 500000, sqft: 1250 }))).toBe(400)
  })

  it('is unavailable without a usable sqft', () => {
    expect(pricePerSqFt(listing({ sqft: null }))).toBeNull()
    expect(pricePerSqFt(listing({ sqft: 0 }))).toBeNull()
  })
})
