import type { DealResults } from '../lib/calculations'
import { formatCurrency, formatCurrencyExact, formatPercent } from '../lib/format'
import type { DealInputs, DealType } from '../lib/types'

interface KeyMetric {
  key: string
  label: string
  value: string
  tone?: 'positive' | 'negative'
}

/** Green for gains, red for losses; neutral when unavailable. */
function signTone(value: number | null): KeyMetric['tone'] {
  if (value == null) return undefined
  return value < 0 ? 'negative' : 'positive'
}

interface KeyMetricsProps {
  dealType: DealType
  inputs: DealInputs
  results: DealResults
}

export function KeyMetrics({ dealType, inputs, results }: KeyMetricsProps) {
  const rateTerm =
    inputs.loanRate == null
      ? inputs.loanTerm != null
        ? `${inputs.loanTerm} yr`
        : '—'
      : inputs.loanTerm != null
        ? `${formatPercent(inputs.loanRate)} / ${inputs.loanTerm} yr`
        : formatPercent(inputs.loanRate)

  const common: KeyMetric[] = [
    { key: 'price', label: 'Sale Price', value: formatCurrency(inputs.propertyValue) },
    { key: 'tax', label: 'Property Tax / yr', value: formatCurrency(results.annualTaxAtSale) },
    { key: 'rate', label: 'Fixed Rate / Term', value: rateTerm },
    { key: 'payment', label: 'Monthly Payment', value: formatCurrencyExact(results.monthlyMortgage) },
  ]

  const metrics: KeyMetric[] =
    dealType === 'investment'
      ? [
          ...common,
          { key: 'arv', label: 'ARV / Market Value', value: formatCurrency(inputs.propertyArvValue) },
          {
            key: 'cashflow',
            label: 'Monthly Cash Flow (25% Rule)',
            value: formatCurrencyExact(results.monthlyCashFlowTwentyFiveRule),
            tone: signTone(results.monthlyCashFlowTwentyFiveRule),
          },
        ]
      : [
          ...common,
          {
            key: 'ownership',
            label: 'Monthly Ownership Cost',
            value: formatCurrencyExact(results.monthlyOwnershipCost),
          },
          {
            key: 'savings',
            label: 'Monthly Savings vs Rent',
            value: formatCurrencyExact(results.rentVsBuyMonthly),
            tone: signTone(results.rentVsBuyMonthly),
          },
        ]

  return (
    <div className="key-metrics">
      {metrics.map((metric) => {
        const empty = metric.value === '—'
        const className = `key-metric ${empty ? 'key-metric-empty' : ''} ${
          metric.tone ? `key-metric-${metric.tone}` : ''
        }`
        return (
          <div key={metric.key} className={className}>
            <span className="key-metric-label">{metric.label}</span>
            <span className="key-metric-value">{metric.value}</span>
          </div>
        )
      })}
    </div>
  )
}
