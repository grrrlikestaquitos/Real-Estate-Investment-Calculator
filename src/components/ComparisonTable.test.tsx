import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_INPUTS, type Deal, type DealInputs, type DealType } from '../lib/types'
import { ComparisonTable } from './ComparisonTable'

function makeDeal(id: string, type: DealType, inputs: Partial<DealInputs>): Deal {
  return { id, name: id, type, inputs: { ...DEFAULT_INPUTS, ...inputs }, createdAt: 0, updatedAt: 0 }
}

const loan = { loanValue: 200000, loanRate: 6, loanTerm: 30 }

function row(name: RegExp) {
  return screen.getByRole('row', { name })
}

describe('ComparisonTable', () => {
  it('highlights the best value in each ranked row', () => {
    render(
      <ComparisonTable
        deals={[
          makeDeal('Low Rent', 'investment', { ...loan, propertyArvValue: 250000, rentValue: 2000 }),
          makeDeal('High Rent', 'investment', { ...loan, propertyArvValue: 250000, rentValue: 5500 }),
        ]}
        isIncluded={() => true}
        onToggle={() => {}}
        onSelect={() => {}}
      />,
    )

    // "Cash Flow / mo" but not "Cash Flow / mo (50% Rule)"
    const [low, high] = within(row(/^Cash Flow \/ mo(?! \()/)).getAllByRole('cell')
    expect(high).toHaveClass('cell-best')
    expect(low).not.toHaveClass('cell-best')
    expect(within(high).getByText('(best)')).toBeInTheDocument()

    // Identical mortgages tie, so nothing is singled out
    const mortgage = row(/^Mortgage \/ mo/)
    expect(within(mortgage).queryByText('(best)')).not.toBeInTheDocument()

    // 2% rule badges: 2000 / 250000 = 0.8% fails, 5500 / 250000 = 2.2% passes
    const twoPercent = row(/^Rent \/ ARV/)
    expect(within(twoPercent).getByText('Fail')).toBeInTheDocument()
    expect(within(twoPercent).getByText('Pass')).toBeInTheDocument()
  })

  it('shows mode-specific rows only for deals in that mode', () => {
    render(
      <ComparisonTable
        deals={[
          makeDeal('Rental', 'investment', { ...loan, rentValue: 2000 }),
          makeDeal('Home', 'owner', { ...loan, propertyValue: 250000, rentYouPay: 2500 }),
        ]}
        isIncluded={() => true}
        onToggle={() => {}}
        onSelect={() => {}}
      />,
    )

    const rent = within(row(/^Monthly Rent/)).getAllByRole('cell')
    expect(rent.map((c) => c.textContent)).toEqual(['$2,000', '—'])

    const ownership = within(row(/^Monthly Ownership Cost/)).getAllByRole('cell')
    expect(ownership[0]).toHaveTextContent('—')
    expect(ownership[1]).not.toHaveTextContent('—')
  })

  it('opens a deal from its column header', async () => {
    const onSelect = vi.fn()
    render(
      <ComparisonTable
        deals={[
          makeDeal('A', 'investment', { propertyValue: 1 }),
          makeDeal('B', 'owner', { propertyValue: 2 }),
        ]}
        isIncluded={() => true}
        onToggle={() => {}}
        onSelect={onSelect}
      />,
    )
    within(screen.getByRole('table', { name: 'Deal comparison' })).getByRole('button', { name: 'B' }).click()
    expect(onSelect).toHaveBeenCalledWith('B')
  })

  it('compares only the deals picked, and asks for at least two', () => {
    const onToggle = vi.fn()
    const deals = [
      makeDeal('A', 'investment', { propertyValue: 100000 }),
      makeDeal('B', 'investment', { propertyValue: 200000 }),
      makeDeal('C', 'investment', { propertyValue: 300000 }),
    ]
    const { rerender } = render(
      <ComparisonTable
        deals={deals}
        isIncluded={(id) => id !== 'B'}
        onToggle={onToggle}
        onSelect={() => {}}
      />,
    )
    const picker = screen.getByRole('group', { name: 'Deals to compare' })
    expect(within(picker).getByRole('button', { name: /B/ })).toHaveAttribute('aria-pressed', 'false')
    const [head] = screen.getAllByRole('rowgroup')
    expect(within(head).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Metric',
      'AInvestor',
      'CInvestor',
    ])

    within(picker).getByRole('button', { name: /B/ }).click()
    expect(onToggle).toHaveBeenCalledWith('B')

    rerender(
      <ComparisonTable
        deals={deals}
        isIncluded={(id) => id === 'A'}
        onToggle={onToggle}
        onSelect={() => {}}
      />,
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Pick at least two deals to compare.')).toBeInTheDocument()
  })
})
