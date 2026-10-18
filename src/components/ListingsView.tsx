import { useRef, useState, type ChangeEvent } from 'react'
import { formatCurrency, formatNumber, formatPercent } from '../lib/format'
import { PROPERTY_TYPE_LABELS, type PropertyType } from '../lib/mls'
import {
  LARGE_LOT_SQFT,
  RENT_TAPER_SQFT,
  SORT_LABELS,
  type ListingAnalysis,
  type SortKey,
} from '../lib/screening'
import { useListings, type FilterStrings } from '../hooks/useListings'
import { Field } from './Field'
import { ListingCard } from './ListingCard'
import { Section } from './Section'

interface ListingsViewProps {
  onNewDeal: (analysis: ListingAnalysis) => void
  notify: (text: string, tone?: 'error') => void
}

const PAGE_SIZE = 30

type ToggleFilter = {
  [K in keyof FilterStrings]: FilterStrings[K] extends boolean ? K : never
}[keyof FilterStrings]
const TYPES: PropertyType[] = ['house', 'townhouse', 'condo', 'manufactured']

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * The listings screen: NWMLS exports (bundled from Data/ or imported as CSV)
 * analyzed as rentals and ranked by a screening score, with filters, the
 * assumptions behind the numbers, and a shortlist.
 */
export function ListingsView({ onNewDeal, notify }: ListingsViewProps) {
  const api = useListings()
  const fileRef = useRef<HTMLInputElement>(null)
  const { filters, results, assumptionStrings: a } = api
  // A new filter or sort starts back at the first page.
  const pageKey = JSON.stringify([filters, api.sort])
  const [paging, setPaging] = useState({ key: pageKey, shown: PAGE_SIZE })
  const shown = paging.key === pageKey ? paging.shown : PAGE_SIZE

  function checkbox(key: ToggleFilter, label: string) {
    return (
      <label className="listings-check">
        <input
          type="checkbox"
          checked={filters[key]}
          onChange={(e) => api.updateFilters({ [key]: e.target.checked })}
        />
        {label}
      </label>
    )
  }

  function toggleType(type: PropertyType) {
    const types = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type]
    api.updateFilters({ types })
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    for (const file of files) {
      const count = await api.importFile(file)
      if (count == null) notify(`${file.name} isn't an NWMLS CSV export.`, 'error')
      else notify(`Imported ${count} listings from ${file.name}`)
    }
  }

  const medianPrice = median(results.map((r) => r.listing.price))
  const medianPpsf = median(results.flatMap((r) => (r.pricePerSqft != null ? [r.pricePerSqft] : [])))
  const bestCap = results.reduce<number | null>(
    (best, r) => (r.capRate != null && (best == null || r.capRate > best) ? r.capRate : best),
    null,
  )
  const positiveCashFlow = results.filter((r) => (r.cashFlow ?? -1) >= 0).length

  return (
    <div className="layout">
      <div className="layout-side listings-side">
        <Section title="Listings data" subtitle="NWMLS CSV exports — overlapping files are merged">
          {api.loading ? <p className="note">Loading listings…</p> : null}
          {api.loadError ? (
            <p className="note note-error">Couldn't load the bundled listings.</p>
          ) : null}
          {!api.loading && api.datasets.length === 0 ? (
            <p className="note">
              No data yet. Put NWMLS CSV exports in the <code>Data/</code> folder and rebuild, or
              import one below.
            </p>
          ) : null}
          <ul className="listings-datasets">
            {api.datasets.map((d) => (
              <li key={d.id}>
                <label className="listings-check">
                  <input
                    type="checkbox"
                    checked={api.isEnabled(d.id)}
                    onChange={() => api.toggleDataset(d.id)}
                  />
                  <span className="listings-dataset-name">{d.name}</span>
                  <span className="listings-dataset-count">{d.listings.length}</span>
                </label>
                {api.isImported(d.id) ? (
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    aria-label={`Remove ${d.name}`}
                    onClick={() => api.removeImported(d.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
            Import CSV…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Import NWMLS CSV exports"
            onChange={(e) => void handleImport(e)}
          />
        </Section>

        <Section title="Filters">
          <div className="field-grid">
            <Field
              id="listings-min"
              label="Min price"
              prefix="$"
              grouped
              value={filters.minPrice}
              onChange={(v) => api.updateFilters({ minPrice: v })}
              placeholder="Any"
            />
            <Field
              id="listings-max"
              label="Max price"
              prefix="$"
              grouped
              value={filters.maxPrice}
              onChange={(v) => api.updateFilters({ maxPrice: v })}
              placeholder="Any"
            />
            <Field
              id="listings-min-sqft"
              label="Min size"
              suffix="sqft"
              grouped
              value={filters.minSqft}
              onChange={(v) => api.updateFilters({ minSqft: v })}
              placeholder="Any"
            />
            <Field
              id="listings-min-beds"
              label="Min beds"
              value={filters.minBeds}
              onChange={(v) => api.updateFilters({ minBeds: v })}
              placeholder="Any"
            />
            <Field
              id="listings-max-hoa"
              label="Max HOA"
              prefix="$"
              suffix="/mo"
              value={filters.maxHoa}
              onChange={(v) => api.updateFilters({ maxHoa: v })}
              placeholder="Any"
            />
            <div className="field">
              <div className="field-label-row">
                <label htmlFor="listings-city">City</label>
              </div>
              <select
                id="listings-city"
                className="listings-select"
                value={filters.city}
                onChange={(e) => api.updateFilters({ city: e.target.value })}
              >
                <option value="">All cities</option>
                {api.cities.map(([city, count]) => (
                  <option key={city} value={city}>
                    {city} ({count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="listings-filter-group" role="group" aria-label="Property type">
            <span className="listings-filter-label">Type</span>
            <div className="chips">
              {TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`chip ${filters.types.includes(type) ? 'chip-active' : ''}`}
                  aria-pressed={filters.types.includes(type)}
                  onClick={() => toggleType(type)}
                >
                  {PROPERTY_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="listings-checks">
            {checkbox('priceCutOnly', 'Price reduced')}
            {checkbox('valueAddOnly', 'Value-add signals (ADU, in-law, fixer…)')}
            {checkbox('hideRestricted', 'Hide 55+, cash-only and auctions')}
            {checkbox('shortlistOnly', `Shortlist only (${api.shortlistCount})`)}
          </div>
          <button type="button" className="btn btn-small btn-ghost" onClick={api.resetFilters}>
            Reset filters
          </button>
        </Section>

        <Section
          title="Rental assumptions"
          subtitle="Used for every listing's rent, cash flow and cap rate"
        >
          <div className="field-grid">
            <Field
              id="assume-down"
              label="Down payment"
              suffix="%"
              value={a.downPct}
              onChange={(v) => api.updateAssumptions({ downPct: v })}
            />
            <Field
              id="assume-rate"
              label="Interest rate"
              suffix="%"
              value={a.rate}
              onChange={(v) => api.updateAssumptions({ rate: v })}
            />
            <Field
              id="assume-rent"
              label="Rent per sqft"
              prefix="$"
              suffix="/mo"
              value={a.rentPerSqft}
              onChange={(v) => api.updateAssumptions({ rentPerSqft: v })}
              hint={`Half rate past ${formatNumber(RENT_TAPER_SQFT)} sqft`}
            />
            <Field
              id="assume-vacancy"
              label="Vacancy"
              suffix="% rent"
              value={a.vacancyPct}
              onChange={(v) => api.updateAssumptions({ vacancyPct: v })}
            />
            <Field
              id="assume-repairs"
              label="Repairs & CapEx"
              suffix="% rent"
              value={a.repairsPct}
              onChange={(v) => api.updateAssumptions({ repairsPct: v })}
            />
            <Field
              id="assume-management"
              label="Management"
              suffix="% rent"
              value={a.managementPct}
              onChange={(v) => api.updateAssumptions({ managementPct: v })}
            />
            <Field
              id="assume-insurance"
              label="Insurance"
              suffix="% / yr"
              value={a.insurancePct}
              onChange={(v) => api.updateAssumptions({ insurancePct: v })}
            />
            <Field
              id="assume-closing"
              label="Closing costs"
              suffix="%"
              value={a.closingPct}
              onChange={(v) => api.updateAssumptions({ closingPct: v })}
            />
          </div>
          <p className="note">
            Property tax uses each city's 2026 rate (the regional median where the city isn't in
            the table); HOA dues come from the listing.
          </p>
          <button type="button" className="btn btn-small btn-ghost" onClick={api.resetAssumptions}>
            Reset assumptions
          </button>
        </Section>
      </div>

      <div className="layout-results">
        <Section
          title="Ranked listings"
          wide
          subtitle={
            api.loading
              ? 'Loading…'
              : `${results.length} of ${api.listings.length} listings match your filters`
          }
        >
          <div className="listings-summary">
            <span className="listings-summary-stat">
              Median price <strong>{formatCurrency(medianPrice)}</strong>
            </span>
            <span className="listings-summary-stat">
              Median $/sqft <strong>{formatCurrency(medianPpsf)}</strong>
            </span>
            <span className="listings-summary-stat">
              Best cap rate <strong>{formatPercent(bestCap)}</strong>
            </span>
            <span className="listings-summary-stat">
              Cash flow ≥ $0 <strong>{positiveCashFlow}</strong>
            </span>
          </div>

          <div className="listings-toolbar">
            <label htmlFor="listings-sort">Sort by</label>
            <select
              id="listings-sort"
              className="listings-select"
              value={api.sort}
              onChange={(e) => api.setSort(e.target.value as SortKey)}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <details className="listings-score-help">
            <summary>How the score works</summary>
            <p>
              Out of 100: <strong>value</strong> (35) — $/sqft against the median for the same
              property type in the same city; <strong>return</strong> (25) — cap rate under your
              assumptions; <strong>motivation</strong> (20) — price cuts and days on market;{' '}
              <strong>upside</strong> (20) — ADU, in-law, fixer or investor mentions in the
              remarks, and house lots of {formatNumber(LARGE_LOT_SQFT)}+ sqft. HOA dues, 55+ or
              cash-only restrictions, auctions and manufactured homes take points off. It ranks
              listings against each other — always check the remarks, photos and real rent comps.
            </p>
          </details>

          {results.length > 0 ? (
            <>
              <ul className="listings">
                {results.slice(0, shown).map((analysis) => (
                  <ListingCard
                    key={analysis.listing.id}
                    analysis={analysis}
                    shortlisted={api.isShortlisted(analysis.listing.id)}
                    onToggleShortlist={api.toggleShortlist}
                    onNewDeal={onNewDeal}
                  />
                ))}
              </ul>
              {results.length > shown ? (
                <button
                  type="button"
                  className="btn listings-more"
                  onClick={() => setPaging({ key: pageKey, shown: shown + PAGE_SIZE })}
                >
                  Show {Math.min(PAGE_SIZE, results.length - shown)} more of{' '}
                  {results.length - shown}
                </button>
              ) : null}
            </>
          ) : api.loading ? null : (
            <p className="note">No listings match. Loosen a filter or turn a dataset on.</p>
          )}
        </Section>
      </div>
    </div>
  )
}
