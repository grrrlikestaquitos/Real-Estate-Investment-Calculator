import { formatCurrencyExact, formatNumber } from '../lib/format'
import { pricePerSqFt, type Listing } from '../lib/listings'

interface ListingCardProps {
  listing: Listing
  /** Dimmed styling for listings that only qualify via the buffer. */
  buffered?: boolean
  onNewDeal: (listing: Listing) => void
}

export function ListingCard({ listing, buffered = false, onNewDeal }: ListingCardProps) {
  const psf = pricePerSqFt(listing)
  const price = <span className="listing-card-price-value">{formatCurrencyExact(listing.price)}</span>

  return (
    <li className={`listing-card ${buffered ? 'listing-card-buffered' : ''}`}>
      {listing.photoUrl ? (
        <img
          className="listing-card-photo"
          src={listing.photoUrl}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
      <div className="listing-card-main">
        {listing.url ? (
          <a className="listing-card-price" href={listing.url} target="_blank" rel="noreferrer">
            {price}
          </a>
        ) : (
          <span className="listing-card-price">{price}</span>
        )}
        <div className="listing-card-address">
          {listing.address}
          {listing.location ? (
            <span className="listing-card-location"> · {listing.location}</span>
          ) : null}
        </div>
        <div className="listing-card-facts">
          {listing.beds != null ? <span>{formatNumber(listing.beds)} bd</span> : null}
          {listing.baths != null ? <span>{formatNumber(listing.baths)} ba</span> : null}
          {listing.sqft != null ? <span>{formatNumber(listing.sqft)} sqft</span> : null}
          {psf != null ? <span>{formatCurrencyExact(psf)}/sqft</span> : null}
          {buffered ? <span className="listing-card-buffer-tag">within buffer</span> : null}
        </div>
      </div>
      <button type="button" className="btn btn-small" onClick={() => onNewDeal(listing)}>
        New deal
      </button>
    </li>
  )
}
