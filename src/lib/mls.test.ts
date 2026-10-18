import { describe, expect, it } from 'vitest'
import { mlsCsv } from '../test/fixtures/mls'
import {
  bedsFromRemarks,
  geocodeKey,
  withPositions,
  mergeDatasets,
  parseCsv,
  parseMlsCsv,
  propertyTypeFromStyle,
} from './mls'

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, embedded commas and newlines, CRLF and a BOM', () => {
    const text = '﻿a,b,c\r\n1,"two, ""quoted""","multi\nline"\r\n\r\n3,,x\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'two, "quoted"', 'multi\nline'],
      ['3', '', 'x'],
    ])
  })

  it('keeps a last row without a trailing newline', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseMlsCsv', () => {
  it('normalizes a row and never keeps agent-only remarks', () => {
    const [listing] = parseMlsCsv(
      mlsCsv([
        {
          id: '2591878',
          price: 625000,
          original: 650000,
          sqft: 1800,
          unit: 'B',
          hoa: [600, 'Annually'],
          remarks: 'Charming 3-bedroom rambler with a DADU out back.',
          agentOnly: 'Lockbox 9999',
        },
      ]),
    )!
    expect(listing).toMatchObject({
      id: '2591878',
      address: '1878 12th Ave SE #B',
      city: 'Everett',
      zip: '98208',
      area: '740 - Everett/Mukilteo',
      price: 625000,
      originalPrice: 650000,
      sqft: 1800,
      beds: 3,
      bedsAtLeast: false,
      baths: 2.5,
      type: 'house',
      style: '2 Story',
      hoaMonthly: 50,
      listedOn: '2026-09-01',
      basement: '',
      flags: ['adu'],
    })
    expect(JSON.stringify(listing)).not.toContain('Lockbox')
  })

  it('marks per-level bedroom counts as a floor (the export omits upper floors)', () => {
    const [listing] = parseMlsCsv(mlsCsv([{ id: '1', price: 500000, sqft: 1500, beds: [0, 1] }]))!
    expect(listing.beds).toBe(1)
    expect(listing.bedsAtLeast).toBe(true)
  })

  it('flags bank-owned and new construction, and drops placeholder lot sizes', () => {
    const [listing] = parseMlsCsv(
      mlsCsv([{ id: '1', price: 500000, sqft: 1500, bankOwned: true, year: 2026, lot: 1 }]),
    )!
    expect(listing.flags).toEqual(['bankOwned', 'newConstruction'])
    expect(listing.lotSqft).toBeNull()
  })

  it('returns null for a CSV that is not an NWMLS export', () => {
    expect(parseMlsCsv('name,price\nfoo,1\n')).toBeNull()
  })
})

describe('helpers', () => {
  it('maps NWMLS styles to property types', () => {
    expect(propertyTypeFromStyle('Townhouse')).toBe('townhouse')
    expect(propertyTypeFromStyle('Condo (2 Levels)')).toBe('condo')
    expect(propertyTypeFromStyle('Manuf-Double Wide')).toBe('manufactured')
    expect(propertyTypeFromStyle('1 Story w/Bsmnt.')).toBe('house')
  })

  it('reads the first bedroom count from the remarks', () => {
    expect(bedsFromRemarks('Spacious four bedroom home, plus a 1 bed ADU')).toBe(4)
    expect(bedsFromRemarks('3BR, 2BA')).toBe(3)
    expect(bedsFromRemarks('Great views')).toBeNull()
  })

  it('folds the same home listed twice into the residential listing', () => {
    const [condo, house, other] = parseMlsCsv(
      mlsCsv([
        { id: '2583384', streetNumber: '731', price: 650000, sqft: 1455, style: '34 - Condo (3 Levels)' },
        { id: '2584678', streetNumber: '731', price: 650000, sqft: 1455, style: '32 - Townhouse' },
        { id: '2590000', streetNumber: '733', price: 650000, sqft: 1455 },
      ]),
    )!
    const merged = mergeDatasets([{ id: 'a', name: 'a', listings: [condo, house, other] }])
    expect(merged.map((l) => [l.id, l.alsoListedAs])).toEqual([
      ['2584678', [{ id: '2583384', type: 'condo' }]],
      ['2590000', []],
    ])
  })

  it('attaches saved map positions by address and ZIP', () => {
    const [placed, unplaced] = parseMlsCsv(
      mlsCsv([
        { id: '1234', price: 1, sqft: 1, unit: 'B' },
        { id: '5678', price: 1, sqft: 1 },
      ]),
    )!
    expect(geocodeKey(placed)).toBe('1234 12th ave se #b|98208')
    const [a, b] = withPositions([placed, unplaced], { '1234 12th ave se #b|98208': [47.9, -122.2] })
    expect([a.lat, a.lng]).toEqual([47.9, -122.2])
    expect(b.lat).toBeUndefined()
  })

  it('merges datasets, de-duplicating by listing number', () => {
    const a = parseMlsCsv(mlsCsv([{ id: '1', price: 1, sqft: 1 }, { id: '2', price: 2, sqft: 1 }]))!
    const b = parseMlsCsv(mlsCsv([{ id: '2', price: 2, sqft: 1 }, { id: '3', price: 3, sqft: 1 }]))!
    const merged = mergeDatasets([
      { id: 'a', name: 'a', listings: a },
      { id: 'b', name: 'b', listings: b },
    ])
    expect(merged.map((l) => l.id)).toEqual(['1', '2', '3'])
  })
})
