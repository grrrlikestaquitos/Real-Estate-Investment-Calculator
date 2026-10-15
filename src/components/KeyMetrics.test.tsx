import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { computeResults } from '../lib/calculations'
import { DEFAULT_INPUTS, type DealInputs, type DealType } from '../lib/types'
import { KeyMetrics } from './KeyMetrics'

function renderMetrics(dealType: DealType, extra: Partial<DealInputs> = {}) {
  const inputs: DealInputs = { ...DEFAULT_INPUTS, ...extra }
  render(<KeyMetrics dealType={dealType} inputs={inputs} results={computeResults(inputs)} />)
}

describe('KeyMetrics', () => {
  it('shows placeholders until inputs are provided', () => {
    renderMetrics('investment')
    const tile = screen.getByText('Sale Price', { selector: '.key-metric-label' }).closest('.key-metric')
    expect(tile).not.toBeNull()
    expect(within(tile as HTMLElement).getByText('—')).toBeInTheDocument()
  })

  it('shows investor tiles with computed values', () => {
    renderMetrics('investment', {
      propertyValue: 180000,
      propertyArvValue: 220000,
      propertyTax: 1,
      loanValue: 150000,
      loanRate: 6,
      loanTerm: 30,
    })
    expect(screen.getByText('$180,000')).toBeInTheDocument()
    expect(screen.getByText('6.00% / 30 yr')).toBeInTheDocument()
    expect(screen.getByText('Monthly Cash Flow (25% Rule)')).toBeInTheDocument()
    expect(screen.queryByText('Monthly Savings vs Rent')).not.toBeInTheDocument()
  })

  it('shows owner tiles with computed values', () => {
    renderMetrics('owner', {
      propertyValue: 600000,
      propertyTax: 0.9,
      loanValue: 480000,
      loanRate: 6,
      loanTerm: 30,
      rentYouPay: 3000,
    })
    expect(screen.getByText('$600,000')).toBeInTheDocument()
    expect(screen.getByText('Monthly Savings vs Rent')).toBeInTheDocument()
    expect(screen.queryByText('Monthly Cash Flow (25% Rule)')).not.toBeInTheDocument()
  })
})
