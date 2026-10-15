import { useState, type ReactNode } from 'react'
import type { Deal, DealInputKey, DealInputs } from '../lib/types'
import {
  DEFAULT_PMI_RATE_PERCENT,
  DEFAULT_REFI_TERM_YEARS,
  downPayment,
  downPaymentPercent,
  loanForDownPayment,
  parseInput,
} from '../lib/calculations'
import { formatCurrency } from '../lib/format'
import { Field } from './Field'
import { TaxRateReference } from './TaxRateReference'

type FieldStrings = Record<DealInputKey, string>

/**
 * Down payment quick picks, as a percent of the sale price. Investment loans
 * usually need 15%+ down; low-down options (FHA, conventional 3–5%) are for homes.
 */
const DOWN_PAYMENT_PICKS = {
  investment: [15, 20, 25],
  owner: [3.5, 5, 10, 20],
} as const

const EXPENSE_KEYS: DealInputKey[] = ['vacancyRate', 'managementRate', 'maintenanceRate', 'insuranceAnnual']
const REFINANCE_KEYS: DealInputKey[] = ['refiLtv', 'refiRate', 'refiTerm', 'refiClosingCost']
const POINTS_KEYS: DealInputKey[] = ['loanPointRate', 'pointsOffered']

function toFieldStrings(inputs: DealInputs): FieldStrings {
  const out = {} as FieldStrings
  for (const key of Object.keys(inputs) as DealInputKey[]) {
    out[key] = inputs[key] == null ? '' : String(inputs[key])
  }
  return out
}

/** A collapsible group of optional inputs; starts open when any of them has a value. */
function OptionalGroup({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string
  hint?: string
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      className="input-group input-group-optional"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{title}</summary>
      {hint ? <p className="input-group-hint">{hint}</p> : null}
      <div className="field-grid">{children}</div>
    </details>
  )
}

interface DealFormProps {
  /**
   * The form keeps its own text state; App remounts it (via `key`) whenever
   * the deal's inputs change from outside, e.g. switching deals or Reset.
   */
  deal: Deal
  onCommit: (inputs: DealInputs) => void
  onReset: () => void
}

