/*
 * Zillow listing extractor.
 *
 * Runs in YOUR browser, on a Zillow search results page. It reads the listings
 * shown on the page, copies them to the clipboard as JSON, and also downloads
 * them as a .json file you can import in BRRR Calculator → Find listings.
 *
 * How to run: open a Zillow search, press F12 → Console, paste this whole
 * script, press Enter. The Find-listings view has a "Copy snippet" button that
 * puts this script on your clipboard.
 *
 * Why a snippet instead of the app fetching Zillow directly: browsers block
 * cross-origin requests to Zillow (CORS), and Zillow's bot protection rejects
 * datacenter servers, so the fetch has to happen in your own, already-
 * authenticated browser session. The app does the filtering.
 */
(() => {
  'use strict'

  const PRICE_RE = /\$[\d,]+(?:\.\d+)?/
  const STREET_RE = /^\d{1,7}[\s-][A-Za-z]/
  const CITY_RE = /, [A-Z]{2} \d{5}(-\d+)?$/
  const BEDS_RE = /(\d+(?:\.\d+)?)\s*(?:beds?|bd)\b/i
  const BATHS_RE = /(\d+(?:\.\d+)?)\s*(?:baths?|full baths?|ba)\b/i
  const SQFT_RE = /([\d,]+)\s*(?:sq\.?\s?ft\.?|sqft)\b/i

  function toNumber(value) {
    if (value == null) return null
    const n = Number(String(value).replace(/[^\d.]/g, ''))
    return Number.isFinite(n) && value !== '' ? n : null
  }

  /**
   * Group a card's text nodes into lines: consecutive text nodes sharing the
   * same parent element form one line. In Zillow cards the street and the
   * "City, ST ZIP" line sit in separate elements, so this keeps them apart.
   */
  function textLines(el) {
    const out = []
    let current = ''
    let lastParent = null
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const text = (node.textContent || '').trim()
      if (!text) continue
      const parent = node.parentElement
      if (parent !== lastParent) {
        if (current) out.push(current)
        current = text
        lastParent = parent
      } else {
        current += ' ' + text
      }
    }
    if (current) out.push(current)
    return out
  }

  function extractFromCard(card) {
    const lines = textLines(card)
    const full = lines.join(' ')
    const priceMatch = full.match(PRICE_RE)
    const price = priceMatch ? Number(priceMatch[0].replace(/[$,]/g, '')) : null
    if (price == null || price <= 0) return null

    let address = null
    let location = null
    for (const line of lines) {
      if (address == null && STREET_RE.test(line)) {
        address = line
      } else if (address != null && location == null && CITY_RE.test(line)) {
        location = line
      }
    }
    if (!address) {
      // Cards that render everything in one text node: pull a street out of it.
      const m = full.match(
        /\b(\d{1,7}[\s-][A-Z][A-Za-z0-9'’. -]*?\s(?:St|Street|Ave|Avenue|Rd|Road|Ln|Lane|Dr|Drive|Ct|Court|Pl|Place|Blvd|Boulevard|Way|Ter|Terrace|Cir|Circle|Trl|Trail)\.?)\b/,
      )
      address = m ? m[1].trim() : null
    }
    if (!address) return null
    if (!location) {
      const m = full.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)*, [A-Z]{2} \d{5}(?:-\d+)?)\b/)
      location = m ? m[1] : null
    }

    const bedsMatch = full.match(BEDS_RE)
    const bathsMatch = full.match(BATHS_RE)
    const sqftMatch = full.match(SQFT_RE)
    const photo = card.querySelector('img[src]')
    const link =
      card.querySelector('a[href*="/homes/"][href*="_zpb"]') ||
      card.querySelector('a[href*="/homes/"]')

    return {
      price,
      address,
      location,
      beds: toNumber(bedsMatch && bedsMatch[1]),
      baths: toNumber(bathsMatch && bathsMatch[1]),
      sqft: toNumber(sqftMatch && sqftMatch[1]),
      photoUrl: photo ? photo.src : null,
      url: link ? link.href : '',
    }
  }

  function findCards() {
    const selectors = [
      '[data-test="search-result"]',
      '.SearchResultsPropertyCard__item',
      'li.SearchResultsPropertyCard__item',
      '[class*="SearchResultsPropertyCard"]',
    ]
    for (const selector of selectors) {
      const els = document.querySelectorAll(selector)
      if (els.length > 0) return Array.from(els)
    }
    // Last resort: group listing links by their nearest card-like ancestor.
    const anchors = document.querySelectorAll('a[href*="/homes/"][href*="_zpb"]')
    const cards = new Set()
    anchors.forEach((a) => {
      const card = a.closest('li, article, section') || a.closest('div[class*="card"]')
      if (card) cards.add(card)
    })
    return Array.from(cards)
  }

  /** All listings visible on this page, deduped, capped at 100. */
  function extractListings() {
    const out = []
    const seen = new Set()
    for (const card of findCards()) {
      const row = extractFromCard(card)
      if (!row) continue
      const key = row.url || row.address
      if (seen.has(key)) continue
      seen.add(key)
      out.push(row)
      if (out.length >= 100) break
    }
    return out
  }

  function overlay(message, isError) {
    try {
      const el = document.createElement('div')
      el.setAttribute('role', 'status')
      el.textContent = message
      Object.assign(el.style, {
        position: 'fixed',
        zIndex: '2147483647',
        top: '16px',
        right: '16px',
        background: isError ? '#7f1d1d' : '#14532d',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: '8px',
        font: '14px/1.4 system-ui, sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        maxWidth: '360px',
      })
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 8000)
    } catch {
      /* not a document context */
    }
  }

  /** Extract, then copy to the clipboard and download a .json fallback. */
  async function run() {
    const listings = extractListings()
    const payload = { source: location.href, fetchedAt: Date.now(), listings }
    if (listings.length === 0) {
      overlay('No listings found. Open a Zillow search results page and run this again.', true)
      return payload
    }
    const json = JSON.stringify(payload, null, 2)
    let copied = false
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json)
        copied = true
      }
    } catch {
      copied = false
    }
    if (!copied && typeof URL.createObjectURL === 'function') {
      try {
        const blob = new Blob([json], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `zillow-listings-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      } catch {
        /* download unavailable; the clipboard attempt already ran */
      }
    }
    overlay(
      copied
        ? `Copied ${listings.length} listings — paste them in BRRR Calculator (Find listings).`
        : `Saved ${listings.length} listings — import the downloaded file in BRRR Calculator.`,
      false,
    )
    return payload
  }

  // Exposed for tests (the app page runs the script top-to-bottom instead).
  window.__zillowExtract = { extractListings, run }
  // The test suite sets this flag before evaluating the script so it can
  // inspect the API without the side effects of a real run.
  if (!window.__ZILLOW_EXTRACT_NO_AUTO_RUN__) void run()
})()
