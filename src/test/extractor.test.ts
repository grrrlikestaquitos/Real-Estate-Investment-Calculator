import fixtureHtml from './fixtures/zillow-search.html?raw'
import scriptText from '../../public/zillow-extractor.js?raw'
import { describe, expect, it, vi } from 'vitest'

type ExtractorApi = {
  extractListings: () => Record<string, unknown>[]
  run: () => Promise<Record<string, unknown>>
}

function runExtractor(): ExtractorApi {
  // Quiet mode: skip the script's auto-run so tests control the side effects.
  ;(window as unknown as Record<string, unknown>).__ZILLOW_EXTRACT_NO_AUTO_RUN__ = true
  new Function(scriptText)()
  return (window as unknown as { __zillowExtract: ExtractorApi }).__zillowExtract
}

describe('zillow-extractor', () => {
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

  it('run() copies a JSON payload to the clipboard', async () => {
    document.body.innerHTML = fixtureHtml
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
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
  })

  it('run() reports zero listings on a non-search page', async () => {
    document.body.innerHTML = '<p>not a search page</p>'
    const { run } = runExtractor()
    const payload = await run()
    expect(payload.listings).toEqual([])
  })
})
