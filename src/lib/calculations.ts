import type { DealInputs, DealType } from './types'
import { ANALYSIS_HORIZONS } from './types'

function isNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v)
}

/** Optional inputs (fees, closing costs, rehab…) count as zero when left empty. */
function orZero(v: number | null | undefined): number {
  return isNum(v) ? v : 0
}

/**
 * Parse free-form user input into a number. Thousands separators, `$` and
 * spaces are ignored ("$320,000" → 320000). Empty or invalid input is null.
 */
export function parseInput(value: string): number | null {
  const trimmed = value.replace(/[,$\s]/g, '')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Property & market
// ---------------------------------------------------------------------------

/** Rent as a percentage of ARV (the 2% rule input). */
export function rentToArvRatio(inputs: DealInputs): number | null {
  const { rentValue: rent, propertyArvValue: arv } = inputs
  if (!isNum(rent) || !isNum(arv) || arv === 0) return null
  return (rent / arv) * 100
}

export function passesTwoPercentRule(inputs: DealInputs): boolean | null {
  const ratio = rentToArvRatio(inputs)
  if (!isNum(ratio)) return null
  return ratio >= 2
}

/** ARV minus sale price (negative means paying above ARV). */
export function arvDifferenceMoney(inputs: DealInputs): number | null {
  const { propertyValue: price, propertyArvValue: arv } = inputs
  if (!isNum(price) || !isNum(arv)) return null
  return arv - price
}

/** What percent below ARV the sale price is (negative means above ARV). */
export function arvDifferencePercent(inputs: DealInputs): number | null {
  const { propertyValue: price, propertyArvValue: arv } = inputs
  if (!isNum(price) || !isNum(arv) || arv === 0) return null
  return (1 - price / arv) * 100
}

export function pricePerSqFt(value: number | null, size: number | null): number | null {
  if (!isNum(value) || !isNum(size) || size === 0) return null
  return value / size
}

export function annualPropertyTax(value: number | null, ratePercent: number | null): number | null {
  if (!isNum(value) || !isNum(ratePercent)) return null
  return (value * ratePercent) / 100
}

/** Monthly rent range for the 1%–2% rule, based on ARV. */
export function optimalRentRange(arv: number | null): [number, number] | null {
  if (!isNum(arv)) return null
  return [arv * 0.01, arv * 0.02]
}

export function grossRentForMonths(rent: number | null, months: number): number | null {
  if (!isNum(rent)) return null
  return rent * months
}

/**
 * Annual gross income ranges at which the rent consumes 25% (common screening
 * ceiling) and 30% (typical max rent-to-income) of the tenant's income.
 */
export function tenantIncomeRange(annualGrossRent: number | null): {
  at25Percent: number
  at30Percent: number
} | null {
  if (!isNum(annualGrossRent)) return null
  return {
    at25Percent: annualGrossRent / 0.25,
    at30Percent: annualGrossRent / 0.3,
  }
}

// ---------------------------------------------------------------------------
// Mortgage
// ---------------------------------------------------------------------------

export function downPayment(inputs: DealInputs): number | null {
  const { propertyValue: price, loanValue: loan } = inputs
  if (!isNum(price) || !isNum(loan)) return null
  return price - loan
}

export function downPaymentPercent(inputs: DealInputs): number | null {
  const dp = downPayment(inputs)
  const { propertyValue: price } = inputs
  if (!isNum(dp) || !isNum(price) || price === 0) return null
  return (dp / price) * 100
}

/** Loan amount (whole dollars) that leaves `percentDown` of the price as the down payment. */
export function loanForDownPayment(price: number | null, percentDown: number): number | null {
  if (!isNum(price) || price <= 0 || percentDown < 0 || percentDown > 100) return null
  return Math.round(price * (1 - percentDown / 100))
}

/** Cash needed at closing: down payment plus closing costs (when entered). */
export function cashToClose(inputs: DealInputs): number | null {
  const dp = downPayment(inputs)
  if (!isNum(dp)) return null
  const { closingCost } = inputs
  return dp + (isNum(closingCost) ? closingCost : 0)
}

/**
 * Standard fixed-rate amortized monthly payment.
 * Returns null when inputs are missing/invalid; 0% rates use principal / months.
 */
export function monthlyMortgagePayment(
  principal: number | null,
  annualRatePercent: number | null,
  termYears: number | null,
): number | null {
  if (!isNum(principal) || principal < 0) return null
  if (!isNum(termYears) || termYears <= 0) return null
  if (!isNum(annualRatePercent) || annualRatePercent < 0) return null
  const n = termYears * 12
  if (principal === 0) return 0
  if (annualRatePercent === 0) return principal / n
  const c = annualRatePercent / 100 / 12
  const factor = Math.pow(1 + c, n)
  return (principal * c * factor) / (factor - 1)
}

export function totalLoanPayments(
  inputs: DealInputs,
  rateKey: 'loanRate' | 'loanPointRate',
): number | null {
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs[rateKey], inputs.loanTerm)
  const { loanTerm } = inputs
  if (!isNum(payment) || !isNum(loanTerm)) return null
  return payment * loanTerm * 12
}

export function closingCostPercent(closingCost: number | null, loan: number | null): number | null {
  if (!isNum(closingCost) || !isNum(loan) || loan === 0) return null
  return (closingCost / loan) * 100
}

/** Typical closing-cost estimate range: 2%–5% of the loan. */
export function estimatedClosingCostRange(loan: number | null): [number, number] | null {
  if (!isNum(loan)) return null
  return [loan * 0.02, loan * 0.05]
}

/** One point = 1% of the loan amount. */
export function mortgagePointValue(loan: number | null): number | null {
  if (!isNum(loan)) return null
  return loan / 100
}

