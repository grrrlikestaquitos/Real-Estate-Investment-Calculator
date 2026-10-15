import type { DealResults } from '../lib/calculations'
import { FRONT_RATIO_PASS_PERCENT, SEVENTY_RULE_PERCENT } from '../lib/calculations'
import { formatCurrency } from '../lib/format'
import type { DealType } from '../lib/types'

interface SummaryBarProps {
  dealType: DealType
  results: DealResults
  /** Distance to keep from the bottom of the layout viewport (the on-screen keyboard). */
  bottomInset: number
  onShowResults: () => void
}

interface Metric {
  label: string
  value: number | null
  /** Color by sign (cash flow, savings). */
  signed?: boolean
}

interface Rule {
  label: string
  ok: boolean | null
}

const nonNegative = (value: number | null) => (value == null ? null : value >= 0)

/** Phone-only strip pinned to the bottom of the screen with the deal's headline numbers. */
export function SummaryBar({ dealType, results, bottomInset, onShowResults }: SummaryBarProps) {
  const itemized = results.expenseBasis === 'itemized'

  const [first, second]: Metric[] =
    dealType === 'investment'
      ? [
          { label: 'Payment / mo', value: results.monthlyMortgage },
          {
            label: `Cash flow · ${itemized ? 'itemized' : '25%'}`,
            value: itemized ? results.monthlyCashFlowItemized : results.monthlyCashFlowTwentyFiveRule,
            signed: true,
          },
        ]
      : [
          { label: 'Payment / mo', value: results.monthlyMortgage },
          { label: 'Monthly cost', value: results.monthlyOwnershipCost },
        ]

  const rules: Rule[] =
    dealType === 'investment'
      ? [
          { label: '2%', ok: results.passesTwoPercentRule },
          { label: `${SEVENTY_RULE_PERCENT}%`, ok: results.passesSeventyRule },
          { label: '50%', ok: nonNegative(results.monthlyCashFlowFiftyRule) },
        ]
      : [
          { label: `${FRONT_RATIO_PASS_PERCENT}%`, ok: results.passesFrontRatio },
          { label: 'Rent', ok: nonNegative(results.rentVsBuyMonthly) },
        ]

  return (
    <aside className="summary-bar" aria-label="Results summary" style={{ bottom: bottomInset }}>
      <button type="button" className="summary-bar-button" onClick={onShowResults}>
        {[first, second].map((metric) => (
          <span key={metric.label} className="summary-metric">
            <span className="summary-metric-label">{metric.label}</span>
            <span
              className={`summary-metric-value ${
                metric.signed && metric.value != null ? (metric.value < 0 ? 'negative' : 'positive') : ''
              }`}
            >
              {formatCurrency(metric.value)}
            </span>
          </span>
        ))}
        <span className="summary-rules">
          {rules.map((rule) => {
            const state = rule.ok == null ? 'unknown' : rule.ok ? 'ok' : 'bad'
            return (
              <span key={rule.label} className={`rule-pill rule-pill-${state}`}>
                <span aria-hidden="true">{state === 'ok' ? '✓' : state === 'bad' ? '✕' : '•'}</span>
                {rule.label}
                <span className="sr-only">
                  {state === 'ok' ? ' rule passes' : state === 'bad' ? ' rule fails' : ' rule needs more inputs'}
                </span>
              </span>
            )
          })}
        </span>
        <span className="sr-only">Show full results</span>
        <span aria-hidden="true" className="summary-chevron" />
      </button>
    </aside>
  )
}