export function DealForm({ deal, onCommit, onReset }: DealFormProps) {
  const [fields, setFields] = useState<FieldStrings>(() => toFieldStrings(deal.inputs))
  const isOwner = deal.type === 'owner'
  const { inputs } = deal
  const anySet = (keys: DealInputKey[]) => keys.some((key) => inputs[key] != null)

  function update(key: DealInputKey, raw: string) {
    setFields((prev) => ({ ...prev, [key]: raw }))
    onCommit({ ...inputs, [key]: parseInput(raw) })
  }

  /** Common props for a field bound to an input key. */
  const bind = (key: DealInputKey) => ({
    id: key,
    value: fields[key],
    onChange: (v: string) => update(key, v),
  })

  const dpAmount = downPayment(inputs)
  const dpPercent = downPaymentPercent(inputs)
  const loanHint =
    dpAmount != null && dpPercent != null
      ? `${formatCurrency(dpAmount)} down (${dpPercent.toFixed(1)}% of price)`
      : inputs.propertyValue != null
        ? 'Pick a down payment or type the loan amount'
        : null

  return (
    <section className="card form-card">
      <header className="card-header card-header-row">
        <h2>Deal Inputs</h2>
        <button type="button" className="btn btn-ghost btn-small" onClick={onReset}>
          Clear all
        </button>
      </header>

      <div className="input-groups">
        <fieldset className="input-group">
          <legend>Property</legend>
          <div className="field-grid">
            <Field label="Sale Price" prefix="$" grouped {...bind('propertyValue')} />
            {!isOwner ? (
              <>
                <Field label="ARV / Market Value" prefix="$" grouped {...bind('propertyArvValue')} />
                <Field label="Rehab Budget" prefix="$" grouped {...bind('rehabCost')} />
                <Field label="Monthly Rent" prefix="$" suffix="/mo" grouped {...bind('rentValue')} />
              </>
            ) : null}
            <Field label="Property Tax Rate" suffix="%" {...bind('propertyTax')} />
            <Field label="Annual Appreciation" suffix="%" {...bind('appreciationRate')} />
            <Field label="Property Size" suffix="sq ft" grouped {...bind('propertySize')} />
          </div>
          <TaxRateReference onUseRate={(percent) => update('propertyTax', String(percent))} />
        </fieldset>

        {isOwner ? (
          <fieldset className="input-group">
            <legend>Renting &amp; Affordability</legend>
            <div className="field-grid">
              <Field
                label="Rent You'd Otherwise Pay"
                prefix="$"
                suffix="/mo"
                grouped
                {...bind('rentYouPay')}
              />
              <Field label="Monthly Household Income" prefix="$" grouped {...bind('householdIncome')} />
            </div>
          </fieldset>
        ) : null}

        <fieldset className="input-group">
          <legend>{isOwner ? 'Mortgage' : 'Purchase Loan'}</legend>
          <div className="field-grid">
            <Field label="Loan Amount" prefix="$" grouped wide hint={loanHint} {...bind('loanValue')}>
              {inputs.propertyValue != null && inputs.propertyValue > 0 ? (
                <div className="chips" role="group" aria-label="Set loan from down payment">
                  {DOWN_PAYMENT_PICKS[deal.type].map((pct) => {
                    const active = dpPercent != null && Math.abs(dpPercent - pct) < 0.05
                    return (
                      <button
                        key={pct}
                        type="button"
                        className={`chip ${active ? 'chip-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => {
                          const loan = loanForDownPayment(inputs.propertyValue, pct)
                          if (loan != null) update('loanValue', String(loan))
                        }}
                      >
                        {pct}% down
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </Field>
            <Field label="Fixed Rate" suffix="%" {...bind('loanRate')} />
            <Field label="Loan Term" suffix="yrs" {...bind('loanTerm')} />
            <Field label="Closing Costs" prefix="$" grouped {...bind('closingCost')} />
            <Field label="Other Monthly Fees" prefix="$" suffix="/mo" grouped {...bind('additionalMonthlyFees')} />
            {isOwner ? (
              <>
                <Field
                  label="Home Insurance"
                  prefix="$"
                  suffix="/yr"
                  placeholder="e.g. 1,800"
                  grouped
                  {...bind('insuranceAnnual')}
                />
                <Field
                  label="PMI Rate"
                  suffix="%/yr"
                  placeholder={`Auto ${DEFAULT_PMI_RATE_PERCENT}`}
                  {...bind('pmiRate')}
                />
              </>
            ) : null}
          </div>
          {isOwner ? (
            <p className="input-group-hint input-group-note">
              PMI applies only under 20% down. Leave it empty for a {DEFAULT_PMI_RATE_PERCENT}%/yr
              estimate, or enter 0 if your loan has none (e.g. VA).
            </p>
          ) : null}
        </fieldset>

        {!isOwner ? (
          <>
            <OptionalGroup
              title="Operating expenses (optional)"
              hint="Itemize to get a cash flow based on your own numbers instead of the 50%/25% rules. Property tax is included automatically."
              defaultOpen={anySet(EXPENSE_KEYS)}
            >
              <Field label="Vacancy" suffix="% of rent" placeholder="e.g. 5" {...bind('vacancyRate')} />
              <Field
                label="Management"
                suffix="% of rent"
                placeholder="e.g. 8"
                {...bind('managementRate')}
              />
              <Field
                label="Repairs & CapEx"
                suffix="% of rent"
                placeholder="e.g. 10"
                {...bind('maintenanceRate')}
              />
              <Field
                label="Insurance"
                prefix="$"
                suffix="/yr"
                placeholder="e.g. 1,500"
                grouped
                {...bind('insuranceAnnual')}
              />
            </OptionalGroup>

            <OptionalGroup
              title="Refinance after rehab (optional)"
              hint="The refinance loan is a share of ARV and pays off the purchase loan."
              defaultOpen={anySet(REFINANCE_KEYS)}
            >
              <Field label="Loan-to-Value" suffix="% of ARV" placeholder="e.g. 75" {...bind('refiLtv')} />
              <Field label="Refinance Rate" suffix="%" {...bind('refiRate')} />
              <Field
                label="Refinance Term"
                suffix="yrs"
                placeholder={String(DEFAULT_REFI_TERM_YEARS)}
                {...bind('refiTerm')}
              />
              <Field label="Refi Closing Costs" prefix="$" grouped {...bind('refiClosingCost')} />
            </OptionalGroup>
          </>
        ) : null}

        <OptionalGroup title="Mortgage points (optional)" defaultOpen={anySet(POINTS_KEYS)}>
          <Field label="Rate with Points" suffix="%" {...bind('loanPointRate')} />
          <Field label="Points Offered" {...bind('pointsOffered')} />
        </OptionalGroup>
      </div>
    </section>
  )
}
