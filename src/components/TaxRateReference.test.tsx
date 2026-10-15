import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaxRateReference } from './TaxRateReference'

function rowFor(city: string) {
  const row = screen.getByText(city).closest('tr')
  if (!row) throw new Error(`no table row for ${city}`)
  return row
}

describe('TaxRateReference', () => {
  it('renders a collapsed table with one row per city', () => {
    render(<TaxRateReference onUseRate={() => {}} />)
    expect(screen.getByText('Greater Seattle property tax rates (2026)')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Use' })).toHaveLength(59)
    expect(within(rowFor('Seattle')).getByText('0.99% – 1.22%')).toBeInTheDocument()
    expect(within(rowFor('Everett')).getByText('0.86%')).toBeInTheDocument()
  })

  it('applies the King county max rate when Use is clicked', async () => {
    const user = userEvent.setup()
    const onUseRate = vi.fn()
    render(<TaxRateReference onUseRate={onUseRate} />)

    await user.click(within(rowFor('Seattle')).getByRole('button', { name: 'Use' }))

    expect(onUseRate).toHaveBeenCalledWith(1.22)
    expect(within(rowFor('Seattle')).getByRole('button', { name: 'Applied ✓' })).toBeInTheDocument()
  })

  it('applies the Snohomish predominant rate when Use is clicked', async () => {
    const user = userEvent.setup()
    const onUseRate = vi.fn()
    render(<TaxRateReference onUseRate={onUseRate} />)

    await user.click(within(rowFor('Lynnwood')).getByRole('button', { name: 'Use' }))

    expect(onUseRate).toHaveBeenCalledWith(0.79)
  })

  it('shows the source disclaimers', () => {
    render(<TaxRateReference onUseRate={() => {}} />)
    expect(screen.getByText(/verify with the county assessor/i)).toBeInTheDocument()
    expect(screen.getByText(/Pierce County cities are not listed/i)).toBeInTheDocument()
    expect(screen.getByText(/2026 Property Tax Levy Rate Distribution/i)).toBeInTheDocument()
  })
})