export interface PointsBreakEven {
  savingsPerMonth: number
  savingsPerYear: number
  monthsToBreakEven: number
  yearsToBreakEven: number
}

/**
 * Break-even analysis for paying points. Returns null when it is not
 * computable (missing inputs, zero points, or no monthly savings).
 */
export function pointsBreakEven(inputs: DealInputs): PointsBreakEven | null {
  const base = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  const withPoints = monthlyMortgagePayment(
    inputs.loanValue,
    inputs.loanPointRate,
    inputs.loanTerm,
  )
  const { pointsOffered } = inputs
  const pointValue = mortgagePointValue(inputs.loanValue)
  if (!isNum(base) || !isNum(withPoints) || !isNum(pointsOffered) || !isNum(pointValue)) return null
  if (pointsOffered <= 0) return null
  const savingsPerMonth = base - withPoints
  if (savingsPerMonth <= 0) return null
  const monthsToBreakEven = (pointValue * pointsOffered) / savingsPerMonth
  return {
    savingsPerMonth,
    savingsPerYear: savingsPerMonth * 12,
    monthsToBreakEven,
    yearsToBreakEven: monthsToBreakEven / 12,
  }
}

// ---------------------------------------------------------------------------
// Cash flow
// ---------------------------------------------------------------------------

/**
 * Monthly cash flow. `rentFraction` is the share of gross rent left after
 * operating expenses: 1 = no overhead, 0.5 = 50% rule, 0.75 = 25% rule.
 * (The rule is applied to gross rent, per the standard BRRR convention.)
 */
export function monthlyCashFlow(inputs: DealInputs, rentFraction = 1): number | null {
  const { rentValue: rent, additionalMonthlyFees: fees } = inputs
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  if (!isNum(rent) || !isNum(payment)) return null
  const monthlyFees = isNum(fees) ? fees : 0
  return rent * rentFraction - payment - monthlyFees
}

/** Yearly cash flow as a percentage of the cash invested; null when nothing was invested. */
function returnOnCash(monthly: number | null, invested: number | null): number | null {
  if (!isNum(monthly) || !isNum(invested) || invested <= 0) return null
  return ((monthly * 12) / invested) * 100
}

/** Yearly cash-flow return on the cash invested (down payment + closing costs + rehab). */
export function cashFlowRateOfReturn(inputs: DealInputs, rentFraction = 1): number | null {
  return returnOnCash(monthlyCashFlow(inputs, rentFraction), cashInvested(inputs))
}

// ---------------------------------------------------------------------------
// Itemized operating expenses (investor)
// ---------------------------------------------------------------------------

/** True once any itemized expense is entered; until then cash flow relies on the 50%/25% rules. */
export function hasItemizedExpenses(inputs: DealInputs): boolean {
  return [inputs.vacancyRate, inputs.managementRate, inputs.maintenanceRate, inputs.insuranceAnnual].some(
    isNum,
  )
}

/**
 * Monthly operating expenses: vacancy, management, and repairs/CapEx as a share
 * of gross rent, plus insurance and property tax (on the sale price). Null until
 * rent and at least one itemized expense are entered.
 */
export function monthlyOperatingExpenses(inputs: DealInputs): number | null {
  const { rentValue: rent } = inputs
  if (!isNum(rent) || !hasItemizedExpenses(inputs)) return null
  const rentShare =
    (orZero(inputs.vacancyRate) + orZero(inputs.managementRate) + orZero(inputs.maintenanceRate)) / 100
  return rent * rentShare + orZero(inputs.insuranceAnnual) / 12 + orZero(monthlyPropertyTax(inputs))
}

/** Operating expenses as a percentage of gross rent (compare with the 50% rule). */
export function expenseRatio(inputs: DealInputs): number | null {
  const opex = monthlyOperatingExpenses(inputs)
  const { rentValue: rent } = inputs
  if (!isNum(opex) || !isNum(rent) || rent === 0) return null
  return (opex / rent) * 100
}

/** Rent − itemized operating expenses − mortgage payment − other fees. */
export function monthlyCashFlowItemized(
  inputs: DealInputs,
  payment: number | null = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm),
): number | null {
  const opex = monthlyOperatingExpenses(inputs)
  const { rentValue: rent } = inputs
  if (!isNum(opex) || !isNum(rent) || !isNum(payment)) return null
  return rent - opex - payment - orZero(inputs.additionalMonthlyFees)
}

export type ExpenseBasis = 'itemized' | 'fiftyRule'

/** Itemized expenses once any are entered, otherwise the 50% rule. */
export function expenseBasis(inputs: DealInputs): ExpenseBasis {
  return hasItemizedExpenses(inputs) ? 'itemized' : 'fiftyRule'
}

// ---------------------------------------------------------------------------
// BRRR: rehab & refinance
// ---------------------------------------------------------------------------

/** Share of ARV the 70% rule allows for the purchase price plus rehab. */
export const SEVENTY_RULE_PERCENT = 70

/** Refinance term used when none is entered. */
export const DEFAULT_REFI_TERM_YEARS = 30

/** Purchase price + rehab + closing costs. */
export function allInCost(inputs: DealInputs): number | null {
  const { propertyValue: price } = inputs
  if (!isNum(price)) return null
  return price + orZero(inputs.rehabCost) + orZero(inputs.closingCost)
}

/** Equity on day one: ARV less everything paid to get there (price, rehab, closing). */
export function equityAtPurchase(inputs: DealInputs): number | null {
  const allIn = allInCost(inputs)
  const { propertyArvValue: arv } = inputs
  if (!isNum(allIn) || !isNum(arv)) return null
  return arv - allIn
}

