import fixtureHtml from './fixtures/zillow-search.html?raw'
import scriptText from '../../public/zillow-extractor.js?raw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ExtractorApi = {
  extractListings: () => Record<string, unknown>[]
  run: () => Promise<Record<string, unknown>>
  notFoundMessage: (info: { path: string; search: string; mapVisible: boolean }) => string
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
    }
    expect(raw.listings).toHaveLength(3)
    expect(raw.source).toBe(window.location.href)
    expect(raw.fetchedAt).toBeTypeOf('number')
    expect(payload.listings).toHaveLength(3)

    const panel = document.querySelector('.zillow-extract-panel')
    expect(panel?.textContent).toContain('Found 3 listings')
    expect(panel?.textContent).toContain('Copied to the clipboard')
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
