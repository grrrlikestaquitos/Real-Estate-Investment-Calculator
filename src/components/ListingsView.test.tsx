import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseMlsCsv } from '../lib/mls'
import { mlsCsv } from '../test/fixtures/mls'
import { ListingsView } from './ListingsView'

// Leaflet needs a real browser; stand in for the map with buttons that act like clicking a ZIP.
vi.mock('./ListingsMap', () => ({
  default: (props: {
    zips: { zip: string }[]
    results: unknown[]
    hiddenZips: string[]
    onToggleZip: (zip: string) => void
  }) => (
    <div data-testid="map">
      {props.zips.map((z) => (
        <button key={z.zip} type="button" onClick={() => props.onToggleZip(z.zip)}>
          map {z.zip}
        </button>
      ))}
      <span>{props.results.length} dots</span>
    </div>
  ),
}))

vi.mock('virtual:mls-data', async () => {
  const { parseMlsCsv: parse } = await import('../lib/mls')
  const { mlsCsv: csv } = await import('../test/fixtures/mls')
  const rows = ['1001', '1002', '1003', '1004'].map((id) => ({ id, price: 600000, sqft: 1500 }))
  return {
    default: [
      {
        id: 'Area, 5 mi',
        name: 'Area, 5 mi',
        listings: parse(
          csv([
            ...rows,
            { id: '1777', price: 480000, original: 540000, sqft: 1500, remarks: 'Fixer with a DADU.' },
            {
              id: '1888',
              price: 650000,
              sqft: 900,
              city: 'Bothell',
              zip: '98011',
              style: '32 - Townhouse',
              hoa: [300, 'Monthly'],
            },
          ]),
        ),
      },
    ],
    geocodes: { '1777 12th ave se|98208': [47.9, -122.2] },
  }
})

function renderView() {
  const onNewDeal = vi.fn()
  const notify = vi.fn()
  render(<ListingsView onNewDeal={onNewDeal} notify={notify} />)
  return { onNewDeal, notify }
}


async function loaded() {
  await screen.findByText('6 of 6 listings match your filters')
}

function addresses(): string[] {
  return [...document.querySelectorAll('.listing-card-address')].map(
    (el) => el.firstChild?.textContent ?? '',
  )
}