/** Highest purchase price under the 70% rule: ARV × 70% − rehab. */
export function maxOfferSeventyRule(inputs: DealInputs): number | null {
  const { propertyArvValue: arv } = inputs
  if (!isNum(arv)) return null
  return (arv * SEVENTY_RULE_PERCENT) / 100 - orZero(inputs.rehabCost)
}

export function passesSeventyRule(inputs: DealInputs): boolean | null {
  const max = maxOfferSeventyRule(inputs)
  const { propertyValue: price } = inputs
  if (!isNum(max) || !isNum(price)) return null
  return price <= max
}

/** Cash put into the deal before any refinance: down payment + closing costs + rehab. */
export function cashInvested(inputs: DealInputs): number | null {
  const dp = downPayment(inputs)
  if (!isNum(dp)) return null
  return dp + orZero(inputs.closingCost) + orZero(inputs.rehabCost)
}

/** New loan at refinance: ARV × refinance loan-to-value. */
export function refinanceLoan(inputs: DealInputs): number | null {
  const { propertyArvValue: arv, refiLtv } = inputs
  if (!isNum(arv) || !isNum(refiLtv)) return null
  return (arv * refiLtv) / 100
}

export function refinancePayment(inputs: DealInputs): number | null {
  return monthlyMortgagePayment(
    refinanceLoan(inputs),
    inputs.refiRate,
    inputs.refiTerm ?? DEFAULT_REFI_TERM_YEARS,
  )
}

/**
 * Cash back at the refinance: the new loan, less paying off the purchase loan
 * (assumed near its original balance after a short rehab) and refi closing costs.
 * Negative means cash is needed to close the refinance.
 */
export function cashOutAtRefinance(inputs: DealInputs): number | null {
  const refi = refinanceLoan(inputs)
  const { loanValue } = inputs
  if (!isNum(refi) || !isNum(loanValue)) return null
  return refi - loanValue - orZero(inputs.refiClosingCost)
}

/** Cash still in the deal after the refinance (zero or less: all of it came back out). */
export function cashLeftInDeal(inputs: DealInputs): number | null {
  const invested = cashInvested(inputs)
  const out = cashOutAtRefinance(inputs)
  if (!isNum(invested) || !isNum(out)) return null
  return invested - out
}

/** Equity remaining after the refinance: ARV − refinance loan. */
export function equityAfterRefinance(inputs: DealInputs): number | null {
  const refi = refinanceLoan(inputs)
  const { propertyArvValue: arv } = inputs
  if (!isNum(refi) || !isNum(arv)) return null
  return arv - refi
}

/** Monthly cash flow with the refinanced payment, on the given expense basis. */
export function cashFlowAfterRefinance(
  inputs: DealInputs,
  basis: ExpenseBasis = expenseBasis(inputs),
): number | null {
  const payment = refinancePayment(inputs)
  if (basis === 'itemized') return monthlyCashFlowItemized(inputs, payment)
  const { rentValue: rent } = inputs
  if (!isNum(rent) || !isNum(payment)) return null
  return rent * 0.5 - payment - orZero(inputs.additionalMonthlyFees)
}

/**
 * Yearly cash-on-cash return on the cash left in after the refinance. Null when
 * no cash is left in (an unbounded return) or inputs are missing.
 */
export function cashOnCashAfterRefinance(inputs: DealInputs): number | null {
  return returnOnCash(cashFlowAfterRefinance(inputs), cashLeftInDeal(inputs))
}

export function cumulativeCashFlowWithoutAppreciation(
  inputs: DealInputs,
  years: number,
): number | null {
  const cashFlow = monthlyCashFlow(inputs, 1)
  if (!isNum(cashFlow) || years <= 0) return null
  return cashFlow * 12 * years
}

/**
 * Cumulative cash flow where rent re-prices with the home value at the
 * appreciation rate (year 1 uses the current rent, year N uses rent grown by
 * N-1 years). The mortgage payment stays fixed.
 */
export function cumulativeCashFlowWithAppreciation(
  inputs: DealInputs,
  years: number,
): number | null {
  const { rentValue: rent, appreciationRate: rate, additionalMonthlyFees: fees } = inputs
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  if (!isNum(rent) || !isNum(rate) || !isNum(payment) || years <= 0) return null
  const monthlyFees = isNum(fees) ? fees : 0
  let total = 0
  for (let y = 1; y <= years; y++) {
    const yearRent = y === 1 ? rent : rent * Math.pow(1 + rate / 100, y - 1)
    total += (yearRent - payment - monthlyFees) * 12
  }
  return total
}

// ---------------------------------------------------------------------------
// Appreciation
// ---------------------------------------------------------------------------

/** Compound value after `years` at an annual percentage rate. */
export function homeValueAfterYears(
  startValue: number | null,
  annualRatePercent: number | null,
  years: number,
): number | null {
  if (!isNum(startValue) || !isNum(annualRatePercent) || years < 0) return null
  return startValue * Math.pow(1 + annualRatePercent / 100, years)
}

// ---------------------------------------------------------------------------
// Homeownership
// ---------------------------------------------------------------------------

/** Annual maintenance reserve, as a percent of the home price (1% rule). */
export const MAINTENANCE_RATE_PERCENT = 1

/** Front-ratio ceiling: PITI as a share of monthly income (28% rule). */
export const FRONT_RATIO_PASS_PERCENT = 28

/** PMI rate assumed (% of the loan per year) when under 20% down and none is entered. */
export const DEFAULT_PMI_RATE_PERCENT = 0.5

/** PMI applies while the loan is above 80% of the price… */
const PMI_REQUIRED_ABOVE_LTV = 80
/** …and ends automatically once the balance amortizes to 78% of it. */
const PMI_ENDS_AT_LTV = 78

/**
 * Remaining loan balance after `months` amortized payments.
 * 0 before payments start, 0 at or past the end of the term.
 */
