import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    delete document.documentElement.dataset.theme
  })

  it('renders the header and a default deal', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /real estate investment calculator/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /deal inputs/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /market analysis/i })).toBeInTheDocument()
  })

  it('shows placeholders until inputs are provided', () => {
    render(<App />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(5)
  })

  it('computes live results as inputs are typed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Sale Price'), '180000')
    await user.type(screen.getByLabelText('ARV / Market Value'), '220000')
    await user.type(screen.getByLabelText('Monthly Rent'), '1900')

    // 1900 / 220000 = 0.86%
    expect(screen.getByText('0.86%', { selector: '.stat-value' })).toBeInTheDocument()
    // Rent below 2% of ARV
    expect(screen.getByText('Rent is below 2% of ARV')).toBeInTheDocument()
    // 220000 - 180000 = $40,000 below-ARV difference
    expect(screen.getByText('$40,000')).toBeInTheDocument()
  })

  it('switches a deal to homeowner mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('radio', { name: 'Homeowner' }))

    // Homeowner sections appear
    expect(
      screen.getByRole('heading', { name: 'Home Value & Equity Over Time' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cost of Ownership' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rent vs Buy' })).toBeInTheDocument()

    // Investor-only sections disappear
    expect(screen.queryByRole('heading', { name: 'Cash Flow' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Cash Flow Over Time' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Rent & Tenant Screening' }),
    ).not.toBeInTheDocument()

    // Investor-only inputs are hidden; homeowner inputs are shown
    expect(screen.queryByLabelText('Monthly Rent')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('ARV / Market Value')).not.toBeInTheDocument()
    expect(screen.getByLabelText("Rent You'd Otherwise Pay")).toBeInTheDocument()
    expect(screen.getByLabelText('Monthly Household Income')).toBeInTheDocument()
  })

  it('applies a greater Seattle tax rate from the reference list', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Open the reference and apply Seattle's rate (1.22%)
    const seattleRow = screen.getByText('Greater Seattle property tax rates (2026)')
    await user.click(seattleRow)
    const row = screen.getByText('Seattle').closest('tr')
    if (!row) throw new Error('no Seattle row')
    await user.click(within(row).getByRole('button', { name: 'Use' }))

    const taxInput = screen.getByLabelText('Property Tax Rate')
    expect(taxInput).toHaveValue('1.22')
    const stored = JSON.parse(window.localStorage.getItem('brrr-calculator/deals/v1') ?? '[]')
    expect(stored[0].inputs.propertyTax).toBe(1.22)
  })

  it('surfaces key numbers and keeps secondary sections collapsed', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Key metrics tiles show placeholders until inputs are provided
    expect(screen.getByText('Sale Price', { selector: '.key-metric-label' })).toBeInTheDocument()

    // Advanced analysis is collapsed by default
    const advanced = screen.getByText('Advanced Analysis').closest('details')
    expect(advanced).not.toBeNull()
    expect(advanced).not.toHaveAttribute('open')

    // Investor: multi-year projections and screening live inside the advanced section
    expect(screen.getByRole('heading', { name: 'Home Value Over Time' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rent & Tenant Screening' })).toBeInTheDocument()

    // The key price tile picks up the value as you type
    await user.type(screen.getByLabelText('Sale Price'), '180000')
    const tile = screen.getByText('Sale Price', { selector: '.key-metric-label' }).closest('.key-metric')
    expect(within(tile as HTMLElement).getByText('$180,000')).toBeInTheDocument()
  })

  it('shows mode-specific advanced sections', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Homeowner' }))

    // Owner: only points analysis is advanced
    expect(screen.queryByRole('heading', { name: 'Home Value Over Time' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Rent & Tenant Screening' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mortgage Points' })).toBeInTheDocument()
  })

  it('persists inputs across renders of the same session', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '123456')
    // Shown with thousands separators, stored as a plain number
    expect(screen.getByLabelText('Sale Price')).toHaveValue('123,456')
    const stored = JSON.parse(window.localStorage.getItem('brrr-calculator/deals/v1') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].inputs.propertyValue).toBe(123456)
  })

  it('sets the loan amount from a down payment quick pick', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '320000')
    await user.click(screen.getByRole('button', { name: '20%' }))

    expect(screen.getByLabelText('Loan Amount')).toHaveValue('256,000')
    expect(screen.getByRole('button', { name: '20%' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Down Payment')).toHaveValue('20')
    expect(screen.getByText('$64,000 down')).toBeInTheDocument()
  })

  it('sets the down payment by slider or by typing a percent, and follows the loan amount', async () => {
    const user = userEvent.setup()
    render(<App />)
    const slider = screen.getByRole('slider', { name: 'Adjust down payment' })
    expect(slider).toBeDisabled()

    await user.type(screen.getByLabelText('Sale Price'), '400000')
    fireEvent.change(slider, { target: { value: '25' } })
    expect(screen.getByLabelText('Loan Amount')).toHaveValue('300,000')
    expect(screen.getByLabelText('Down Payment')).toHaveValue('25')

    await user.clear(screen.getByLabelText('Down Payment'))
    await user.type(screen.getByLabelText('Down Payment'), '10')
    expect(screen.getByLabelText('Loan Amount')).toHaveValue('360,000')

    await user.clear(screen.getByLabelText('Loan Amount'))
    await user.type(screen.getByLabelText('Loan Amount'), '380000')
    expect(screen.getByLabelText('Down Payment')).toHaveValue('5')
    expect(screen.getByText('$20,000 down')).toBeInTheDocument()
  })

  it('moves a rate with its slider and shows what it costs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '400000')
    await user.click(screen.getByRole('button', { name: '20%' }))

    const rate = screen.getByRole('slider', { name: 'Adjust fixed rate' })
    expect(rate).toHaveAttribute('aria-valuetext', 'Not set')
    fireEvent.change(rate, { target: { value: '6.5' } })
    expect(screen.getByLabelText('Fixed Rate')).toHaveValue('6.5')
    expect(rate).toHaveAttribute('aria-valuetext', '6.5%')
    expect(screen.getByText('$2,023/mo principal & interest')).toBeInTheDocument()

    // Typing outside the slider's span is kept; the slider pins to its end
    await user.clear(screen.getByLabelText('Fixed Rate'))
    await user.type(screen.getByLabelText('Fixed Rate'), '14')
    expect(rate).toHaveValue('12')
    const stored = JSON.parse(window.localStorage.getItem('brrr-calculator/deals/v1') ?? '[]')
    expect(stored[0].inputs.loanRate).toBe(14)
  })

  it('picks a common loan term in one tap, or types another', async () => {
    const user = userEvent.setup()
    render(<App />)
    const term = screen.getByRole('radiogroup', { name: 'Loan Term' })
    expect(within(term).getByRole('radio', { name: '30 yr' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('textbox', { name: 'Loan Term' })).not.toBeInTheDocument()

    await user.click(within(term).getByRole('radio', { name: '15 yr' }))
    const storedTerm = () =>
      JSON.parse(window.localStorage.getItem('brrr-calculator/deals/v1') ?? '[]')[0].inputs.loanTerm
    expect(storedTerm()).toBe(15)

    await user.click(within(term).getByRole('radio', { name: 'Other' }))
    const box = screen.getByRole('textbox', { name: 'Loan Term' })
    expect(box).toHaveFocus()
    expect(box).toHaveValue('15')
    await user.keyboard('25')
    expect(storedTerm()).toBe(25)
    expect(within(term).getByRole('radio', { name: 'Other' })).toHaveAttribute('aria-checked', 'true')
  })

  it('clears the input fields and can undo it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '250000')

    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByLabelText('Sale Price')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByLabelText('Sale Price')).toHaveValue('250,000')
  })

  it('renames a deal inline', async () => {
    const user = userEvent.setup()
    render(<App />)
    const name = screen.getByRole('textbox', { name: 'Deal name' })
    await user.clear(name)
    await user.type(name, 'Duplex on Main{Enter}')

    expect(screen.getByRole('button', { name: /Duplex on Main/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const stored = JSON.parse(window.localStorage.getItem('brrr-calculator/deals/v1') ?? '[]')
    expect(stored[0].name).toBe('Duplex on Main')
  })

  it('duplicates a deal, and deleting it can be undone', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '200000')
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    // The copy is active and keeps the inputs
    expect(screen.getByRole('textbox', { name: 'Deal name' })).toHaveValue('My Deal (copy)')
    expect(screen.getByLabelText('Sale Price')).toHaveValue('200,000')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByRole('button', { name: /My Deal \(copy\)/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('textbox', { name: 'Deal name' })).toHaveValue('My Deal (copy)')
  })

  it('compares deals side by side and highlights the best value', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '300000')
    await user.click(screen.getByRole('button', { name: /new deal/i }))
    await user.type(screen.getByLabelText('Sale Price'), '250000')
    await user.type(screen.getByLabelText('Loan Amount'), '200000')
    await user.type(screen.getByLabelText('Fixed Rate'), '6')

    await user.click(screen.getByRole('button', { name: /^compare/i }))
    expect(screen.getByRole('heading', { name: 'Deal Comparison' })).toBeInTheDocument()
    const table = screen.getByRole('table')

    const priceRow = within(table).getByRole('row', { name: /^Sale Price/ })
    expect(within(priceRow).getByText('$300,000')).toBeInTheDocument()
    expect(within(priceRow).getByText('$250,000')).toBeInTheDocument()

    // Only one deal has a mortgage, so there is nothing to rank
    const mortgageRow = within(table).getByRole('row', { name: /^Mortgage \/ mo/ })
    expect(within(mortgageRow).queryByText('(best)')).not.toBeInTheDocument()

    // Rows with no data for any deal are hidden
    expect(within(table).queryByRole('row', { name: /^Monthly Rent/ })).not.toBeInTheDocument()

    // Selecting a column header opens that deal
    await user.click(within(table).getByRole('button', { name: 'My Deal' }))
    expect(screen.queryByRole('heading', { name: 'Deal Comparison' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Deal name' })).toHaveValue('My Deal')
  })

  it('imports deals from a backup file', async () => {
    const user = userEvent.setup()
    render(<App />)
    const backup = JSON.stringify({
      deals: [
        {
          id: 'imported-1',
          name: 'Imported Rental',
          type: 'investment',
          inputs: { propertyValue: 410000 },
        },
      ],
    })
    await user.upload(
      screen.getByLabelText('Import deals from a backup file'),
      new File([backup], 'deals.json', { type: 'application/json' }),
    )

    expect(await screen.findByText('Imported 1 deal')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Deal name' })).toHaveValue('Imported Rental')
    expect(screen.getByLabelText('Sale Price')).toHaveValue('410,000')
  })

  it('switches between dark and light themes and remembers the choice', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('brrr-calculator/theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })

  it('charts equity over time and reads values by year from the keyboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Homeowner' }))
    expect(screen.getByText(/to see your equity grow/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Sale Price'), '400000')
    await user.type(screen.getByLabelText('Annual Appreciation'), '3')
    await user.type(screen.getByLabelText('Loan Amount'), '320000')
    await user.type(screen.getByLabelText('Fixed Rate'), '6')

    const chart = screen.getByRole('img', { name: /home value and equity/i })
    chart.focus()
    await user.keyboard('{Home}')
    // Today: value is the price, equity is the down payment
    expect(
      screen.getByText('Today: Home value $400,000, Equity $80,000'),
    ).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText(/^Year 1: Home value \$412,000, Equity/)).toBeInTheDocument()
  })

  it('charts cumulative cash flow for investors in the main results', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Cash Flow Over Time' })).toBeInTheDocument()
    expect(screen.getByText(/to project cash flow/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Monthly Rent'), '2500')
    await user.type(screen.getByLabelText('Loan Amount'), '200000')
    await user.type(screen.getByLabelText('Fixed Rate'), '6')
    expect(screen.getByRole('img', { name: /cumulative cash flow/i })).toBeInTheDocument()
  })

  it('models a BRRR deal: 70% rule, rehab, and refinance', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '150000')
    await user.type(screen.getByLabelText('ARV / Market Value'), '250000')
    await user.type(screen.getByLabelText('Rehab Budget'), '30000')
    await user.type(screen.getByLabelText('Monthly Rent'), '2200')
    await user.type(screen.getByLabelText('Loan Amount'), '120000')
    await user.type(screen.getByLabelText('Fixed Rate'), '10')
    await user.type(screen.getByLabelText('Closing Costs'), '5000')

    // 250k × 70% − 30k rehab = 145k max offer, so 150k fails
    expect(screen.getByText('Max offer $145,000')).toBeInTheDocument()
    expect(screen.getByText('Price is above 70% of ARV minus rehab')).toBeInTheDocument()
    expect(screen.getByText(/Enter ARV and the refinance terms/)).toBeInTheDocument()

    await user.click(screen.getByText('Refinance after rehab (optional)'))
    await user.type(screen.getByLabelText('Loan-to-Value'), '75')
    await user.type(screen.getByLabelText('Refinance Rate'), '7')
    await user.type(screen.getByLabelText('Refi Closing Costs'), '4000')

    const row = (label: RegExp) => screen.getByText(label, { selector: '.stat-label' }).closest('.stat-row') as HTMLElement
    // 30k down + 5k closing + 30k rehab in; 187.5k − 120k − 4k out
    expect(within(row(/^Cash Invested/)).getByText('$65,000')).toBeInTheDocument()
    expect(within(row(/^Cash Out at Refinance/)).getByText('$63,500')).toBeInTheDocument()
    expect(within(row(/^Cash Left in Deal/)).getByText('$1,500')).toBeInTheDocument()
  })

  it('switches to itemized cash flow once operating expenses are entered', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('Monthly Cash Flow (25% Rule)', { selector: '.key-metric-label' })).toBeInTheDocument()

    await user.click(screen.getByText('Operating expenses (optional)'))
    await user.type(screen.getByLabelText('Vacancy'), '5')
    expect(screen.getByText('Monthly Cash Flow (Itemized)', { selector: '.key-metric-label' })).toBeInTheDocument()
    expect(screen.getByText('Expense Ratio (% of Rent)')).toBeInTheDocument()
  })

  it('adds estimated PMI for homeowners under 20% down', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Sale Price'), '400000')
    // Investors get investment-loan picks; homeowners get low-down options
    expect(screen.getByRole('button', { name: '15%' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '3.5%' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Homeowner' }))
    expect(screen.getByRole('button', { name: '3.5%' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Fixed Rate'), '6')
    await user.click(screen.getByRole('button', { name: '5%' }))

    // 380k × 0.5% / 12
    const pmi = screen.getByText(/^PMI \(est\. 0\.5%\/yr\), ends ~year \d+$/).closest('.stat-row') as HTMLElement
    expect(within(pmi).getByText('$158.33')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '20%' }))
    expect(screen.getByText('None (20%+ down)')).toBeInTheDocument()
  })
})

describe('phone summary bar', () => {
  const originalMatchMedia = window.matchMedia
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    // A phone-sized screen: the stacked layout's media query matches
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width: 960px'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    Element.prototype.scrollIntoView = scrollIntoView
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    // jsdom has no scrollIntoView; remove the mock so other tests see the same environment
    delete (Element.prototype as Partial<Element>).scrollIntoView
    scrollIntoView.mockReset()
  })

  const bar = () => screen.getByRole('complementary', { name: 'Results summary' })

  it('keeps headline numbers and rule checks in view while typing', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(within(bar()).getByText('Payment / mo')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Sale Price'), '200000')
    await user.type(screen.getByLabelText('ARV / Market Value'), '250000')
    await user.type(screen.getByLabelText('Monthly Rent'), '2000')
    await user.type(screen.getByLabelText('Loan Amount'), '160000')
    await user.type(screen.getByLabelText('Fixed Rate'), '6')

    // 160k at 6% over 30 years
    expect(within(bar()).getByText('$959')).toBeInTheDocument()
    // 2000 / 250000 = 0.8%: below the 2% rule; 200k is above 70% × 250k = 175k
    expect(within(bar()).getByText(/^2%/).closest('.rule-pill')).toHaveClass('rule-pill-bad')
    expect(within(bar()).getByText(/^70%/).closest('.rule-pill')).toHaveClass('rule-pill-bad')
    // 2000 × 0.5 − 959 ≥ 0
    expect(within(bar()).getByText(/^50%/).closest('.rule-pill')).toHaveClass('rule-pill-ok')
  })

  it('shows homeowner checks and scrolls to the full results', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Homeowner' }))
    expect(within(bar()).getByText('Monthly cost')).toBeInTheDocument()
    expect(within(bar()).getByText(/^28%/)).toBeInTheDocument()
    expect(within(bar()).getByText(/^Rent/)).toBeInTheDocument()

    await user.click(within(bar()).getByRole('button', { name: /show full results/i }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toHaveClass('layout-results')
  })

  it('is hidden in the comparison view and on wide screens', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: /new deal/i }))
    await user.click(screen.getByRole('button', { name: /^compare/i }))
    expect(screen.queryByRole('complementary', { name: 'Results summary' })).not.toBeInTheDocument()
    unmount()

    window.matchMedia = originalMatchMedia
    render(<App />)
    expect(screen.queryByRole('complementary', { name: 'Results summary' })).not.toBeInTheDocument()
  })
})

