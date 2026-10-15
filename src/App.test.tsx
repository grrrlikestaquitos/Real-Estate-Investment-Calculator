import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
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
    await user.click(screen.getByRole('button', { name: '20% down' }))

    expect(screen.getByLabelText('Loan Amount')).toHaveValue('256,000')
    expect(screen.getByRole('button', { name: '20% down' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('$64,000 down (20.0% of price)')).toBeInTheDocument()
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
})