export function loanBalanceAfter(
  principal: number | null,
  annualRatePercent: number | null,
  termYears: number | null,
  months: number,
): number | null {
  if (!isNum(principal) || principal < 0) return null
  if (!isNum(termYears) || termYears <= 0) return null
  if (!isNum(annualRatePercent) || annualRatePercent < 0) return null
  const n = termYears * 12
  if (principal === 0) return 0
  if (months <= 0) return principal
  if (months >= n) return 0
  if (annualRatePercent === 0) return principal * (1 - months / n)
  const c = annualRatePercent / 100 / 12
  const factor = Math.pow(1 + c, n)
  const pmt = (principal * c * factor) / (factor - 1)
  const growth = Math.pow(1 + c, months)
  return principal * growth - (pmt * (growth - 1)) / c
}

/** Annual property tax at the sale price, as a monthly amount. */
export function monthlyPropertyTax(inputs: DealInputs): number | null {
  const { propertyValue, propertyTax } = inputs
  if (!isNum(propertyValue) || !isNum(propertyTax)) return null
  return (propertyValue * propertyTax) / 100 / 12
}

export function monthlyInsurance(inputs: DealInputs): number | null {
  return isNum(inputs.insuranceAnnual) ? inputs.insuranceAnnual / 12 : null
}

/**
 * Monthly private mortgage insurance while the loan is above 80% of the price
 * (0 with 20%+ down). Uses the entered rate, or an estimate when it's empty.
 */
export function monthlyPmi(inputs: DealInputs): number | null {
  const { propertyValue: price, loanValue: loan } = inputs
  if (!isNum(price) || price <= 0 || !isNum(loan)) return null
  if ((loan / price) * 100 <= PMI_REQUIRED_ABOVE_LTV) return 0
  return (loan * (inputs.pmiRate ?? DEFAULT_PMI_RATE_PERCENT)) / 100 / 12
}

/** Months of PMI until the balance amortizes to 78% of the price (capped at the loan term). */
export function pmiMonths(inputs: DealInputs): number | null {
  const pmi = monthlyPmi(inputs)
  const { propertyValue: price, loanValue, loanRate, loanTerm } = inputs
  if (!isNum(pmi)) return null
  if (pmi === 0) return 0
  if (!isNum(price) || !isNum(loanTerm) || loanTerm <= 0) return null
  const termMonths = Math.round(loanTerm * 12)
  const threshold = (price * PMI_ENDS_AT_LTV) / 100
  for (let month = 1; month <= termMonths; month++) {
    const balance = loanBalanceAfter(loanValue, loanRate, loanTerm, month)
    if (!isNum(balance)) return null
    if (balance <= threshold) return month
  }
  return termMonths
}

/**
 * What it costs per month to own the home today: mortgage payment + property
 * tax + insurance + PMI + other monthly fees + a ~1% annual maintenance reserve.
 */
export function monthlyOwnershipCost(inputs: DealInputs): number | null {
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  const { propertyValue } = inputs
  if (!isNum(payment) || !isNum(propertyValue)) return null
  const maintenance = (propertyValue * MAINTENANCE_RATE_PERCENT) / 100 / 12
  return (
    payment +
    orZero(monthlyPropertyTax(inputs)) +
    orZero(monthlyInsurance(inputs)) +
    orZero(monthlyPmi(inputs)) +
    orZero(inputs.additionalMonthlyFees) +
    maintenance
  )
}

/** Total cost of owning over the loan term, with PMI only for the months it applies. */
export function costOfOwnership(inputs: DealInputs): number | null {
  const monthly = monthlyOwnershipCost(inputs)
  const { loanTerm } = inputs
  if (!isNum(monthly) || !isNum(loanTerm)) return null
  const pmi = orZero(monthlyPmi(inputs))
  return (monthly - pmi) * 12 * loanTerm + pmi * orZero(pmiMonths(inputs))
}

/** Total interest paid over the life of the loan. */
export function totalInterest(inputs: DealInputs): number | null {
  const total = totalLoanPayments(inputs, 'loanRate')
  const { loanValue } = inputs
  if (!isNum(total) || !isNum(loanValue)) return null
  return Math.max(0, total - loanValue)
}

/** Monthly savings (positive) or extra cost (negative) of owning vs renting. */
export function rentVsBuyMonthly(inputs: DealInputs): number | null {
  const ownership = monthlyOwnershipCost(inputs)
  const { rentYouPay } = inputs
  if (!isNum(ownership) || !isNum(rentYouPay)) return null
  return rentYouPay - ownership
}

/** Cumulative savings vs renting over `years` (rent held flat; PMI stops when it ends). */
export function rentVsBuyCumulative(inputs: DealInputs, years: number): number | null {
  const monthly = rentVsBuyMonthly(inputs)
  if (!isNum(monthly) || years <= 0) return null
  const pmi = orZero(monthlyPmi(inputs))
  const months = years * 12
  const monthsWithoutPmi = Math.max(0, months - orZero(pmiMonths(inputs)))
  return monthly * months + pmi * monthsWithoutPmi
}

/**
 * Front ratio: housing payment (principal & interest, property tax, insurance,
 * PMI, and other monthly fees such as HOA) as a percentage of monthly income.
 */
/** What lenders count as the housing payment: mortgage, property tax, insurance, PMI, and fees. */
export function monthlyHousingCost(inputs: DealInputs): number | null {
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  if (!isNum(payment)) return null
  return (
    payment +
    orZero(monthlyPropertyTax(inputs)) +
    orZero(monthlyInsurance(inputs)) +
    orZero(monthlyPmi(inputs)) +
    orZero(inputs.additionalMonthlyFees)
  )
}

export function frontRatio(inputs: DealInputs): number | null {
  const { householdIncome: income } = inputs
  const housing = monthlyHousingCost(inputs)
  if (!isNum(income) || income <= 0 || !isNum(housing)) return null
  return (housing / income) * 100
}

