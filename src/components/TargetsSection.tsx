import type { ReactNode } from 'react'
import type { DealResults } from '../lib/calculations'
import { FRONT_RATIO_PASS_PERCENT } from '../lib/calculations'
import { formatCurrency, formatPercent } from '../lib/format'
import { GLOSSARY } from '../lib/glossary'
import type { DealInputs, DealType } from '../lib/types'
import { InfoTip } from './InfoTip'
import { Section } from './Section'

interface TargetsSectionProps {
  dealType: DealType
  inputs: DealInputs
  results: DealResults
}

/** Green when the deal as entered is on the right side of the target. */
function meets(actual: number | null, target: number | null, direction: 'atLeast' | 'atMost') {
  if (actual == null || target == null) return undefined
  const ok = direction === 'atLeast' ? actual >= target : actual <= target
  return ok ? ('positive' as const) : ('negative' as const)
}

/** A target beside what the deal has now, green when the deal meets it. */
function TargetRow({
  label,
  value,
  now,
  tone,
  info,
}: {
  label: string
  value: string
  now: string | null
  tone?: 'positive' | 'negative'
  info?: ReactNode
}) {
  return (
    <div className={`stat-row ${tone ? `stat-row-${tone}` : ''}`}>
      <span className="stat-label">
        {label}
        {info}
      </span>
      <span className="target-value">
        <span className="stat-value">{value}</span>
        {now != null ? <span className="target-now">now {now}</span> : null}
      </span>
    </div>
  )
}

const perMonth = (value: number | null) => (value == null ? null : `${formatCurrency(value)}/mo`)
const orNull = (value: number | null, format: (v: number) => string) => (value == null ? null : format(value))

/** A solved rate: "Any rate" when nothing up to 30% breaks it, "Not even at 0%" when none works. */
function rateText(rate: number | null, solvable: boolean): string {
  if (rate === Infinity) return 'Any rate'
  if (rate == null) return solvable ? 'Not even at 0%' : '—'
  return formatPercent(rate)
}

/**
 * "What it takes": each figure solves for one input (rent, price, or rate)
 * with everything else held as entered.
 */
export function TargetsSection({ dealType, inputs, results }: TargetsSectionProps) {
  if (dealType === 'owner') {
    const rateSolvable = inputs.householdIncome != null && results.monthlyMortgage != null
    return (
      <Section
        title="What It Takes"
        subtitle={`Limits for the ${FRONT_RATIO_PASS_PERCENT}% rule at your income, holding everything else as entered`}
      >
        <div className="stats stats-2col">
          <TargetRow
            label={`Max Price (${FRONT_RATIO_PASS_PERCENT}% Rule)`}
            value={formatCurrency(results.maxPriceForFrontRatio)}
            now={orNull(inputs.propertyValue, formatCurrency)}
            tone={meets(inputs.propertyValue, results.maxPriceForFrontRatio, 'atMost')}
            info={<InfoTip {...GLOSSARY.frontRatio} />}
          />
          <TargetRow
            label={`Highest Rate (${FRONT_RATIO_PASS_PERCENT}% Rule)`}
            value={rateText(results.maxRateForFrontRatio, rateSolvable)}
            now={orNull(inputs.loanRate, formatPercent)}
            tone={
              results.maxRateForFrontRatio === Infinity
                ? 'positive'
                : meets(inputs.loanRate, results.maxRateForFrontRatio, 'atMost')
            }
          />
        </div>
        {inputs.householdIncome == null ? (
          <p className="note">Enter your monthly household income to see these limits.</p>
        ) : null}
      </Section>
    )
  }

  const basis = results.expenseBasis === 'itemized' ? 'Itemized' : '50% Rule'
  const rateSolvable = inputs.rentValue != null && inputs.loanValue != null && inputs.loanTerm != null
  return (
    <Section
      title="What It Takes"
      subtitle={`Break-even points on the ${basis === 'Itemized' ? 'itemized expense' : '50% rule'} basis, holding everything else as entered`}
    >
      <div className="stats stats-2col">
        <TargetRow
          label={`Rent to Break Even (${basis})`}
          value={perMonth(results.breakEvenRent) ?? '—'}
          now={perMonth(inputs.rentValue)}
          tone={meets(inputs.rentValue, results.breakEvenRent, 'atLeast')}
          info={<InfoTip {...GLOSSARY.breakEven} />}
        />
        <TargetRow
          label="Max Price to Break Even"
          value={formatCurrency(results.maxPriceToBreakEven)}
          now={orNull(inputs.propertyValue, formatCurrency)}
          tone={meets(inputs.propertyValue, results.maxPriceToBreakEven, 'atMost')}
        />
        <TargetRow
          label="Highest Rate to Break Even"
          value={rateText(results.maxRateToBreakEven, rateSolvable)}
          now={orNull(inputs.loanRate, formatPercent)}
          tone={
            results.maxRateToBreakEven === Infinity
              ? 'positive'
              : meets(inputs.loanRate, results.maxRateToBreakEven, 'atMost')
          }
        />
      </div>
    </Section>
  )
}
