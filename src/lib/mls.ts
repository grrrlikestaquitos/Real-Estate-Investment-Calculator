/**
 * NWMLS (Matrix) CSV exports → listings. Pure parsing, so the same code runs
 * at build time (vite.config.ts bundles the files in Data/) and in the browser
 * (a CSV the user imports). Agent-only remarks are never read: they hold
 * showing instructions and contact details that do not belong on a web page.
 */

export type PropertyType = 'house' | 'townhouse' | 'condo' | 'manufactured' | 'other'

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: 'House',
  townhouse: 'Townhouse',
  condo: 'Condo',
  manufactured: 'Manufactured',
  other: 'Other',
}

/** Things in the public remarks an investor would want to know about. */
export type ListingFlag =
  | 'adu'
  | 'separateEntrance'
  | 'fixer'
  | 'investor'
  | 'rental'
  | 'bankOwned'
  | 'auction'
  | 'newConstruction'
  | 'seniors'
  | 'cashOnly'
  | 'updated'

export const FLAG_LABELS: Record<ListingFlag, string> = {
  adu: 'ADU / DADU',
  separateEntrance: 'Separate entrance / in-law',
  fixer: 'Fixer / as-is',
  investor: 'Investor special',
  rental: 'Rental history',
  bankOwned: 'Bank owned',
  auction: 'Auction',
  newConstruction: 'New construction',
  seniors: '55+ community',
  cashOnly: 'Cash only',
  updated: 'Updated / remodeled',
}

/** Flags that point at upside (extra income, forced appreciation, a motivated seller). */
export const VALUE_ADD_FLAGS: readonly ListingFlag[] = [
  'adu',
  'separateEntrance',
  'fixer',
  'investor',
  'bankOwned',
]

/** Flags that limit who can buy or rent the property, or how it can be financed. */
export const CAUTION_FLAGS: readonly ListingFlag[] = ['seniors', 'cashOnly', 'auction']

export interface MlsListing {
  /** NWMLS listing number. */
  id: string
  address: string
  city: string
  zip: string
  /** NWMLS area, e.g. "740 - Everett/Mukilteo". */
  area: string
  price: number
  originalPrice: number
  sqft: number | null
  lotSqft: number | null
  yearBuilt: number | null
  /** Bedrooms, from the remarks ("3-bedroom") or else the per-level counts. */
  beds: number | null
  /**
   * True when `beds` is only a floor: the export leaves upper-level bedrooms
   * out, so the per-level counts undercount most multi-story homes.
   */
  bedsAtLeast: boolean
  /** Full baths + ¾ baths (0.75) + half baths (0.5). */
  baths: number | null
  type: PropertyType
  /** The NWMLS style, e.g. "2 Story", "Townhouse". */
  style: string
  /** HOA dues normalized to a monthly amount (0 when none). */
  hoaMonthly: number
  /** Cumulative days on market (across relists). */
  daysOnMarket: number | null
  /** Listing date as YYYY-MM-DD. */
  listedOn: string | null
  status: string
  view: string
  waterfront: string
  basement: string
  garageSpaces: number | null
  community: string
  remarks: string
  flags: ListingFlag[]
  /**
   * Other listing numbers for the same address (an agent sometimes lists one
   * home twice, e.g. as a house and as a condo). Filled in by mergeDatasets.
   */
  alsoListedAs?: { id: string; type: PropertyType }[]
  /** Map position from Data/geocodes.json (scripts/geocode.mjs), when the address was found. */
  lat?: number
  lng?: number
}