/** Gross monthly income at which the housing payment is exactly the 28% ceiling. */
export function incomeForFrontRatio(inputs: DealInputs): number | null {
  const housing = monthlyHousingCost(inputs)
  return isNum(housing) ? housing / (FRONT_RATIO_PASS_PERCENT / 100) : null
}

// ---------------------------------------------------------------------------
// Year-by-year projection (for charts)
// ---------------------------------------------------------------------------

export interface YearPoint {
  year: number
  /** Purchase price compounded at the appreciation rate (homeowner projection). */
  homeValue: number | null
  loanBalance: number | null
  /** homeValue − loanBalance. */
  equity: number | null
  /** Cumulative cash flow after mortgage and fees, rent held flat. */
  cashFlow: number | null
  /** Cumulative cash flow with rent re-priced at the appreciation rate. */
  cashFlowWithAppreciation: number | null
}

/** One point per year from today (year 0) through `years`, using the same formulas as the horizon tables. */
export function yearlyProjection(inputs: DealInputs, years = ANALYSIS_HORIZONS[ANALYSIS_HORIZONS.length - 1]): YearPoint[] {
  const flatCashFlowKnown = monthlyCashFlow(inputs, 1) != null
  const repricedCashFlowKnown = cumulativeCashFlowWithAppreciation(inputs, 1) != null
  return Array.from({ length: years + 1 }, (_, year) => {
    const homeValue = homeValueAfterYears(inputs.propertyValue, inputs.appreciationRate, year)
    const loanBalance = loanBalanceAfter(inputs.loanValue, inputs.loanRate, inputs.loanTerm, year * 12)
    return {
      year,
      homeValue,
      loanBalance,
      equity: isNum(homeValue) && isNum(loanBalance) ? homeValue - loanBalance : null,
      cashFlow:
        year === 0
          ? flatCashFlowKnown
            ? 0
            : null
          : cumulativeCashFlowWithoutAppreciation(inputs, year),
      cashFlowWithAppreciation:
        year === 0
          ? repricedCashFlowKnown
            ? 0
            : null
          : cumulativeCashFlowWithAppreciation(inputs, year),
    }
  })
}

/**
 * Equity for each year from today through `years`: value at the appreciation
 * rate minus the purchase loan's balance. Rentals grow from ARV (the value
 * after rehab), homes from the price.
 */
export function equityOverTime(
  inputs: DealInputs,
  type: DealType,
  years = ANALYSIS_HORIZONS[ANALYSIS_HORIZONS.length - 1],
): (number | null)[] {
  const start = type === 'investment' ? (inputs.propertyArvValue ?? inputs.propertyValue) : inputs.propertyValue
  return Array.from({ length: years + 1 }, (_, year) => {
    const value = homeValueAfterYears(start, inputs.appreciationRate, year)
    const balance = loanBalanceAfter(inputs.loanValue, inputs.loanRate, inputs.loanTerm, year * 12)
    return isNum(value) && isNum(balance) ? value - balance : null
  })
}

// ---------------------------------------------------------------------------
// Targets: what the deal needs, holding everything else as entered
// ---------------------------------------------------------------------------

/** Highest annual rate (%) tried when solving for a rate. */
const MAX_RATE_SEARCHED = 30

/**
 * The annual rate (%) at which a loan's monthly payment equals `payment`.
 * Null when even 0% costs more; Infinity when any rate up to 30% fits.
 */
export function rateForPayment(
  principal: number | null,
  termYears: number | null,
  payment: number,
): number | null {
  const at = (rate: number) => monthlyMortgagePayment(principal, rate, termYears)
  const atZero = at(0)
  if (!isNum(atZero) || atZero > payment) return null
  if ((at(MAX_RATE_SEARCHED) as number) <= payment) return Infinity
  let low = 0
  let high = MAX_RATE_SEARCHED
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2
    if ((at(mid) as number) > payment) high = mid
    else low = mid
  }
  return low
}

/**
 * Operating expenses on the deal's basis, split the way the targets need them:
 * the share of rent kept, fixed monthly costs, and property tax per dollar of price.
 */
function expenseModel(inputs: DealInputs) {
  const fees = orZero(inputs.additionalMonthlyFees)
  if (expenseBasis(inputs) === 'itemized') {
    const rentShare =
      (orZero(inputs.vacancyRate) + orZero(inputs.managementRate) + orZero(inputs.maintenanceRate)) / 100
    return {
      rentKept: 1 - rentShare,
      fixed: orZero(inputs.insuranceAnnual) / 12 + fees,
      taxPerDollar: orZero(inputs.propertyTax) / 100 / 12,
    }
  }
  return { rentKept: 0.5, fixed: fees, taxPerDollar: 0 }
}

/** Monthly rent at which cash flow is zero, on the deal's expense basis (itemized, else the 50% rule). */
export function breakEvenRent(inputs: DealInputs): number | null {
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  if (!isNum(payment)) return null
  const { rentKept, fixed, taxPerDollar } = expenseModel(inputs)
  if (rentKept <= 0) return null
  return (payment + fixed + taxPerDollar * orZero(inputs.propertyValue)) / rentKept
}

/** Highest price that still breaks even at the entered rent, keeping the same down payment %, rate, and term. */
export function maxPriceToBreakEven(inputs: DealInputs): number | null {
  const { rentValue: rent } = inputs
  const percentDown = downPaymentPercent(inputs)
  const perDollarBorrowed = monthlyMortgagePayment(1, inputs.loanRate, inputs.loanTerm)
  if (!isNum(rent) || !isNum(percentDown) || !isNum(perDollarBorrowed)) return null
  const { rentKept, fixed, taxPerDollar } = expenseModel(inputs)
  const costPerDollar = (1 - percentDown / 100) * perDollarBorrowed + taxPerDollar
  if (costPerDollar <= 0) return null
  return Math.max(0, (rent * rentKept - fixed) / costPerDollar)
}

