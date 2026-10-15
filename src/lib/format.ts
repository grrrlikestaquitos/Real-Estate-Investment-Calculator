const UNAVAILABLE = '—'

const wholeCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const exactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const plain = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Whole-dollar currency (or '—' when unavailable). */
export function formatCurrency(value: number | null): string {
  return value == null || !Number.isFinite(value) ? UNAVAILABLE : wholeCurrency.format(value)
}

/** Currency with cents (or '—' when unavailable). */
export function formatCurrencyExact(value: number | null): string {
  return value == null || !Number.isFinite(value) ? UNAVAILABLE : exactCurrency.format(value)
}

/** Short currency for chart axes and labels: $250K, $1.2M (or '—' when unavailable). */
export function formatCurrencyCompact(value: number | null): string {
  return value == null || !Number.isFinite(value) ? UNAVAILABLE : compactCurrency.format(value)
}

/** Plain number with commas (or '—' when unavailable). */
export function formatNumber(value: number | null): string {
  return value == null || !Number.isFinite(value) ? UNAVAILABLE : plain.format(value)
}

/**
 * Percentage from an already-scaled value (e.g. 1.5 means "1.5%"),
 * or '—' when unavailable.
 */
export function formatPercent(value: number | null): string {
  return value == null || !Number.isFinite(value) ? UNAVAILABLE : percent.format(value / 100)
}

/**
 * Add thousands separators to a number the user is typing, keeping whatever
 * decimal part they have typed so far ("1234.5" → "1,234.5", "12." → "12.").
 * Anything other than digits, one leading "-" and the first "." is dropped.
 */
export function groupDigits(raw: string): string {
  const cleaned = raw.replace(/[^\d.-]/g, '')
  const sign = cleaned.startsWith('-') ? '-' : ''
  const unsigned = cleaned.replace(/-/g, '')
  const dot = unsigned.indexOf('.')
  const whole = dot === -1 ? unsigned : unsigned.slice(0, dot)
  const fraction = dot === -1 ? '' : `.${unsigned.slice(dot + 1).replace(/\./g, '')}`
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}${fraction}`
}

export function formatCurrencyRange(range: [number, number] | null): string {
  if (range == null) return UNAVAILABLE
  return `${formatCurrency(range[0])} – ${formatCurrency(range[1])}`
}
