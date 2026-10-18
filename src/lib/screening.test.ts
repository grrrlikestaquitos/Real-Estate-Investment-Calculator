import { describe, expect, it } from 'vitest'
import { mlsCsv, type Row } from '../test/fixtures/mls'
import { computeResults } from './calculations'
import { parseMlsCsv, type MlsListing } from './mls'
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_FILTERS,
  analyzeListings,
  buildComps,
  estimateRent,
  matchesFilters,
  sortAnalyses,
  taxRateForCity,
} from './screening'

function listings(rows: Row[]): MlsListing[] {
  return parseMlsCsv(mlsCsv(rows))!
}

// Five Everett houses at $400/sqft, so comps are trusted (MIN_COMPS).
const BASE: Row[] = ['1001', '1002', '1003', '1004', '1005'].map((id) => ({
  id,
  price: 600000,
  sqft: 1500,
}))

describe('comps', () => {
  it('uses the city + type median when there are enough, else the type, else everything', () => {
    const all = listings([
      ...BASE,
      { id: '2001', price: 500000, sqft: 1000, city: 'Bothell' },
      { id: '3001', price: 300000, sqft: 1000, style: '32 - Townhouse' },
    ])
    const compsFor = buildComps(all)
    expect(compsFor(all[0])).toEqual({ label: 'Everett houses', medianPricePerSqft: 400, count: 5 })
    expect(compsFor(all[5])?.label).toBe('all houses')
    expect(compsFor(all[6])?.label).toBe('all listings')
  })
})

describe('analyzeListings', () => {
  it('rewards a discounted, reduced, value-add listing over the pack', () => {
    const analyses = analyzeListings(
      listings([
        ...BASE,
        {
          id: '9001',
          price: 480000,
          original: 540000,
          sqft: 1500,
          cdom: 120,
          lot: 9000,
          remarks: 'Investor alert! Mother-in-law unit with a separate entrance.',
        },
      ]),
      DEFAULT_ASSUMPTIONS,
    )
    const [best] = sortAnalyses(analyses, 'score')
    expect(best.listing.id).toBe('9001')
    expect(best.discountPct).toBeCloseTo(20, 6)
    expect(best.priceCutPct).toBeCloseTo(11.1, 1)
    expect(best.reasons.map((r) => r.text)).toEqual(
      expect.arrayContaining([
        '20% below Everett houses $/sqft',
        'Price cut 11% ($60,000)',
        '120 days on market',
        'Investor special',
        'Separate entrance / in-law',
        'Large lot (9,000 sqft)',
      ]),
    )
    expect(best.score).toBeGreaterThan(analyses[0].score + 30)
  })

  it('takes points off for HOA dues and 55+ restrictions', () => {
    const [plain, restricted] = analyzeListings(
      listings([
        ...BASE,
        { id: '9002', price: 600000, sqft: 1500, hoa: [400, 'Monthly'], remarks: 'A 55+ community.' },
      ]),
      DEFAULT_ASSUMPTIONS,
    ).slice(4)
    expect(restricted.score).toBeLessThan(plain.score - 15)
    expect(restricted.reasons).toEqual([
      { tone: 'bad', text: 'HOA $400/mo' },
      { tone: 'bad', text: '55+ community' },
    ])
  })

  it('computes returns the same way a deal does', () => {
    const [analysis] = analyzeListings(
      listings([{ id: '1', price: 600000, sqft: 1500, hoa: [100, 'Monthly'], city: 'Bothell' }]),
      DEFAULT_ASSUMPTIONS,
    )
    const deal = computeResults(analysis.dealInputs)
    expect(analysis.dealInputs).toMatchObject({
      propertyValue: 600000,
      rentValue: 3000,
      loanValue: 480000,
      loanRate: 6.5,
      closingCost: 12000,
      additionalMonthlyFees: 100,
      insuranceAnnual: 1800,
      propertyTax: taxRateForCity('Bothell').rate,
    })
    expect(analysis.cashFlow).toBeCloseTo(deal.monthlyCashFlowItemized!, 6)
    expect(analysis.cashNeeded).toBe(132000)
  })
})

describe('estimateRent', () => {
  it('charges half rate past the taper and rounds to $25', () => {
    const [small, big] = listings([
      { id: '1', price: 1, sqft: 1000 },
      { id: '2', price: 1, sqft: 2500 },
    ])
    expect(estimateRent(small, 2)).toBe(2000)
    expect(estimateRent(big, 2)).toBe(4000)
  })
})

describe('taxRateForCity', () => {
  it('uses the table, else the regional median', () => {
    expect(taxRateForCity('bothell').estimated).toBe(false)
    expect(taxRateForCity('Kingston').estimated).toBe(true)
  })
})

describe('matchesFilters', () => {
  const [house, condo] = analyzeListings(
    listings([
      { id: '1', price: 500000, sqft: 1500, beds: [0, 1], remarks: 'Fixer!' },
      { id: '2', price: 700000, sqft: 900, style: '30 - Condo (1 Level)', hoa: [500, 'Monthly'] },
    ]),
    DEFAULT_ASSUMPTIONS,
  )
  const none = new Set<string>()

  it('filters by price, type, HOA and value-add', () => {
    expect(matchesFilters(house, { ...DEFAULT_FILTERS, maxPrice: 600000 }, none)).toBe(true)
    expect(matchesFilters(condo, { ...DEFAULT_FILTERS, maxPrice: 600000 }, none)).toBe(false)
    expect(matchesFilters(condo, { ...DEFAULT_FILTERS, types: ['house'] }, none)).toBe(false)
    expect(matchesFilters(condo, { ...DEFAULT_FILTERS, maxHoa: 300 }, none)).toBe(false)
    expect(matchesFilters(house, { ...DEFAULT_FILTERS, valueAddOnly: true }, none)).toBe(true)
    expect(matchesFilters(condo, { ...DEFAULT_FILTERS, valueAddOnly: true }, none)).toBe(false)
  })

  it('limits to the checked cities', () => {
    expect(matchesFilters(house, { ...DEFAULT_FILTERS, cities: ['Everett', 'Bothell'] }, none)).toBe(true)
    expect(matchesFilters(house, { ...DEFAULT_FILTERS, cities: ['Bothell'] }, none)).toBe(false)
  })

  it("doesn't rule out a listing whose bedroom count is only a floor", () => {
    expect(matchesFilters(house, { ...DEFAULT_FILTERS, minBeds: 3 }, none)).toBe(true)
  })

  it('limits to the shortlist', () => {
    const filters = { ...DEFAULT_FILTERS, shortlistOnly: true }
    expect(matchesFilters(house, filters, new Set(['1']))).toBe(true)
    expect(matchesFilters(condo, filters, new Set(['1']))).toBe(false)
  })
})

describe('sortAnalyses', () => {
  it('sorts price low → high and keeps missing values last', () => {
    const analyses = analyzeListings(
      listings([
        { id: '1', price: 700000, sqft: 1500 },
        { id: '2', price: 500000, sqft: 1500 },
      ]),
      DEFAULT_ASSUMPTIONS,
    )
    expect(sortAnalyses(analyses, 'price').map((a) => a.listing.id)).toEqual(['2', '1'])
  })
})
