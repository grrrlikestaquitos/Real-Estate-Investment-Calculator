import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatCurrencyExact,
  formatCurrencyRange,
  formatNumber,
  formatPercent,
  groupDigits,
} from './format'

describe('formatters', () => {
  it('formats whole-dollar currency', () => {
    expect(formatCurrency(1234)).toBe('$1,234')
    expect(formatCurrency(1234.61)).toBe('$1,235')
    expect(formatCurrency(-1234.61)).toBe('-$1,235')
  })

  it('formats currency with cents', () => {
    expect(formatCurrencyExact(1199.1)).toBe('$1,199.10')
    expect(formatCurrencyExact(0.5)).toBe('$0.50')
  })

  it('formats percentages from scaled values', () => {
    expect(formatPercent(1.5)).toBe('1.50%')
    expect(formatPercent(-3.2)).toBe('-3.20%')
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('formats compact currency for chart labels', () => {
    expect(formatCurrencyCompact(250000)).toBe('$250K')
    expect(formatCurrencyCompact(2756888)).toBe('$2.8M')
    expect(formatCurrencyCompact(-26363)).toBe('-$26.4K')
    expect(formatCurrencyCompact(0)).toBe('$0')
    expect(formatCurrencyCompact(null)).toBe('—')
  })

  it('formats currency ranges', () => {
    expect(formatCurrencyRange([2000, 5000])).toBe('$2,000 – $5,000')
  })

  it('formats plain numbers with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(1234.5)).toBe('1,234.5')
  })

  it('renders an em dash for unavailable values', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrencyExact(null)).toBe('—')
    expect(formatPercent(null)).toBe('—')
    expect(formatNumber(null)).toBe('—')
    expect(formatCurrencyRange(null)).toBe('—')
  })
})

describe('groupDigits', () => {
  it('adds thousands separators while typing', () => {
    expect(groupDigits('1234')).toBe('1,234')
    expect(groupDigits('1234567')).toBe('1,234,567')
    expect(groupDigits('123')).toBe('123')
  })

  it('keeps a partially typed decimal part', () => {
    expect(groupDigits('1234.')).toBe('1,234.')
    expect(groupDigits('1234.5')).toBe('1,234.5')
    expect(groupDigits('.5')).toBe('.5')
  })

  it('is idempotent and normalizes stray characters', () => {
    expect(groupDigits('1,234')).toBe('1,234')
    expect(groupDigits('12,34')).toBe('1,234')
    expect(groupDigits('$1 234')).toBe('1,234')
    expect(groupDigits('1.2.3')).toBe('1.23')
    expect(groupDigits('007')).toBe('7')
    expect(groupDigits('0')).toBe('0')
  })

  it('keeps a leading minus sign', () => {
    expect(groupDigits('-1234')).toBe('-1,234')
    expect(groupDigits('-')).toBe('-')
  })

  it('returns an empty string for empty input', () => {
    expect(groupDigits('')).toBe('')
  })
})
