import type { Deal } from '../lib/types'

interface DealTabsProps {
  deals: Deal[]
  activeId: string
  comparing: boolean
  listingsActive: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onCompare: () => void
  onFindListings: () => void
}

export function DealTabs({
  deals,
  activeId,
  comparing,
  listingsActive,
  onSelect,
  onCreate,
  onCompare,
  onFindListings,
}: DealTabsProps) {
  return (
    <nav className="deal-tabs" aria-label="Saved deals">
      <div className="deal-tabs-list">
        {deals.map((deal) => {
          const active = !comparing && deal.id === activeId
          return (
            <button
              key={deal.id}
              type="button"
              className={`deal-tab ${active ? 'deal-tab-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(deal.id)}
            >
              <span className="deal-tab-name">{deal.name}</span>
              <span className={`tag tag-${deal.type}`}>
                {deal.type === 'owner' ? 'Homeowner' : 'Investor'}
              </span>
            </button>
          )
        })}
        <button type="button" className="deal-tab deal-tab-new" onClick={onCreate}>
          <span aria-hidden="true">+</span> New deal
        </button>
      </div>
      {deals.length >= 2 ? (
        <button
          type="button"
          className={`deal-tab deal-tab-compare ${comparing ? 'deal-tab-active' : ''}`}
          aria-current={comparing ? 'page' : undefined}
          onClick={onCompare}
        >
          Compare <span className="count">{deals.length}</span>
        </button>
      ) : null}
      <button
        type="button"
        className={`deal-tab deal-tab-listings ${listingsActive ? 'deal-tab-active' : ''}`}
        aria-current={listingsActive ? 'page' : undefined}
        onClick={onFindListings}
      >
        Find listings
      </button>
    </nav>
  )
}
