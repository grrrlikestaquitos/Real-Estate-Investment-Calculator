import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import pkg from '../package.json'
import { useCompareSelection } from './hooks/useCompareSelection'
import { useDeals } from './hooks/useDeals'
import { useTheme } from './hooks/useTheme'
import { useToast } from './hooks/useToast'
import { computeResults, yearlyProjection } from './lib/calculations'
import {
  formatCurrency,
  formatCurrencyExact,
  formatCurrencyRange,
  formatPercent,
} from './lib/format'
import { copyText } from './lib/clipboard'
import { exportDealsJson, parseImportedDeals } from './lib/storage'
import { ANALYSIS_HORIZONS } from './lib/types'
import { ComparisonTable } from './components/ComparisonTable'
import { DealForm } from './components/DealForm'
import { DealHeader } from './components/DealHeader'
import { DealIndicators } from './components/DealIndicators'
import { DealTabs } from './components/DealTabs'
import { KeyMetrics } from './components/KeyMetrics'
import { LineChart } from './components/LineChart'
import { Section } from './components/Section'
import { StatRow } from './components/StatRow'
import { Toast } from './components/Toast'
import { YearGrid } from './components/YearGrid'

type View = 'deal' | 'compare'

function downloadFile(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const deals = useDeals()
  const { activeDeal } = deals
  const isInvestor = activeDeal.type === 'investment'
  const results = useMemo(() => computeResults(activeDeal.inputs), [activeDeal.inputs])
  const projection = useMemo(() => yearlyProjection(activeDeal.inputs), [activeDeal.inputs])
  const projectionYears = projection.map((p) => p.year)
  const { toast, show: showToast, dismiss: dismissToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const compareSelection = useCompareSelection()
  const [view, setView] = useState<View>('deal')
  // Bumped when inputs change from outside the form (clear, undo, import) so it re-syncs.
  const [formRevision, setFormRevision] = useState(0)
  const [newDealId, setNewDealId] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const comparing = view === 'compare' && deals.deals.length >= 2

  function openDeal(id: string) {
    setNewDealId(null)
    deals.setActiveId(id)
    setView('deal')
  }

  function handleCreate() {
    const id = deals.createDeal()
    setNewDealId(id)
    setView('deal')
  }

  async function handleShare() {
    const ok = await copyText(deals.shareUrl(activeDeal))
    if (ok) showToast('Link copied: anyone with it can open this deal.')
    else showToast('Could not copy the link.', { tone: 'error' })
  }

  function handleDuplicate() {
    deals.duplicateDeal(activeDeal.id)
    showToast(`Duplicated "${activeDeal.name}". Tweak the copy to compare scenarios.`)
  }

  function handleDelete() {
    const deal = activeDeal
    const index = deals.deals.findIndex((d) => d.id === deal.id)
    deals.deleteDeal(deal.id)
    showToast(`Deleted "${deal.name}"`, {
      action: { label: 'Undo', run: () => deals.restoreDeal(deal, index) },
    })
  }

  function handleClear() {
    const { id, inputs } = activeDeal
    deals.resetInputs(id)
    setFormRevision((r) => r + 1)
    showToast('Inputs cleared', {
      action: {
        label: 'Undo',
        run: () => {
          deals.setInputs(id, inputs)
          setFormRevision((r) => r + 1)
        },
      },
    })
  }

  function handleExport() {
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(
      `real-estate-deals-${date}.json`,
      exportDealsJson(deals.deals),
      'application/json',
    )
    showToast(`Exported ${deals.deals.length} deal${deals.deals.length === 1 ? '' : 's'}`)
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const imported = parseImportedDeals(await file.text())
    if (!imported) {
      showToast("That file doesn't contain any deals.", { tone: 'error' })
      return
    }
    deals.importDeals(imported)
    setFormRevision((r) => r + 1)
    setView('deal')
    showToast(`Imported ${imported.length} deal${imported.length === 1 ? '' : 's'}`)
  }

  const cashFlowTone = (value: number | null) =>
    value == null ? undefined : value < 0 ? 'negative' : 'positive'

  const marketAnalysis = (
    <div className="stats">
      <StatRow
        label="Rent / ARV Ratio (2% Rule)"
        value={formatPercent(results.rentToArvRatioPct)}
      />
      <StatRow
        label="ARV − Sale Price"
        value={formatCurrency(results.arvDifferenceMoney)}
        tone={cashFlowTone(results.arvDifferenceMoney)}
      />
      <StatRow
        label="ARV − Sale Price (%)"
        value={formatPercent(results.arvDifferencePercent)}
        tone={cashFlowTone(results.arvDifferencePercent)}
      />
      <StatRow
        label="Price / sq ft (Sale)"
        value={formatCurrencyExact(results.preArvPricePerSqFt)}
      />
      <StatRow
        label="Price / sq ft (ARV)"
        value={formatCurrencyExact(results.arvPricePerSqFt)}
      />
      <StatRow
        label="Annual Property Tax (Sale Price)"
        value={formatCurrency(results.annualTaxAtSale)}
      />
      <StatRow
        label="Annual Property Tax (ARV)"
        value={formatCurrency(results.annualTaxAtArv)}
      />
      <StatRow
        label="Optimal Rent Range (1–2% of ARV)"
        value={formatCurrencyRange(results.optimalRentRange)}
      />
    </div>
  )

  const mortgagePoints = (
    <div className="stats">
      <StatRow label="Cost per Point (1% of Loan)" value={formatCurrency(results.pointValue)} />
      <StatRow label="Points Cost" value={formatCurrency(results.pointsCost)} />
      <StatRow
        label="Monthly Payment with Points"
        value={formatCurrencyExact(results.monthlyWithPoints)}
      />
      <StatRow
        label="Total with Points (Principal & Interest)"
        value={formatCurrency(results.totalPaymentsWithPoints)}
      />
      <StatRow
        label="Savings with Points (Over Term)"
        value={formatCurrency(results.savingsWithPoints)}
      />
      <StatRow
        label="Points Break-Even"
        value={
          results.pointsBreakEven
            ? `${formatCurrencyExact(results.pointsBreakEven.savingsPerMonth)}/mo saved · break even in ${results.pointsBreakEven.yearsToBreakEven.toFixed(1)} years`
            : '—'
        }
      />
    </div>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ⌂
          </span>
          <div>
            <h1>Real Estate Investment Calculator</h1>
            <p className="brand-tagline">BRRR rentals and homes to buy, side by side</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span
            className={`save-status ${deals.storageOk ? '' : 'save-status-error'}`}
            title={
              deals.storageOk
                ? 'Deals are saved in this browser automatically'
                : 'This browser is blocking storage. Export a backup to keep your deals.'
            }
          >
            {deals.storageOk ? 'Saved in this browser' : 'Not saved (storage blocked)'}
          </span>
          <button type="button" className="btn btn-small btn-ghost" onClick={handleExport}>
            Export
          </button>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => importRef.current?.click()}
          >
            Import
          </button>
          <button
            type="button"
            className="btn btn-small btn-ghost icon-btn"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />
              </svg>
            )}
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import deals from a backup file"
            onChange={(e) => void handleImport(e)}
          />
        </div>
      </header>

      <DealTabs
        deals={deals.deals}
        activeId={deals.activeId}
        comparing={comparing}
        onSelect={openDeal}
        onCreate={handleCreate}
        onCompare={() => setView('compare')}
      />

      <main className="app-main">
        {comparing ? (
          <ComparisonTable
            deals={deals.deals}
            isIncluded={compareSelection.isIncluded}
            onToggle={compareSelection.toggle}
            onSelect={openDeal}
          />
        ) : (
          <>
            <DealHeader
              key={activeDeal.id}
              deal={activeDeal}
              canDelete={deals.deals.length > 1}
              autoFocusName={newDealId === activeDeal.id}
              onRename={(name) => deals.renameDeal(activeDeal.id, name)}
              onTypeChange={(type) => deals.setDealType(activeDeal.id, type)}
              onDuplicate={handleDuplicate}
              onShare={() => void handleShare()}
              onDelete={handleDelete}
            />

            <div className="layout">
              <div className="layout-side">
                <DealForm
                  key={`${activeDeal.id}:${formRevision}`}
                  deal={activeDeal}
                  onCommit={(inputs) => deals.setInputs(activeDeal.id, inputs)}
                  onReset={handleClear}
                />
              </div>

              <div className="layout-results">
                <DealIndicators dealType={activeDeal.type} results={results} />
                <KeyMetrics dealType={activeDeal.type} inputs={activeDeal.inputs} results={results} />

                <div className="results-grid">
                  {isInvestor ? (
                    <Section title="Market Analysis">{marketAnalysis}</Section>
                  ) : (
                    <div className="results-stack">
                      <Section
                        title="Cost of Ownership"
                        subtitle="Mortgage, property tax, fees, and ~1% of the price per year for maintenance"
                      >
                        <div className="stats">
                          <StatRow
                            label="Monthly Ownership Cost"
                            value={formatCurrencyExact(results.monthlyOwnershipCost)}
                          />
                          <StatRow
                            label="Monthly Property Tax"
                            value={formatCurrencyExact(results.monthlyTax)}
                          />
                          <StatRow
                            label="Annual Property Tax"
                            value={formatCurrency(results.annualTaxAtSale)}
                          />
                          <StatRow
                            label="Price / sq ft"
                            value={formatCurrencyExact(results.preArvPricePerSqFt)}
                          />
                          <StatRow
                            label="Total Cost Over Term"
                            value={formatCurrency(results.costOfOwnership)}
                          />
                        </div>
                      </Section>

                      <Section
                        title="Rent vs Buy"
                        subtitle="Owning vs the rent you would otherwise pay (rent held flat)"
                      >
                        <div className="stats">
                          <StatRow
                            label="Monthly Savings vs Renting"
                            value={formatCurrencyExact(results.rentVsBuyMonthly)}
                            tone={cashFlowTone(results.rentVsBuyMonthly)}
                          />
                          <StatRow
                            label="Front Ratio (PITI / Income)"
                            value={formatPercent(results.frontRatioPct)}
                          />
                        </div>
                        <p className="note">
                          Compares cash costs only. Appreciation and equity growth (below) are
                          extra upside not counted against rent.
                        </p>
                      </Section>
                    </div>
                  )}

                  <Section
                    title="Mortgage"
                    subtitle="Closing cost percentages are against the loan amount"
                  >
                    <div className="stats">
                      <StatRow label="Down Payment" value={formatCurrency(results.downPayment)} />
                      <StatRow
                        label="Down Payment (% of Price)"
                        value={formatPercent(results.downPaymentPercent)}
                      />
                      <StatRow label="Cash to Close" value={formatCurrency(results.cashToClose)} />
                      <StatRow
                        label="Monthly Mortgage Payment"
                        value={formatCurrencyExact(results.monthlyMortgage)}
                      />
                      <StatRow
                        label="Monthly Payment + Fees"
                        value={formatCurrencyExact(results.monthlyMortgageWithFees)}
                      />
                      <StatRow
                        label="Total Over Term (Principal & Interest)"
                        value={formatCurrency(results.totalLoanPayments)}
                      />
                      <StatRow label="Total Interest Paid" value={formatCurrency(results.totalInterest)} />
                      <StatRow
                        label="Closing Costs (% of Loan)"
                        value={formatPercent(results.closingCostPercent)}
                      />
                      <StatRow
                        label="Estimated Closing Range (2–5%)"
                        value={formatCurrencyRange(results.estimatedClosingRange)}
                      />
                    </div>
                  </Section>

                  {isInvestor ? (
                    <>
                      <Section title="Cash Flow" wide>
                        <div className="stats stats-2col">
                          <StatRow
                            label="Monthly Cash Flow (No Overhead)"
                            value={formatCurrencyExact(results.monthlyCashFlow)}
                            tone={cashFlowTone(results.monthlyCashFlow)}
                          />
                          <StatRow
                            label="Yearly ROI (No Overhead)"
                            value={formatPercent(results.roiNoOverhead)}
                            tone={cashFlowTone(results.roiNoOverhead)}
                          />
                          <StatRow
                            label="Monthly Cash Flow (50% Rule)"
                            value={formatCurrencyExact(results.monthlyCashFlowFiftyRule)}
                            tone={cashFlowTone(results.monthlyCashFlowFiftyRule)}
                          />
                          <StatRow
                            label="Yearly ROI (50% Rule)"
                            value={formatPercent(results.roiFiftyRule)}
                            tone={cashFlowTone(results.roiFiftyRule)}
                          />
                          <StatRow
                            label="Monthly Cash Flow (25% Rule)"
                            value={formatCurrencyExact(results.monthlyCashFlowTwentyFiveRule)}
                            tone={cashFlowTone(results.monthlyCashFlowTwentyFiveRule)}
                          />
                          <StatRow
                            label="Yearly ROI (25% Rule)"
                            value={formatPercent(results.roiTwentyFiveRule)}
                            tone={cashFlowTone(results.roiTwentyFiveRule)}
                          />
                        </div>
                        <p className="note">
                          The 50% and 25% rules assume operating expenses equal 50% and 25% of gross
                          rent; the mortgage payment and other monthly fees are always deducted. ROI
                          is yearly cash flow over cash to close.
                        </p>
                      </Section>

                      <Section
                        title="Cash Flow Over Time"
                        subtitle="Cumulative cash flow after mortgage and fees, before operating expenses"
                        wide
                      >
                        <LineChart
                          title="Cumulative cash flow over the next 30 years"
                          years={projectionYears}
                          series={[
                            { label: 'Rent held flat', values: projection.map((p) => p.cashFlow) },
                            {
                              label: 'Rent grows with appreciation',
                              values: projection.map((p) => p.cashFlowWithAppreciation),
                            },
                          ]}
                          emptyMessage="Enter rent, loan amount, and rate to project cash flow. Add an appreciation rate to see rent growth."
                        />
                        <details className="table-toggle">
                          <summary>View as table</summary>
                          <YearGrid
                            years={ANALYSIS_HORIZONS}
                            format={formatCurrency}
                            columns={[
                              {
                                label: 'Rent Held Flat',
                                values: results.cashFlowNoAppreciationByHorizon,
                              },
                              {
                                label: 'Rent Grows Yearly',
                                values: results.cashFlowWithAppreciationByHorizon,
                              },
                            ]}
                          />
                        </details>
                      </Section>
                    </>
                  ) : (
                    <Section
                      title="Home Value & Equity Over Time"
                      subtitle="Projected from your purchase price at your annual appreciation rate; equity is value minus the remaining loan"
                      wide
                    >
                      <LineChart
                        title="Home value and equity over the next 30 years"
                        years={projectionYears}
                        series={[
                          { label: 'Home value', values: projection.map((p) => p.homeValue) },
                          { label: 'Equity', values: projection.map((p) => p.equity) },
                        ]}
                        emptyMessage="Enter the sale price, loan, rate, and annual appreciation to see your equity grow."
                      />
                      <details className="table-toggle">
                        <summary>View as table</summary>
                        <YearGrid
                          years={ANALYSIS_HORIZONS}
                          format={formatCurrency}
                          columns={[
                            { label: 'Projected Value', values: results.ownerHomeValueByHorizon },
                            { label: 'Equity', values: results.equityByHorizon },
                            { label: 'Saved vs Renting', values: results.rentVsBuyByHorizon },
                          ]}
                        />
                      </details>
                    </Section>
                  )}
                </div>

                <details className="card advanced-details">
                  <summary>
                    <span className="advanced-title">Advanced Analysis</span>
                    <span className="advanced-hint">
                      {isInvestor
                        ? 'Home value projection, tenant screening, mortgage points'
                        : 'Mortgage points'}
                    </span>
                  </summary>
                  {isInvestor ? (
                    <>
                      <Section
                        plain
                        title="Home Value Over Time"
                        subtitle="Projected from ARV at your annual appreciation rate"
                      >
                        <YearGrid
                          years={ANALYSIS_HORIZONS}
                          format={formatCurrency}
                          columns={[
                            { label: 'Projected Value', values: results.homeValueByHorizon },
                            { label: 'Appreciation Gain', values: results.homeGainByHorizon },
                          ]}
                        />
                      </Section>

                      <Section plain title="Rent & Tenant Screening">
                        <div className="stats">
                          {results.grossRent.map((g) => (
                            <StatRow
                              key={g.months}
                              label={`Gross Rent (${g.months} Months)`}
                              value={formatCurrency(g.amount)}
                            />
                          ))}
                          <StatRow
                            label="Tenant Income (Rent = 25% of Income)"
                            value={formatCurrency(results.tenantIncome?.at25Percent ?? null)}
                          />
                          <StatRow
                            label="Tenant Income (Rent = 30% of Income)"
                            value={formatCurrency(results.tenantIncome?.at30Percent ?? null)}
                          />
                        </div>
                      </Section>

                      <Section plain title="Mortgage Points">
                        {mortgagePoints}
                      </Section>
                    </>
                  ) : (
                    <Section plain title="Mortgage Points">
                      {mortgagePoints}
                    </Section>
                  )}
                </details>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Developed &amp; maintained by Andrei Villasana · v{pkg.version}
        </p>
      </footer>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
