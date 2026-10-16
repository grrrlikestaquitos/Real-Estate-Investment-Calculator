import { useRef, useState, type ChangeEvent } from 'react'
import type { Deal } from '../lib/types'
import type { DealResults } from '../lib/calculations'
import { SEVENTY_RULE_PERCENT } from '../lib/calculations'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '../lib/format'
import { GLOSSARY } from '../lib/glossary'
import { copyText } from '../lib/clipboard'
import { bufferedMax, type Listing } from '../lib/listings'
import { parseZillowUrl, withPriceAndSort, ZILLOW_URL_ERRORS } from '../lib/zillowUrl'
import { useListings } from '../hooks/useListings'
import { Field } from './Field'
import { InfoTip } from './InfoTip'
import { ListingCard } from './ListingCard'
import { Section } from './Section'

interface ListingsViewProps {
  deal: Deal
  results: DealResults
  onNewDeal: (listing: Listing) => void
  notify: (text: string, tone?: 'error') => void
}

/**
 * The Find-listings tool: listings extracted from Zillow in the user's own
 * browser (see public/zillow-extractor.js) are imported here as JSON and
 * filtered by the price range, with a buffer that admits a little headroom.
 */
export function ListingsView({ deal, results, onNewDeal, notify }: ListingsViewProps) {
  const listings = useListings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pasted, setPasted] = useState('')
  const [copyingSnippet, setCopyingSnippet] = useState(false)
  const [sortLowHigh, setSortLowHigh] = useState(true)

  const { min, max, bufferPct, buckets, payload, total } = listings
  const showBufferGroup = max != null && bufferPct != null && bufferPct > 0

  const dealCeiling = results.maxOfferSeventyRule ?? deal.inputs.propertyValue

  // The Zillow search URL's own filters take the buffered ceiling, so the page
  // that loads contains both in-range and buffer listings.
  const ceiling = max == null ? null : bufferedMax(max, bufferPct)
  const urlState = listings.query.url.trim() ? parseZillowUrl(listings.query.url) : null
  const openUrl = urlState?.ok
    ? withPriceAndSort(listings.query.url, min, ceiling, sortLowHigh)
    : null
  const openUrlLabel =
    min != null || ceiling != null
      ? `${min != null ? formatCurrency(min) : 'any'} – ${ceiling != null ? formatCurrency(ceiling) : 'any'}`
      : 'no price filter'

  async function copySnippet() {
    setCopyingSnippet(true)
    try {
      const res = await fetch('/zillow-extractor.js')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ok = await copyText(await res.text())
      if (ok) {
        notify('Snippet copied. On Zillow: press F12 → Console, paste it, press Enter.')
      } else {
        notify("Couldn't copy the snippet — check the site's clipboard permissions.", 'error')
      }
    } catch {
      notify("Couldn't load the snippet. Check that the app is served over http(s).", 'error')
    } finally {
      setCopyingSnippet(false)
    }
  }

  function applyPasted() {
    if (listings.importText(pasted)) {
      setPasted('')
      notify('Listings added.')
    } else {
      notify("That didn't parse as listings JSON.", 'error')
    }
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ok = await listings.importFile(file)
    if (ok) notify(`Imported ${file.name}`)
    else notify(`Couldn't import ${file.name}.`, 'error')
  }

  return (
    <div className="layout">
      <div className="layout-side">
        <Section
          title="Find listings"
          subtitle="Filter Zillow listings by your price range, with buffer headroom"
        >
          <ol className="listings-steps">
            <li>
              <strong>Set your area on Zillow</strong> — zoom the map to a neighborhood or search a
              place — then copy the URL from the address bar and paste it below.
            </li>
            <li>
              <strong>Open the filtered search</strong> — set your range, and <em>Open on Zillow</em>
              re-opens that search with your prices applied to Zillow's own filters (cheapest first),
              so the page that loads is already scoped.
            </li>
            <li>
              <strong>Run the snippet</strong> on that search page: copy it, then press F12 → Console
              on Zillow, paste, and press Enter. It copies the listings to your clipboard and
              downloads them as a <code>.json</code> file.
            </li>
            <li>
              <strong>Bring them here</strong> — paste the JSON or import the file.{' '}
              <em>New deal</em> on any listing starts a deal with the price and size filled in.
            </li>
          </ol>

          <div className="listings-query">
            <Field
              id="listings-url"
              label="Zillow search URL"
              value={listings.query.url}
              onChange={(v) => listings.updateQuery({ url: v })}
              placeholder="https://www.zillow.com/homes/…"
              hint={
                urlState != null && !urlState.ok
                  ? ZILLOW_URL_ERRORS[urlState.reason]
                  : 'Address bar of a Zillow search — a place search or a map you have zoomed to'
              }
            />
            {urlState?.ok ? (
              <div className="listings-open-row">
                <label className="listings-sort-toggle">
                  <input
                    type="checkbox"
                    checked={sortLowHigh}
                    onChange={(e) => setSortLowHigh(e.target.checked)}
                  />
                  Sort by price, low → high
                </label>
                {openUrl ? (
                  <a
                    className="btn btn-small listings-open-btn"
                    href={openUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on Zillow · {openUrlLabel}
                  </a>
                ) : null}
              </div>
            ) : null}
            <Field
              id="listings-min"
              label="Min price"
              prefix="$"
              grouped
              value={listings.query.min}
              onChange={(v) => listings.updateQuery({ min: v })}
              placeholder="200,000"
            />
            <Field
              id="listings-max"
              label="Max price"
              prefix="$"
              grouped
              value={listings.query.max}
              onChange={(v) => listings.updateQuery({ max: v })}
              placeholder="500,000"
            >
              {dealCeiling != null ? (
                <div className="chips">
                  <button
                    type="button"
                    className="chip"
                    title={`Uses the ${SEVENTY_RULE_PERCENT}% rule max offer when available, otherwise the sale price`}
                    onClick={() => listings.updateQuery({ max: String(dealCeiling) })}
                  >
                    Use deal ceiling · {formatCurrency(dealCeiling)}
                  </button>
                </div>
              ) : null}
            </Field>
            <Field
              id="listings-buffer"
              label="Buffer"
              suffix="%"
              value={listings.query.bufferPct}
              onChange={(v) => listings.updateQuery({ bufferPct: v })}
              placeholder="10"
              info={<InfoTip {...GLOSSARY.priceBuffer} />}
              hint={
                max != null && bufferPct != null
                  ? `Admits listings up to ${formatCurrencyCompact(bufferedMax(max, bufferPct))}`
                  : 'Percent headroom above the max price'
              }
            />
          </div>

          <button
            type="button"
            className="btn listings-copy-snippet"
            disabled={copyingSnippet}
            onClick={() => void copySnippet()}
          >
            {copyingSnippet ? 'Copying…' : 'Copy snippet'}
          </button>

          <div className="listings-import">
            <label htmlFor="listings-paste" className="listings-import-label">
              Or paste the JSON here
            </label>
            <textarea
              id="listings-paste"
              className="listings-import-textarea"
              rows={4}
              value={pasted}
              spellCheck={false}
              placeholder='{"listings": [ { "price": 495000, "address": "…" } ]}'
              onChange={(e) => setPasted(e.target.value)}
            />
            <div className="listings-import-actions">
              <button
                type="button"
                className="btn btn-small"
                disabled={pasted.trim() === ''}
                onClick={applyPasted}
              >
                Add pasted listings
              </button>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => fileRef.current?.click()}
              >
                Import .json file
              </button>
              {payload ? (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => {
                    listings.clearResults()
                    setPasted('')
                    notify('Listings cleared')
                  }}
                >
                  Clear
                </button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                tabIndex={-1}
                aria-label="Import listings from a JSON file"
                onChange={(e) => void handleImportFile(e)}
              />
            </div>
            {listings.importError ? <p className="note note-error">{listings.importError}</p> : null}
          </div>
        </Section>
      </div>

      <div className="layout-results">
        <Section
          title="Listings"
          wide
          subtitle={
            payload
              ? `${total} imported${payload.fetchedAt ? ` · captured ${new Date(payload.fetchedAt).toLocaleString()}` : ''}`
              : 'Import listings to see them filtered by your range'
          }
        >
          {payload ? (
            <>
              <div className="listings-summary">
                <span className="listings-summary-stat">
                  In range <strong>{buckets.inRange.length}</strong>
                </span>
                {showBufferGroup ? (
                  <span className="listings-summary-stat listings-summary-buffer">
                    Within +{formatPercent(bufferPct)} <strong>{buckets.withinBuffer.length}</strong>
                  </span>
                ) : null}
              </div>

              <h3 className="listings-group-title">
                In range
                {min != null || max != null
                  ? ` (${min != null ? formatCurrency(min) : 'any'} – ${max != null ? formatCurrency(max) : 'any'})`
                  : ' (no range set)'}
              </h3>
              {buckets.inRange.length > 0 ? (
                <ul className="listings">
                  {buckets.inRange.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onNewDeal={onNewDeal} />
                  ))}
                </ul>
              ) : (
                <p className="note">No imported listings fall in the range.</p>
              )}

              {showBufferGroup ? (
                <>
                  <h3 className="listings-group-title listings-group-buffer">
                    Within +{formatPercent(bufferPct)} buffer (up to{' '}
                    {formatCurrency(bufferedMax(max, bufferPct))})
                  </h3>
                  {buckets.withinBuffer.length > 0 ? (
                    <ul className="listings">
                      {buckets.withinBuffer.map((listing) => (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          buffered
                          onNewDeal={onNewDeal}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="note">No imported listings sit in the buffer.</p>
                  )}
                </>
              ) : null}
            </>
          ) : (
            <p className="note">
              No listings yet. Copy the snippet, run it on a Zillow search page, then paste or
              import the result.
            </p>
          )}
        </Section>
      </div>
    </div>
  )
}
