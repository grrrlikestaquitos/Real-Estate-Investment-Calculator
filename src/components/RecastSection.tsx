import type { RecastResult } from '../lib/calculations'
import { formatCurrency, formatCurrencyExact, formatDuration } from '../lib/format'
import { GLOSSARY } from '../lib/glossary'
import type { DealInputs, DealType } from '../lib/types'
import { InfoTip } from './InfoTip'
import { Section } from './Section'

interface RecastSectionProps {
  dealType: DealType
  inputs: DealInputs
  recast: RecastResult | null
}

function emptyMessage(inputs: DealInputs): string {
  if (inputs.loanValue == null || inputs.loanRate == null || inputs.loanTerm == null) {
    return 'Enter the loan amount, rate, and term first.'
  }
  return 'Add a lump sum and when you would pay it under Deal Inputs → Recast later.'
}

/** Recast vs no extra payment vs paying the lump sum but keeping the payment. */
export function RecastSection({ dealType, inputs, recast }: RecastSectionProps) {
  const title = 'Mortgage Recast'
  if (!recast) {
    return (
      <Section title={title} wide>
        <p className="empty-state">{emptyMessage(inputs)}</p>
      </Section>
    )
  }

  const when = formatDuration(recast.monthsIn)
  const paidOffNow = recast.newPayment === 0
  const scenarios = [
    {
      key: 'none',
      name: 'No extra payment',
      payment: recast.originalPayment,
      payoff: recast.termMonths,
      interest: recast.interestNoExtra,
      saved: null,
    },
    {
      key: 'recast',
      name: 'Recast',
      payment: recast.newPayment,
      payoff: paidOffNow ? recast.monthsIn : recast.termMonths,
      interest: recast.interestRecast,
      saved: recast.interestSavedRecast,
    },
    {
      key: 'keep',
      name: 'Pay lump sum, keep payment',
      payment: recast.originalPayment,
      payoff: recast.payoffMonthKeepPayment,
      interest: recast.interestKeepPayment,
      saved: recast.interestSavedKeepPayment,
    },
  ]

  return (
    <Section
      title={title}
      subtitle={`${formatCurrency(recast.lumpSum)} toward principal after ${when}, when ${formatCurrency(recast.balanceAtRecast)} is still owed`}
      wide
      printKeep
    >
      <div className="recast-headline">
        <div className="recast-figure">
          <span className="recast-figure-label">
            New payment
            <InfoTip {...GLOSSARY.recast} />
          </span>
          <span className="recast-figure-value">{formatCurrencyExact(recast.newPayment)}/mo</span>
          <span className="recast-figure-detail">
            {formatCurrency(recast.monthlySavings)}/mo less than {formatCurrencyExact(recast.originalPayment)}
          </span>
        </div>
        <div className="recast-figure">
          <span className="recast-figure-label">Interest saved</span>
          <span className="recast-figure-value positive">{formatCurrency(recast.interestSavedRecast)}</span>
          <span className="recast-figure-detail">
            {recast.fee > 0
              ? `${formatCurrency(recast.netSavingsRecast)} after the ${formatCurrency(recast.fee)} fee`
              : 'Over the rest of the loan'}
          </span>
        </div>
      </div>

      <div className="table-scroll">
        <table className="scenario-table">
          <thead>
            <tr>
              <td />
              {scenarios.map((s) => (
                <th key={s.key} scope="col" className={s.key === 'recast' ? 'scenario-focus' : undefined}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Monthly payment</th>
              {scenarios.map((s) => (
                <td key={s.key} className={s.key === 'recast' ? 'scenario-focus' : undefined}>
                  {formatCurrencyExact(s.payment)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Paid off after</th>
              {scenarios.map((s) => (
                <td key={s.key} className={s.key === 'recast' ? 'scenario-focus' : undefined}>
                  {formatDuration(s.payoff)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Total interest</th>
              {scenarios.map((s) => (
                <td key={s.key} className={s.key === 'recast' ? 'scenario-focus' : undefined}>
                  {formatCurrency(s.interest)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Interest saved</th>
              {scenarios.map((s) => (
                <td
                  key={s.key}
                  className={`${s.key === 'recast' ? 'scenario-focus' : ''} ${s.saved != null ? 'positive' : ''}`}
                >
                  {s.saved == null ? '—' : formatCurrency(s.saved)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {paidOffNow ? (
        <p className="note">This lump sum pays off the loan, so there is nothing left to recast.</p>
      ) : (
        <p className="note">
          A recast keeps your payoff date and lowers the bill
          {dealType === 'investment'
            ? `, adding ${formatCurrency(recast.monthlySavings)}/mo to cash flow`
            : ''}
          . Keeping your current payment instead pays the loan off{' '}
          {formatDuration(recast.monthsSoonerKeepPayment)} sooner and saves{' '}
          {formatCurrency(recast.interestSavedKeepPayment - recast.interestSavedRecast)} more in
          interest, but the bill stays the same.
        </p>
      )}
    </Section>
  )
}
