/**
 * Screening MLS listings for investment: comps, estimated rent and returns,
 * and a 0–100 score that ranks which listings deserve a closer look. Returns
 * use the same cash-flow math as a deal (calculations.ts), so a listing opened
 * as a deal shows the numbers it was ranked by.
 */
import {
  monthlyCashFlowItemized,
  monthlyMortgagePayment,
  monthlyOperatingExpenses,
} from './calculations'
import {
  CAUTION_FLAGS,
  FLAG_LABELS,
  PROPERTY_TYPE_LABELS,
  VALUE_ADD_FLAGS,
  type MlsListing,
  type PropertyType,
} from './mls'
import { REGIONAL_MEDIAN_RATE_PERCENT, TAX_RATE_ENTRIES, perThousandToPercent } from './taxRates'
import { DEFAULT_INPUTS, type DealInputs } from './types'

/** What the user assumes about financing and running every listing as a rental. */
export interface ScreenAssumptions {
  downPct: number
  rate: number
  termYears: number
  /** Monthly rent per finished square foot, up to RENT_TAPER_SQFT (half that beyond). */
  rentPerSqft: number
  vacancyPct: number
  repairsPct: number
  managementPct: number
  /** Insurance per year, as a percent of the price. */
  insurancePct: number
  /** Closing costs, as a percent of the price. */
  closingPct: number
}

export const DEFAULT_ASSUMPTIONS: ScreenAssumptions = {
  downPct: 20,
  rate: 6.5,
  termYears: 30,
  rentPerSqft: 2,
  vacancyPct: 5,
  repairsPct: 8,
  managementPct: 8,
  insurancePct: 0.3,
  closingPct: 2,
}

/** Fewest listings a comp group needs before its median is trusted. */
export const MIN_COMPS = 5

export interface CompGroup {
  /** e.g. "Everett townhouses", "all houses". */
  label: string
  medianPricePerSqft: number
  count: number
}

export interface Reason {
  tone: 'good' | 'bad'
  text: string
}

