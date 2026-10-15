import type { DealResults } from '../lib/calculations'
import { FRONT_RATIO_PASS_PERCENT, SEVENTY_RULE_PERCENT } from '../lib/calculations'
import { formatCurrency, formatPercent } from '../lib/format'
import type { DealType } from '../lib/types'

interface DealIndicatorsProps {
  dealType: DealType
  results: DealResults
}

const ICONS = { ok: '✓', bad: '✕', unknown: '•' } as const

function Indicator({
  label,
  ok,
  value,
  detail,
}: {
  label: string
  ok: boolean | null
  /** The headline number behind the verdict (omitted until computable). */
  value?: string
  detail: string
}) {
  const state = ok == null ? 'unknown' : ok ? 'ok' : 'bad'
  return (
    <div className={`indicator indicator-${state}`}>
      <span className="indicator-icon" aria-hidden="true">
        {ICONS[state]}
      </span>
      <div className="indicator-body">
        <span className="indicator-label">
          {label}
          {state !== 'unknown' ? (
            <span className="sr-only">{ok ? ': passes' : ': fails'}</span>
          ) : null}
        </span>
        {value != null && ok != null ? <span className="indicator-value">{value}</span> : null}
        <span className="indicator-detail">{detail}</span>
      </div>
    </div>
  )
}

const perMonth = (value: number) => `${formatCurrency(value)}/mo`

export function DealIndicators({ dealType, results }: DealIndicatorsProps) {
  if (dealType === 'owner') {
    const frontRatio = results.passesFrontRatio
    const savings = results.rentVsBuyMonthly

    return (
      <div className="indicators">
        <Indicator
          label={`Affordability (${FRONT_RATIO_PASS_PERCENT}% Rule)`}
          ok={frontRatio}
          value={`${formatPercent(results.frontRatioPct)} of income`}
          detail={
            frontRatio == null
              ? 'Enter income and mortgage'
              : frontRatio
                ? `Payment is within ${FRONT_RATIO_PASS_PERCENT}% of income`
                : `Payment exceeds ${FRONT_RATIO_PASS_PERCENT}% of income`
          }
        />
        <Indicator
          label="Rent vs Own"
          ok={savings != null ? savings >= 0 : null}
          value={savings != null ? perMonth(savings) : undefined}
          detail={
            savings == null
              ? 'Enter the rent you would otherwise pay'
              : savings >= 0
                ? 'Owning costs no more than renting'
                : 'Renting costs less than owning'
          }
        />
      </div>
    )
  }

  const twoPercent = results.passesTwoPercentRule
  const seventy = results.passesSeventyRule
  const cashFlow = results.monthlyCashFlow
  const cashFlowFifty = results.monthlyCashFlowFiftyRule

  return (
    <div className="indicators">
      <Indicator
        label="2% Rule"
        ok={twoPercent}
        value={`${formatPercent(results.rentToArvRatioPct)} of ARV`}
        detail={
          twoPercent == null
            ? 'Enter rent and ARV'
            : twoPercent
              ? 'Rent is at least 2% of ARV'
              : 'Rent is below 2% of ARV'
        }
      />
      <Indicator
        label={`${SEVENTY_RULE_PERCENT}% Rule`}
        ok={seventy}
        value={`Max offer ${formatCurrency(results.maxOfferSeventyRule)}`}
        detail={
          seventy == null
            ? 'Enter price and ARV'
            : seventy
              ? `Price is within ${SEVENTY_RULE_PERCENT}% of ARV minus rehab`
              : `Price is above ${SEVENTY_RULE_PERCENT}% of ARV minus rehab`
        }
      />
      <Indicator
        label="Monthly Cash Flow"
        ok={cashFlow != null ? cashFlow >= 0 : null}
        value={cashFlow != null ? perMonth(cashFlow) : undefined}
        detail={cashFlow == null ? 'Enter rent and loan' : 'Before operating expenses'}
      />
      <Indicator
        label="50% Rule Cash Flow"
        ok={cashFlowFifty != null ? cashFlowFifty >= 0 : null}
        value={cashFlowFifty != null ? perMonth(cashFlowFifty) : undefined}
        detail={cashFlowFifty == null ? 'Enter rent and loan' : 'After 50% of rent for expenses'}
      />
    </div>
  )
}
