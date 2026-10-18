/**
 * Screening MLS listings from two perspectives — an investor buying a rental
 * and a homeowner buying a place to live — with size-matched comps, rent
 * estimates adjusted by ZIP, and a 0–100 score per perspective that ranks
 * which listings deserve a closer look. Money math reuses calculations.ts, so
 * a listing opened as a deal shows the numbers it was ranked by.
 */
import {
  frontRatio,
  monthlyCashFlowItemized,
  monthlyHousingCost,
  monthlyMortgagePayment,
  monthlyOperatingExpenses,
  monthlyOwnershipCost,
  monthlyPmi,
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
import { DEFAULT_INPUTS, type DealInputs, type DealType } from './types'
import zipStatsData from './zipStats.json'

/** Whose eyes the listings are screened through; matches a deal's type. */
export type Perspective = DealType

/** Financing and running every listing as a rental. */
export interface InvestorAssumptions {
  downPct: number
  rate: number
  termYears: number
  /**
   * Monthly rent per finished square foot for a typical ZIP in the data, up to
   * RENT_TAPER_SQFT (half that beyond); each listing's ZIP scales it.
   */
  rentPerSqft: number
  vacancyPct: number
  repairsPct: number
  managementPct: number
  /** Insurance per year, as a percent of the price. */
  insurancePct: number
  /** Closing costs, as a percent of the price. */
  closingPct: number
}

/** Financing a home to live in. */
export interface OwnerAssumptions {
  downPct: number
  rate: number
  termYears: number
  /** Gross household income per year (0 = not entered: affordability isn't scored). */
  householdIncome: number
  insurancePct: number
  closingPct: number
}

export const DEFAULT_INVESTOR_ASSUMPTIONS: InvestorAssumptions = {
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

export const DEFAULT_OWNER_ASSUMPTIONS: OwnerAssumptions = {
  downPct: 10,
  rate: 6.5,
  termYears: 30,
  householdIncome: 0,
  insurancePct: 0.3,
  closingPct: 2,
}

export type Assumptions =
  | { perspective: 'investment'; values: InvestorAssumptions }
  | { perspective: 'owner'; values: OwnerAssumptions }

// ---------------------------------------------------------------------------
// Comps
// ---------------------------------------------------------------------------

/** Fewest other listings a comp group needs before its median is trusted. */
export const MIN_COMPS = 5

/** Comps count as similar in size within this share of the listing's size. */
export const SIZE_BAND = 0.25

export interface CompGroup {
  /** e.g. "similar-size Everett houses", "all houses". */
  label: string
  medianPricePerSqft: number
  count: number
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

interface Sized {
  id: string
  sqft: number
  ppsf: number
}

/**
 * Comps for a listing: the median $/sqft of the *other* listings like it,
 * from the narrowest group with at least MIN_COMPS — similar-size homes of the
 * same type in the same city, then that type in the city at any size, then
 * similar-size homes of that type anywhere, then that type anywhere, then all.
 * Size matters because bigger homes sell for less per square foot.
 */
export function buildComps(listings: readonly MlsListing[]): (listing: MlsListing) => CompGroup | null {
  const groups = new Map<string, Sized[]>()
  const add = (key: string, entry: Sized) => {
    const list = groups.get(key)
    if (list) list.push(entry)
    else groups.set(key, [entry])
  }
  for (const listing of listings) {
    const ppsf = pricePerSqft(listing)
    if (ppsf == null || listing.sqft == null) continue
    const entry = { id: listing.id, sqft: listing.sqft, ppsf }
    add(`city:${listing.city.toLowerCase()}|${listing.type}`, entry)
    add(`type:${listing.type}`, entry)
    add('all', entry)
  }

  return (listing) => {
    const others = (key: string, sized: boolean): number[] => {
      const sqft = listing.sqft
      return (groups.get(key) ?? [])
        .filter(
          (c) =>
            c.id !== listing.id &&
            (!sized ||
              (sqft != null && c.sqft >= sqft * (1 - SIZE_BAND) && c.sqft <= sqft * (1 + SIZE_BAND))),
        )
        .map((c) => c.ppsf)
    }
    const cityKey = `city:${listing.city.toLowerCase()}|${listing.type}`
    const typeKey = `type:${listing.type}`
    const tries: [string, boolean, string][] = [
      [cityKey, true, `similar-size ${listing.city} ${PLURAL[listing.type]}`],
      [cityKey, false, `${listing.city} ${PLURAL[listing.type]}`],
      [typeKey, true, `similar-size ${PLURAL[listing.type]}, all cities`],
      [typeKey, false, `all ${PLURAL[listing.type]}`],
      ['all', false, 'all listings'],
    ]
    for (const [key, sized, label] of tries) {
      const values = others(key, sized)
      if (values.length >= MIN_COMPS) {
        return { label, medianPricePerSqft: median(values), count: values.length }
      }
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Tax, ZIP statistics and rent
// ---------------------------------------------------------------------------

const TAX_BY_CITY = new Map(TAX_RATE_ENTRIES.map((e) => [e.city.toLowerCase(), e]))

/** The city's property tax rate (percent) from the tax table, or the regional median. */
export function taxRateForCity(city: string): { rate: number; estimated: boolean } {
  const entry = TAX_BY_CITY.get(city.trim().toLowerCase())
  return entry
    ? { rate: perThousandToPercent(entry.useRatePer1000), estimated: false }
    : { rate: REGIONAL_MEDIAN_RATE_PERCENT, estimated: true }
}

export interface ZipStats {
  medianRent: number | null
  medianIncome: number | null
}

const ZIP_STATS = zipStatsData.zips as Record<string, (number | null)[]>

/** Where the ZIP figures come from, for the page to cite. */
export const ZIP_STATS_SOURCE: string = zipStatsData.source

/** Census figures for a ZIP (Washington only), or null when it has none (e.g. PO-box ZIPs). */
export function zipStats(zip: string): ZipStats | null {
  const row = ZIP_STATS[zip.trim()]
  if (!row) return null
  return { medianRent: row[0] ?? null, medianIncome: row[1] ?? null }
}

/** Square feet past which each extra foot adds half as much rent (big homes rent for less per foot). */
export const RENT_TAPER_SQFT = 1500

/** ZIP rent adjustments are kept within this range, so one odd ZIP can't swing a rent wildly. */
export const RENT_FACTOR_RANGE: readonly [number, number] = [0.75, 1.35]

/** Rent from the size and the ZIP factor, rounded to $25 (null without a size). */
export function estimateRent(listing: MlsListing, rentPerSqft: number, factor = 1): number | null {
  if (listing.sqft == null || !(rentPerSqft > 0)) return null
  const full = Math.min(listing.sqft, RENT_TAPER_SQFT)
  const tapered = Math.max(0, listing.sqft - RENT_TAPER_SQFT)
  return Math.round(((full + tapered / 2) * rentPerSqft * factor) / 25) * 25
}

/** What every listing is measured against: comps and the typical ZIP rent across the data. */
export interface ScreenContext {
  compsFor: (listing: MlsListing) => CompGroup | null
  /** Median of the listings' ZIP median rents (null when no ZIP has one). */
  referenceRent: number | null
}

export function buildContext(listings: readonly MlsListing[]): ScreenContext {
  const rents = listings.flatMap((l) => {
    const rent = zipStats(l.zip)?.medianRent
    return rent != null ? [rent] : []
  })
  return { compsFor: buildComps(listings), referenceRent: rents.length ? median(rents) : null }
}

/** How much more (or less) rent the listing's ZIP commands than the data's typical ZIP. */
export function rentFactor(zip: string, referenceRent: number | null): number {
  const rent = zipStats(zip)?.medianRent
  if (rent == null || referenceRent == null) return 1
  return clamp(rent / referenceRent, RENT_FACTOR_RANGE[0], RENT_FACTOR_RANGE[1])
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

const round = (n: number) => Math.round(n)

function baseInputs(
  listing: MlsListing,
  a: { downPct: number; rate: number; termYears: number; insurancePct: number; closingPct: number },
): DealInputs {
  return {
    ...DEFAULT_INPUTS,
    propertyValue: listing.price,
    propertySize: listing.sqft,
    propertyTax: taxRateForCity(listing.city).rate,
    loanValue: round(listing.price * (1 - a.downPct / 100)),
    loanRate: a.rate,
    loanTerm: a.termYears,
    closingCost: round((listing.price * a.closingPct) / 100),
    additionalMonthlyFees: listing.hoaMonthly > 0 ? round(listing.hoaMonthly) : null,
    insuranceAnnual: round((listing.price * a.insurancePct) / 100),
  }
}

/** Investor deal inputs for this listing (rent already scaled by the ZIP factor). */
export function investorDealInputs(listing: MlsListing, a: InvestorAssumptions, factor = 1): DealInputs {
  return {
    ...baseInputs(listing, a),
    rentValue: estimateRent(listing, a.rentPerSqft, factor),
    vacancyRate: a.vacancyPct,
    managementRate: a.managementPct,
    maintenanceRate: a.repairsPct,
  }
}

/** Homeowner deal inputs for this listing (income as the deal's monthly figure). */
export function ownerDealInputs(listing: MlsListing, a: OwnerAssumptions): DealInputs {
  return {
    ...baseInputs(listing, a),
    householdIncome: a.householdIncome > 0 ? round(a.householdIncome / 12) : null,
  }
}

// ---------------------------------------------------------------------------
// Analysis and scoring
// ---------------------------------------------------------------------------

export interface Reason {
  tone: 'good' | 'bad'
  text: string
}

export interface ListingAnalysis {
  listing: MlsListing
  perspective: Perspective
  pricePerSqft: number | null
  comps: CompGroup | null
  /** Percent below the comp median $/sqft (negative = above it). */
  discountPct: number | null
  /** Percent the price has dropped from the original list price. */
  priceCutPct: number
  taxRatePercent: number
  /** True when the city isn't in the tax table and the regional median was used. */
  taxRateEstimated: boolean
  zip: ZipStats | null
  /** The ZIP's rent relative to the data's typical ZIP (1 = typical or unknown). */
  rentFactor: number
  /** Principal + interest. */
  payment: number | null
  cashNeeded: number
  // Investor
  rent: number | null
  cashFlow: number | null
  /** Net operating income per year as a percent of the price. */
  capRate: number | null
  cashOnCash: number | null
  /** Monthly rent as a percent of the price (the 1% rule's input). */
  rentToPrice: number | null
  // Homeowner
  /** What a lender counts: mortgage, tax, insurance, PMI, HOA. */
  housingCost: number | null
  /** Housing cost plus a 1%-a-year maintenance reserve. */
  ownershipCost: number | null
  pmi: number | null
  /** Housing cost as a percent of gross monthly income (null without an income). */
  incomeShare: number | null
  score: number
  reasons: Reason[]
  /** The deal a "New deal" button starts from this listing. */
  dealInputs: DealInputs
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
/** 0 at `lo`, `points` at `hi`, linear between (hi may be below lo for "lower is better"). */
const scale = (value: number, lo: number, hi: number, points: number) =>
  clamp((value - lo) / (hi - lo), 0, 1) * points

/** House lots this big can often take an ADU/DADU (and a big yard rents well). */
export const LARGE_LOT_SQFT = 7200

/** A house lot this big has a real yard. */
export const YARD_LOT_SQFT = 5000

/** Views worth calling out (nearly everything in the data is at least "Territorial"). */
const NOTABLE_VIEW = /mountain|water|lake|sound|bay|ocean|river|city|canal|strait|olympic|cascade/i

const pct = (n: number) => `${Math.round(n)}%`
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

function valueReasons(discountPct: number | null, comps: CompGroup | null, reasons: Reason[]) {
  if (discountPct == null || !comps) return
  if (discountPct >= 5) {
    reasons.push({ tone: 'good', text: `${pct(discountPct)} below ${comps.label} $/sqft` })
  } else if (discountPct <= -10) {
    reasons.push({ tone: 'bad', text: `${pct(-discountPct)} above ${comps.label} $/sqft` })
  }
}

/** Points for a seller who may negotiate: price cut up to 10% and days on market up to 120. */
function motivation(
  listing: MlsListing,
  priceCutPct: number,
  cutPoints: number,
  domPoints: number,
  reasons: Reason[],
): number {
  let points = scale(priceCutPct, 0, 10, cutPoints)
  if (priceCutPct >= 3) {
    reasons.push({
      tone: 'good',
      text: `Price cut ${pct(priceCutPct)} (${money(listing.originalPrice - listing.price)})`,
    })
  }
  // Builders list new homes before they're finished, so their time on market says little.
  if (listing.daysOnMarket != null && !listing.flags.includes('newConstruction')) {
    points += scale(listing.daysOnMarket, 0, 120, domPoints)
    if (listing.daysOnMarket >= 60) {
      reasons.push({ tone: 'good', text: `${listing.daysOnMarket} days on market` })
    }
  }
  return points
}

/**
 * Investor score (max 100):
 * - value (35): $/sqft from 15% above to 20% below the comps
 * - return (25): cap rate from 2% to 5.5%
 * - motivation (20): price cut up to 10% (12) and days on market up to 120 (8)
 * - upside (20): value-add mentions, 6 each up to 15, and a large house lot (5)
 * Minus up to 10 for HOA dues, 10 per restriction (55+, cash only, auction),
 * and 5 for manufactured homes (harder to finance and appreciate).
 */
function investorScore(a: ListingAnalysis): { score: number; reasons: Reason[] } {
  const l = a.listing
  const reasons: Reason[] = []
  let score = 0

  if (a.discountPct != null) score += scale(a.discountPct, -15, 20, 35)
  valueReasons(a.discountPct, a.comps, reasons)

  if (a.capRate != null) {
    score += scale(a.capRate, 2, 5.5, 25)
    if (a.capRate >= 4.5) reasons.push({ tone: 'good', text: `Cap rate ${a.capRate.toFixed(1)}%` })
  }

  score += motivation(l, a.priceCutPct, 12, 8, reasons)

  const valueAdd = l.flags.filter((f) => VALUE_ADD_FLAGS.includes(f))
  score += Math.min(15, valueAdd.length * 6)
  for (const flag of valueAdd) reasons.push({ tone: 'good', text: FLAG_LABELS[flag] })
  if (l.type === 'house' && l.lotSqft != null && l.lotSqft >= LARGE_LOT_SQFT) {
    score += 5
    reasons.push({ tone: 'good', text: `Large lot (${l.lotSqft.toLocaleString('en-US')} sqft)` })
  }

  if (l.hoaMonthly > 0) {
    score -= Math.min(10, l.hoaMonthly / 40)
    if (l.hoaMonthly >= 150) reasons.push({ tone: 'bad', text: `HOA ${money(l.hoaMonthly)}/mo` })
  }
  for (const flag of l.flags.filter((f) => CAUTION_FLAGS.includes(f))) {
    score -= 10
    reasons.push({ tone: 'bad', text: FLAG_LABELS[flag] })
  }
  if (l.type === 'manufactured') {
    score -= 5
    reasons.push({ tone: 'bad', text: PROPERTY_TYPE_LABELS.manufactured })
  }
  return { score, reasons }
}

/**
 * Homeowner score (max 100):
 * - value (30): $/sqft from 15% above to 20% below the comps
 * - affordability (25): housing cost from 40% down to 25% of gross income
 *   (skipped until an income is entered)
 * - condition (15): new construction 15, built in the last ~15 years 12,
 *   updated/remodeled 8; a fixer gets nothing and is called out
 * - livability (15): a yard (5), a 2+ car garage (4), a notable view (3),
 *   waterfront (3)
 * - negotiation room (15): price cut up to 10% (9) and days on market up to 120 (6)
 * Minus up to 10 for HOA dues, 10 for cash-only or auction, and 5 each for a
 * 55+ age restriction and manufactured homes.
 */
function ownerScore(a: ListingAnalysis): { score: number; reasons: Reason[] } {
  const l = a.listing
  const reasons: Reason[] = []
  let score = 0

  if (a.discountPct != null) score += scale(a.discountPct, -15, 20, 30)
  valueReasons(a.discountPct, a.comps, reasons)

  if (a.incomeShare != null) {
    score += scale(a.incomeShare, 40, 25, 25)
    if (a.incomeShare <= 28) {
      reasons.push({ tone: 'good', text: `Payment ${pct(a.incomeShare)} of income` })
    } else if (a.incomeShare > 36) {
      reasons.push({ tone: 'bad', text: `Payment ${pct(a.incomeShare)} of income` })
    }
  }

  const recentYear = l.listedOn ? Number(l.listedOn.slice(0, 4)) - 15 : null
  if (l.flags.includes('newConstruction')) {
    score += 15
    reasons.push({ tone: 'good', text: FLAG_LABELS.newConstruction })
  } else if (l.flags.includes('fixer')) {
    reasons.push({ tone: 'bad', text: 'Needs work (fixer / as-is)' })
  } else if (l.yearBuilt != null && recentYear != null && l.yearBuilt >= recentYear) {
    score += 12
    reasons.push({ tone: 'good', text: `Built ${l.yearBuilt}` })
  } else if (l.flags.includes('updated')) {
    score += 8
    reasons.push({ tone: 'good', text: FLAG_LABELS.updated })
  }

  let livability = 0
  if (l.type === 'house' && l.lotSqft != null && l.lotSqft >= YARD_LOT_SQFT) {
    livability += 5
    reasons.push({ tone: 'good', text: `Yard (${l.lotSqft.toLocaleString('en-US')} sqft lot)` })
  }
  if (l.garageSpaces != null && l.garageSpaces >= 2) {
    livability += 4
    reasons.push({ tone: 'good', text: `${l.garageSpaces}-car garage` })
  }
  if (NOTABLE_VIEW.test(l.view)) {
    livability += 3
    const views = l.view
      .split(',')
      .map((v) => v.trim())
      .filter((v) => NOTABLE_VIEW.test(v))
    reasons.push({ tone: 'good', text: `${views.join(', ')} view` })
  }
  if (l.waterfront) {
    livability += 3
    reasons.push({ tone: 'good', text: `Waterfront (${l.waterfront})` })
  }
  score += Math.min(15, livability)

  score += motivation(l, a.priceCutPct, 9, 6, reasons)

  if (l.hoaMonthly > 0) {
    score -= Math.min(10, l.hoaMonthly / 50)
    if (l.hoaMonthly >= 150) reasons.push({ tone: 'bad', text: `HOA ${money(l.hoaMonthly)}/mo` })
  }
  for (const flag of l.flags.filter((f) => f === 'cashOnly' || f === 'auction')) {
    score -= 10
    reasons.push({ tone: 'bad', text: FLAG_LABELS[flag] })
  }
  if (l.flags.includes('seniors')) {
    score -= 5
    reasons.push({ tone: 'bad', text: FLAG_LABELS.seniors })
  }
  if (l.type === 'manufactured') {
    score -= 5
    reasons.push({ tone: 'bad', text: PROPERTY_TYPE_LABELS.manufactured })
  }
  return { score, reasons }
}

export function analyzeListing(listing: MlsListing, ctx: ScreenContext, assumptions: Assumptions): ListingAnalysis {
  const comps = ctx.compsFor(listing)
  const ppsf = pricePerSqft(listing)
  const discountPct = ppsf != null && comps ? (1 - ppsf / comps.medianPricePerSqft) * 100 : null
  const priceCutPct =
    listing.originalPrice > listing.price
      ? ((listing.originalPrice - listing.price) / listing.originalPrice) * 100
      : 0
  const tax = taxRateForCity(listing.city)
  const factor = rentFactor(listing.zip, ctx.referenceRent)

  // Rent is estimated in both perspectives: a homeowner may want to know it too.
  const investor =
    assumptions.perspective === 'investment' ? assumptions.values : DEFAULT_INVESTOR_ASSUMPTIONS
  const rentInputs = investorDealInputs(listing, investor, factor)
  const dealInputs =
    assumptions.perspective === 'investment' ? rentInputs : ownerDealInputs(listing, assumptions.values)

  const payment = monthlyMortgagePayment(dealInputs.loanValue, dealInputs.loanRate, dealInputs.loanTerm)
  const rent = rentInputs.rentValue
  const isInvestor = assumptions.perspective === 'investment'
  const cashFlow = isInvestor ? monthlyCashFlowItemized(rentInputs, payment) : null
  const opex = monthlyOperatingExpenses(rentInputs)
  const noi = rent != null && opex != null ? rent - opex - listing.hoaMonthly : null
  const capRate = noi != null ? ((noi * 12) / listing.price) * 100 : null
  const cashNeeded = listing.price - (dealInputs.loanValue ?? 0) + (dealInputs.closingCost ?? 0)
  const cashOnCash = cashFlow != null && cashNeeded > 0 ? ((cashFlow * 12) / cashNeeded) * 100 : null

  const analysis: ListingAnalysis = {
    listing,
    perspective: assumptions.perspective,
    pricePerSqft: ppsf,
    comps,
    discountPct,
    priceCutPct,
    taxRatePercent: tax.rate,
    taxRateEstimated: tax.estimated,
    zip: zipStats(listing.zip),
    rentFactor: factor,
    payment,
    cashNeeded,
    rent,
    cashFlow,
    capRate,
    cashOnCash,
    rentToPrice: rent != null ? (rent / listing.price) * 100 : null,
    housingCost: monthlyHousingCost(dealInputs),
    ownershipCost: monthlyOwnershipCost(dealInputs),
    pmi: monthlyPmi(dealInputs),
    incomeShare: frontRatio(dealInputs),
    score: 0,
    reasons: [],
    dealInputs,
  }
  const { score, reasons } = isInvestor ? investorScore(analysis) : ownerScore(analysis)
  analysis.score = Math.round(clamp(score, 0, 100))
  analysis.reasons = reasons
  return analysis
}

/** Analyze every listing against the context (comps and rents drawn from the whole set). */
export function analyzeListings(
  listings: readonly MlsListing[],
  ctx: ScreenContext,
  assumptions: Assumptions,
): ListingAnalysis[] {
  return listings.map((listing) => analyzeListing(listing, ctx, assumptions))
}

// ---------------------------------------------------------------------------
// Filtering and sorting
// ---------------------------------------------------------------------------

/** The user's filters. Null/empty means "no limit". */
export interface ScreenFilters {
  minPrice: number | null
  maxPrice: number | null
  types: PropertyType[]
  /** Cities to include (empty = every city). */
  cities: string[]
  /** ZIP codes to leave out. */
  hiddenZips: string[]
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
  hiddenZips: [],
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
  if (f.hiddenZips.includes(l.zip)) return false
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
  | 'monthlyCost'
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
  monthlyCost: 'Monthly cost (low → high)',
  price: 'Price (low → high)',
  pricePerSqft: '$/sqft (low → high)',
  priceCut: 'Price cut',
  daysOnMarket: 'Days on market',
  newest: 'Newest',
}

/** The sorts that make sense from each perspective, in menu order. */
export const SORTS_FOR: Record<Perspective, readonly SortKey[]> = {
  investment: ['score', 'discount', 'cashFlow', 'capRate', 'price', 'pricePerSqft', 'priceCut', 'daysOnMarket', 'newest'],
  owner: ['score', 'discount', 'monthlyCost', 'price', 'pricePerSqft', 'priceCut', 'daysOnMarket', 'newest'],
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
    case 'monthlyCost':
      return a.housingCost == null ? null : -a.housingCost
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
