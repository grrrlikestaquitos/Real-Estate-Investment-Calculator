import { describe, expect, it } from 'vitest'
import { mlsCsv, type Row } from '../test/fixtures/mls'
import { computeResults } from './calculations'
import { parseMlsCsv, type MlsListing } from './mls'
import {
  DEFAULT_FILTERS,
  DEFAULT_INVESTOR_ASSUMPTIONS,
  DEFAULT_OWNER_ASSUMPTIONS,
  RENT_FACTOR_RANGE,
  analyzeListings,
  buildComps,
  buildContext,
  estimateRent,
  matchesFilters,
  rentFactor,
  sortAnalyses,
  taxRateForCity,
  zipStats,
  type Assumptions,
} from './screening'

function listings(rows: Row[]): MlsListing[] {
  return parseMlsCsv(mlsCsv(rows))!
}

const INVESTOR: Assumptions = { perspective: 'investment', values: DEFAULT_INVESTOR_ASSUMPTIONS }
const OWNER: Assumptions = { perspective: 'owner', values: DEFAULT_OWNER_ASSUMPTIONS }

function analyze(rows: Row[], assumptions: Assumptions) {
  const all = listings(rows)
  return analyzeListings(all, buildContext(all), assumptions)
}

// Six Everett houses at $400/sqft, so every one has 5 others to compare with (MIN_COMPS).
const BASE: Row[] = ['1001', '1002', '1003', '1004', '1005', '1006'].map((id) => ({
  id,
  price: 600000,
  sqft: 1500,
}))

describe('comps', () => {
  it('prefers similar-size homes of the same type in the same city, leaving the listing itself out', () => {
    const all = listings([
      ...BASE,
      // Bigger homes go for less per foot: these must not drag the 1,500 sqft median down.
      ...['2001', '2002', '2003', '2004', '2005'].map((id) => ({ id, price: 750000, sqft: 3000 })),
    ])
    const compsFor = buildComps(all)
    expect(compsFor(all[0])).toEqual({
      label: 'similar-size Everett houses',
      medianPricePerSqft: 400,
      count: 5,
    })
    // The big ones have only 4 similar-size others: the city's houses of any size.
    expect(compsFor(all[6])?.label).toBe('Everett houses')
  })

  it('widens to the type in every city, then to everything', () => {
    const all = listings([
      ...BASE,
      { id: '3001', price: 500000, sqft: 1400, city: 'Bothell' },
      { id: '4001', price: 300000, sqft: 1000, style: '32 - Townhouse' },
    ])
    const compsFor = buildComps(all)
    expect(compsFor(all[6])?.label).toBe('similar-size houses, all cities')
    expect(compsFor(all[7])?.label).toBe('all listings')
  })
})

describe('rent by ZIP', () => {
  it('scales rent by the ZIP median rent against the typical ZIP, within limits', () => {
    const typical = zipStats('98208')!.medianRent!
    const pricier = zipStats('98004')!.medianRent!
    expect(rentFactor('98004', typical)).toBeCloseTo(Math.min(pricier / typical, RENT_FACTOR_RANGE[1]), 6)
    expect(rentFactor('98039', 1000)).toBe(RENT_FACTOR_RANGE[1])
    expect(rentFactor('00000', typical)).toBe(1)
  })

  it('tapers rent past 1,500 sqft and rounds to $25', () => {
    const [small, big] = listings([
      { id: '1', price: 1, sqft: 1000 },
      { id: '2', price: 1, sqft: 2500 },
    ])
    expect(estimateRent(small, 2)).toBe(2000)
    expect(estimateRent(big, 2)).toBe(4000)
    expect(estimateRent(small, 2, 1.1)).toBe(2200)
  })

  it('uses the typical ZIP across the listings as the reference', () => {
    const ctx = buildContext(listings([{ id: '1', price: 1, sqft: 1, zip: '98208' }]))
    expect(ctx.referenceRent).toBe(zipStats('98208')!.medianRent)
  })
})

