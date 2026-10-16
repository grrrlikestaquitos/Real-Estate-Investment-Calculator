import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeResults } from '../lib/calculations'
import { DEFAULT_INPUTS, type Deal } from '../lib/types'
import { ListingsView } from './ListingsView'

const deal: Deal = {
  id: 'd1',
  name: 'My Deal',
  type: 'investment',
  inputs: { ...DEFAULT_INPUTS },
  createdAt: 0,
  updatedAt: 0,
}

const LISTINGS_JSON = JSON.stringify({
  listings: [
    { price: 300000, address: '300 Easy St', url: 'https://z/1' },
    { price: 450000, address: '450 Easy St', url: 'https://z/2' },
    { price: 500000, address: '500 Easy St', url: 'https://z/3' },
    { price: 540000, address: '540 Easy St', url: 'https://z/4' },
    { price: 560000, address: '560 Easy St', url: 'https://z/5' },
  ],
})

function renderView(onNewDeal: () => void = vi.fn()) {
  const notify = vi.fn()
  render(<ListingsView deal={deal} results={computeResults(deal.inputs)} onNewDeal={onNewDeal} notify={notify} />)
  return { onNewDeal, notify }
}

async function pasteListings(user: ReturnType<typeof userEvent.setup>, text: string) {
  const textarea = screen.getByLabelText('Or paste the JSON here')
  await user.clear(textarea)
  await user.click(textarea)
  await user.paste(text)
  await user.click(screen.getByRole('button', { name: /add pasted listings/i }))
}

describe('ListingsView', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('buckets imported listings into in-range and buffer groups as the range changes', async () => {
    const user = userEvent.setup()
    const { notify } = renderView()
    await pasteListings(user, LISTINGS_JSON)
    expect(notify).toHaveBeenCalledWith('Listings added.')

    // No max yet: everything is in range, no buffer group.
    expect(screen.queryByText(/within \+10\.00% buffer/i)).toBeNull()
    expect(screen.getByText('560 Easy St')).toBeInTheDocument()

    // Set a max: boundary is inclusive; the buffer catches the next listing.
    await user.type(screen.getByLabelText('Max price'), '500000')
    expect(screen.getByText('In range')).toBeInTheDocument()
    expect(screen.getByText('300 Easy St')).toBeInTheDocument()
    expect(screen.getByText('500 Easy St')).toBeInTheDocument()
    const bufferGroup = screen.getByText(/within \+10\.00% buffer/i)
    expect(bufferGroup).toBeInTheDocument()
    expect(screen.getByText('540 Easy St')).toBeInTheDocument()
    expect(screen.queryByText('560 Easy St')).toBeNull()

    // Widen the buffer: the last listing joins the buffer group.
    const bufferInput = screen.getByLabelText('Buffer')
    await user.clear(bufferInput)
    await user.type(bufferInput, '20')
    expect(screen.getByText('560 Easy St')).toBeInTheDocument()
  })

  it('creates a deal from a listing with its price and address', async () => {
    const user = userEvent.setup()
    const onNewDeal = vi.fn()
    renderView(onNewDeal)
    await pasteListings(user, LISTINGS_JSON)

    const card = screen.getByText('450 Easy St').closest('li')
    expect(card).not.toBeNull()
    await user.click(within(card!).getByRole('button', { name: 'New deal' }))
    expect(onNewDeal).toHaveBeenCalledWith(
      expect.objectContaining({ price: 450000, address: '450 Easy St' }),
    )
  })

  it('shows an error for unparseable input and recovers on a good paste', async () => {
    const user = userEvent.setup()
    renderView()
    await pasteListings(user, 'not json at all')
    expect(screen.getByText(/doesn't look like listings json/i)).toBeInTheDocument()

    await pasteListings(user, LISTINGS_JSON)
    expect(screen.queryByText(/doesn't look like listings json/i)).toBeNull()
    expect(screen.getByText('450 Easy St')).toBeInTheDocument()
  })
})
