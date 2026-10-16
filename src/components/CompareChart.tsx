import { useState } from 'react'
import { equityOverTime, yearlyProjection } from '../lib/calculations'
import { formatCurrency } from '../lib/format'
import { ANALYSIS_HORIZONS, type Deal } from '../lib/types'
import { LineChart, type ChartSeries } from './LineChart'
import { SegmentedControl } from './SegmentedControl'
import { YearGrid } from './YearGrid'

type Metric = 'equity' | 'cashFlow'

/** Validated categorical colors; deals past this aren't charted. */
const MAX_SERIES = 8
const LAST_YEAR = ANALYSIS_HORIZONS[ANALYSIS_HORIZONS.length - 1]
const YEARS = Array.from({ length: LAST_YEAR + 1 }, (_, year) => year)

const METRICS: Record<Metric, { title: string; subtitle: string; empty: string }> = {
  equity: {
    title: 'Equity over the next 30 years',
    subtitle: 'Value at each deal’s appreciation rate (from ARV for rentals) minus the loan balance',
    empty: 'Enter a loan and an annual appreciation rate on the deals to compare equity.',
  },
  cashFlow: {
    title: 'Cumulative cash flow over the next 30 years',
    subtitle: 'Rentals only: cash flow after mortgage and fees, before operating expenses, rent held flat',
    empty: 'Enter rent, loan amount, and rate on your rentals to compare cash flow.',
  },
}

interface CompareChartProps {
  deals: Deal[]
  isIncluded: (id: string) => boolean
}

/** The compared deals on one chart, so their paths over time can be read side by side. */
export function CompareChart({ deals, isIncluded }: CompareChartProps) {
  const [metric, setMetric] = useState<Metric>('equity')

  // A deal's color follows its place among all deals, so leaving one out never repaints the rest.
  const compared = deals.map((deal, i) => ({ deal, slot: i + 1 })).filter(({ deal }) => isIncluded(deal.id))
  if (compared.length < 2) return null

  const charted = compared.filter(({ slot }) => slot <= MAX_SERIES)
  const notCharted = compared.filter(({ slot }) => slot > MAX_SERIES).map(({ deal }) => deal.name)
  const inMetric =
    metric === 'cashFlow' ? charted.filter(({ deal }) => deal.type === 'investment') : charted
  const series: ChartSeries[] = inMetric.map(({ deal, slot }) => ({
    label: deal.name,
    slot,
    values:
      metric === 'equity'
        ? equityOverTime(deal.inputs, deal.type, LAST_YEAR)
        : yearlyProjection(deal.inputs, LAST_YEAR).map((point) => point.cashFlow),
  }))
  const { title, subtitle, empty } = METRICS[metric]

  return (
    <section className="card compare-chart-card">
      <header className="card-header card-header-row compare-chart-header">
        <div>
          <h2>Over Time</h2>
          <p className="card-subtitle">{subtitle}</p>
        </div>
        <SegmentedControl
          label="Chart"
          value={metric}
          options={[
            { value: 'equity', label: 'Equity' },
            { value: 'cashFlow', label: 'Cash flow' },
          ]}
          onChange={setMetric}
        />
      </header>
      <LineChart
        title={title}
        years={YEARS}
        series={series}
        emptyMessage={
          metric === 'cashFlow' && inMetric.length === 0
            ? 'None of the deals being compared are rentals.'
            : empty
        }
      />
      {series.length > 0 ? (
        <details className="table-toggle">
          <summary>View as table</summary>
          <YearGrid
            years={ANALYSIS_HORIZONS}
            format={formatCurrency}
            columns={series.map((s) => ({
              label: s.label,
              values: ANALYSIS_HORIZONS.map((year) => s.values[year] ?? null),
            }))}
          />
        </details>
      ) : null}
      {notCharted.length > 0 ? (
        <p className="note">
          The chart shows the first {MAX_SERIES} deals; {notCharted.join(', ')}{' '}
          {notCharted.length === 1 ? 'is' : 'are'} in the table only.
        </p>
      ) : null}
    </section>
  )
}
