import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUTS, type Deal, type DealInputs, type DealType } from '../lib/types'
import { CompareChart } from './CompareChart'

function makeDeal(name: string, type: DealType, inputs: Partial<DealInputs>): Deal {
  return { id: name, name, type, inputs: { ...DEFAULT_INPUTS, ...inputs }, createdAt: 0, updatedAt: 0 }
}

const loan = { loanValue: 240000, loanRate: 6, loanTerm: 30, appreciationRate: 3 }
const deals = [
  makeDeal('Duplex', 'investment', { ...loan, propertyValue: 300000, propertyArvValue: 340000, rentValue: 3200 }),
  makeDeal('Condo', 'investment', { ...loan, propertyValue: 280000, rentValue: 2600 }),
  makeDeal('Our Home', 'owner', { ...loan, propertyValue: 320000 }),
]

const legend = () => within(document.querySelector('.chart-legend') as HTMLElement).getAllByRole('listitem')

describe('CompareChart', () => {
  it('puts each compared deal on one equity chart, with a table view', () => {
    render(<CompareChart deals={deals} isIncluded={() => true} />)
    expect(legend().map((li) => li.textContent)).toEqual(['Duplex', 'Condo', 'Our Home'])
    expect(screen.getByRole('img', { name: /Equity over the next 30 years/ })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Horizon',
      'Duplex',
      'Condo',
      'Our Home',
    ])
  })

  it('charts rentals only for cash flow', async () => {
    const user = userEvent.setup()
    render(<CompareChart deals={deals} isIncluded={() => true} />)
    await user.click(screen.getByRole('radio', { name: 'Cash flow' }))
    expect(legend().map((li) => li.textContent)).toEqual(['Duplex', 'Condo'])
  })

  it('keeps each deal’s color when another is left out', () => {
    render(<CompareChart deals={deals} isIncluded={(id) => id !== 'Duplex'} />)
    const keys = legend().map((li) => li.querySelector('.line-key')?.className)
    expect(keys).toEqual(['line-key line-key-2', 'line-key line-key-3'])
  })

  it('stays out of the way until two deals are compared', () => {
    const { container } = render(<CompareChart deals={deals} isIncluded={(id) => id === 'Condo'} />)
    expect(container).toBeEmptyDOMElement()
  })
})