/**
 * Parse CSV text (RFC 4180: quoted fields, doubled quotes, newlines inside
 * quotes, CRLF or LF). Returns rows of raw cells; a trailing blank line is dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function num(value: string | undefined): number | null {
  if (value == null) return null
  const cleaned = value.replace(/[$,\s]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function positive(value: string | undefined): number | null {
  const n = num(value)
  return n != null && n > 0 ? n : null
}

/** "10/9/2026 12:00:00 AM" → "2026-10-09". */
function isoDate(value: string | undefined): string | null {
  const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, m, d, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** NWMLS style code ("32 - Townhouse") → a property type investors screen by. */
export function propertyTypeFromStyle(style: string): PropertyType {
  const s = style.toLowerCase()
  if (s.includes('townhouse')) return 'townhouse'
  if (s.includes('condo')) return 'condo'
  if (s.includes('manuf')) return 'manufactured'
  if (s.includes('floating')) return 'other'
  return s.trim() === '' ? 'other' : 'house'
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
const BEDS_IN_TEXT = /\b(\d|one|two|three|four|five|six)[\s-]*(?:bed(?:room)?s?|bd|br)\b/i

/** The first "3-bedroom" / "4 bed" / "three bedroom" in the remarks, which is nearly always the home's total. */
export function bedsFromRemarks(remarks: string): number | null {
  const match = remarks.match(BEDS_IN_TEXT)
  if (!match) return null
  const word = match[1].toLowerCase()
  return NUMBER_WORDS[word] ?? Number(word)
}

const FLAG_PATTERNS: [ListingFlag, RegExp][] = [
  ['adu', /\b(d?adu|accessory dwelling|backyard cottage)\b/i],
  ['separateEntrance', /separate entr|private entr|mother[- ]in[- ]law|in[- ]law|guest suite|multi[- ]gen/i],
  ['fixer', /\bfixer|\bas[- ]is\b|\btlc\b|handyman|sweat equity|needs work|bring your (tools|vision|ideas)/i],
  ['investor', /\binvestors?\b|cash flow|income potential|rental income/i],
  ['rental', /\b(currently rented|tenant[- ]occupied|tenants? in place|leased until|rented until)\b/i],
  ['seniors', /\b55\s?\+|\b55 and older|senior (community|living)/i],
  ['cashOnly', /\bcash only\b|cash buyers? only/i],
  [
    'updated',
    /\b(remodel(ed|ing)?|renovat(ed|ion)|fully updated|newly updated|new (roof|furnace|windows|kitchen|flooring|carpet|paint)|move[- ]in ready)\b/i,
  ],
]

function flagsFor(
  remarks: string,
  row: Record<string, string>,
  yearBuilt: number | null,
  listedOn: string | null,
): ListingFlag[] {
  const flags = FLAG_PATTERNS.filter(([, re]) => re.test(remarks)).map(([flag]) => flag)
  if (row.BankOrRealEstateOwned === 'True') flags.push('bankOwned')
  if (row.Auction === 'True') flags.push('auction')
  // Built the year it was listed or the year before.
  const listedYear = listedOn ? Number(listedOn.slice(0, 4)) : new Date().getFullYear()
  if (yearBuilt != null && yearBuilt >= listedYear - 1) flags.push('newConstruction')
  return flags
}

const PER_YEAR: Record<string, number> = { monthly: 12, quarterly: 4, annually: 1, 'semi-annually': 2 }

function hoaMonthly(dues: string | undefined, frequency: string | undefined): number {
  const amount = num(dues)
  if (amount == null || amount <= 0) return 0
  const perYear = PER_YEAR[(frequency ?? '').trim().toLowerCase()] ?? 12
  return (amount * perYear) / 12
}

function streetAddress(row: Record<string, string>): string {
  const parts = [
    row.StreetNumber,
    row.StreetNumberModifier,
    row.StreetDirection,
    row.StreetName,
    row.StreetSuffix,
    row.StreetPostDirection,
  ]
  const street = parts.map((p) => (p ?? '').trim()).filter(Boolean).join(' ')
  const unit = (row.Unit ?? '').trim()
  return unit ? `${street} #${unit}` : street
}

/** One CSV row (keyed by header) → a listing, or null when it lacks a price or address. */
export function normalizeMlsRow(row: Record<string, string>): MlsListing | null {
  const price = positive(row.CurrentPrice) ?? positive(row.ListingPrice)
  const address = streetAddress(row)
  const id = (row.ListingNumber ?? '').trim()
  if (price == null || !address || !id) return null

  const remarks = (row.MarketingComments ?? '').trim()
  const yearBuilt = positive(row.YearBuilt)
  const style = (row.StyleCode ?? '').replace(/^\d+\s*-\s*/, '').trim()
  const levelBeds = ['BedroomsMain', 'BedroomsLower', 'BedroomsUpper']
    .map((k) => num(row[k]) ?? 0)
    .reduce((a, b) => a + b, 0)
  const textBeds = bedsFromRemarks(remarks)
  const beds = Math.max(levelBeds, textBeds ?? 0) || null
  const bedsAtLeast = beds != null && textBeds == null
  const full = num(row.BathsFullTotal) ?? 0
  const threeQuarter = num(row.BathsThreeQuarterTotal) ?? 0
  const half = num(row.BathsHalfTotal) ?? 0
  const baths = full + threeQuarter * 0.75 + half * 0.5 || null
  // Lot sizes of 0/1 sq ft are placeholders the export uses for "none" (condos, townhomes).
  const lot = positive(row.LotSquareFootage)
  const listedOn = isoDate(row.ListingDate)

  return {
    id,
    address,
    city: (row.City ?? '').trim(),
    zip: (row.ZipCode ?? '').trim(),
    area: (row.Area ?? '').replace(/​/g, '').trim(),
    price,
    originalPrice: positive(row.OriginalPrice) ?? price,
    sqft: positive(row.SquareFootageFinished) ?? positive(row.SquareFootage),
    lotSqft: lot != null && lot > 1 ? lot : null,
    yearBuilt,
    beds,
    bedsAtLeast,
    baths,
    type: propertyTypeFromStyle(style),
    style,
    hoaMonthly: hoaMonthly(row.AssociationDues, row.AssociationFeeFrequency),
    daysOnMarket: num(row.CDOM) ?? num(row.DOM),
    listedOn,
    status: (row.Status ?? '').trim(),
    view: (row.View ?? '').trim(),
    waterfront: (row.Waterfront ?? '').trim(),
    basement: (row.Basement ?? '').trim() === 'None' ? '' : (row.Basement ?? '').trim(),
    garageSpaces: num(row.ParkingCoveredTotal),
    community: (row.BuildingComplexOrProjectName ?? '').trim(),
    remarks,
    flags: flagsFor(remarks, row, yearBuilt, listedOn),
  }
}

/** The key a listing's position is saved under in Data/geocodes.json. */
export function geocodeKey(listing: Pick<MlsListing, 'address' | 'zip'>): string {
  return `${listing.address.toLowerCase().replace(/\s+/g, ' ')}|${listing.zip}`
}

/** Parse an NWMLS CSV export. Null when it isn't one (no ListingNumber/price columns). */
export function parseMlsCsv(text: string): MlsListing[] | null {
  const [header, ...rows] = parseCsv(text)
  if (!header) return null
  const keys = header.map((h) => h.trim())
  if (!keys.includes('ListingNumber') || !(keys.includes('CurrentPrice') || keys.includes('ListingPrice'))) {
    return null
  }
  const listings: MlsListing[] = []
  for (const cells of rows) {
    const record: Record<string, string> = {}
    keys.forEach((key, i) => {
      record[key] = cells[i] ?? ''
    })
    const listing = normalizeMlsRow(record)
    if (listing) listings.push(listing)
  }
  return listings
}

/** A named set of listings: one CSV file. */
export interface MlsDataset {
  /** Stable key (the file name without extension). */
  id: string
  name: string
  listings: MlsListing[]
}

/**
 * Union of several datasets: de-duplicated by listing number (first one wins),
 * then listings of the same address and ZIP folded into one card. NWMLS often
 * lists a home twice — once as residential and once as a condo — so the
 * non-condo listing is kept and the others are recorded in `alsoListedAs`.
 */
export function mergeDatasets(datasets: readonly MlsDataset[]): MlsListing[] {
  const seenIds = new Set<string>()
  const byAddress = new Map<string, number>()
  const merged: MlsListing[] = []
  for (const dataset of datasets) {
    for (const listing of dataset.listings) {
      if (seenIds.has(listing.id)) continue
      seenIds.add(listing.id)
      const key = geocodeKey(listing)
      const index = byAddress.get(key)
      if (index == null) {
        byAddress.set(key, merged.length)
        merged.push({ ...listing, alsoListedAs: [] })
        continue
      }
      const kept = merged[index]
      const others = kept.alsoListedAs ?? []
      if (kept.type === 'condo' && listing.type !== 'condo') {
        merged[index] = {
          ...listing,
          alsoListedAs: [...others, { id: kept.id, type: kept.type }],
        }
      } else {
        kept.alsoListedAs = [...others, { id: listing.id, type: listing.type }]
      }
    }
  }
  return merged
}

/** Listings with their map position attached, where the address has one. */
export function withPositions(
  listings: MlsListing[],
  points: Readonly<Record<string, readonly [number, number]>>,
): MlsListing[] {
  return listings.map((listing) => {
    const point = points[geocodeKey(listing)]
    return point ? { ...listing, lat: point[0], lng: point[1] } : listing
  })
}
