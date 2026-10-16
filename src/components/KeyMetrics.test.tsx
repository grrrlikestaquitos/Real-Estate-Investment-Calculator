import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { computeResults } from '../lib/calculations'
import { DEFAULT_INPUTS, type DealInputs, type DealType } from '../lib/types'
import { KeyMetrics } from './KeyMetrics'

function renderMetrics(dealType: DealType, extra: Partial<DealInputs> = {}) {
  const inputs: DealInputs = { ...DEFAULT_INPUTS, ...extra }
  render(<KeyMetrics dealType={dealType} results={computeResults(inputs)} />)
}

function tileValue(label: string): string {
  const tile = screen.getByText(label, { selector: '.key-metric-label' }).closest('.key-metric')
  return within(tile as HTMLElement).getByText(/./, { selector: '.key-metric-value' }).textContent ?? ''
}

describe('KeyMetrics', () => {
  it('shows placeholders until inputs are provided', () => {
    renderMetrics('investment')
    expect(tileValue('Cash Needed')).toBe('—')
  })

  it('shows what the investor puts in, earns, and builds instead of echoing inputs', () => {
    renderMetrics('investment', {
      propertyValue: 180000,
      propertyArvValue: 240000,
      rehabCost: 20000,
      closingCost: 5000,
      propertyTax: 1,
      loanValue: 144000,
      loanRate: 6,
      loanTerm: 30,
      rentValue: 2000,
    })
    // 36k down + 5k closing + 20k rehab
    expect(tileValue('Cash Needed')).toBe('$61,000')
    // 240k − (180k + 20k + 5k)
    expect(tileValue('Equity at Purchase')).toBe('$35,000')
    expect(tileValue('Cash Left After Refi')).toBe('—')
    expect(screen.getByText('Cash-on-Cash (25% Rule)', { selector: '.key-metric-label' })).toBeInTheDocument()
    expect(screen.queryByText('Sale Price')).not.toBeInTheDocument()
    expect(screen.queryByText('Monthly Savings vs Rent')).not.toBeInTheDocument()
  })

  it('shows owner tiles with computed values', () => {
    renderMetrics('owner', {
      propertyValue: 600000,
      propertyTax: 0.9,
      loanValue: 480000,
      loanRate: 6,
      loanTerm: 30,
      closingCost: 12000,
    })
    expect(tileValue('Cash to Close')).toBe('$132,000')
    expect(tileValue('Income Needed (28% Rule)')).toMatch(/^\$[\d,]+\/mo$/)
    // No appreciation rate yet, so no projection
    expect(tileValue('Equity in 5 Years')).toBe('—')
    expect(screen.queryByText(/Cash Flow/)).not.toBeInTheDocument()
  })

  it('explains a term from its "?" tip, and closes with Escape', async () => {
    const user = userEvent.setup()
    renderMetrics('investment')
    const tip = screen.getByRole('button', { name: 'What is cash-on-cash return?' })
    expect(tip).toHaveAttribute('aria-expanded', 'false')

    await user.click(tip)
    expect(tip).toHaveAttribute('aria-expanded', 'true')
    const pop = document.getElementById(tip.getAttribute('aria-controls') ?? '')
    expect(pop).toHaveTextContent(/divided by the cash you put in/)

    await user.keyboard('{Escape}')
    expect(tip).toHaveAttribute('aria-expanded', 'false')
    expect(tip).toHaveFocus()
    expect(screen.queryByText(/divided by the cash you put in/)).not.toBeInTheDocument()
  })

  it('closes a tip when another one opens', async () => {
    const user = userEvent.setup()
    renderMetrics('investment')
    await user.click(screen.getByRole('button', { name: 'What is cash needed?' }))
    expect(screen.getByText(/Everything you pay out of pocket/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'What is equity at purchase?' }))
    expect(screen.queryByText(/Everything you pay out of pocket/)).not.toBeInTheDocument()
    expect(screen.getByText(/the value the deal and the rehab create/)).toBeInTheDocument()
  })
})