/** Highest rate at which the entered rent still breaks even. */
export function maxRateToBreakEven(inputs: DealInputs): number | null {
  const { rentValue: rent } = inputs
  if (!isNum(rent) || !isNum(inputs.loanValue)) return null
  const { rentKept, fixed, taxPerDollar } = expenseModel(inputs)
  const available = rent * rentKept - fixed - taxPerDollar * orZero(inputs.propertyValue)
  return rateForPayment(inputs.loanValue, inputs.loanTerm, available)
}

/** Highest price whose housing payment stays within 28% of income, keeping the same down payment %, rate, and term. */
export function maxPriceForFrontRatio(inputs: DealInputs): number | null {
  const { householdIncome: income } = inputs
  const percentDown = downPaymentPercent(inputs)
  const perDollarBorrowed = monthlyMortgagePayment(1, inputs.loanRate, inputs.loanTerm)
  if (!isNum(income) || income <= 0 || !isNum(percentDown) || !isNum(perDollarBorrowed)) return null
  const loanShare = 1 - percentDown / 100
  const pmiPerDollar =
    loanShare * 100 > PMI_REQUIRED_ABOVE_LTV
      ? (loanShare * (inputs.pmiRate ?? DEFAULT_PMI_RATE_PERCENT)) / 100 / 12
      : 0
  const costPerDollar = loanShare * perDollarBorrowed + orZero(inputs.propertyTax) / 100 / 12 + pmiPerDollar
  if (costPerDollar <= 0) return null
  const available =
    (income * FRONT_RATIO_PASS_PERCENT) / 100 -
    orZero(inputs.insuranceAnnual) / 12 -
    orZero(inputs.additionalMonthlyFees)
  return Math.max(0, available / costPerDollar)
}

/** Highest rate at which the housing payment stays within 28% of income. */
export function maxRateForFrontRatio(inputs: DealInputs): number | null {
  const { householdIncome: income } = inputs
  if (!isNum(income) || income <= 0 || !isNum(inputs.loanValue)) return null
  const available =
    (income * FRONT_RATIO_PASS_PERCENT) / 100 -
    orZero(monthlyPropertyTax(inputs)) -
    orZero(monthlyInsurance(inputs)) -
    orZero(monthlyPmi(inputs)) -
    orZero(inputs.additionalMonthlyFees)
  return rateForPayment(inputs.loanValue, inputs.loanTerm, available)
}

// ---------------------------------------------------------------------------
// Mortgage recast
// ---------------------------------------------------------------------------

export interface RecastResult {
  /** Payments made before the recast. */
  monthsIn: number
  balanceAtRecast: number
  /** Lump sum applied (capped at the balance). */
  lumpSum: number
  fee: number
  originalPayment: number
  /** Re-amortized payment over the months left. */
  newPayment: number
  monthlySavings: number
  /** Total interest over the life of the loan for each choice. */
  interestNoExtra: number
  interestRecast: number
  interestKeepPayment: number
  interestSavedRecast: number
  /** Interest saved less the lender's recast fee. */
  netSavingsRecast: number
  interestSavedKeepPayment: number
  /** Month the loan is paid off if you pay the lump sum but keep the original payment. */
  payoffMonthKeepPayment: number
  monthsSoonerKeepPayment: number
  termMonths: number
}

/** Pay `balance` down at `payment` a month: months taken and interest paid. */
function payOff(balance: number, monthlyRate: number, payment: number): { months: number; interest: number } {
  let remaining = balance
  let months = 0
  let interest = 0
  while (remaining > 0.005 && months < 1200) {
    const charge = remaining * monthlyRate
    interest += charge
    remaining = remaining + charge - Math.min(payment, remaining + charge)
    months++
  }
  return { months, interest }
}

/**
 * A recast: pay a lump sum toward principal some years into the loan and have
 * the lender re-amortize the rest over the remaining term at the same rate,
 * lowering the payment. Compared with no extra payment, and with paying the
 * same lump sum but keeping the original payment (paying off early instead).
 */
export function mortgageRecast(inputs: DealInputs): RecastResult | null {
  const { loanValue: principal, loanRate: rate, loanTerm: term, recastYears, recastLumpSum } = inputs
  const payment = monthlyMortgagePayment(principal, rate, term)
  if (!isNum(payment) || !isNum(principal) || !isNum(rate) || !isNum(term)) return null
  if (!isNum(recastYears) || !isNum(recastLumpSum) || recastLumpSum <= 0) return null
  const termMonths = Math.round(term * 12)
  const monthsIn = Math.round(recastYears * 12)
  if (monthsIn < 1 || monthsIn >= termMonths) return null

  const balanceAtRecast = loanBalanceAfter(principal, rate, term, monthsIn) as number
  const lumpSum = Math.min(recastLumpSum, balanceAtRecast)
  const balanceAfter = balanceAtRecast - lumpSum
  const monthsLeft = termMonths - monthsIn
  const newPayment = monthlyMortgagePayment(balanceAfter, rate, monthsLeft / 12) as number

  // Interest already paid is the same in every scenario.
  const interestSoFar = payment * monthsIn - (principal - balanceAtRecast)
  const interestNoExtra = interestSoFar + payment * monthsLeft - balanceAtRecast
  const interestRecast = interestSoFar + newPayment * monthsLeft - balanceAfter
  const keep = payOff(balanceAfter, rate / 100 / 12, payment)
  const interestKeepPayment = interestSoFar + keep.interest
  const fee = orZero(inputs.recastFee)

  return {
    monthsIn,
    balanceAtRecast,
    lumpSum,
    fee,
    originalPayment: payment,
    newPayment,
    monthlySavings: payment - newPayment,
    interestNoExtra,
    interestRecast,
    interestKeepPayment,
    interestSavedRecast: interestNoExtra - interestRecast,
    netSavingsRecast: interestNoExtra - interestRecast - fee,
    interestSavedKeepPayment: interestNoExtra - interestKeepPayment,
    payoffMonthKeepPayment: monthsIn + keep.months,
    monthsSoonerKeepPayment: monthsLeft - keep.months,
    termMonths,
  }
}

