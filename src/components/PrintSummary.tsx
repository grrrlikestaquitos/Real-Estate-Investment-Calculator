import { useEffect, useState } from 'react'
import { downPaymentPercent } from '../lib/calculations'
import { formatCurrency, formatNumber, formatPercent } from '../lib/format'
import type { Deal, DealInputKey, DealType } from '../lib/types'

interface InputLine {
  key: DealInputKey
  label: string
  format: (value: number) => string
  /** Only shown for deals of this type. */
  mode?: DealType
}

const perMonth = (v: number) => `${formatCurrency(v)}/mo`
const perYear = (v: number) => `${formatCurrency(v)}/yr`
const percent = (v: number) => formatPercent(v)
const years = (v: number) => `${formatNumber(v)} yrs`

/** Every input a printout lists, in form order. */
const INPUT_LINES: InputLine[] = [
  { key: 'propertyValue', label: 'Sale price', format: formatCurrency },
  { key: 'propertyArvValue', label: 'ARV', format: formatCurrency, mode: 'investment' },
  { key: 'rehabCost', label: 'Rehab budget', format: formatCurrency, mode: 'investment' },
  { key: 'rentValue', label: 'Monthly rent', format: perMonth, mode: 'investment' },
  { key: 'propertySize', label: 'Size', format: (v) => `${formatNumber(v)} sq ft` },
  { key: 'appreciationRate', label: 'Appreciation', format: (v) => `${formatPercent(v)}/yr` },
  { key: 'propertyTax', label: 'Property tax', format: (v) => `${formatPercent(v)}/yr` },
  { key: 'rentYouPay', label: "Rent you'd pay", format: perMonth, mode: 'owner' },
  { key: 'householdIncome', label: 'Household income', format: perMonth, mode: 'owner' },
  { key: 'loanValue', label: 'Loan', format: formatCurrency },
  { key: 'loanRate', label: 'Rate', format: percent },
  { key: 'loanTerm', label: 'Term', format: years },
  { key: 'closingCost', label: 'Closing costs', format: formatCurrency },
  { key: 'additionalMonthlyFees', label: 'Other fees', format: perMonth },
  { key: 'insuranceAnnual', label: 'Insurance', format: perYear },
  { key: 'pmiRate', label: 'PMI', format: (v) => `${formatPercent(v)}/yr`, mode: 'owner' },
  { key: 'vacancyRate', label: 'Vacancy', format: percent, mode: 'investment' },
  { key: 'managementRate', label: 'Management', format: percent, mode: 'investment' },
  { key: 'maintenanceRate', label: 'Repairs & CapEx', format: percent, mode: 'investment' },
  { key: 'refiLtv', label: 'Refi LTV', format: percent, mode: 'investment' },
  { key: 'refiRate', label: 'Refi rate', format: percent, mode: 'investment' },
  { key: 'refiTerm', label: 'Refi term', format: years, mode: 'investment' },
  { key: 'refiClosingCost', label: 'Refi closing', format: formatCurrency, mode: 'investment' },
  { key: 'recastLumpSum', label: 'Recast lump sum', format: formatCurrency },
  { key: 'recastYears', label: 'Recast after', format: years },
  { key: 'recastFee', label: 'Recast fee', format: formatCurrency },
  { key: 'loanPointRate', label: 'Rate with points', format: percent },
  { key: 'pointsOffered', label: 'Points', format: formatNumber },
]

const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })
const today = () => longDate.format(new Date())

/** Today's date, refreshed when printing starts (a tab can stay open for days). */
function usePrintDate(): string {
  const [date, setDate] = useState(today)
  useEffect(() => {
    const refresh = () => setDate(today())
    window.addEventListener('beforeprint', refresh)
    return () => window.removeEventListener('beforeprint', refresh)
  }, [])
  return date
}

/** Shown only on paper: what the deal is and every number that went into it (the form doesn't print). */
export function PrintSummary({ deal }: { deal: Deal }) {
  const printedOn = usePrintDate()
  const { inputs } = deal
  const percentDown = downPaymentPercent(inputs)
  const lines = INPUT_LINES.filter(
    (line) => inputs[line.key] != null && (!line.mode || line.mode === deal.type),
  )

  return (
    <section className="print-only print-summary">
      <header className="print-summary-header">
        <h1>{deal.name}</h1>
        <p>
          {deal.type === 'investment' ? 'Rental investment' : 'Home purchase'} · Real Estate
          Investment Calculator · {printedOn}
        </p>
      </header>
      {lines.length > 0 ? (
        <dl className="print-inputs">
          {lines.map((line) => (
            <div key={line.key}>
              <dt>{line.label}</dt>
              <dd>
                {line.format(inputs[line.key] as number)}
                {line.key === 'loanValue' && percentDown != null
                  ? ` (${formatNumber(Number(percentDown.toFixed(1)))}% down)`
                  : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}
