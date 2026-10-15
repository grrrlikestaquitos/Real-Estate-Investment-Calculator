import { beforeEach, describe, expect, it } from 'vitest'
import type { Deal } from './types'
import { DEFAULT_INPUTS } from './types'
import {
  exportDealsJson,
  loadDeals,
  mergeDeals,
  newDealId,
  parseImportedDeals,
  parseHashForDeal,
  sanitizeInputs,
  saveDeals,
  shareUrlFor,
} from './storage'

function makeDeal(id = 'deal-1', type: Deal['type'] = 'investment'): Deal {
  return {
    id,
    name: 'Test Deal',
    type,
    inputs: { ...DEFAULT_INPUTS, rentValue: 1500, propertyValue: 180000 },
    createdAt: 1,
    updatedAt: 2,
  }
}

describe('deal persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips deals through localStorage', () => {
    expect(saveDeals([makeDeal()])).toBe(true)
    const loaded = loadDeals()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Test Deal')
    expect(loaded[0].inputs.rentValue).toBe(1500)
  })

  it('returns an empty list when storage is empty or corrupt', () => {
    expect(loadDeals()).toEqual([])
    window.localStorage.setItem('brrr-calculator/deals/v1', 'not json')
    expect(loadDeals()).toEqual([])
    window.localStorage.setItem(
      'brrr-calculator/deals/v1',
      JSON.stringify([{ id: '', name: 5, inputs: { rentValue: 'oops' } }]),
    )
    expect(loadDeals()).toEqual([])
  })

  it('migrates deal types: missing or unknown types become investment', () => {
    window.localStorage.setItem(
      'brrr-calculator/deals/v1',
      JSON.stringify([
        { id: 'a', name: 'A', inputs: { propertyValue: 100 } },
        { id: 'b', name: 'B', type: 'owner', inputs: {} },
        { id: 'c', name: 'C', type: 'bogus', inputs: {} },
      ]),
    )
    const loaded = loadDeals()
    expect(loaded.map((d) => d.type)).toEqual(['investment', 'owner', 'investment'])
  })

  it('sanitizes input values, dropping non-numeric ones', () => {
    const inputs = sanitizeInputs({
      rentValue: 'nope',
      propertyValue: 100,
      appreciationRate: null,
      extra: 1,
    })
    expect(inputs.rentValue).toBeNull()
    expect(inputs.propertyValue).toBe(100)
    expect(inputs.appreciationRate).toBeNull()
  })
})

describe('shareable links', () => {
  it('round-trips a deal through the URL hash', () => {
    const deal = { ...makeDeal('abc-123'), name: 'Café #1' }
    const url = shareUrlFor(deal)
    expect(url).toContain('#d=')

    const parsed = parseHashForDeal(url.slice(url.indexOf('#')))
    expect(parsed?.id).toBe('abc-123')
    expect(parsed?.name).toBe('Café #1')
    expect(parsed?.inputs.rentValue).toBe(1500)
    expect(parsed?.inputs.propertyValue).toBe(180000)
  })

  it('round-trips the deal type through the URL hash', () => {
    const deal = makeDeal('own-1', 'owner')
    const url = shareUrlFor(deal)
    const parsed = parseHashForDeal(url.slice(url.indexOf('#')))
    expect(parsed?.type).toBe('owner')
  })

  it('rejects empty and malformed hashes', () => {
    expect(parseHashForDeal('')).toBeNull()
    expect(parseHashForDeal('#other=1')).toBeNull()
    expect(parseHashForDeal('#d=!!!not-base64!!!')).toBeNull()
    expect(parseHashForDeal('#d=' + btoa('{oops').replace(/=+$/, ''))).toBeNull()
  })
})

describe('ids', () => {
  it('generates unique ids', () => {
    const seen = new Set(Array.from({ length: 50 }, () => newDealId()))
    expect(seen.size).toBe(50)
  })
})

describe('backup files', () => {
  it('round-trips deals through an exported backup', () => {
    const json = exportDealsJson([makeDeal('a'), makeDeal('b', 'owner')], new Date(0))
    expect(JSON.parse(json)).toMatchObject({ app: 'brrr-calculator', version: 1 })

    const imported = parseImportedDeals(json)
    expect(imported?.map((d) => d.id)).toEqual(['a', 'b'])
    expect(imported?.[1].type).toBe('owner')
    expect(imported?.[0].inputs.propertyValue).toBe(180000)
  })

  it('accepts a bare array of deals and drops invalid entries', () => {
    const imported = parseImportedDeals(JSON.stringify([makeDeal('a'), { name: 'no id' }, 42]))
    expect(imported?.map((d) => d.id)).toEqual(['a'])
  })

  it('rejects files with no usable deals', () => {
    expect(parseImportedDeals('not json')).toBeNull()
    expect(parseImportedDeals('{}')).toBeNull()
    expect(parseImportedDeals('{"deals": []}')).toBeNull()
    expect(parseImportedDeals('null')).toBeNull()
  })

  it('replaces deals with matching ids and appends new ones', () => {
    const current = [makeDeal('a'), makeDeal('b')]
    const restored = { ...makeDeal('b'), name: 'Restored' }
    const merged = mergeDeals(current, [restored, makeDeal('c')])
    expect(merged.map((d) => d.id)).toEqual(['a', 'b', 'c'])
    expect(merged[1].name).toBe('Restored')
  })
})