// ---------------------------------------------------------------------------
// Aggregated results
// ---------------------------------------------------------------------------

export interface DealResults {
  rentToArvRatioPct: number | null
  passesTwoPercentRule: boolean | null
  arvDifferenceMoney: number | null
  arvDifferencePercent: number | null
  preArvPricePerSqFt: number | null
  arvPricePerSqFt: number | null
  annualTaxAtSale: number | null
  annualTaxAtArv: number | null
  optimalRentRange: [number, number] | null
  grossRent: { months: number; amount: number | null }[]
  tenantIncome: { at25Percent: number; at30Percent: number } | null
  downPayment: number | null
  downPaymentPercent: number | null
  cashToClose: number | null
  monthlyMortgage: number | null
  monthlyMortgageWithFees: number | null
  totalLoanPayments: number | null
  closingCostPercent: number | null
  estimatedClosingRange: [number, number] | null
  pointValue: number | null
  pointsCost: number | null
  monthlyWithPoints: number | null
  totalPaymentsWithPoints: number | null
  savingsWithPoints: number | null
  pointsBreakEven: PointsBreakEven | null
  monthlyCashFlow: number | null
  monthlyCashFlowFiftyRule: number | null
  monthlyCashFlowTwentyFiveRule: number | null
  roiNoOverhead: number | null
  roiFiftyRule: number | null
  roiTwentyFiveRule: number | null
  homeValueByHorizon: (number | null)[]
  homeGainByHorizon: (number | null)[]
  cashFlowNoAppreciationByHorizon: (number | null)[]
  cashFlowWithAppreciationByHorizon: (number | null)[]
  totalInterest: number | null
  monthlyTax: number | null
  ownerHomeValueByHorizon: (number | null)[]
  ownerHomeGainByHorizon: (number | null)[]
  equityByHorizon: (number | null)[]
  monthlyOwnershipCost: number | null
  costOfOwnership: number | null
  rentVsBuyMonthly: number | null
  rentVsBuyByHorizon: (number | null)[]
  frontRatioPct: number | null
  passesFrontRatio: boolean | null
  incomeForFrontRatio: number | null
  monthlyInsurance: number | null
  monthlyPmi: number | null
  pmiMonths: number | null
  /** Whether the PMI figure is the built-in estimate (no rate entered). */
  pmiEstimated: boolean
  expenseBasis: ExpenseBasis
  monthlyOperatingExpenses: number | null
  expenseRatioPct: number | null
  monthlyCashFlowItemized: number | null
  roiItemized: number | null
  allInCost: number | null
  equityAtPurchase: number | null
  maxOfferSeventyRule: number | null
  passesSeventyRule: boolean | null
  cashInvested: number | null
  refinanceLoan: number | null
  refinancePayment: number | null
  cashOutAtRefinance: number | null
  cashLeftInDeal: number | null
  equityAfterRefinance: number | null
  cashFlowAfterRefinance: number | null
  cashFlowAfterRefinanceFiftyRule: number | null
  cashOnCashAfterRefinance: number | null
  breakEvenRent: number | null
  maxPriceToBreakEven: number | null
  maxRateToBreakEven: number | null
  maxPriceForFrontRatio: number | null
  maxRateForFrontRatio: number | null
  recast: RecastResult | null
}

