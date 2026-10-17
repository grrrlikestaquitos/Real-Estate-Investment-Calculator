import fixtureHtml from './fixtures/zillow-search.html?raw'
import scriptText from '../../public/zillow-extractor.js?raw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ExtractorApi = {
  extractListings: () => Record<string, unknown>[]
  run: () => Promise<Record<string, unknown>>
  notFoundMessage: (info: { path: string; search: string; mapVisible: boolean }) => string
  pageTotal: () => number | null
}

function runExtractor(): ExtractorApi {
  // Quiet mode: skip the script's auto-run so tests control the side effects.
  ;(window as unknown as Record<string, unknown>).__ZILLOW_EXTRACT_NO_AUTO_RUN__ = true
  new Function(scriptText)()
  return (window as unknown as { __zillowExtract: ExtractorApi }).__zillowExtract
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

describe('zillow-extractor', () => {
  beforeEach(() => {
    // Fast polling so tests that find nothing do not wait out the full
    // 10-second hydration window (default is 500 ms x 20 polls).
    ;(window as unknown as Record<string, unknown>).__ZILLOW_EXTRACT_POLL__ = {
      everyMs: 5,
      maxPolls: 20,
    }
  })

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__ZILLOW_EXTRACT_POLL__
    history.replaceState({}, '', '/')
    document.body.innerHTML = ''
  })

  it('extracts visible listings, skips price-less cards, and dedupes by url', () => {
    document.body.innerHTML = fixtureHtml
    const { extractListings } = runExtractor()
    // Five cards: one without a price is skipped and the duplicate is dropped.
    const listings = extractListings()

    expect(listings).toHaveLength(3)
    expect(listings[0]).toEqual({
      price: 495000,
      address: '123 Pine St',
      location: 'Seattle, WA 98101',
      beds: 3,
      baths: 2,
      sqft: 1410,
      photoUrl: 'https://maps.example.com/pine.jpg',
      url: 'https://www.zillow.com/homes/123-Pine-St_Seattle_WA-98101/_zpb/?z4=1',
    })
    // Second card uses the spelled-out "beds"/"bath"/"sq ft" wording.
    expect(listings[1]).toMatchObject({
      price: 512500,
      address: '456 Maple Ave',
      beds: 2,
      baths: 1,
      sqft: 980,
    })
    // The card whose price, address, and details share one text node still parses.
    expect(listings[2]).toMatchObject({
      price: 610000,
      address: '901 Larch Pl',
      location: 'Seattle, WA 98199',
      beds: 4,
      baths: 3,
      sqft: 2200,
    })
  })

  it('run() copies a JSON payload to the clipboard and shows the result panel', async () => {
    document.body.innerHTML = fixtureHtml
    const writeText = mockClipboard()
    const { run } = runExtractor()
    const payload = await run()

    expect(writeText).toHaveBeenCalledTimes(1)
    const raw = JSON.parse(writeText.mock.calls[0][0]) as {
      listings: unknown[]
      source: string
      fetchedAt: number
      total: number | null
    }
    expect(raw.listings).toHaveLength(3)
    expect(raw.source).toBe(window.location.href)
    expect(raw.fetchedAt).toBeTypeOf('number')
    expect(raw.total).toBe(5000)
    expect(payload.listings).toHaveLength(3)

    const panel = document.querySelector('.zillow-extract-panel')
    expect(panel?.textContent).toContain('Found 3 listings')
    expect(panel?.textContent).toContain('Copied to the clipboard')
    expect(panel?.textContent).toContain('5,000')
    const [copyBtn, downloadBtn] = Array.from(panel!.querySelectorAll('button'))
    expect(copyBtn?.textContent).toBe('Copy JSON')
    expect(downloadBtn?.textContent).toBe('Download .json')
  })

  it('the panel Copy button copies again on click (a user gesture)', async () => {
    document.body.innerHTML = fixtureHtml
    const writeText = mockClipboard()
    const { run } = runExtractor()
    await run()

    const copyBtn = document.querySelector<HTMLButtonElement>('.zillow-extract-panel button')
    copyBtn?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(copyBtn?.textContent).toBe('Copied ✓')
  })

  it('waits for the list to hydrate before extracting', async () => {
    document.body.innerHTML = '<p>loading</p>'
    mockClipboard()
    setTimeout(() => {
      document.body.innerHTML = fixtureHtml
    }, 30)
    const { run } = runExtractor()
    const payload = await run()
    expect(payload.listings).toHaveLength(3)
  })

  it('run() reports zero listings on a non-search page', async () => {
    document.body.innerHTML = '<p>not a search page</p>'
    const { run } = runExtractor()
    const payload = await run()
    expect(payload.listings).toEqual([])
    const panel = document.querySelector('.zillow-extract-panel')
    expect(panel?.textContent).toContain('does not look like a Zillow search results page')
  })

  it('tells map-mode users to open the results list', async () => {
    history.pushState({}, '', '/homes/for-sale/98101_rb/')
    document.body.innerHTML = '<canvas></canvas><div>map only</div>'
    const { run } = runExtractor()
    const payload = await run()
    expect(payload.listings).toEqual([])
    const panel = document.querySelector('.zillow-extract-panel')
    expect(panel?.textContent).toContain('Open the results list')
  })

  it('recovers when the class selector only matches a list container (regression: found 1 of many)', () => {
    // The Safari report: Zillow's per-card attributes drifted, so the only
    // element matching [class*="SearchResultsPropertyCard"] was the list
    // wrapper — and the old code reported "Found 1 listing".
    const cards = [
      { price: '$400,000', street: '10 First St', zip: '98101', slug: '10-First-St' },
      { price: '$450,000', street: '20 Second St', zip: '98102', slug: '20-Second-St' },
      { price: '$500,000', street: '30 Third St', zip: '98103', slug: '30-Third-St' },
    ]
    document.body.innerHTML = `
      <div class="SearchResultsPropertyCard__list">
        ${cards
          .map(
            (c, i) => `
          <div class="listing-tile-2026">
            <a href="https://www.zillow.com/homes/${c.slug}_Seattle_WA-${c.zip}/_zpb/?z4=${i}">
              <span class="price-display">${c.price}</span>
              <div class="addr"><span>${c.street}</span><span>Seattle, WA ${c.zip}</span></div>
              <div class="det"><span>3 bd</span><span>2 ba</span><span>1,400 sqft</span></div>
            </a>
          </div>`,
          )
          .join('')}
      </div>`
    const { extractListings } = runExtractor()
    const listings = extractListings()
    expect(listings).toHaveLength(3)
    expect(listings.map((l) => l.address)).toEqual(['10 First St', '20 Second St', '30 Third St'])
  })

  it('extracts cards that have no /homes links at all (text clusters)', () => {
    document.body.innerHTML = `
      <div class="mystery-list">
        <div class="t">
          <span>$450,000</span><span>77 Birch St</span><span>Bellevue, WA 98004</span>
          <span>2 bd 1 ba 900 sqft</span>
        </div>
        <div class="t">
          <span>$520,000</span><span>88 Cedar Ln</span><span>Bellevue, WA 98005</span>
          <span>3 bd 2 ba 1,150 sqft</span>
        </div>
      </div>`
    const { extractListings } = runExtractor()
    const listings = extractListings()
    expect(listings).toHaveLength(2)
    expect(listings[0]).toMatchObject({
      price: 450000,
      address: '77 Birch St',
      location: 'Bellevue, WA 98004',
      url: '',
    })
  })

  it('splits a combined street and city line', () => {
    document.body.innerHTML = `
      <div data-test="search-result">
        <a href="https://www.zillow.com/homes/123-Pine-St_Seattle_WA-98101/_zpb/?z4=8">
          <span>$500,000</span><span>123 Pine St, Seattle, WA 98101</span><span>3 bd</span>
        </a>
      </div>`
    const { extractListings } = runExtractor()
    const [row] = extractListings()
    expect(row.price).toBe(500000)
    expect(row.address).toBe('123 Pine St')
    expect(row.location).toBe('Seattle, WA 98101')
  })

  it('pulls a street out of a single combined text node', () => {
    document.body.innerHTML = `
      <div data-test="search-result">
        <a href="https://www.zillow.com/homes/123-Pine-St_Seattle_WA-98101/_zpb/?z4=9">
          <span>$500,000 123 Pine St, Seattle, WA 98101 3 bd 2 ba 1,200 sqft</span>
        </a>
      </div>`
    const { extractListings } = runExtractor()
    const [row] = extractListings()
    expect(row.price).toBe(500000)
    expect(row.address).toBe('123 Pine St')
    expect(row.location).toBe('Seattle, WA 98101')
    expect(row.sqft).toBe(1200)
  })

  describe('pageTotal', () => {
    it('reads the Zillow total from the page text', () => {
      document.body.innerHTML = '<h1>13k homes for sale in Seattle, WA</h1>'
      const { pageTotal } = runExtractor()
      expect(pageTotal()).toBe(13000)
    })

    it('handles comma-grouped numbers and no suffix', () => {
      document.body.innerHTML = '<h1>1,234 homes for sale in Bellevue</h1>'
      const { pageTotal } = runExtractor()
      expect(pageTotal()).toBe(1234)
    })

    it('returns null when there is no total', () => {
      document.body.innerHTML = '<p>nothing here</p>'
      const { pageTotal } = runExtractor()
      expect(pageTotal()).toBeNull()
    })
  })

  it('falls back to anchor-based cards when the known selectors are absent', () => {
    // A div-only card with no Zillow class names or data-test attributes.
    document.body.innerHTML = `
      <div class="whatever">
        <a href="https://www.zillow.com/homes/222-Oak-St_Spokane_WA-99201/_zpb/?z4=9">
          <span>$399,000</span>
          <div><span>222 Oak St</span><span>Spokane, WA 99201</span></div>
          <span>3 bd 2 ba 1,100 sqft</span>
        </a>
      </div>`
    const { extractListings } = runExtractor()
    const listings = extractListings()
    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      price: 399000,
      address: '222 Oak St',
      location: 'Spokane, WA 99201',
      beds: 3,
      baths: 2,
      sqft: 1100,
      url: 'https://www.zillow.com/homes/222-Oak-St_Spokane_WA-99201/_zpb/?z4=9',
    })
  })

  describe('notFoundMessage', () => {
    it('points at the results list when a map is visible', () => {
      const { notFoundMessage } = runExtractor()
      expect(notFoundMessage({ path: '/homes/for-sale/98101_rb/', search: '', mapVisible: true })).toContain(
        'Open the results list',
      )
    })

    it('tells the user to wait when the list is still loading', () => {
      const { notFoundMessage } = runExtractor()
      expect(
        notFoundMessage({ path: '/homes/for-sale/98101_rb/', search: '', mapVisible: false }),
      ).toContain('finish loading')
    })

    it('says so plainly when it is not a search page at all', () => {
      const { notFoundMessage } = runExtractor()
      expect(notFoundMessage({ path: '/', search: '', mapVisible: false })).toContain(
        'does not look like a Zillow search results page',
      )
    })

    it('counts a searchQueryState search string as a search page', () => {
      const { notFoundMessage } = runExtractor()
      expect(
        notFoundMessage({ path: '/homes', search: '?searchQueryState={"v":2}', mapVisible: false }),
      ).toContain('finish loading')
    })
  })
})
