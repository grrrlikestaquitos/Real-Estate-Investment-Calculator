import { useState } from 'react'
import {
  TAX_RATE_COVERAGE_NOTE,
  TAX_RATE_DISCLAIMER,
  TAX_RATE_ENTRIES,
  TAX_RATE_SOURCES,
  formatRateDisplay,
  perThousandToPercent,
  type TaxRateEntry,
} from '../lib/taxRates'

interface TaxRateReferenceProps {
  onUseRate: (percent: number) => void
}

function entryKey(entry: TaxRateEntry): string {
  return `${entry.county}/${entry.city}`
}

export function TaxRateReference({ onUseRate }: TaxRateReferenceProps) {
  const [appliedKey, setAppliedKey] = useState<string | null>(null)

  function handleUse(entry: TaxRateEntry) {
    onUseRate(perThousandToPercent(entry.useRatePer1000))
    setAppliedKey(entryKey(entry))
  }

  return (
    <details className="tax-rate-details">
      <summary>Greater Seattle property tax rates (2026)</summary>
      <div className="table-scroll">
        <table className="tax-rate-table">
          <thead>
            <tr>
              <th scope="col">City</th>
              <th scope="col">County</th>
              <th scope="col" className="numeric">
                Rate / yr
              </th>
              <th scope="col" className="numeric">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {TAX_RATE_ENTRIES.map((entry) => {
              const key = entryKey(entry)
              const applied = appliedKey === key
              return (
                <tr key={key} className={applied ? 'tax-rate-row-applied' : undefined}>
                  <td>{entry.city}</td>
                  <td>{entry.county}</td>
                  <td className="numeric">{formatRateDisplay(entry)}</td>
                  <td className="numeric">
                    <button
                      type="button"
                      className={`btn btn-small ${applied ? 'btn-small-applied' : ''}`}
                      onClick={() => handleUse(entry)}
                    >
                      {applied ? 'Applied ✓' : 'Use'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="note">{TAX_RATE_DISCLAIMER}</p>
      <p className="note">{TAX_RATE_COVERAGE_NOTE}</p>
      <p className="note">
        {TAX_RATE_SOURCES.king.label} ·{' '}
        <a href={TAX_RATE_SOURCES.king.url}>{TAX_RATE_SOURCES.king.url}</a>
      </p>
      <p className="note">
        {TAX_RATE_SOURCES.snohomish.label} ·{' '}
        <a href={TAX_RATE_SOURCES.snohomish.url}>{TAX_RATE_SOURCES.snohomish.url}</a>
      </p>
    </details>
  )
}
