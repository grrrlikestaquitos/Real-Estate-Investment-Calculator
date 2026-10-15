import type { DealInputs } from './types'
import { ANALYSIS_HORIZONS } from './types'

function isNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v)
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

/** Yearly cash-flow return on the money put down (down payment + closing costs). */
export function cashFlowRateOfReturn(inputs: DealInputs, rentFraction = 1): number | null {
  const cashFlow = monthlyCashFlow(inputs, rentFraction)
  const dp = downPayment(inputs)
  const { closingCost } = inputs
  if (!isNum(cashFlow) || !isNum(dp)) return null
  const moneyDown = dp + (isNum(closingCost) ? closingCost : 0)
  if (moneyDown === 0) return null
  return ((cashFlow * 12) / moneyDown) * 100
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

/**
 * What it costs per month to own the home: mortgage payment + property tax +
 * additional monthly fees + a ~1% annual maintenance reserve on the price.
 */
export function monthlyOwnershipCost(inputs: DealInputs): number | null {
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  const { propertyValue, additionalMonthlyFees: fees } = inputs
  if (!isNum(payment) || !isNum(propertyValue)) return null
  const tax = monthlyPropertyTax(inputs) ?? 0
  const monthlyFees = isNum(fees) ? fees : 0
  const maintenance = (propertyValue * MAINTENANCE_RATE_PERCENT) / 100 / 12
  return payment + tax + monthlyFees + maintenance
}

/** Total cost of owning over the full loan term (payment, tax, fees, maintenance). */
export function costOfOwnership(inputs: DealInputs): number | null {
  const monthly = monthlyOwnershipCost(inputs)
  const { loanTerm } = inputs
  if (!isNum(monthly) || !isNum(loanTerm)) return null
  return monthly * 12 * loanTerm
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

/** Cumulative savings vs renting over `years`, assuming the rent stays flat. */
export function rentVsBuyCumulative(inputs: DealInputs, years: number): number | null {
  const monthly = rentVsBuyMonthly(inputs)
  if (!isNum(monthly) || years <= 0) return null
  return monthly * 12 * years
}

/**
 * Front ratio: PITI (payment + property tax + additional fees) as a
 * percentage of monthly household income.
 */
export function frontRatio(inputs: DealInputs): number | null {
  const { householdIncome: income, additionalMonthlyFees: fees } = inputs
  const payment = monthlyMortgagePayment(inputs.loanValue, inputs.loanRate, inputs.loanTerm)
  if (!isNum(income) || income <= 0 || !isNum(payment)) return null
  const tax = monthlyPropertyTax(inputs) ?? 0
  const monthlyFees = isNum(fees) ? fees : 0
  return ((payment + tax + monthlyFees) / income) * 100
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
  }
}
