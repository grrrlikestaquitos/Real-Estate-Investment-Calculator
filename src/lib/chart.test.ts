import { describe, expect, it } from 'vitest'
import { niceTicks } from './chart'

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    expect(niceTicks(0, 2756888)).toEqual([0, 1000000, 2000000, 3000000])
    expect(niceTicks(0, 211968)).toEqual([0, 50000, 100000, 150000, 200000, 250000])
    expect(niceTicks(0, 100)).toEqual([0, 25, 50, 75, 100])
  })

  it('spans negative values', () => {
    const ticks = niceTicks(-790876, 0)
    expect(ticks[0]).toBeLessThanOrEqual(-790876)
    expect(ticks.at(-1)).toBe(0)
    expect(ticks).toContain(-400000)
  })

  it('handles a flat or invalid range', () => {
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(niceTicks(500, 500)[0]).toBeLessThanOrEqual(500)
    expect(niceTicks(NaN, 1)).toEqual([0, 1])
  })
})
