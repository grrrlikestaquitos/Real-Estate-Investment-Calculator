/*
 * Zillow listing extractor.
 *
 * Runs in YOUR browser, on a Zillow search results page. It reads the listings
 * shown on the page (auto-scrolling the list to load more when it appears to
 * lazy-load), copies them to the clipboard as JSON, downloads them as a .json
 * file, and shows a small panel with Copy/Download buttons (clicking those
 * works even where the console can't write the clipboard directly, e.g.
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
  const COMBINED_LINE_RE =
    /^(.*?),\s*([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2}\s+\d{5}(?:-\d+)?)$/
  const BEDS_RE = /(\d+(?:\.\d+)?)\s*(?:beds?|bd)\b/i
  const BATHS_RE = /(\d+(?:\.\d+)?)\s*(?:baths?|full baths?|ba)\b/i
  const SQFT_RE = /([\d,]+)\s*(?:sq\.?\s?ft\.?|sqft)\b/i
  const HOMES_SELECTOR = 'a[href*="/homes/"]'
  const CAP = 100

  function toNumber(value) {
    if (value == null) return null
    const n = Number(String(value).replace(/[^\d.]/g, ''))
    return Number.isFinite(n) && value !== '' ? n : null
  }

  /**
   * Card text with real line breaks: consecutive text nodes sharing the same
   * parent form one line, and lines are joined with newlines. Unlike innerText
   * (absent in some DOMs), this is deterministic everywhere, so "123 Pine St"
   * and "Seattle, WA 98101" never smear into "StSeattle".
   */
  function cardText(el) {
    return textLines(el).join('\n')
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
    // A line like "123 Pine St, Seattle, WA 98101" carries both at once.
    const combined = address.match(COMBINED_LINE_RE)
    if (combined) {
      const street = combined[1].trim()
      if (street) address = street
      location = combined[2]
    }
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
      card.querySelector(HOMES_SELECTOR)

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

  /** Number of distinct /homes/ link targets inside an element. */
  function distinctHomesHrefs(el) {
    const hrefs = new Set()
    for (const a of el.querySelectorAll(HOMES_SELECTOR)) hrefs.add(a.href)
    return hrefs.size
  }

  /**
   * Cards by Zillow's known attributes (fast path). An element holding more
   * than one distinct listing link is a list CONTAINER, not a card — the class
   * substring can match a list wrapper, so those are filtered out.
   */
  function knownCards() {
    const selectors = [
      '[data-test="search-result"]',
      '.SearchResultsPropertyCard__item',
      'li.SearchResultsPropertyCard__item',
      '[class*="SearchResultsPropertyCard"]',
    ]
    for (const selector of selectors) {
      const els = document.querySelectorAll(selector)
      if (!els.length) continue
      const kept = Array.from(els).filter((el) => distinctHomesHrefs(el) < 2)
      if (kept.length) return kept
    }
    return []
  }

  /**
   * The smallest ancestor of a listing link that has a price and a street and
   * points at exactly one listing. Survives class-name changes, since the
   * /homes/ link is Zillow's stable contract.
   */
  function smallestCardFor(anchor) {
    let el = anchor.parentElement
    while (el && el !== document.body) {
      if (distinctHomesHrefs(el) > 1) return null
      const text = cardText(el)
      if (PRICE_REAL_RE.test(text) && (STREET_ANY_RE.test(text) || STREET_RE.test(text))) {
        return el
      }
      el = el.parentElement
    }
    return null
  }

  /** Cards via their listing links, deduped by link target. */
  function anchorCards() {
    const cards = new Map()
    for (const a of document.querySelectorAll(HOMES_SELECTOR)) {
      if (cards.has(a.href)) continue
      const card = smallestCardFor(a)
      if (card) cards.set(a.href, card)
    }
    return Array.from(cards.values())
  }

  /**
   * Last resort for pages with no recognizable card structure: climb from each
   * price text node up to a small element that also holds a street address.
   * Works on plain divs with no links and no recognizable classes.
   */
  function clusterCards() {
    const cards = new Map()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      if (!PRICE_REAL_RE.test(node.textContent || '')) continue
      let el = node.parentElement
      while (el && el !== document.body) {
        if ((el.textContent || '').length > 600) break
        const text = cardText(el)
        if ((text.match(PRICE_REAL_RE) || []).length > 2) break
        if (STREET_ANY_RE.test(text) || STREET_RE.test(text)) {
          if (!cards.has(el)) cards.set(el, el)
          break
        }
        el = el.parentElement
      }
    }
    return Array.from(cards.values())
  }

  function extractRows(cards) {
    const out = []
    const seen = new Set()
    for (const card of cards) {
      const row = extractFromCard(card)
      if (!row) continue
      const key = `${row.price}|${row.address}|${row.url}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(row)
      if (out.length >= CAP) break
    }
    return out
  }

  /**
   * All listings visible on this page, deduped, capped at CAP. The three
   * discovery layers are tried in order; the most productive wins, so a
   * container mis-match in layer one cannot cap the result at one card.
   */
  function extractListings() {
    const finders = [knownCards, anchorCards, clusterCards]
    let best = []
    for (const find of finders) {
      const rows = extractRows(find())
      if (rows.length > best.length) best = rows
      if (best.length >= 2) break
    }
    return best
  }

  function looksLikeSearchPage() {
    return /\/homes\//.test(location.pathname) || /searchQueryState/.test(location.search)
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

  /** Zillow's own count for this search ("13k homes for sale"), if visible. */
  function pageTotal() {
    const text = document.body ? document.body.innerText || document.body.textContent || '' : ''
    const m =
      text.match(/([\d,.]+)\s*(k|m)?\s+homes?\s+for sale/i) ||
      text.match(/([\d,.]+)\s*(k|m)?\s+homes?/i)
    if (!m) return null
    const n = Number(m[1].replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0) return null
    const mult = /m/i.test(m[2]) ? 1e6 : /k/i.test(m[2]) ? 1e3 : 1
    return Math.round(n * mult)
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  /** The scrollable element that holds the results list, if any. */
  function findScrollContainer() {
    const anchor = document.querySelector(HOMES_SELECTOR)
    if (!anchor) return null
    let el = anchor.parentElement
    while (el && el !== document.body) {
      const overflow = getComputedStyle(el).overflowY
      if (/(auto|scroll|overlay)/.test(overflow) && el.scrollHeight > el.clientHeight + 10) {
        return el
      }
      el = el.parentElement
    }
    return null
  }

  /**
   * Scroll the results list to load more cards (Zillow lazy-loads as you
   * scroll). Stops after `steps`, once nothing new appears twice in a row,
   * or at the cap.
   */
  async function loadMore(cfg) {
    const steps = cfg.scrollSteps ?? 10
    const pauseMs = cfg.scrollPauseMs ?? 600
    const stallLimit = cfg.scrollStall ?? 2
    const scroller = findScrollContainer()
    let prev = extractListings().length
    let stall = 0
    for (let i = 0; i < steps; i += 1) {
      if (prev >= CAP) break
      try {
        if (scroller) scroller.scrollTop = scroller.scrollHeight
        else window.scrollBy(0, Math.round(window.innerHeight * 0.9))
      } catch {
        break
      }
      await sleep(pauseMs)
      const now = extractListings().length
      if (now > prev) {
        prev = now
        stall = 0
      } else if (++stall >= stallLimit) {
        break
      }
    }
  }

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

    if (payload.total != null && payload.total > payload.listings.length) {
      const totalLine = document.createElement('div')
      totalLine.textContent = `Zillow lists ≈ ${payload.total.toLocaleString(
        'en-US',
      )} for this search — this holds the loaded listings (narrow the search or scroll for more).`
      Object.assign(totalLine.style, {
        fontSize: '12px',
        lineHeight: '1.45',
        opacity: '0.8',
        marginTop: '4px',
      })
      el.appendChild(totalLine)
    }

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
   * moment after load), auto-scroll for more if the page is a search that
   * lazy-loads, then extract, copy, download, and show the panel. Polling and
   * scroll cadence are overridable for tests:
   *   window.__ZILLOW_EXTRACT_POLL__ = {
   *     everyMs: 20, maxPolls: 5,
   *     scrollSteps: 2, scrollPauseMs: 10, scrollStall: 2,
   *     scroll: false
   *   }
   */
  async function run() {
    const cfg = window.__ZILLOW_EXTRACT_POLL__ || {
      everyMs: 500,
      maxPolls: 20,
      scrollSteps: 10,
      scrollPauseMs: 600,
      scrollStall: 2,
    }
    let listings = extractListings()
    let poll = 0
    while (listings.length === 0 && poll < cfg.maxPolls) {
      await sleep(cfg.everyMs)
      poll += 1
      listings = extractListings()
    }
    if (listings.length < 2 && cfg.scroll !== false && looksLikeSearchPage()) {
      const scroller = findScrollContainer()
      const doc = document.documentElement
      const moreToLoad =
        (scroller ? scroller.scrollHeight > scroller.clientHeight + 50 : false) ||
        (doc ? doc.scrollHeight > window.innerHeight + 50 : false)
      if (moreToLoad) {
        await loadMore(cfg)
        const after = extractListings()
        if (after.length > listings.length) listings = after
      }
    }

    const payload = {
      source: location.href,
      fetchedAt: Date.now(),
      total: pageTotal(),
      listings,
    }
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
  window.__zillowExtract = { extractListings, run, notFoundMessage, pageTotal }
  // The test suite sets this flag before evaluating the script so it can
  // inspect the API without the side effects of a real run.
  return window.__ZILLOW_EXTRACT_NO_AUTO_RUN__ ? undefined : run()
})()
