import { describe, expect, it } from 'vitest'
import {
  TAX_RATE_ENTRIES,
  formatRateDisplay,
  perThousandToPercent,
  type TaxRateEntry,
} from './taxRates'

function entry(county: string, city: string): TaxRateEntry {
  const found = TAX_RATE_ENTRIES.find((e) => e.county === county && e.city === city)
  if (!found) throw new Error(`missing ${county} ${city}`)
  return found
}

describe('perThousandToPercent', () => {
  it('converts rates per $1,000 to percentages', () => {
    expect(perThousandToPercent(9.90845)).toBe(0.99)
    expect(perThousandToPercent(12.22112)).toBe(1.22)
    expect(perThousandToPercent(8.5886)).toBe(0.86)
    expect(perThousandToPercent(25.7)).toBe(2.57)
  })
})

describe('formatRateDisplay', () => {
  it('shows a single rate when the city has one', () => {
    expect(formatRateDisplay(entry('Snohomish', 'Everett'))).toBe('0.86%')
    expect(formatRateDisplay(entry('King', 'Mercer Island'))).toBe('0.65%')
  })

  it('shows a range when rates vary within the city', () => {
    expect(formatRateDisplay(entry('King', 'Seattle'))).toBe('0.99% – 1.22%')
  })
})

describe('TAX_RATE_ENTRIES', () => {
  it('covers King and Snohomish county cities', () => {
    expect(TAX_RATE_ENTRIES).toHaveLength(59)
    expect(TAX_RATE_ENTRIES.filter((e) => e.county === 'King')).toHaveLength(39)
    expect(TAX_RATE_ENTRIES.filter((e) => e.county === 'Snohomish')).toHaveLength(20)
  })

  it('has positive, consistent rates for every entry', () => {
    for (const e of TAX_RATE_ENTRIES) {
      expect(e.rateMaxPer1000).toBeGreaterThan(0)
      expect(e.useRatePer1000).toBeGreaterThan(0)
      expect(e.year).toBe(2026)
      if (e.rateMinPer1000 != null) {
        expect(e.rateMinPer1000).toBeGreaterThan(0)
        expect(e.rateMinPer1000).toBeLessThanOrEqual(e.rateMaxPer1000)
      }
      // Applied rate never exceeds the highest known rate
      expect(e.useRatePer1000).toBeLessThanOrEqual(e.rateMaxPer1000)
    }
  })

  it('is sorted alphabetically within each county', () => {
    const counties: Array<'King' | 'Snohomish'> = ['King', 'Snohomish']
    for (const county of counties) {
      const names = TAX_RATE_ENTRIES.filter((e) => e.county === county).map((e) => e.city)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    }
    // King entries come first
    expect(TAX_RATE_ENTRIES[0].county).toBe('King')
  })

  it('includes Bothell in both counties (city spans the county line)', () => {
    expect(entry('King', 'Bothell')).toBeTruthy()
    expect(entry('Snohomish', 'Bothell')).toBeTruthy()
  })

  it('applies the highest rate for King cities (conservative) and the predominant rate for Snohomish', () => {
    const seattle = entry('King', 'Seattle')
    expect(seattle.useRatePer1000).toBe(seattle.rateMaxPer1000)
    const everett = entry('Snohomish', 'Everett')
    expect(everett.useRatePer1000).toBe(everett.rateMaxPer1000)
    expect(perThousandToPercent(seattle.useRatePer1000)).toBe(1.22)
    expect(perThousandToPercent(everett.useRatePer1000)).toBe(0.86)
  })
})