export interface ListingAnalysis {
  listing: MlsListing
  pricePerSqft: number | null
  comps: CompGroup | null
  /** Percent below the comp median $/sqft (negative = above it). */
  discountPct: number | null
  /** Percent the price has dropped from the original list price. */
  priceCutPct: number
  taxRatePercent: number
  /** True when the city isn't in the tax table and the regional median was used. */
  taxRateEstimated: boolean
  rent: number | null
  /** Principal + interest. */
  payment: number | null
  cashFlow: number | null
  /** Net operating income per year as a percent of the price. */
  capRate: number | null
  cashNeeded: number
  cashOnCash: number | null
  /** Monthly rent as a percent of the price (the 1% rule's input). */
  rentToPrice: number | null
  score: number
  reasons: Reason[]
  /** The deal a "New deal" button starts from this listing. */
  dealInputs: DealInputs
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function pricePerSqft(listing: MlsListing): number | null {
  return listing.sqft != null && listing.sqft > 0 ? listing.price / listing.sqft : null
}

const PLURAL: Record<PropertyType, string> = {
  house: 'houses',
  townhouse: 'townhouses',
  condo: 'condos',
  manufactured: 'manufactured homes',
  other: 'other homes',
}

/**
 * Comp groups for every listing: the median $/sqft of the same property type
 * in the same city, falling back to that type everywhere, then to everything,
 * whenever a group has fewer than MIN_COMPS listings.
 */
export function buildComps(listings: readonly MlsListing[]): (listing: MlsListing) => CompGroup | null {
  const byKey = new Map<string, number[]>()
  const add = (key: string, value: number) => {
    const list = byKey.get(key)
    if (list) list.push(value)
    else byKey.set(key, [value])
  }
  for (const listing of listings) {
    const ppsf = pricePerSqft(listing)
    if (ppsf == null) continue
    add(`city:${listing.city.toLowerCase()}|${listing.type}`, ppsf)
    add(`type:${listing.type}`, ppsf)
    add('all', ppsf)
  }
  const cache = new Map<string, CompGroup | null>()
  const group = (key: string, label: string): CompGroup | null => {
    if (cache.has(key)) return cache.get(key) ?? null
    const values = byKey.get(key)
    const result =
      values && values.length >= MIN_COMPS
        ? { label, medianPricePerSqft: median(values), count: values.length }
        : null
    cache.set(key, result)
    return result
  }
  return (listing) =>
    group(`city:${listing.city.toLowerCase()}|${listing.type}`, `${listing.city} ${PLURAL[listing.type]}`) ??
    group(`type:${listing.type}`, `all ${PLURAL[listing.type]}`) ??
    group('all', 'all listings')
}

const TAX_BY_CITY = new Map(TAX_RATE_ENTRIES.map((e) => [e.city.toLowerCase(), e]))

/** The city's property tax rate (percent) from the tax table, or the regional median. */
export function taxRateForCity(city: string): { rate: number; estimated: boolean } {
  const entry = TAX_BY_CITY.get(city.trim().toLowerCase())
  return entry
    ? { rate: perThousandToPercent(entry.useRatePer1000), estimated: false }
    : { rate: REGIONAL_MEDIAN_RATE_PERCENT, estimated: true }
}

/** Square feet past which each extra foot adds half as much rent (big homes rent for less per foot). */
export const RENT_TAPER_SQFT = 1500

/** Rent from the size, rounded to $25 (null without a size). */
export function estimateRent(listing: MlsListing, rentPerSqft: number): number | null {
  if (listing.sqft == null || !(rentPerSqft > 0)) return null
  const full = Math.min(listing.sqft, RENT_TAPER_SQFT)
  const tapered = Math.max(0, listing.sqft - RENT_TAPER_SQFT)
  return Math.round(((full + tapered / 2) * rentPerSqft) / 25) * 25
}

/** Deal inputs for this listing under the assumptions. */
export function dealInputsFor(listing: MlsListing, a: ScreenAssumptions): DealInputs {
  const { rate } = taxRateForCity(listing.city)
  const round = (n: number) => Math.round(n)
  return {
    ...DEFAULT_INPUTS,
    propertyValue: listing.price,
    propertySize: listing.sqft,
    propertyTax: rate,
    rentValue: estimateRent(listing, a.rentPerSqft),
    loanValue: round(listing.price * (1 - a.downPct / 100)),
    loanRate: a.rate,
    loanTerm: a.termYears,
    closingCost: round((listing.price * a.closingPct) / 100),
    additionalMonthlyFees: listing.hoaMonthly > 0 ? round(listing.hoaMonthly) : null,
    insuranceAnnual: round((listing.price * a.insurancePct) / 100),
    vacancyRate: a.vacancyPct,
    managementRate: a.managementPct,
    maintenanceRate: a.repairsPct,
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
/** 0 at `lo`, `points` at `hi`, linear between. */
const scale = (value: number, lo: number, hi: number, points: number) =>
  clamp((value - lo) / (hi - lo), 0, 1) * points

/** Lots this big can often take an ADU/DADU (and a big yard rents well). */
export const LARGE_LOT_SQFT = 7200

const pct = (n: number) => `${Math.round(n)}%`
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/**
 * Score points (max 100):
 * - value (35): $/sqft from 15% above to 20% below the comps
 * - return (25): cap rate from 2% to 5.5%
 * - motivation (20): price cut up to 10% (12) and days on market up to 120 (8)
 * - upside (20): value-add mentions, 6 each up to 15, and a large house lot (5)
 * Minus up to 10 for HOA dues, 10 per restriction (55+, cash only, auction),
 * and 5 for manufactured homes (harder to finance and appreciate).
 */
export function analyzeListing(
  listing: MlsListing,
  comps: CompGroup | null,
  a: ScreenAssumptions,
): ListingAnalysis {
  const ppsf = pricePerSqft(listing)
  const discountPct =
    ppsf != null && comps ? (1 - ppsf / comps.medianPricePerSqft) * 100 : null
  const priceCutPct =
    listing.originalPrice > listing.price
      ? ((listing.originalPrice - listing.price) / listing.originalPrice) * 100
      : 0
  const tax = taxRateForCity(listing.city)
  const inputs = dealInputsFor(listing, a)
  const rent = inputs.rentValue
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  const cashFlow = monthlyCashFlowItemized(inputs, payment)
  const opex = monthlyOperatingExpenses(inputs)
  const noi = rent != null && opex != null ? rent - opex - listing.hoaMonthly : null
  const capRate = noi != null ? ((noi * 12) / listing.price) * 100 : null
  const cashNeeded = listing.price - (inputs.loanValue ?? 0) + (inputs.closingCost ?? 0)
  const cashOnCash = cashFlow != null && cashNeeded > 0 ? ((cashFlow * 12) / cashNeeded) * 100 : null
  const rentToPrice = rent != null ? (rent / listing.price) * 100 : null

  const reasons: Reason[] = []
  let score = 0

  if (discountPct != null && comps) {
    score += scale(discountPct, -15, 20, 35)
    if (discountPct >= 5) {
      reasons.push({ tone: 'good', text: `${pct(discountPct)} below ${comps.label} $/sqft` })
    } else if (discountPct <= -10) {
      reasons.push({ tone: 'bad', text: `${pct(-discountPct)} above ${comps.label} $/sqft` })
    }
  }

  if (capRate != null) {
    score += scale(capRate, 2, 5.5, 25)
    if (capRate >= 4.5) reasons.push({ tone: 'good', text: `Cap rate ${capRate.toFixed(1)}%` })
  }

  score += scale(priceCutPct, 0, 10, 12)
  if (priceCutPct >= 3) {
    reasons.push({
      tone: 'good',
      text: `Price cut ${pct(priceCutPct)} (${money(listing.originalPrice - listing.price)})`,
    })
  }
  if (listing.daysOnMarket != null && !listing.flags.includes('newConstruction')) {
    score += scale(listing.daysOnMarket, 0, 120, 8)
    if (listing.daysOnMarket >= 60) {
      reasons.push({ tone: 'good', text: `${listing.daysOnMarket} days on market` })
    }
  }

  const valueAdd = listing.flags.filter((f) => VALUE_ADD_FLAGS.includes(f))
  score += Math.min(15, valueAdd.length * 6)
  for (const flag of valueAdd) reasons.push({ tone: 'good', text: FLAG_LABELS[flag] })
  if (listing.type === 'house' && listing.lotSqft != null && listing.lotSqft >= LARGE_LOT_SQFT) {
    score += 5
    reasons.push({ tone: 'good', text: `Large lot (${listing.lotSqft.toLocaleString('en-US')} sqft)` })
  }

  if (listing.hoaMonthly > 0) {
    score -= Math.min(10, listing.hoaMonthly / 40)
    if (listing.hoaMonthly >= 150) {
      reasons.push({ tone: 'bad', text: `HOA ${money(listing.hoaMonthly)}/mo` })
    }
  }
  for (const flag of listing.flags.filter((f) => CAUTION_FLAGS.includes(f))) {
    score -= 10
    reasons.push({ tone: 'bad', text: FLAG_LABELS[flag] })
  }
  if (listing.type === 'manufactured') {
    score -= 5
    reasons.push({ tone: 'bad', text: PROPERTY_TYPE_LABELS.manufactured })
  }

  return {
    listing,
    pricePerSqft: ppsf,
    comps,
    discountPct,
    priceCutPct,
    taxRatePercent: tax.rate,
    taxRateEstimated: tax.estimated,
    rent,
    payment,
    cashFlow,
    capRate,
    cashNeeded,
    cashOnCash,
    rentToPrice,
    score: Math.round(clamp(score, 0, 100)),
    reasons,
    dealInputs: inputs,
  }
}

/** Analyze every listing, with comps drawn from the whole set. */
export function analyzeListings(
  listings: readonly MlsListing[],
  a: ScreenAssumptions,
): ListingAnalysis[] {
  const compsFor = buildComps(listings)
  return listings.map((listing) => analyzeListing(listing, compsFor(listing), a))
}

/** The user's filters. Null/empty means "no limit". */
export interface ScreenFilters {
  minPrice: number | null
  maxPrice: number | null
  types: PropertyType[]
  /** Cities to include (empty = every city). */
  cities: string[]
  minSqft: number | null
  minBeds: number | null
  maxHoa: number | null
  priceCutOnly: boolean
  valueAddOnly: boolean
  hideRestricted: boolean
  shortlistOnly: boolean
}

export const DEFAULT_FILTERS: ScreenFilters = {
  minPrice: null,
  maxPrice: null,
  types: [],
  cities: [],
  minSqft: null,
  minBeds: null,
  maxHoa: null,
  priceCutOnly: false,
  valueAddOnly: false,
  hideRestricted: true,
  shortlistOnly: false,
}

export function matchesFilters(
  analysis: ListingAnalysis,
  f: ScreenFilters,
  shortlist: ReadonlySet<string>,
): boolean {
  const l = analysis.listing
  if (f.minPrice != null && l.price < f.minPrice) return false
  if (f.maxPrice != null && l.price > f.maxPrice) return false
  if (f.types.length > 0 && !f.types.includes(l.type)) return false
  if (f.cities.length > 0 && !f.cities.includes(l.city)) return false
  if (f.minSqft != null && (l.sqft ?? 0) < f.minSqft) return false
  // An "at least" bedroom count can't rule a listing out: it may have more.
  if (f.minBeds != null && !l.bedsAtLeast && (l.beds ?? 0) < f.minBeds) return false
  if (f.maxHoa != null && l.hoaMonthly > f.maxHoa) return false
  if (f.priceCutOnly && analysis.priceCutPct <= 0) return false
  if (f.valueAddOnly && !l.flags.some((flag) => VALUE_ADD_FLAGS.includes(flag))) return false
  if (f.hideRestricted && l.flags.some((flag) => CAUTION_FLAGS.includes(flag))) return false
  if (f.shortlistOnly && !shortlist.has(l.id)) return false
  return true
}

export type SortKey =
  | 'score'
  | 'discount'
  | 'cashFlow'
  | 'capRate'
  | 'price'
  | 'pricePerSqft'
  | 'priceCut'
  | 'daysOnMarket'
  | 'newest'

export const SORT_LABELS: Record<SortKey, string> = {
  score: 'Score',
  discount: 'Below comps',
  cashFlow: 'Cash flow',
  capRate: 'Cap rate',
  price: 'Price (low → high)',
  pricePerSqft: '$/sqft (low → high)',
  priceCut: 'Price cut',
  daysOnMarket: 'Days on market',
  newest: 'Newest',
}

/** The value a sort key ranks by, oriented so higher always sorts first. */
function sortValue(a: ListingAnalysis, key: SortKey): number | null {
  switch (key) {
    case 'score':
      return a.score
    case 'discount':
      return a.discountPct
    case 'cashFlow':
      return a.cashFlow
    case 'capRate':
      return a.capRate
    case 'price':
      return -a.listing.price
    case 'pricePerSqft':
      return a.pricePerSqft == null ? null : -a.pricePerSqft
    case 'priceCut':
      return a.priceCutPct
    case 'daysOnMarket':
      return a.listing.daysOnMarket
    case 'newest':
      return a.listing.listedOn ? Date.parse(a.listing.listedOn) : null
  }
}

/** Sorted copy, best first; listings missing the value go last. Ties keep score order. */
export function sortAnalyses(analyses: readonly ListingAnalysis[], key: SortKey): ListingAnalysis[] {
  return [...analyses].sort((x, y) => {
    const a = sortValue(x, key)
    const b = sortValue(y, key)
    if (a == null && b == null) return y.score - x.score
    if (a == null) return 1
    if (b == null) return -1
    return b - a || y.score - x.score
  })
}
