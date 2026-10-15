import { useState } from 'react'
import type { Deal, DealInputKey, DealInputs } from '../lib/types'
import {
  downPayment,
  downPaymentPercent,
  loanForDownPayment,
  parseInput,
} from '../lib/calculations'
import { formatCurrency } from '../lib/format'
import { Field } from './Field'
import { TaxRateReference } from './TaxRateReference'

type FieldStrings = Record<DealInputKey, string>

/** Down payment quick picks, as a percent of the sale price. */
const DOWN_PAYMENT_PICKS = [3.5, 5, 10, 20, 25] as const

function toFieldStrings(inputs: DealInputs): FieldStrings {
  const out = {} as FieldStrings
  for (const key of Object.keys(inputs) as DealInputKey[]) {
    out[key] = inputs[key] == null ? '' : String(inputs[key])
  }
  return out
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
  const [pointsOpen, setPointsOpen] = useState(
    deal.inputs.loanPointRate != null || deal.inputs.pointsOffered != null,
  )
  const isOwner = deal.type === 'owner'
  const { inputs } = deal

  function update(key: DealInputKey, raw: string) {
    setFields((prev) => ({ ...prev, [key]: raw }))
    onCommit({ ...inputs, [key]: parseInput(raw) })
  }

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
            <Field
              id="propertyValue"
              label="Sale Price"
              prefix="$"
              grouped
              value={fields.propertyValue}
              onChange={(v) => update('propertyValue', v)}
            />
            {!isOwner ? (
              <Field
                id="propertyArvValue"
                label="ARV / Market Value"
                prefix="$"
                grouped
                value={fields.propertyArvValue}
                onChange={(v) => update('propertyArvValue', v)}
              />
            ) : null}
            {!isOwner ? (
              <Field
                id="rentValue"
                label="Monthly Rent"
                prefix="$"
                suffix="/mo"
                grouped
                value={fields.rentValue}
                onChange={(v) => update('rentValue', v)}
              />
            ) : null}
            <Field
              id="propertySize"
              label="Property Size"
              suffix="sq ft"
              grouped
              value={fields.propertySize}
              onChange={(v) => update('propertySize', v)}
            />
            <Field
              id="propertyTax"
              label="Property Tax Rate"
              suffix="%"
              value={fields.propertyTax}
              onChange={(v) => update('propertyTax', v)}
            />
            <Field
              id="appreciationRate"
              label="Annual Appreciation"
              suffix="%"
              value={fields.appreciationRate}
              onChange={(v) => update('appreciationRate', v)}
            />
          </div>
          <TaxRateReference onUseRate={(percent) => update('propertyTax', String(percent))} />
        </fieldset>

        {isOwner ? (
          <fieldset className="input-group">
            <legend>Renting &amp; Affordability</legend>
            <div className="field-grid">
              <Field
                id="rentYouPay"
                label="Rent You'd Otherwise Pay"
                prefix="$"
                suffix="/mo"
                grouped
                value={fields.rentYouPay}
                onChange={(v) => update('rentYouPay', v)}
              />
              <Field
                id="householdIncome"
                label="Monthly Household Income"
                prefix="$"
                grouped
                value={fields.householdIncome}
                onChange={(v) => update('householdIncome', v)}
              />
            </div>
          </fieldset>
        ) : null}

        <fieldset className="input-group">
          <legend>Mortgage</legend>
          <div className="field-grid">
            <Field
              id="loanValue"
              label="Loan Amount"
              prefix="$"
              grouped
              wide
              value={fields.loanValue}
              onChange={(v) => update('loanValue', v)}
              hint={loanHint}
            >
              {inputs.propertyValue != null && inputs.propertyValue > 0 ? (
                <div className="chips" role="group" aria-label="Set loan from down payment">
                  {DOWN_PAYMENT_PICKS.map((pct) => {
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
            <Field
              id="loanRate"
              label="Fixed Rate"
              suffix="%"
              value={fields.loanRate}
              onChange={(v) => update('loanRate', v)}
            />
            <Field
              id="loanTerm"
              label="Loan Term"
              suffix="yrs"
              value={fields.loanTerm}
              onChange={(v) => update('loanTerm', v)}
            />
            <Field
              id="closingCost"
              label="Closing Costs"
              prefix="$"
              grouped
              value={fields.closingCost}
              onChange={(v) => update('closingCost', v)}
            />
            <Field
              id="additionalMonthlyFees"
              label="Other Monthly Fees"
              prefix="$"
              suffix="/mo"
              grouped
              value={fields.additionalMonthlyFees}
              onChange={(v) => update('additionalMonthlyFees', v)}
            />
          </div>
        </fieldset>

        <details
          className="input-group input-group-optional"
          open={pointsOpen}
          onToggle={(e) => setPointsOpen(e.currentTarget.open)}
        >
          <summary>Mortgage points (optional)</summary>
          <div className="field-grid">
            <Field
              id="loanPointRate"
              label="Rate with Points"
              suffix="%"
              value={fields.loanPointRate}
              onChange={(v) => update('loanPointRate', v)}
            />
            <Field
              id="pointsOffered"
              label="Points Offered"
              value={fields.pointsOffered}
              onChange={(v) => update('pointsOffered', v)}
            />
          </div>
        </details>
      </div>
    </section>
  )
}
