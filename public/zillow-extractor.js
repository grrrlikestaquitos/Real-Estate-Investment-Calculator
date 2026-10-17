/*
 * Zillow listing extractor.
 *
 * Runs in YOUR browser, on a Zillow search results page. It reads the listings
 * shown on the page, copies them to the clipboard as JSON, downloads them as a
 * .json file, and shows a small panel with Copy/Download buttons (clicking
 * those works even where the console can't write the clipboard directly, e.g.
 * Safari). The console also receives the JSON object as the result.
 *
 * How to run: open a Zillow search, press F12 → Console (Safari: Develop →
 * Show JavaScript Console), paste this whole script, press Enter. The
 * Find-listings view in the app has a "Copy snippet" button that puts this
 * script on your clipboard.
 *
 * Why a snippet instead of the app fetching Zillow directly: browsers block
 * cross-origin requests to Zillow (CORS), and Zillow's bot protection rejects
 * datacenter servers, so the fetch has to happen in your own, already-
 * authenticated browser session. The app does the filtering.
 */
(() => {
  'use strict'

  const PRICE_RE = /\$[\d,]+(?:\.\d+)?/
  const PRICE_REAL_RE = /\$[\d,]{4,}/
  const STREET_RE = /^\d{1,7}[\s-][A-Za-z]/
  const CITY_RE = /, [A-Z]{2} \d{5}(-\d+)?$/
  const STREET_ANY_RE =
    /\b(\d{1,7}[\s-][A-Z][A-Za-z0-9'’. -]*?\s(?:St|Street|Ave|Avenue|Rd|Road|Ln|Lane|Dr|Drive|Ct|Court|Pl|Place|Blvd|Boulevard|Way|Ter|Terrace|Cir|Circle|Trl|Trail)\.?)\b/
  const CITY_ANY_RE = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*, [A-Z]{2} \d{5}(?:-\d+)?)\b/
  const BEDS_RE = /(\d+(?:\.\d+)?)\s*(?:beds?|bd)\b/i
  const BATHS_RE = /(\d+(?:\.\d+)?)\s*(?:baths?|full baths?|ba)\b/i
  const SQFT_RE = /([\d,]+)\s*(?:sq\.?\s?ft\.?|sqft)\b/i

  function toNumber(value) {
    if (value == null) return null
    const n = Number(String(value).replace(/[^\d.]/g, ''))
    return Number.isFinite(n) && value !== '' ? n : null
  }

  function textOf(el) {
    return el.innerText || el.textContent || ''
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
      const m = full.match(STREET_ANY_RE)
      address = m ? m[1].trim() : null
    }
    if (!address) return null
    if (!location) {
      const m = full.match(CITY_ANY_RE)
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

  /** Cards by Zillow's known attributes (fast path). */
  function knownCards() {
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
    return []
  }

  /**
   * Cards via their listing links: any anchor to a /homes/ page, grouped by
   * the nearest list item / article / section (or parent as a last resort).
   * Survives class-name changes, since the link is Zillow's stable contract.
   */
  function anchorCards() {
    const cards = new Map()
    const anchors = document.querySelectorAll('a[href*="/homes/"]')
    for (const a of anchors) {
      const card = a.closest('li, article, section') || a.parentElement
      if (!card) continue
      if (!PRICE_RE.test(textOf(card))) continue
      if (!cards.has(a.href)) cards.set(a.href, card)
    }
    return Array.from(cards.values())
  }

  /**
   * Last resort: walk from each price text node up to the smallest ancestor
   * that also holds a /homes/ link. Works even when the card markup uses
   * plain divs with no recognizable class or list structure.
   */
  function climbCards() {
    const cards = new Map()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      if (!PRICE_REAL_RE.test(node.textContent || '')) continue
      let el = node.parentElement
      while (el && el !== document.body) {
        const link = el.querySelector ? el.querySelector('a[href*="/homes/"]') : null
        if (link) {
          if (!cards.has(link.href)) cards.set(link.href, el)
          break
        }
        el = el.parentElement
      }
    }
    return Array.from(cards.values())
  }

  /** All listings visible on this page, deduped, capped at 100. */
  function extractListings() {
    let cards = knownCards()
    if (cards.length === 0) cards = anchorCards()
    if (cards.length === 0) cards = climbCards()

    const out = []
    const seen = new Set()
    for (const card of cards) {
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

  /** Pure (so it is unit-tested): pick the message for an empty extraction. */
  function notFoundMessage({ path, search, mapVisible }) {
    const looksLikeSearch = /\/homes\//.test(path) || /searchQueryState/.test(search)
    if (!looksLikeSearch) {
      return 'This does not look like a Zillow search results page. Open a search (a place or a map) and run this again.'
    }
    if (mapVisible) {
      return 'The map is showing but no listings are loaded. Open the results list (the list icon, top left), wait for it to load, then run this again.'
    }
    return 'No listings are loaded on this page yet. Wait for the list to finish loading and run this again.'
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  function panelButton(label, onClick) {
    const b = document.createElement('button')
    b.textContent = label
    Object.assign(b.style, {
      border: '1px solid rgba(255,255,255,.35)',
      borderRadius: '8px',
      background: 'rgba(255,255,255,.12)',
      color: '#fff',
      padding: '6px 12px',
      font: '600 13px/1.2 system-ui, sans-serif',
      cursor: 'pointer',
    })
    b.addEventListener('click', () => {
      try {
        onClick(b)
      } catch {
        b.textContent = 'Failed'
      }
    })
    return b
  }

  /** Fixed panel: the result plus Copy/Download buttons (user-gesture safe). */
  function showPanel(payload, statusText, isError) {
    const el = document.createElement('div')
    el.className = 'zillow-extract-panel'
    el.setAttribute('role', 'status')
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '2147483647',
      top: '16px',
      right: '16px',
      maxWidth: '380px',
      background: isError ? '#3d1214' : '#101418',
      color: '#fff',
      border: '1px solid rgba(255,255,255,.18)',
      borderRadius: '10px',
      padding: '12px 14px',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 16px rgba(0,0,0,.4)',
    })

    const title = document.createElement('div')
    title.textContent = payload.listings.length
      ? `Found ${payload.listings.length} listing${payload.listings.length === 1 ? '' : 's'}`
      : 'No listings found'
    Object.assign(title.style, { fontWeight: '700', fontSize: '14px', marginBottom: '6px' })
    el.appendChild(title)

    const status = document.createElement('div')
    status.textContent = statusText
    Object.assign(status.style, { fontSize: '12.5px', lineHeight: '1.45', marginBottom: '4px' })
    el.appendChild(status)

    if (payload.listings.length > 0) {
      const row = document.createElement('div')
      Object.assign(row.style, { display: 'flex', gap: '8px', marginTop: '8px' })
      const json = JSON.stringify(payload, null, 2)
      const copyBtn = panelButton('Copy JSON', async (b) => {
        try {
          await navigator.clipboard.writeText(json)
          b.textContent = 'Copied ✓'
        } catch {
          b.textContent = 'Copy blocked — use Download'
        }
      })
      const downloadBtn = panelButton('Download .json', (b) => {
        if (typeof URL.createObjectURL !== 'function') {
          b.textContent = 'Download unavailable'
          return
        }
        const blob = new Blob([json], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `zillow-listings-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
        b.textContent = 'Downloaded ✓'
      })
      row.appendChild(copyBtn)
      row.appendChild(downloadBtn)
      el.appendChild(row)
    }

    document.body.appendChild(el)
    setTimeout(() => el.remove(), 60000)
  }

  /**
   * Poll for the listing cards (Zillow is a React app; the list hydrates a
   * moment after load), then extract, copy, download, and show the panel.
   * Polling cadence is overridable for tests:
   *   window.__ZILLOW_EXTRACT_POLL__ = { everyMs: 20, maxPolls: 20 }
   */
  async function run() {
    const poll = window.__ZILLOW_EXTRACT_POLL__ || { everyMs: 500, maxPolls: 20 }
    let listings = []
    for (let attempt = 0; attempt < poll.maxPolls; attempt++) {
      listings = extractListings()
      if (listings.length > 0) break
      if (attempt < poll.maxPolls - 1) await sleep(poll.everyMs)
    }

    const payload = { source: location.href, fetchedAt: Date.now(), listings }
    if (listings.length === 0) {
      showPanel(
        payload,
        notFoundMessage({
          path: location.pathname,
          search: location.search,
          mapVisible: !!document.querySelector('canvas, [class*="map" i]'),
        }),
        true,
      )
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
        /* the panel's buttons remain available */
      }
    }
    showPanel(
      payload,
      copied
        ? 'Copied to the clipboard. Paste them in BRRR Calculator (Find listings).'
        : 'Use the buttons above to copy or download, then import in BRRR Calculator (Find listings).',
      false,
    )
    return payload
  }

  // Exposed for tests (the app page runs the script top-to-bottom instead).
  window.__zillowExtract = { extractListings, run, notFoundMessage }
  // The test suite sets this flag before evaluating the script so it can
  // inspect the API without the side effects of a real run.
  return window.__ZILLOW_EXTRACT_NO_AUTO_RUN__ ? undefined : run()
})()
