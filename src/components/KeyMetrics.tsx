import { FRONT_RATIO_PASS_PERCENT, type DealResults } from '../lib/calculations'
import { formatCurrency, formatCurrencyExact, formatPercent } from '../lib/format'
import { GLOSSARY, type GlossaryEntry } from '../lib/glossary'
import { ANALYSIS_HORIZONS, type DealType } from '../lib/types'
import { InfoTip } from './InfoTip'

interface KeyMetric {
  key: string
  label: string
  value: string
  tone?: 'positive' | 'negative'
  info?: GlossaryEntry
}

/** Green for gains, red for losses; neutral when unavailable. */
function signTone(value: number | null): KeyMetric['tone'] {
  if (value == null) return undefined
  return value < 0 ? 'negative' : 'positive'
}

const perMonth = (value: number | null) => (value == null ? '—' : `${formatCurrency(value)}/mo`)

const FIVE_YEARS = ANALYSIS_HORIZONS.indexOf(5)

interface KeyMetricsProps {
  dealType: DealType
  results: DealResults
}

/**
 * Headline numbers the inputs don't already show: what the deal costs up front,
 * what it pays or costs each month, and what it builds.
 */
export function KeyMetrics({ dealType, results }: KeyMetricsProps) {
  const itemized = results.expenseBasis === 'itemized'
  const basis = itemized ? 'Itemized' : '25% Rule'
  const cashFlow = itemized ? results.monthlyCashFlowItemized : results.monthlyCashFlowTwentyFiveRule
  const cashOnCash = itemized ? results.roiItemized : results.roiTwentyFiveRule

  const metrics: KeyMetric[] =
    dealType === 'investment'
      ? [
          {
            key: 'cash',
            label: 'Cash Needed',
            value: formatCurrency(results.cashInvested),
            info: GLOSSARY.cashNeeded,
          },
          { key: 'payment', label: 'Monthly Payment', value: formatCurrencyExact(results.monthlyMortgage) },
          {
            key: 'cashflow',
            label: `Monthly Cash Flow (${basis})`,
            value: formatCurrencyExact(cashFlow),
            tone: signTone(cashFlow),
            info: itemized ? undefined : GLOSSARY.twentyFiveRule,
          },
          {
            key: 'coc',
            label: `Cash-on-Cash (${basis})`,
            value: formatPercent(cashOnCash),
            tone: signTone(cashOnCash),
            info: GLOSSARY.cashOnCash,
          },
          {
            key: 'equity',
            label: 'Equity at Purchase',
            value: formatCurrency(results.equityAtPurchase),
            tone: signTone(results.equityAtPurchase),
            info: GLOSSARY.equityAtPurchase,
          },
          {
            key: 'left',
            label: 'Cash Left After Refi',
            value: formatCurrency(results.cashLeftInDeal),
            info: GLOSSARY.cashLeftInDeal,
          },
        ]
      : [
          {
            key: 'cash',
            label: 'Cash to Close',
            value: formatCurrency(results.cashToClose),
            info: GLOSSARY.cashToClose,
          },
          { key: 'payment', label: 'Monthly Payment', value: formatCurrencyExact(results.monthlyMortgage) },
          {
            key: 'ownership',
            label: 'Monthly Ownership Cost',
            value: formatCurrencyExact(results.monthlyOwnershipCost),
            info: GLOSSARY.ownershipCost,
          },
          {
            key: 'income',
            label: `Income Needed (${FRONT_RATIO_PASS_PERCENT}% Rule)`,
            value: perMonth(results.incomeForFrontRatio),
            info: GLOSSARY.frontRatio,
          },
          {
            key: 'equity',
            label: 'Equity in 5 Years',
            value: formatCurrency(results.equityByHorizon[FIVE_YEARS]),
            info: GLOSSARY.equity,
          },
          { key: 'interest', label: 'Total Interest Paid', value: formatCurrency(results.totalInterest) },
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
            <span className="key-metric-label">
              {metric.label}
              {metric.info ? <InfoTip {...metric.info} /> : null}
            </span>
            <span className="key-metric-value">{metric.value}</span>
          </div>
        )
      })}
    </div>
  )
}
