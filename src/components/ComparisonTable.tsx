import type { Deal, DealType } from '../lib/types'
import { ANALYSIS_HORIZONS } from '../lib/types'
import type { DealResults } from '../lib/calculations'
import { FRONT_RATIO_PASS_PERCENT, computeResults } from '../lib/calculations'
import { formatCurrency, formatPercent } from '../lib/format'

interface ComparisonTableProps {
  /** Every saved deal; the picker lets the user include or leave out each one. */
  deals: Deal[]
  isIncluded: (id: string) => boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

interface Row {
  label: string
  /** Only meaningful for deals in this mode; other deals show "—". */
  mode?: DealType
  get: (results: DealResults, deal: Deal) => number | null
  format: (value: number | null) => string
  /** Which direction wins the row; rows without it are informational. */
  better?: 'higher' | 'lower'
  /** Color losses red and gains green (cash-flow-style values). */
  signed?: boolean
  /** Rule behind a Pass/Fail badge next to the value. */
  passes?: (value: number) => boolean
}

interface Group {
  label: string
  rows: Row[]
}

const TEN_YEARS = ANALYSIS_HORIZONS.indexOf(10)

const GROUPS: Group[] = [
  {
    label: 'Purchase',
    rows: [
      { label: 'Sale Price', get: (_r, d) => d.inputs.propertyValue, format: formatCurrency },
      {
        label: 'ARV / Market Value',
        mode: 'investment',
        get: (_r, d) => d.inputs.propertyArvValue,
        format: formatCurrency,
      },
      { label: 'Price / sq ft', get: (r) => r.preArvPricePerSqFt, format: formatCurrency, better: 'lower' },
      { label: 'Property Tax / yr', get: (r) => r.annualTaxAtSale, format: formatCurrency, better: 'lower' },
    ],
  },
  {
    label: 'Financing',
    rows: [
      { label: 'Cash to Close', get: (r) => r.cashToClose, format: formatCurrency, better: 'lower' },
      { label: 'Down Payment', get: (r) => r.downPaymentPercent, format: formatPercent },
      { label: 'Fixed Rate', get: (_r, d) => d.inputs.loanRate, format: formatPercent, better: 'lower' },
      { label: 'Mortgage / mo', get: (r) => r.monthlyMortgage, format: formatCurrency, better: 'lower' },
      { label: 'Total Interest', get: (r) => r.totalInterest, format: formatCurrency, better: 'lower' },
    ],
  },
  {
    label: 'Rental Returns',
    rows: [
      {
        label: 'Monthly Rent',
        mode: 'investment',
        get: (_r, d) => d.inputs.rentValue,
        format: formatCurrency,
        better: 'higher',
      },
      {
        label: 'Rent / ARV (2% Rule)',
        mode: 'investment',
        get: (r) => r.rentToArvRatioPct,
        format: formatPercent,
        better: 'higher',
        passes: (v) => v >= 2,
      },
      {
        label: 'Cash Flow / mo',
        mode: 'investment',
        get: (r) => r.monthlyCashFlow,
        format: formatCurrency,
        better: 'higher',
        signed: true,
      },
      {
        label: 'Cash Flow / mo (50% Rule)',
        mode: 'investment',
        get: (r) => r.monthlyCashFlowFiftyRule,
        format: formatCurrency,
        better: 'higher',
        signed: true,
      },
      {
        label: 'Yearly ROI (50% Rule)',
        mode: 'investment',
        get: (r) => r.roiFiftyRule,
        format: formatPercent,
        better: 'higher',
        signed: true,
      },
    ],
  },
  {
    label: 'Living There',
    rows: [
      {
        label: 'Monthly Ownership Cost',
        mode: 'owner',
        get: (r) => r.monthlyOwnershipCost,
        format: formatCurrency,
        better: 'lower',
      },
      {
        label: 'Savings vs Renting / mo',
        mode: 'owner',
        get: (r) => r.rentVsBuyMonthly,
        format: formatCurrency,
        better: 'higher',
        signed: true,
      },
      {
        label: `Front Ratio (${FRONT_RATIO_PASS_PERCENT}% Rule)`,
        mode: 'owner',
        get: (r) => r.frontRatioPct,
        format: formatPercent,
        better: 'lower',
        passes: (v) => v <= FRONT_RATIO_PASS_PERCENT,
      },
      {
        label: 'Equity @ 10 yr',
        mode: 'owner',
        get: (r) => r.equityByHorizon[TEN_YEARS],
        format: formatCurrency,
        better: 'higher',
      },
    ],
  },
]

/** Column indexes holding the row's best value (none when fewer than two values or all tie). */
function bestIndexes(values: (number | null)[], better?: 'higher' | 'lower'): Set<number> {
  const numbers = values.filter((v): v is number => v != null)
  if (!better || numbers.length < 2) return new Set()
  const target = better === 'higher' ? Math.max(...numbers) : Math.min(...numbers)
  if (numbers.every((v) => v === target)) return new Set()
  return new Set(values.flatMap((v, i) => (v === target ? [i] : [])))
}

export function ComparisonTable({
  deals: allDeals,
  isIncluded,
  onToggle,
  onSelect,
}: ComparisonTableProps) {
  const deals = allDeals.filter((d) => isIncluded(d.id))
  const results = deals.map((d) => computeResults(d.inputs))

  const groups = GROUPS.map((group) => ({
    label: group.label,
    rows: group.rows
      .map((row) => ({
        row,
        values: deals.map((deal, i) =>
          row.mode && deal.type !== row.mode ? null : row.get(results[i], deal),
        ),
      }))
      .filter(({ values }) => values.some((v) => v != null)),
  })).filter((group) => group.rows.length > 0)

  return (
    <section className="card compare-card">
      <header className="card-header">
        <h2>Deal Comparison</h2>
        <p className="card-subtitle">
          The best value in each row is highlighted. Select a deal name to open it.
        </p>
      </header>
      <div className="compare-picker" role="group" aria-label="Deals to compare">
        <span className="compare-picker-label">Comparing</span>
        {allDeals.map((deal) => {
          const on = isIncluded(deal.id)
          return (
            <button
              key={deal.id}
              type="button"
              className={`chip ${on ? 'chip-active' : ''}`}
              aria-pressed={on}
              onClick={() => onToggle(deal.id)}
            >
              <span className="chip-check" aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              {deal.name}
            </button>
          )
        })}
      </div>
      {deals.length < 2 ? (
        <p className="empty-state">Pick at least two deals to compare.</p>
      ) : groups.length === 0 ? (
        <p className="empty-state">Enter a sale price or loan on your deals to compare them here.</p>
      ) : (
        <div className="table-scroll">
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col" className="sticky-col">
                  Metric
                </th>
                {deals.map((deal) => (
                  <th key={deal.id} scope="col" className="numeric">
                    <button
                      type="button"
                      className="column-header-btn"
                      onClick={() => onSelect(deal.id)}
                    >
                      {deal.name}
                    </button>
                    <span className={`tag tag-${deal.type}`}>
                      {deal.type === 'owner' ? 'Homeowner' : 'Investor'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.label}>
                <tr className="group-row">
                  <th scope="colgroup" colSpan={deals.length + 1} className="sticky-col">
                    {group.label}
                  </th>
                </tr>
                {group.rows.map(({ row, values }) => {
                  const best = bestIndexes(values, row.better)
                  return (
                    <tr key={row.label}>
                      <th scope="row" className="sticky-col">
                        {row.label}
                      </th>
                      {values.map((value, i) => {
                        const tone =
                          row.signed && value != null ? (value < 0 ? 'negative' : 'positive') : ''
                        const pass = value != null && row.passes ? row.passes(value) : null
                        return (
                          <td
                            key={deals[i].id}
                            className={`numeric ${tone} ${best.has(i) ? 'cell-best' : ''} ${
                              value == null ? 'cell-empty' : ''
                            }`}
                          >
                            {row.format(value)}
                            {pass != null ? (
                              <span className={`badge ${pass ? 'badge-pass' : 'badge-fail'}`}>
                                {pass ? 'Pass' : 'Fail'}
                              </span>
                            ) : null}
                            {best.has(i) ? <span className="sr-only"> (best)</span> : null}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  )
}