describe('ListingsView', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('ranks the bundled listings with the best deal first and explains why', async () => {
    renderView()
    await loaded()
    expect(addresses()[0]).toBe('1777 12th Ave SE')
    const best = document.querySelector('.listing-card')!
    expect(within(best as HTMLElement).getByText('Fixer / as-is')).toBeInTheDocument()
    expect(within(best as HTMLElement).getByText('ADU / DADU')).toBeInTheDocument()
    expect(within(best as HTMLElement).getByText(/Price cut 11%/)).toBeInTheDocument()
  })

  it('filters by price, type and HOA', async () => {
    const user = userEvent.setup()
    renderView()
    await loaded()

    await user.type(screen.getByLabelText('Max price'), '500000')
    expect(screen.getByText('1 of 6 listings match your filters')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Max price'))

    await user.click(screen.getByRole('button', { name: 'Townhouse' }))
    expect(addresses()).toEqual(['1888 12th Ave SE'])
    await user.type(screen.getByLabelText('Max HOA'), '200')
    expect(screen.getByText(/No listings match/)).toBeInTheDocument()
  })

  it('filters by one or more checked cities', async () => {
    const user = userEvent.setup()
    renderView()
    await loaded()
    await user.click(screen.getByRole('checkbox', { name: /^Bothell/ }))
    expect(addresses()).toEqual(['1888 12th Ave SE'])
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /^Everett/ }))
    expect(screen.getByText('6 of 6 listings match your filters')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /^Bothell/ })).not.toBeChecked()
  })

  it('carries a city saved by the earlier single-city filter over as a checked city', async () => {
    window.localStorage.setItem(
      'brrr-calculator/listings/v2',
      JSON.stringify({ filters: { city: 'Bothell', hideRestricted: true } }),
    )
    renderView()
    await screen.findByText('1 of 6 listings match your filters')
    expect(screen.getByRole('checkbox', { name: /^Bothell/ })).toBeChecked()
  })

  it('hides ZIP codes from the map or the checklist', async () => {
    const user = userEvent.setup()
    renderView()
    await loaded()
    await screen.findByTestId('map')
    // Only one of the six listings has a saved position.
    expect(screen.getByText(/5 matching listings have no map position/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'map 98208' }))
    expect(screen.getByText('1 of 6 listings match your filters')).toBeInTheDocument()
    expect(screen.getByText('1 hidden')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /^98208/ })).not.toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: /^98208/ }))
    expect(screen.getByText('6 of 6 listings match your filters')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide all ZIPs' }))
    expect(screen.getByText('0 of 6 listings match your filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show ZIP 98011' }))
    expect(addresses()).toEqual(['1888 12th Ave SE'])
    await user.click(screen.getByRole('button', { name: 'Show all ZIPs' }))
    expect(screen.getByText('6 of 6 listings match your filters')).toBeInTheDocument()
  })

  it('shortlists listings and remembers them', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ListingsView onNewDeal={vi.fn()} notify={vi.fn()} />)
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Shortlist 1888 12th Ave SE' }))
    await user.click(screen.getByLabelText(/Shortlist only \(1\)/))
    expect(addresses()).toEqual(['1888 12th Ave SE'])

    unmount()
    renderView()
    await screen.findByText('1 of 6 listings match your filters')
    expect(screen.getByRole('button', { name: 'Remove 1888 12th Ave SE from shortlist' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('recomputes cash flow when the assumptions change', async () => {
    const user = userEvent.setup()
    renderView()
    await loaded()
    const first = () => document.querySelector('.listing-card')!.textContent!
    const before = first()
    await user.clear(screen.getByLabelText('Rent per sqft'))
    await user.type(screen.getByLabelText('Rent per sqft'), '3')
    expect(first()).not.toBe(before)
    expect(first()).toContain('$4,500')
  })

  it('starts a deal from a listing', async () => {
    const user = userEvent.setup()
    const { onNewDeal } = renderView()
    await loaded()
    const best = document.querySelector('.listing-card') as HTMLElement
    await user.click(within(best).getByRole('button', { name: 'New deal' }))
    expect(onNewDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        listing: expect.objectContaining({ id: '1777' }),
        dealInputs: expect.objectContaining({ propertyValue: 480000, rentValue: 3000 }),
      }),
    )
  })

  it('switches to the homeowner perspective with its own assumptions, numbers and sorts', async () => {
    const user = userEvent.setup()
    const { onNewDeal } = renderView()
    await loaded()
    expect(screen.getByLabelText('Rent per sqft')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Homeowner' }))
    expect(screen.queryByLabelText('Rent per sqft')).toBeNull()
    expect(screen.getByText('Add your income to check affordability')).toBeInTheDocument()
    const sorts = within(screen.getByLabelText('Sort by')).getAllByRole('option').map((o) => o.textContent)
    expect(sorts).toContain('Monthly cost (low → high)')
    expect(sorts).not.toContain('Cap rate')

    await user.type(screen.getByLabelText('Household income'), '180000')
    expect(screen.getByText(/Within 28% of income/)).toBeInTheDocument()
    const best = document.querySelector('.listing-card') as HTMLElement
    expect(within(best).getByText('Monthly cost')).toBeInTheDocument()
    expect(within(best).queryByText('Cap rate')).toBeNull()

    await user.click(within(best).getByRole('button', { name: 'New deal' }))
    expect(onNewDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        perspective: 'owner',
        dealInputs: expect.objectContaining({ householdIncome: 15000, rentValue: null }),
      }),
    )
  })

  it("remembers the perspective and keeps each one's assumptions", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ListingsView onNewDeal={vi.fn()} notify={vi.fn()} />)
    await loaded()
    await user.clear(screen.getByLabelText('Interest rate'))
    await user.type(screen.getByLabelText('Interest rate'), '7.25')
    await user.click(screen.getByRole('radio', { name: 'Homeowner' }))
    expect(screen.getByLabelText('Interest rate')).toHaveValue('6.5')

    unmount()
    renderView()
    await loaded()
    expect(screen.getByRole('radio', { name: 'Homeowner' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: 'Investor (Rental)' }))
    expect(screen.getByLabelText('Interest rate')).toHaveValue('7.25')
  })

  it('carries settings saved before perspectives over to the investor side', async () => {
    window.localStorage.setItem(
      'brrr-calculator/listings/v2',
      JSON.stringify({ assumptions: { rentPerSqft: '2.5' }, sort: 'capRate' }),
    )
    renderView()
    await loaded()
    expect(screen.getByLabelText('Rent per sqft')).toHaveValue('2.5')
    expect(screen.getByLabelText('Sort by')).toHaveValue('capRate')
  })

  it('imports an NWMLS CSV and rejects other files', async () => {
    const user = userEvent.setup()
    const { notify } = renderView()
    await loaded()
    const input = screen.getByLabelText('Import NWMLS CSV exports')
    const csv = mlsCsv([{ id: '5555', price: 520000, sqft: 1600 }])
    expect(parseMlsCsv(csv)).toHaveLength(1)
    await user.upload(input, new File([csv], 'More homes.csv', { type: 'text/csv' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Imported 1 listings from More homes.csv'))
    expect(screen.getByText('7 of 7 listings match your filters')).toBeInTheDocument()

    await user.upload(input, new File(['a,b\n1,2\n'], 'junk.csv', { type: 'text/csv' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith("junk.csv isn't an NWMLS CSV export.", 'error'))
  })

  it('turns a dataset off', async () => {
    const user = userEvent.setup()
    renderView()
    await loaded()
    await user.click(screen.getByLabelText(/Area, 5 mi/))
    expect(screen.getByText('0 of 0 listings match your filters')).toBeInTheDocument()
  })
})