export function computeResults(inputs: DealInputs): DealResults {
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  const fees = inputs.additionalMonthlyFees
  const feesOrZero = isNum(fees) ? fees : 0
  const dp = downPayment(inputs)
  const pointValue = mortgagePointValue(inputs.loanValue)
  const baseTotal = totalLoanPayments(inputs, 'loanRate')
  const pointsTotal = totalLoanPayments(inputs, 'loanPointRate')
  const annualGrossRent = grossRentForMonths(inputs.rentValue, 12)

  const pointsCost =
    isNum(pointValue) && isNum(inputs.pointsOffered) ? pointValue * inputs.pointsOffered : null

  const arv = inputs.propertyArvValue
  const homeValueByHorizon = ANALYSIS_HORIZONS.map((y) =>
    homeValueAfterYears(arv, inputs.appreciationRate, y),
  )
  const homeGainByHorizon = homeValueByHorizon.map((value) => {
    if (!isNum(value) || !isNum(arv)) return null
    return value - arv
  })

  // Homeowner projections start from the purchase price, not ARV.
  const ownerValueByHorizon = ANALYSIS_HORIZONS.map((y) =>
    homeValueAfterYears(inputs.propertyValue, inputs.appreciationRate, y),
  )
  const ownerGainByHorizon = ownerValueByHorizon.map((value) => {
    if (!isNum(value) || !isNum(inputs.propertyValue)) return null
    return value - inputs.propertyValue
  })
  const balanceByHorizon = ANALYSIS_HORIZONS.map((y) =>
    loanBalanceAfter(inputs.loanValue, inputs.loanRate, inputs.loanTerm, y * 12),
  )
  const equityByHorizon = ANALYSIS_HORIZONS.map((_y, i) => {
    const value = ownerValueByHorizon[i]
    const balance = balanceByHorizon[i]
    if (!isNum(value) || !isNum(balance)) return null
    return value - balance
  })
  const frontRatioPct = frontRatio(inputs)
  const pmi = monthlyPmi(inputs)
  const cashFlowItemized = monthlyCashFlowItemized(inputs)

  return {
    rentToArvRatioPct: rentToArvRatio(inputs),
    passesTwoPercentRule: passesTwoPercentRule(inputs),
    arvDifferenceMoney: arvDifferenceMoney(inputs),
    arvDifferencePercent: arvDifferencePercent(inputs),
    preArvPricePerSqFt: pricePerSqFt(inputs.propertyValue, inputs.propertySize),
    arvPricePerSqFt: pricePerSqFt(inputs.propertyArvValue, inputs.propertySize),
    annualTaxAtSale: annualPropertyTax(inputs.propertyValue, inputs.propertyTax),
    annualTaxAtArv: annualPropertyTax(inputs.propertyArvValue, inputs.propertyTax),
    optimalRentRange: optimalRentRange(inputs.propertyArvValue),
    grossRent: [12, 6, 3].map((months) => ({
      months,
      amount: grossRentForMonths(inputs.rentValue, months),
    })),
    tenantIncome: tenantIncomeRange(annualGrossRent),
    downPayment: dp,
    downPaymentPercent: downPaymentPercent(inputs),
    cashToClose: cashToClose(inputs),
    monthlyMortgage: payment,
    monthlyMortgageWithFees: isNum(payment) ? payment + feesOrZero : null,
    totalLoanPayments: baseTotal,
    closingCostPercent: closingCostPercent(inputs.closingCost, inputs.loanValue),
    estimatedClosingRange: estimatedClosingCostRange(inputs.loanValue),
    pointValue,
    pointsCost,
    monthlyWithPoints: monthlyMortgagePayment(
      inputs.loanValue,
      inputs.loanPointRate,
      inputs.loanTerm,
    ),
    totalPaymentsWithPoints: pointsTotal,
    savingsWithPoints:
      isNum(baseTotal) && isNum(pointsTotal) ? baseTotal - pointsTotal : null,
    pointsBreakEven: pointsBreakEven(inputs),
    monthlyCashFlow: monthlyCashFlow(inputs, 1),
    monthlyCashFlowFiftyRule: monthlyCashFlow(inputs, 0.5),
    monthlyCashFlowTwentyFiveRule: monthlyCashFlow(inputs, 0.75),
    roiNoOverhead: cashFlowRateOfReturn(inputs, 1),
    roiFiftyRule: cashFlowRateOfReturn(inputs, 0.5),
    roiTwentyFiveRule: cashFlowRateOfReturn(inputs, 0.75),
    homeValueByHorizon,
    homeGainByHorizon,
    cashFlowNoAppreciationByHorizon: ANALYSIS_HORIZONS.map((y) =>
      cumulativeCashFlowWithoutAppreciation(inputs, y),
    ),
    cashFlowWithAppreciationByHorizon: ANALYSIS_HORIZONS.map((y) =>
      cumulativeCashFlowWithAppreciation(inputs, y),
    ),
    totalInterest: totalInterest(inputs),
    monthlyTax: monthlyPropertyTax(inputs),
    ownerHomeValueByHorizon: ownerValueByHorizon,
    ownerHomeGainByHorizon: ownerGainByHorizon,
    equityByHorizon,
    monthlyOwnershipCost: monthlyOwnershipCost(inputs),
    costOfOwnership: costOfOwnership(inputs),
    rentVsBuyMonthly: rentVsBuyMonthly(inputs),
    rentVsBuyByHorizon: ANALYSIS_HORIZONS.map((y) => rentVsBuyCumulative(inputs, y)),
    frontRatioPct,
    passesFrontRatio:
      frontRatioPct == null ? null : frontRatioPct <= FRONT_RATIO_PASS_PERCENT,
    incomeForFrontRatio: incomeForFrontRatio(inputs),
    monthlyInsurance: monthlyInsurance(inputs),
    monthlyPmi: pmi,
    pmiMonths: pmiMonths(inputs),
    pmiEstimated: isNum(pmi) && pmi > 0 && !isNum(inputs.pmiRate),
    expenseBasis: expenseBasis(inputs),
    monthlyOperatingExpenses: monthlyOperatingExpenses(inputs),
    expenseRatioPct: expenseRatio(inputs),
    monthlyCashFlowItemized: cashFlowItemized,
    roiItemized: returnOnCash(cashFlowItemized, cashInvested(inputs)),
    allInCost: allInCost(inputs),
    equityAtPurchase: equityAtPurchase(inputs),
    maxOfferSeventyRule: maxOfferSeventyRule(inputs),
    passesSeventyRule: passesSeventyRule(inputs),
    cashInvested: cashInvested(inputs),
    refinanceLoan: refinanceLoan(inputs),
    refinancePayment: refinancePayment(inputs),
    cashOutAtRefinance: cashOutAtRefinance(inputs),
    cashLeftInDeal: cashLeftInDeal(inputs),
    equityAfterRefinance: equityAfterRefinance(inputs),
    cashFlowAfterRefinance: cashFlowAfterRefinance(inputs),
    cashFlowAfterRefinanceFiftyRule: cashFlowAfterRefinance(inputs, 'fiftyRule'),
    cashOnCashAfterRefinance: cashOnCashAfterRefinance(inputs),
    breakEvenRent: breakEvenRent(inputs),
    maxPriceToBreakEven: maxPriceToBreakEven(inputs),
    maxRateToBreakEven: maxRateToBreakEven(inputs),
    maxPriceForFrontRatio: maxPriceForFrontRatio(inputs),
    maxRateForFrontRatio: maxRateForFrontRatio(inputs),
    recast: mortgageRecast(inputs),
  }
}
