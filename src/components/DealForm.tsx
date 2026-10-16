import { useState, type ReactNode } from 'react'
import type { Deal, DealInputKey, DealInputs } from '../lib/types'
import {
  DEFAULT_PMI_RATE_PERCENT,
  DEFAULT_REFI_TERM_YEARS,
  annualPropertyTax,
  downPayment,
  downPaymentPercent,
  homeValueAfterYears,
  loanForDownPayment,
  monthlyMortgagePayment,
  monthlyPmi,
  mortgagePointValue,
  parseInput,
  refinanceLoan,
  refinancePayment,
} from '../lib/calculations'
import { formatCurrency, formatCurrencyCompact } from '../lib/format'
import { GLOSSARY } from '../lib/glossary'
import { Field } from './Field'
import { InfoTip } from './InfoTip'
import { SliderField } from './SliderField'
import { TaxRateReference } from './TaxRateReference'
import { TermField } from './TermField'

type FieldStrings = Record<DealInputKey, string>

/**
 * Down payment quick picks, as a percent of the sale price. Investment loans
 * usually need 15%+ down; low-down options (FHA, conventional 3–5%) are for homes.
 */
const DOWN_PAYMENT_PICKS = {
  investment: [15, 20, 25],
  owner: [3.5, 5, 10, 20],
} as const

const LOAN_TERM_PRESETS = [15, 20, 30] as const

/** Slider span and step for a rate in percent; typed values may go outside it. */
const RATE_RANGE = { min: 2, max: 12, step: 0.125 } as const

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

/** Trim a percentage for an input box: 20 → "20", 19.987 → "19.99". */
const percentText = (value: number) => String(Number(value.toFixed(2)))

/**
 * Down payment as a percent of the price, by slider, quick pick, or typing.
 * It sets the loan amount (the stored input) and follows it when that's typed.
 */
