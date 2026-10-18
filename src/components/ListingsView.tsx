import { useRef, useState, type ChangeEvent } from 'react'
import { formatCurrency, formatNumber, formatPercent } from '../lib/format'
import { PROPERTY_TYPE_LABELS, type PropertyType } from '../lib/mls'
import {
  LARGE_LOT_SQFT,
  SIZE_BAND,
  SORTS_FOR,
  SORT_LABELS,
  YARD_LOT_SQFT,
  ZIP_STATS_SOURCE,
  type ListingAnalysis,
  type Perspective,
  type SortKey,
} from '../lib/screening'
import { FRONT_RATIO_PASS_PERCENT } from '../lib/calculations'
import { useListings, type FilterStrings } from '../hooks/useListings'
import { Field } from './Field'
import { ListingAssumptions } from './ListingAssumptions'
import { ListingCard } from './ListingCard'
import { Section } from './Section'
import { SegmentedControl } from './SegmentedControl'

interface ListingsViewProps {
  onNewDeal: (analysis: ListingAnalysis) => void
  notify: (text: string, tone?: 'error') => void
}

const PAGE_SIZE = 30

type ToggleFilter = {
  [K in keyof FilterStrings]: FilterStrings[K] extends boolean ? K : never
}[keyof FilterStrings]
const TYPES: PropertyType[] = ['house', 'townhouse', 'condo', 'manufactured']

const PERSPECTIVE_NOTES: Record<Perspective, string> = {
  investment: 'Ranks listings as rentals: value, cash flow and cap rate, seller motivation, upside.',
  owner: 'Ranks listings as a home to live in: value, affordability, condition, yard and garage, room to negotiate.',
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * The listings screen: NWMLS exports (bundled from Data/ or imported as CSV)
 * ranked by a screening score from an investor's or a homeowner's
 * perspective, with filters, the assumptions behind the numbers, and a
 * shortlist.
 */
export function ListingsView({ onNewDeal, notify }: ListingsViewProps) {
  const api = useListings()
  const fileRef = useRef<HTMLInputElement>(null)
  const { filters, results } = api
  const isOwner = api.perspective === 'owner'
  // A new filter, sort or perspective starts back at the first page.
  const pageKey = JSON.stringify([filters, api.sort, api.perspective])
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

  function toggleCity(city: string) {
    const cities = filters.cities.includes(city)
      ? filters.cities.filter((c) => c !== city)
      : [...filters.cities, city]
    api.updateFilters({ cities })
  }

  // Keep checked cities listed (with 0) after their dataset is turned off, so they can be unchecked.
  const cityOptions: [string, number][] = [
    ...api.cities,
    ...filters.cities
      .filter((c) => !api.cities.some(([city]) => city === c))
      .map((c): [string, number] => [c, 0]),
  ]

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
  const medianMonthly = median(results.flatMap((r) => (r.housingCost != null ? [r.housingCost] : [])))
  const hasIncome = results.some((r) => r.incomeShare != null)
  const affordable = results.filter(
    (r) => r.incomeShare != null && r.incomeShare <= FRONT_RATIO_PASS_PERCENT,
  ).length

  return (
    <div className="layout">
      <div className="layout-side listings-side">
        <Section title="Screen as">
          <SegmentedControl
            label="Perspective"
            value={api.perspective}
            options={[
              { value: 'investment', label: 'Investor (Rental)' },
              { value: 'owner', label: 'Homeowner' },
            ]}
            onChange={api.setPerspective}
          />
          <p className="note">{PERSPECTIVE_NOTES[api.perspective]}</p>
        </Section>

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

          <fieldset className="listings-cities">
            <legend className="listings-filter-label">
              Cities
              <span className="listings-cities-count">
                {filters.cities.length > 0 ? `${filters.cities.length} selected` : 'All'}
              </span>
              {filters.cities.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-small btn-ghost listings-cities-clear"
                  onClick={() => api.updateFilters({ cities: [] })}
                >
                  Clear
                </button>
              ) : null}
            </legend>
            <ul className="listings-city-list">
              {cityOptions.map(([city, count]) => (
                <li key={city}>
                  <label className="listings-check">
                    <input
                      type="checkbox"
                      checked={filters.cities.includes(city)}
                      onChange={() => toggleCity(city)}
                    />
                    <span className="listings-dataset-name">{city}</span>
                    <span className="listings-dataset-count">{count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

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

        <ListingAssumptions api={api} />
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
            {isOwner ? (
              <>
                <span className="listings-summary-stat">
                  Median monthly cost <strong>{formatCurrency(medianMonthly)}</strong>
                </span>
                <span className="listings-summary-stat">
                  {hasIncome ? (
                    <>
                      Within {FRONT_RATIO_PASS_PERCENT}% of income <strong>{affordable}</strong>
                    </>
                  ) : (
                    'Add your income to check affordability'
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="listings-summary-stat">
                  Best cap rate <strong>{formatPercent(bestCap)}</strong>
                </span>
                <span className="listings-summary-stat">
                  Cash flow ≥ $0 <strong>{positiveCashFlow}</strong>
                </span>
              </>
            )}
          </div>

          <div className="listings-toolbar">
            <label htmlFor="listings-sort">Sort by</label>
            <select
              id="listings-sort"
              className="listings-select"
              value={api.sort}
              onChange={(e) => api.setSort(e.target.value as SortKey)}
            >
              {SORTS_FOR[api.perspective].map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <details className="listings-score-help">
            <summary>How the score works</summary>
            {isOwner ? (
              <p>
                Out of 100: <strong>value</strong> (30) — $/sqft against similar homes;{' '}
                <strong>affordability</strong> (25) — the payment (mortgage, tax, insurance, PMI,
                HOA) as a share of your income, full marks at 25% or less, none past 40%;{' '}
                <strong>condition</strong> (15) — new construction, recently built, or updated,
                while fixers get nothing; <strong>livability</strong> (15) — a yard (house lot of{' '}
                {formatNumber(YARD_LOT_SQFT)}+ sqft), a 2-car garage, a notable view, waterfront;{' '}
                <strong>negotiation room</strong> (15) — price cuts and days on market. HOA dues,
                cash-only sales, auctions, 55+ restrictions and manufactured homes take points off.
              </p>
            ) : (
              <p>
                Out of 100: <strong>value</strong> (35) — $/sqft against similar homes;{' '}
                <strong>return</strong> (25) — cap rate under your assumptions;{' '}
                <strong>motivation</strong> (20) — price cuts and days on market;{' '}
                <strong>upside</strong> (20) — ADU, in-law, fixer or investor mentions in the
                remarks, and house lots of {formatNumber(LARGE_LOT_SQFT)}+ sqft. HOA dues, 55+ or
                cash-only restrictions, auctions and manufactured homes take points off. Rent
                scales with each ZIP's median rent.
              </p>
            )}
            <p>
              Similar homes are the same property type in the same city within ±
              {Math.round(SIZE_BAND * 100)}% of the size (widening to any size, then all cities,
              when there are fewer than 5). The score ranks listings against each other — always
              check the remarks, photos and real comps. ZIP figures: {ZIP_STATS_SOURCE}.
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
