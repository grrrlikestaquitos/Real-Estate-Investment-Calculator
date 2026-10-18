import { useState } from 'react'
import { formatCurrency, formatNumber, formatPercent } from '../lib/format'
import { PROPERTY_TYPE_LABELS } from '../lib/mls'
import type { ListingAnalysis } from '../lib/screening'

interface ListingCardProps {
  analysis: ListingAnalysis
  shortlisted: boolean
  onToggleShortlist: (id: string) => void
  onNewDeal: (analysis: ListingAnalysis) => void
}

function scoreTier(score: number): string {
  if (score >= 70) return 'listing-score-great'
  if (score >= 50) return 'listing-score-good'
  return ''
}

function signedCurrency(value: number | null): string {
  if (value == null) return '—'
  return value < 0 ? `−${formatCurrency(-value)}` : formatCurrency(value)
}

export function ListingCard({ analysis, shortlisted, onToggleShortlist, onNewDeal }: ListingCardProps) {
  const [open, setOpen] = useState(false)
  const { listing: l } = analysis
  const fullAddress = `${l.address}, ${l.city}, WA ${l.zip}`
  const query = encodeURIComponent(fullAddress)
  const detailsId = `listing-details-${l.id}`

  return (
    <li className={`listing-card ${shortlisted ? 'listing-card-shortlisted' : ''}`}>
      <div
        className={`listing-score ${scoreTier(analysis.score)}`}
        title="Screening score out of 100: value vs comps, estimated return, seller motivation and upside"
      >
        <span className="listing-score-value">{analysis.score}</span>
        <span className="listing-score-label">score</span>
      </div>

      <div className="listing-card-main">
        <div className="listing-card-top">
          <span className="listing-card-price">{formatCurrency(l.price)}</span>
          {analysis.priceCutPct > 0 ? (
            <span
              className="listing-cut"
              title={`Listed at ${formatCurrency(l.originalPrice)}`}
            >
              ↓ {Math.round(analysis.priceCutPct)}%
            </span>
          ) : null}
          <span className="tag">{PROPERTY_TYPE_LABELS[l.type]}</span>
        </div>
        <div className="listing-card-address">
          {l.address}
          <span className="listing-card-location">
            {' '}
            · {l.city} {l.zip}
          </span>
        </div>
        <div className="listing-card-facts">
          {l.beds != null ? (
            <span title={l.bedsAtLeast ? 'The export leaves out upper-floor bedrooms' : undefined}>
              {l.beds}
              {l.bedsAtLeast ? '+' : ''} bd
            </span>
          ) : null}
          {l.baths != null ? <span>{formatNumber(l.baths)} ba</span> : null}
          {l.sqft != null ? <span>{formatNumber(l.sqft)} sqft</span> : null}
          {l.lotSqft != null && l.type === 'house' ? (
            <span>{formatNumber(l.lotSqft)} sqft lot</span>
          ) : null}
          {l.yearBuilt != null ? <span>built {l.yearBuilt}</span> : null}
          {l.daysOnMarket != null ? <span>{l.daysOnMarket} days listed</span> : null}
        </div>
        <dl className="listing-metrics">
          <div>
            <dt>$/sqft</dt>
            <dd>
              {formatCurrency(analysis.pricePerSqft)}
              {analysis.discountPct != null ? (
                <span
                  className={analysis.discountPct >= 0 ? 'positive' : 'negative'}
                  title={
                    analysis.comps
                      ? `Median ${formatCurrency(analysis.comps.medianPricePerSqft)}/sqft across ${analysis.comps.count} ${analysis.comps.label}`
                      : undefined
                  }
                >
                  {' '}
                  {analysis.discountPct >= 0 ? '↓' : '↑'}
                  {Math.abs(Math.round(analysis.discountPct))}%
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Est. rent</dt>
            <dd>{formatCurrency(analysis.rent)}</dd>
          </div>
          <div>
            <dt>Cash flow</dt>
            <dd className={(analysis.cashFlow ?? 0) >= 0 ? 'positive' : 'negative'}>
              {signedCurrency(analysis.cashFlow)}/mo
            </dd>
          </div>
          <div>
            <dt>Cap rate</dt>
            <dd>{formatPercent(analysis.capRate)}</dd>
          </div>
        </dl>
        {analysis.reasons.length > 0 ? (
          <ul className="listing-reasons" aria-label="Why it scored this way">
            {analysis.reasons.map((r) => (
              <li key={r.text} className={`listing-reason listing-reason-${r.tone}`}>
                {r.text}
              </li>
            ))}
          </ul>
        ) : null}

        {open ? (
          <div id={detailsId} className="listing-details">
            <dl className="listing-details-grid">
              <div>
                <dt>Payment (P&amp;I)</dt>
                <dd>{formatCurrency(analysis.payment)}/mo</dd>
              </div>
              <div>
                <dt>HOA</dt>
                <dd>{l.hoaMonthly > 0 ? `${formatCurrency(l.hoaMonthly)}/mo` : 'None'}</dd>
              </div>
              <div>
                <dt>Property tax</dt>
                <dd>
                  {formatPercent(analysis.taxRatePercent)}
                  {analysis.taxRateEstimated ? ' (regional median)' : ''}
                </dd>
              </div>
              <div>
                <dt>Cash to close</dt>
                <dd>{formatCurrency(analysis.cashNeeded)}</dd>
              </div>
              <div>
                <dt>Cash-on-cash</dt>
                <dd>{formatPercent(analysis.cashOnCash)}</dd>
              </div>
              <div>
                <dt>Rent / price</dt>
                <dd>{formatPercent(analysis.rentToPrice)}</dd>
              </div>
              <div>
                <dt>Style</dt>
                <dd>{l.style || '—'}</dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{l.area || '—'}</dd>
              </div>
              {l.community ? (
                <div>
                  <dt>Community</dt>
                  <dd>{l.community}</dd>
                </div>
              ) : null}
              {l.basement ? (
                <div>
                  <dt>Basement</dt>
                  <dd>{l.basement}</dd>
                </div>
              ) : null}
              {l.view ? (
                <div>
                  <dt>View</dt>
                  <dd>{l.view}</dd>
                </div>
              ) : null}
              {l.waterfront ? (
                <div>
                  <dt>Waterfront</dt>
                  <dd>{l.waterfront}</dd>
                </div>
              ) : null}
              <div>
                <dt>Listed</dt>
                <dd>{l.listedOn ?? '—'}</dd>
              </div>
              <div>
                <dt>MLS #</dt>
                <dd>{l.id}</dd>
              </div>
            </dl>
            {l.remarks ? <p className="listing-remarks">{l.remarks}</p> : null}
            <div className="listing-links">
              <a href={`https://www.zillow.com/homes/${query}_rb/`} target="_blank" rel="noreferrer">
                Zillow
              </a>
              <a
                href={`https://www.redfin.com/search?q=${query}`}
                target="_blank"
                rel="noreferrer"
              >
                Redfin
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                target="_blank"
                rel="noreferrer"
              >
                Map
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="listing-card-actions">
        <button
          type="button"
          className={`btn btn-small listing-star ${shortlisted ? 'listing-star-on' : ''}`}
          aria-pressed={shortlisted}
          aria-label={shortlisted ? `Remove ${l.address} from shortlist` : `Shortlist ${l.address}`}
          onClick={() => onToggleShortlist(l.id)}
        >
          {shortlisted ? '★' : '☆'}
        </button>
        <button
          type="button"
          className="btn btn-small btn-ghost"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Less' : 'Details'}
        </button>
        <button type="button" className="btn btn-small" onClick={() => onNewDeal(analysis)}>
          New deal
        </button>
      </div>
    </li>
  )
}