function DownPaymentField({
  inputs,
  picks,
  onLoanChange,
}: {
  inputs: DealInputs
  picks: readonly number[]
  onLoanChange: (loan: string) => void
}) {
  // While the box has focus it shows what's typed; otherwise the percent derived from the loan.
  const [draft, setDraft] = useState<string | null>(null)
  const percent = downPaymentPercent(inputs)
  const amount = downPayment(inputs)
  const hasPrice = inputs.propertyValue != null && inputs.propertyValue > 0
  const shown = draft ?? (percent == null ? '' : percentText(percent))

  function setPercent(raw: string) {
    if (draft != null) setDraft(raw)
    const pct = parseInput(raw)
    const loan = pct == null ? null : loanForDownPayment(inputs.propertyValue, pct)
    if (loan != null) onLoanChange(String(loan))
  }

  return (
    <SliderField
      id="downPaymentPercent"
      label="Down Payment"
      value={hasPrice ? shown : ''}
      onChange={setPercent}
      onFocus={() => setDraft(shown)}
      onBlur={() => setDraft(null)}
      min={0}
      max={50}
      step={0.5}
      suffix="%"
      restingValue={20}
      disabled={!hasPrice}
      hint={
        !hasPrice
          ? 'Enter the sale price first'
          : amount != null
            ? `${formatCurrency(amount)} down`
            : 'Drag, pick one, or type the loan amount'
      }
    >
      {hasPrice ? (
        <div className="chips" role="group" aria-label="Set loan from down payment">
          {picks.map((pct) => {
            const active = percent != null && Math.abs(percent - pct) < 0.05
            return (
              <button
                key={pct}
                type="button"
                className={`chip ${active ? 'chip-active' : ''}`}
                aria-pressed={active}
                onClick={() => setPercent(String(pct))}
              >
                {pct}%
              </button>
            )
          })}
        </div>
      ) : null}
    </SliderField>
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

  const price = inputs.propertyValue
  const rent = inputs.rentValue

  /** "$160/mo of rent" for an expense entered as a share of rent. */
  const shareOfRent = (key: DealInputKey) => {
    const rate = inputs[key]
    return rent != null && rate != null ? `${formatCurrency((rent * rate) / 100)}/mo of rent` : 'Share of monthly rent'
  }

  const tax = annualPropertyTax(price, inputs.propertyTax)
  const appreciationBase = isOwner ? price : (inputs.propertyArvValue ?? price)
  const valueIn10 = homeValueAfterYears(appreciationBase, inputs.appreciationRate, 10)
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  const pmi = monthlyPmi(inputs)
  const refiLoan = refinanceLoan(inputs)
  const refiPayment = refinancePayment(inputs)
  const pointValue = mortgagePointValue(inputs.loanValue)

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
                <Field
                  label="ARV / Market Value"
                  prefix="$"
                  grouped
                  info={<InfoTip {...GLOSSARY.arv} />}
                  {...bind('propertyArvValue')}
                />
                <Field label="Rehab Budget" prefix="$" grouped {...bind('rehabCost')} />
                <Field label="Monthly Rent" prefix="$" suffix="/mo" grouped {...bind('rentValue')} />
              </>
            ) : null}
            <Field label="Property Size" suffix="sq ft" grouped {...bind('propertySize')} />
            <SliderField
              label="Annual Appreciation"
              suffix="%"
              min={-2}
              max={8}
              step={0.25}
              placeholder="e.g. 3"
              hint={
                valueIn10 != null
                  ? `${formatCurrencyCompact(valueIn10)} in 10 yrs`
                  : 'Expected yearly change in value'
              }
              {...bind('appreciationRate')}
            />
            <SliderField
              label="Property Tax Rate"
              suffix="%"
              min={0}
              max={2.5}
              step={0.01}
              hint={tax != null ? `${formatCurrency(tax)}/yr on the sale price` : 'Of the sale price, per year'}
              {...bind('propertyTax')}
            />
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
            <DownPaymentField
              inputs={inputs}
              picks={DOWN_PAYMENT_PICKS[deal.type]}
              onLoanChange={(loan) => update('loanValue', loan)}
            />
            <Field label="Loan Amount" prefix="$" grouped {...bind('loanValue')} />
            <Field
              label="Closing Costs"
              prefix="$"
              grouped
              info={<InfoTip {...GLOSSARY.closingCosts} />}
              {...bind('closingCost')}
            />
            <SliderField
              label="Fixed Rate"
              suffix="%"
              {...RATE_RANGE}
              hint={payment != null ? `${formatCurrency(payment)}/mo principal & interest` : 'Annual interest rate'}
              {...bind('loanRate')}
            />
            <TermField label="Loan Term" presets={LOAN_TERM_PRESETS} {...bind('loanTerm')} />
            <Field
              label="Other Monthly Fees"
              prefix="$"
              suffix="/mo"
              grouped
              info={<InfoTip {...GLOSSARY.otherFees} />}
              {...bind('additionalMonthlyFees')}
            />
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
                <SliderField
                  label="PMI Rate"
                  info={<InfoTip {...GLOSSARY.pmi} />}
                  suffix="%"
                  min={0}
                  max={1.5}
                  step={0.05}
                  placeholder={`Auto ${DEFAULT_PMI_RATE_PERCENT}`}
                  restingValue={DEFAULT_PMI_RATE_PERCENT}
                  hint={
                    pmi == null
                      ? 'Of the loan, per year'
                      : pmi === 0
                        ? 'None at 20%+ down'
                        : `${formatCurrency(pmi)}/mo until 22% equity`
                  }
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
              <SliderField
                label="Vacancy"
                info={<InfoTip {...GLOSSARY.vacancy} />}
                suffix="%"
                min={0}
                max={15}
                step={0.5}
                placeholder="e.g. 5"
                hint={shareOfRent('vacancyRate')}
                {...bind('vacancyRate')}
              />
              <SliderField
                label="Management"
                info={<InfoTip {...GLOSSARY.management} />}
                suffix="%"
                min={0}
                max={15}
                step={0.5}
                placeholder="e.g. 8"
                hint={shareOfRent('managementRate')}
                {...bind('managementRate')}
              />
              <SliderField
                label="Repairs & CapEx"
                info={<InfoTip {...GLOSSARY.capex} />}
                suffix="%"
                min={0}
                max={20}
                step={0.5}
                placeholder="e.g. 10"
                hint={shareOfRent('maintenanceRate')}
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
              <SliderField
                label="Loan-to-Value"
                info={<InfoTip {...GLOSSARY.ltv} />}
                suffix="%"
                min={50}
                max={85}
                step={1}
                placeholder="e.g. 75"
                hint={refiLoan != null ? `${formatCurrency(refiLoan)} new loan` : 'Share of ARV'}
                {...bind('refiLtv')}
              />
              <SliderField
                label="Refinance Rate"
                suffix="%"
                {...RATE_RANGE}
                restingValue={inputs.loanRate ?? undefined}
                hint={refiPayment != null ? `${formatCurrency(refiPayment)}/mo principal & interest` : 'Annual interest rate'}
                {...bind('refiRate')}
              />
              <TermField
                label="Refinance Term"
                presets={LOAN_TERM_PRESETS}
                emptyMeans={DEFAULT_REFI_TERM_YEARS}
                {...bind('refiTerm')}
              />
              <Field label="Refi Closing Costs" prefix="$" grouped {...bind('refiClosingCost')} />
            </OptionalGroup>
          </>
        ) : null}

        <OptionalGroup title="Mortgage points (optional)" defaultOpen={anySet(POINTS_KEYS)}>
          <SliderField
            label="Rate with Points"
            suffix="%"
            {...RATE_RANGE}
            restingValue={inputs.loanRate ?? undefined}
            hint="The lower rate the points buy"
            {...bind('loanPointRate')}
          />
          <SliderField
            label="Points Offered"
            info={<InfoTip {...GLOSSARY.points} />}
            suffix="pts"
            min={0}
            max={4}
            step={0.25}
            restingValue={1}
            hint={
              pointValue != null && inputs.pointsOffered != null
                ? `${formatCurrency(pointValue * inputs.pointsOffered)} upfront`
                : 'Each point costs 1% of the loan'
            }
            {...bind('pointsOffered')}
          />
        </OptionalGroup>
      </div>
    </section>
  )
}