describe('investor perspective', () => {
  it('rewards a discounted, reduced, value-add listing over the pack', () => {
    const analyses = analyze(
      [
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
      ],
      INVESTOR,
    )
    const [best] = sortAnalyses(analyses, 'score')
    expect(best.listing.id).toBe('9001')
    expect(best.discountPct).toBeCloseTo(20, 6)
    expect(best.reasons.map((r) => r.text)).toEqual(
      expect.arrayContaining([
        '20% below similar-size Everett houses $/sqft',
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
    const [plain, restricted] = analyze(
      [...BASE, { id: '9002', price: 600000, sqft: 1500, hoa: [400, 'Monthly'], remarks: 'A 55+ community.' }],
      INVESTOR,
    ).slice(5)
    expect(restricted.score).toBeLessThan(plain.score - 15)
    expect(restricted.reasons).toEqual([
      { tone: 'bad', text: 'HOA $400/mo' },
      { tone: 'bad', text: '55+ community' },
    ])
  })

  it('computes returns the same way a deal does', () => {
    const [analysis] = analyze(
      [{ id: '1', price: 600000, sqft: 1500, hoa: [100, 'Monthly'], city: 'Bothell' }],
      INVESTOR,
    )
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
    expect(analysis.cashFlow).toBeCloseTo(computeResults(analysis.dealInputs).monthlyCashFlowItemized!, 6)
    expect(analysis.cashNeeded).toBe(132000)
  })
})

describe('homeowner perspective', () => {
  const income = (householdIncome: number): Assumptions => ({
    perspective: 'owner',
    values: { ...DEFAULT_OWNER_ASSUMPTIONS, householdIncome },
  })

  it('builds a homeowner deal with PMI under 20% down and the income as a monthly figure', () => {
    const [analysis] = analyze([{ id: '1', price: 600000, sqft: 1500 }], income(180000))
    expect(analysis.dealInputs).toMatchObject({ loanValue: 540000, householdIncome: 15000, rentValue: null })
    expect(analysis.pmi).toBeGreaterThan(0)
    expect(analysis.cashFlow).toBeNull()
    const deal = computeResults(analysis.dealInputs)
    expect(analysis.incomeShare).toBeCloseTo(deal.frontRatioPct!, 6)
  })

  it('scores affordability only once an income is entered', () => {
    const rows = [...BASE]
    const without = analyze(rows, OWNER)[0]
    const comfortable = analyze(rows, income(400000))[0]
    const stretched = analyze(rows, income(100000))[0]
    expect(without.incomeShare).toBeNull()
    expect(comfortable.score).toBe(without.score + 25)
    expect(stretched.score).toBe(without.score)
    expect(stretched.reasons).toContainEqual({ tone: 'bad', text: `Payment ${Math.round(stretched.incomeShare!)}% of income` })
  })

  it('prefers new or updated homes, yards, garages and views, and calls out fixers', () => {
    const analyses = analyze(
      [
        ...BASE,
        { id: '7001', price: 600000, sqft: 1500, year: 2026, view: 'Mountain, Territorial' },
        { id: '7002', price: 600000, sqft: 1500, remarks: 'Fixer, sold as-is.', lot: 3000, garage: 0 },
      ],
      OWNER,
    )
    const plain = analyses[0]
    const newer = analyses[6]
    const fixer = analyses[7]
    expect(newer.reasons.map((r) => r.text)).toEqual(
      expect.arrayContaining(['New construction', 'Mountain view', 'Yard (5,000 sqft lot)', '2-car garage']),
    )
    expect(newer.score).toBe(plain.score + 15 + 3)
    expect(fixer.reasons).toContainEqual({ tone: 'bad', text: 'Needs work (fixer / as-is)' })
    expect(fixer.score).toBeLessThan(plain.score)
  })

  it('ranks investor upside differently: a fixer with an ADU suits an investor, not a homeowner', () => {
    const rows: Row[] = [
      ...BASE,
      { id: '8001', price: 600000, sqft: 1500, remarks: 'Fixer with a DADU, investors welcome.' },
      { id: '8002', price: 600000, sqft: 1500, year: 2026 },
    ]
    expect(sortAnalyses(analyze(rows, INVESTOR), 'score')[0].listing.id).toBe('8001')
    expect(sortAnalyses(analyze(rows, OWNER), 'score')[0].listing.id).toBe('8002')
  })

  it('sorts by monthly cost, cheapest first', () => {
    const analyses = analyze(
      [
        { id: '1', price: 650000, sqft: 1500 },
        { id: '2', price: 600000, sqft: 1500, hoa: [500, 'Monthly'] },
        { id: '3', price: 550000, sqft: 1500 },
      ],
      OWNER,
    )
    expect(sortAnalyses(analyses, 'monthlyCost').map((a) => a.listing.id)).toEqual(['3', '1', '2'])
  })
})

describe('matchesFilters', () => {
  const [house, condo] = analyze(
    [
      { id: '1', price: 500000, sqft: 1500, beds: [0, 1], remarks: 'Fixer!' },
      { id: '2', price: 700000, sqft: 900, style: '30 - Condo (1 Level)', hoa: [500, 'Monthly'] },
    ],
    INVESTOR,
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

  it('leaves out hidden ZIP codes', () => {
    expect(matchesFilters(house, { ...DEFAULT_FILTERS, hiddenZips: ['98208'] }, none)).toBe(false)
    expect(matchesFilters(house, { ...DEFAULT_FILTERS, hiddenZips: ['98168'] }, none)).toBe(true)
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
    const analyses = analyze(
      [
        { id: '1', price: 700000, sqft: 1500 },
        { id: '2', price: 500000, sqft: 1500 },
      ],
      INVESTOR,
    )
    expect(sortAnalyses(analyses, 'price').map((a) => a.listing.id)).toEqual(['2', '1'])
  })
})
