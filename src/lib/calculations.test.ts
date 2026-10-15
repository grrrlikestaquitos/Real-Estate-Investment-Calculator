import { describe, expect, it } from 'vitest'
import type { DealInputs } from './types'
import { DEFAULT_INPUTS } from './types'
import {
  annualPropertyTax,
  arvDifferenceMoney,
  arvDifferencePercent,
  cashFlowRateOfReturn,
  cashToClose,
  closingCostPercent,
  computeResults,
  costOfOwnership,
  cumulativeCashFlowWithoutAppreciation,
  cumulativeCashFlowWithAppreciation,
  downPayment,
  downPaymentPercent,
  estimatedClosingCostRange,
  frontRatio,
  grossRentForMonths,
  homeValueAfterYears,
  loanBalanceAfter,
  loanForDownPayment,
  monthlyCashFlow,
  monthlyMortgagePayment,
  monthlyOwnershipCost,
  mortgagePointValue,
  optimalRentRange,
  passesTwoPercentRule,
  parseInput,
  pointsBreakEven,
  pricePerSqFt,
  rentToArvRatio,
  rentVsBuyCumulative,
  rentVsBuyMonthly,
  tenantIncomeRange,
  yearlyProjection,
  totalInterest,
  totalLoanPayments,
  allInCost,
  cashFlowAfterRefinance,
  cashInvested,
  cashLeftInDeal,
  cashOnCashAfterRefinance,
  cashOutAtRefinance,
  equityAfterRefinance,
  expenseBasis,
  expenseRatio,
  maxOfferSeventyRule,
  monthlyCashFlowItemized,
  monthlyOperatingExpenses,
  monthlyPmi,
  passesSeventyRule,
  pmiMonths,
  refinanceLoan,
  refinancePayment,
} from './calculations'

function deal(over: Partial<DealInputs> = {}): DealInputs {
  return { ...DEFAULT_INPUTS, ...over }
}

describe('parseInput', () => {
  it('returns null for empty or whitespace input', () => {
    expect(parseInput('')).toBeNull()
    expect(parseInput('   ')).toBeNull()
  })

  it('parses valid numbers', () => {
    expect(parseInput('123')).toBe(123)
    expect(parseInput('12.5')).toBe(12.5)
    expect(parseInput('-5')).toBe(-5)
    expect(parseInput('.5')).toBe(0.5)
  })

  it('ignores thousands separators, dollar signs and spaces', () => {
    expect(parseInput('320,000')).toBe(320000)
    expect(parseInput('$1,500.50')).toBe(1500.5)
    expect(parseInput(' 1 200 ')).toBe(1200)
  })

  it('returns null for invalid input', () => {
    expect(parseInput('abc')).toBeNull()
    expect(parseInput(',')).toBeNull()
    expect(parseInput('12a')).toBeNull()
  })
})

describe('rent-to-ARV ratio and 2% rule', () => {
  it('computes the ratio as a percentage', () => {
    expect(rentToArvRatio(deal({ rentValue: 2000, propertyArvValue: 100000 }))).toBe(2)
  })

  it('returns null when inputs are missing or ARV is zero', () => {
    expect(rentToArvRatio(deal())).toBeNull()
    expect(rentToArvRatio(deal({ rentValue: 100, propertyArvValue: 0 }))).toBeNull()
  })

  it('evaluates the 2% rule', () => {
    expect(passesTwoPercentRule(deal({ rentValue: 2000, propertyArvValue: 100000 }))).toBe(true)
    expect(passesTwoPercentRule(deal({ rentValue: 1500, propertyArvValue: 100000 }))).toBe(false)
    expect(passesTwoPercentRule(deal())).toBeNull()
  })
})

describe('ARV difference', () => {
  it('computes money and percent differences', () => {
    const inputs = deal({ propertyValue: 180000, propertyArvValue: 220000 })
    expect(arvDifferenceMoney(inputs)).toBe(40000)
    expect(arvDifferencePercent(inputs)).toBeCloseTo(18.1818, 3)
  })

  it('goes negative when paying above ARV', () => {
    const inputs = deal({ propertyValue: 220000, propertyArvValue: 200000 })
    expect(arvDifferenceMoney(inputs)).toBe(-20000)
    expect(arvDifferencePercent(inputs)).toBeCloseTo(-10, 6)
  })

  it('returns null when inputs are missing', () => {
    expect(arvDifferenceMoney(deal())).toBeNull()
    expect(arvDifferencePercent(deal({ propertyValue: 100 }))).toBeNull()
  })
})

describe('price per sq ft and taxes', () => {
  it('computes price per square foot', () => {
    expect(pricePerSqFt(200000, 2000)).toBe(100)
    expect(pricePerSqFt(200000, 0)).toBeNull()
    expect(pricePerSqFt(null, 2000)).toBeNull()
  })

  it('computes annual property tax', () => {
    expect(annualPropertyTax(200000, 2.57)).toBeCloseTo(5140, 6)
    expect(annualPropertyTax(200000, null)).toBeNull()
  })
})

describe('rent and tenant helpers', () => {
  it('computes optimal rent range (1-2% of ARV)', () => {
    const range = optimalRentRange(200000)
    expect(range).not.toBeNull()
    if (range) {
      expect(range[0]).toBeCloseTo(2000, 6)
      expect(range[1]).toBeCloseTo(4000, 6)
    }
    expect(optimalRentRange(null)).toBeNull()
  })

  it('computes gross rent for a number of months', () => {
    expect(grossRentForMonths(1500, 12)).toBe(18000)
    expect(grossRentForMonths(null, 12)).toBeNull()
  })

  it('computes tenant income ranges', () => {
    const range = tenantIncomeRange(18000)
    expect(range).not.toBeNull()
    if (range) {
      expect(range.at25Percent).toBeCloseTo(72000, 6)
      expect(range.at30Percent).toBeCloseTo(60000, 6)
    }
    expect(tenantIncomeRange(null)).toBeNull()
  })
})

describe('down payment', () => {
  it('computes amount and percent', () => {
    const inputs = deal({ propertyValue: 200000, loanValue: 160000 })
    expect(downPayment(inputs)).toBe(40000)
    expect(downPaymentPercent(inputs)).toBe(20)
  })

  it('returns null when inputs are missing', () => {
    expect(downPayment(deal({ propertyValue: 200000 }))).toBeNull()
  })

  it('derives a loan amount from a down payment percentage', () => {
    expect(loanForDownPayment(320000, 20)).toBe(256000)
    expect(loanForDownPayment(415000, 3.5)).toBe(400475)
    expect(loanForDownPayment(200000, 100)).toBe(0)
    expect(loanForDownPayment(null, 20)).toBeNull()
    expect(loanForDownPayment(0, 20)).toBeNull()
    expect(loanForDownPayment(200000, 120)).toBeNull()
  })

  it('adds closing costs to the down payment for cash to close', () => {
    expect(cashToClose(deal({ propertyValue: 200000, loanValue: 160000, closingCost: 6000 }))).toBe(
      46000,
    )
    expect(cashToClose(deal({ propertyValue: 200000, loanValue: 160000 }))).toBe(40000)
    expect(cashToClose(deal({ closingCost: 6000 }))).toBeNull()
  })
})

describe('monthlyMortgagePayment', () => {
  it('matches the classic 200k @ 6% over 30 years', () => {
    expect(monthlyMortgagePayment(200000, 6, 30)).toBeCloseTo(1199.1, 2)
  })

  it('uses principal / months at a 0% rate', () => {
    expect(monthlyMortgagePayment(200000, 0, 30)).toBeCloseTo(555.56, 2)
  })

  it('returns zero payment for a zero principal', () => {
    expect(monthlyMortgagePayment(0, 6, 30)).toBe(0)
  })

  it('returns null for invalid inputs', () => {
    expect(monthlyMortgagePayment(null, 6, 30)).toBeNull()
    expect(monthlyMortgagePayment(200000, null, 30)).toBeNull()
    expect(monthlyMortgagePayment(200000, 6, null)).toBeNull()
    expect(monthlyMortgagePayment(200000, 6, 0)).toBeNull()
    expect(monthlyMortgagePayment(200000, -1, 30)).toBeNull()
    expect(monthlyMortgagePayment(-1, 6, 30)).toBeNull()
  })
})

describe('total loan payments and closing costs', () => {
  it('multiplies the payment over the full term', () => {
    const inputs = deal({ loanValue: 200000, loanRate: 6, loanTerm: 30 })
    expect(totalLoanPayments(inputs, 'loanRate')).toBeCloseTo(1199.1 * 360, 0)
    expect(totalLoanPayments(deal({ loanRate: 6, loanTerm: 30 }), 'loanRate')).toBeNull()
  })

  it('computes closing cost percent and estimated range', () => {
    expect(closingCostPercent(4000, 200000)).toBe(2)
    expect(closingCostPercent(4000, 0)).toBeNull()
    expect(estimatedClosingCostRange(200000)).toEqual([4000, 10000])
  })
})

describe('mortgage points', () => {
  it('computes point value and break-even', () => {
    const inputs = deal({
      loanValue: 200000,
      loanTerm: 30,
      loanRate: 6,
      loanPointRate: 5.5,
      pointsOffered: 1,
    })
    expect(mortgagePointValue(200000)).toBe(2000)
    const be = pointsBreakEven(inputs)
    expect(be).not.toBeNull()
    if (be) {
      expect(be.savingsPerMonth).toBeCloseTo(63.5, 0)
      expect(be.monthsToBreakEven).toBeCloseTo(31.5, 0)
      expect(be.yearsToBreakEven).toBeCloseTo(2.6, 0)
    }
  })

  it('returns null when points are zero or there is no savings', () => {
    const inputs = deal({
      loanValue: 200000,
      loanTerm: 30,
      loanRate: 6,
      loanPointRate: 6,
      pointsOffered: 1,
    })
    expect(pointsBreakEven(inputs)).toBeNull()
    expect(
      pointsBreakEven(deal({ loanValue: 200000, loanTerm: 30, loanRate: 6, loanPointRate: 5.5 })),
    ).toBeNull()
  })
})

describe('monthly cash flow', () => {
  const inputs = deal({
    rentValue: 1500,
    loanValue: 200000,
    loanRate: 6,
    loanTerm: 30,
    additionalMonthlyFees: 100,
  })

  it('no overhead: rent minus payment minus fees', () => {
    expect(monthlyCashFlow(inputs, 1)).toBeCloseTo(1500 - 1199.1 - 100, 1)
  })

  it('applies the 50% rule to gross rent', () => {
    expect(monthlyCashFlow(inputs, 0.5)).toBeCloseTo(750 - 1199.1 - 100, 1)
  })

  it('applies the 25% rule to gross rent', () => {
    expect(monthlyCashFlow(inputs, 0.75)).toBeCloseTo(1125 - 1199.1 - 100, 1)
  })

  it('treats missing fees as zero', () => {
    const noFees = deal({ rentValue: 1500, loanValue: 200000, loanRate: 6, loanTerm: 30 })
    expect(monthlyCashFlow(noFees, 1)).toBeCloseTo(1500 - 1199.1, 1)
  })

  it('returns null without rent or loan inputs', () => {
    expect(monthlyCashFlow(deal(), 1)).toBeNull()
    expect(monthlyCashFlow(deal({ rentValue: 1500 }), 1)).toBeNull()
  })
})

describe('cash flow rate of return', () => {
  it('divides yearly cash flow by money down (down payment + closing)', () => {
    const inputs = deal({
      rentValue: 1500,
      propertyValue: 200000,
      loanValue: 170000,
      loanRate: 6,
      loanTerm: 30,
      closingCost: 5000,
    })
    // payment = 170k @ 6% / 30y = 1019.24; cf = 480.76; money down = 35k
    expect(cashFlowRateOfReturn(inputs, 1)).toBeCloseTo(16.48, 1)
  })

  it('returns null when money down is zero or inputs missing', () => {
    expect(
      cashFlowRateOfReturn(
        deal({ rentValue: 1500, propertyValue: 200000, loanValue: 200000, loanRate: 6, loanTerm: 30 }),
        1,
      ),
    ).toBeNull()
    expect(cashFlowRateOfReturn(deal({ rentValue: 1500 }), 1)).toBeNull()
  })
})

describe('appreciation', () => {
  it('compounds annually', () => {
    expect(homeValueAfterYears(100000, 5, 10)).toBeCloseTo(162889.46, 1)
    expect(homeValueAfterYears(100000, 0, 30)).toBe(100000)
  })

  it('returns null on missing inputs', () => {
    expect(homeValueAfterYears(null, 5, 10)).toBeNull()
    expect(homeValueAfterYears(100000, null, 10)).toBeNull()
  })
})

describe('cumulative cash flow', () => {
  const inputs = deal({
    rentValue: 1000,
    propertyArvValue: 100000,
    appreciationRate: 5,
    loanValue: 200000,
    loanRate: 0,
    loanTerm: 30,
  })

  it('without appreciation: constant monthly flow over years', () => {
    const monthly = 1000 - 200000 / 360
    expect(cumulativeCashFlowWithoutAppreciation(inputs, 1)).toBeCloseTo(monthly * 12, 1)
    expect(cumulativeCashFlowWithoutAppreciation(inputs, 5)).toBeCloseTo(monthly * 12 * 5, 1)
    expect(cumulativeCashFlowWithoutAppreciation(inputs, 0)).toBeNull()
  })

  it('with appreciation: year 1 rent stays flat, then rent re-prices annually', () => {
    const pmt = 200000 / 360
    // year 1: (1000 - pmt) * 12; year 2: (1050 - pmt) * 12
    expect(cumulativeCashFlowWithAppreciation(inputs, 1)).toBeCloseTo((1000 - pmt) * 12, 1)
    expect(cumulativeCashFlowWithAppreciation(inputs, 2)).toBeCloseTo(
      (1000 - pmt) * 12 + (1050 - pmt) * 12,
      1,
    )
    expect(cumulativeCashFlowWithAppreciation(deal({ rentValue: 1000 }), 2)).toBeNull()
  })
})

describe('loanBalanceAfter', () => {
  const PRINCIPAL = 200000
  const RATE = 6
  const TERM = 30

  it('returns the principal before any payments', () => {
    expect(loanBalanceAfter(PRINCIPAL, RATE, TERM, 0)).toBeCloseTo(PRINCIPAL, 0)
  })

  it('reaches zero at the end of the term', () => {
    expect(loanBalanceAfter(PRINCIPAL, RATE, TERM, TERM * 12)).toBe(0)
    expect(loanBalanceAfter(PRINCIPAL, RATE, TERM, TERM * 12 + 5)).toBe(0)
  })

  it('matches a step-by-step amortization schedule', () => {
    const pmt = monthlyMortgagePayment(PRINCIPAL, RATE, TERM)
    if (pmt == null) throw new Error('expected a monthly payment')
    const c = RATE / 100 / 12
    let balance = PRINCIPAL
    for (let month = 0; month < 120; month++) {
      balance = balance * (1 + c) - pmt
    }
    expect(loanBalanceAfter(PRINCIPAL, RATE, TERM, 120)).toBeCloseTo(balance, 6)
  })

  it('amortizes linearly at a 0% rate', () => {
    expect(loanBalanceAfter(120000, 0, 10, 24)).toBeCloseTo(120000 * (1 - 24 / 120), 6)
  })

  it('returns null on invalid inputs', () => {
    expect(loanBalanceAfter(null, RATE, TERM, 12)).toBeNull()
    expect(loanBalanceAfter(PRINCIPAL, RATE, null, 12)).toBeNull()
    expect(loanBalanceAfter(PRINCIPAL, -1, TERM, 12)).toBeNull()
  })
})

describe('cost of ownership', () => {
  // 100% financed; PMI is switched off here and covered in its own tests below
  const inputs = deal({
    propertyValue: 200000,
    propertyTax: 2.57,
    loanValue: 200000,
    loanRate: 6,
    loanTerm: 30,
    additionalMonthlyFees: 100,
    pmiRate: 0,
  })

  it('monthly cost = payment + tax + fees + 1% maintenance', () => {
    const payment = monthlyMortgagePayment(200000, 6, 30) as number
    const expected = payment + (200000 * 2.57) / 100 / 12 + 100 + (200000 * 0.01) / 12
    expect(monthlyOwnershipCost(inputs)).toBeCloseTo(expected, 6)
    expect(monthlyOwnershipCost(deal({ propertyValue: 200000 }))).toBeNull()
  })

  it('total cost spans the full loan term', () => {
    const monthly = monthlyOwnershipCost(inputs)
    expect(monthly).not.toBeNull()
    expect(costOfOwnership(inputs)).toBeCloseTo((monthly as number) * 12 * 30, 6)
    expect(
      costOfOwnership(deal({ propertyValue: 200000, loanValue: 200000, loanRate: 6, loanTerm: null })),
    ).toBeNull()
  })

  it('total interest = total payments minus principal', () => {
    const expected = (monthlyMortgagePayment(200000, 6, 30) as number) * 360 - 200000
    expect(totalInterest(inputs)).toBeCloseTo(expected, 6)
    expect(totalInterest(deal({ loanValue: 200000 }))).toBeNull()
  })
})

describe('rent vs buy', () => {
  const inputs = deal({
    propertyValue: 200000,
    propertyTax: 2.57,
    loanValue: 200000,
    loanRate: 6,
    loanTerm: 30,
    rentYouPay: 2200,
  })

  it('monthly savings = rent minus ownership cost', () => {
    const ownership = monthlyOwnershipCost(inputs)
    expect(ownership).not.toBeNull()
    expect(rentVsBuyMonthly(inputs)).toBeCloseTo(2200 - (ownership as number), 6)
  })

  it('cumulative savings scale with years', () => {
    const monthly = rentVsBuyMonthly(inputs)
    expect(monthly).not.toBeNull()
    expect(rentVsBuyCumulative(inputs, 10)).toBeCloseTo((monthly as number) * 120, 6)
    expect(rentVsBuyCumulative(inputs, 0)).toBeNull()
  })

  it('returns null without rent or loan inputs', () => {
    expect(rentVsBuyMonthly(deal({ rentYouPay: 2200 }))).toBeNull()
    expect(rentVsBuyMonthly(deal({}))).toBeNull()
  })
})

describe('front ratio', () => {
  const base = {
    propertyValue: 200000,
    propertyTax: 2.57,
    loanValue: 200000,
    loanRate: 6,
    loanTerm: 30,
    additionalMonthlyFees: 100,
    pmiRate: 0,
  }

  it('PITI as a percent of monthly income', () => {
    const pit = (monthlyMortgagePayment(200000, 6, 30) as number) + (200000 * 2.57) / 100 / 12 + 100
    expect(frontRatio(deal({ ...base, householdIncome: 8000 }))).toBeCloseTo((pit / 8000) * 100, 6)
  })

  it('includes insurance and PMI in the housing payment', () => {
    const withExtras = deal({ ...base, householdIncome: 8000, insuranceAnnual: 1200, pmiRate: 0.6 })
    const pit = (monthlyMortgagePayment(200000, 6, 30) as number) + (200000 * 2.57) / 100 / 12 + 100
    const extras = 100 + (200000 * 0.006) / 12
    expect(frontRatio(withExtras)).toBeCloseTo(((pit + extras) / 8000) * 100, 6)
  })

  it('returns null for missing or non-positive income', () => {
    expect(frontRatio(deal({ ...base }))).toBeNull()
    expect(frontRatio(deal({ ...base, householdIncome: 0 }))).toBeNull()
    expect(frontRatio(deal({ ...base, householdIncome: -100 }))).toBeNull()
  })
})

describe('computeResults', () => {
  it('computes the full result set from a populated deal', () => {
    const inputs = deal({
      propertyValue: 180000,
      propertyArvValue: 220000,
      propertyTax: 2,
      rentValue: 1900,
      appreciationRate: 5,
      propertySize: 1500,
      loanValue: 144000,
      loanTerm: 30,
      loanRate: 6,
      loanPointRate: 5.5,
      pointsOffered: 1,
      closingCost: 4000,
    })
    const r = computeResults(inputs)

    expect(r.rentToArvRatioPct).toBeCloseTo((1900 / 220000) * 100, 6)
    expect(r.passesTwoPercentRule).toBe(false)
    expect(r.downPayment).toBe(36000)
    expect(r.downPaymentPercent).toBeCloseTo(20, 6)
    expect(r.monthlyMortgage).toBeCloseTo(863.35, 0)
    expect(r.preArvPricePerSqFt).toBeCloseTo(120, 6)
    expect(r.arvPricePerSqFt).toBeCloseTo(146.67, 1)
    expect(r.annualTaxAtSale).toBe(3600)
    expect(r.optimalRentRange).not.toBeNull()
    if (r.optimalRentRange) {
      expect(r.optimalRentRange[0]).toBeCloseTo(2200, 6)
      expect(r.optimalRentRange[1]).toBeCloseTo(4400, 6)
    }
    expect(r.pointsCost).toBe(1440)
    expect(r.savingsWithPoints).not.toBeNull()
    expect(r.pointsBreakEven).not.toBeNull()
    expect(r.homeValueByHorizon).toHaveLength(6)
    expect(r.homeValueByHorizon[0]).toBeCloseTo(220000 * 1.05, 2)
    expect(r.homeGainByHorizon[0]).toBeCloseTo(220000 * 0.05, 2)
    expect(r.cashFlowWithAppreciationByHorizon[0]).not.toBeNull()
  })

  it('returns nulls everywhere for an empty deal', () => {
    const r = computeResults(deal())
    expect(r.rentToArvRatioPct).toBeNull()
    expect(r.monthlyMortgage).toBeNull()
    expect(r.monthlyCashFlow).toBeNull()
    expect(r.homeValueByHorizon.every((v) => v == null)).toBe(true)
  })

  it('computes homeowner-mode results from the purchase price', () => {
    const inputs = deal({
      propertyValue: 300000,
      propertyTax: 2,
      appreciationRate: 4,
      loanValue: 240000,
      loanTerm: 30,
      loanRate: 6,
      rentYouPay: 2500,
      householdIncome: 9000,
    })
    const r = computeResults(inputs)

    expect(r.ownerHomeValueByHorizon[0]).toBeCloseTo(300000 * 1.04, 1)
    expect(r.ownerHomeGainByHorizon[0]).toBeCloseTo(300000 * 0.04, 1)
    expect(r.equityByHorizon[0]).toBeCloseTo(
      300000 * 1.04 - (loanBalanceAfter(240000, 6, 30, 12) as number),
      1,
    )
    // At the end of the term the loan is paid off, so equity equals value.
    expect(r.equityByHorizon[5]).toBeCloseTo(r.ownerHomeValueByHorizon[5] as number, 0)
    expect(r.totalInterest).not.toBeNull()
    expect(r.monthlyTax).toBeCloseTo((300000 * 2) / 100 / 12, 6)
    expect(r.monthlyOwnershipCost).not.toBeNull()
    expect(r.costOfOwnership).not.toBeNull()
    expect(r.rentVsBuyMonthly).not.toBeNull()
    expect(r.frontRatioPct).toBeCloseTo(
      ((monthlyMortgagePayment(240000, 6, 30) as number) + 500) / 9000 * 100,
      6,
    )
    expect(r.passesFrontRatio).toBe(true)
  })

  it('computes front-ratio pass/fail', () => {
    const inputs = deal({
      propertyValue: 300000,
      propertyTax: 2,
      loanValue: 240000,
      loanTerm: 30,
      loanRate: 6,
      householdIncome: 6000,
    })
    const r = computeResults(inputs)
    // PITI ≈ 1938.92 → 32.3% of 6000, above the 28% ceiling.
    expect(r.frontRatioPct).toBeCloseTo(32.3, 0)
    expect(r.passesFrontRatio).toBe(false)
    expect(computeResults(deal({ ...inputs, householdIncome: null })).passesFrontRatio).toBeNull()
  })
})

describe('yearlyProjection', () => {
  const inputs = deal({
    propertyValue: 400000,
    appreciationRate: 3,
    loanValue: 320000,
    loanRate: 6,
    loanTerm: 30,
    rentValue: 3000,
    additionalMonthlyFees: 100,
  })

  it('has one point per year starting today', () => {
    const points = yearlyProjection(inputs)
    expect(points).toHaveLength(31)
    expect(points[0]).toMatchObject({ year: 0, homeValue: 400000, loanBalance: 320000, equity: 80000 })
    expect(points[0].cashFlow).toBe(0)
    expect(points[0].cashFlowWithAppreciation).toBe(0)
    expect(points[30].loanBalance).toBe(0)
    expect(points[30].equity).toBeCloseTo(points[30].homeValue ?? NaN, 6)
  })

  it('matches the horizon tables at the shared years', () => {
    const points = yearlyProjection(inputs)
    const results = computeResults(inputs)
    ;[1, 5, 10, 15, 20, 30].forEach((year, i) => {
      expect(points[year].equity).toBeCloseTo(results.equityByHorizon[i] ?? NaN, 6)
      expect(points[year].cashFlow).toBeCloseTo(results.cashFlowNoAppreciationByHorizon[i] ?? NaN, 6)
      expect(points[year].cashFlowWithAppreciation).toBeCloseTo(
        results.cashFlowWithAppreciationByHorizon[i] ?? NaN,
        6,
      )
    })
  })

  it('leaves series empty when their inputs are missing', () => {
    const points = yearlyProjection(deal({ propertyValue: 400000 }))
    expect(points.every((p) => p.equity == null && p.cashFlow == null)).toBe(true)
    // No appreciation rate: flat-rent cash flow still projects, re-priced does not
    const flat = yearlyProjection({ ...inputs, appreciationRate: null })
    expect(flat[5].cashFlow).not.toBeNull()
    expect(flat[5].cashFlowWithAppreciation).toBeNull()
  })
})

describe('PMI', () => {
  const home = deal({ propertyValue: 400000, loanValue: 380000, loanRate: 6, loanTerm: 30 })

  it('estimates 0.5% of the loan per year when under 20% down', () => {
    expect(monthlyPmi(home)).toBeCloseTo((380000 * 0.005) / 12, 6)
    expect(monthlyPmi({ ...home, pmiRate: 0.8 })).toBeCloseTo((380000 * 0.008) / 12, 6)
    expect(monthlyPmi({ ...home, pmiRate: 0 })).toBe(0)
  })

  it('is zero with 20% or more down', () => {
    expect(monthlyPmi({ ...home, loanValue: 320000 })).toBe(0)
    expect(pmiMonths({ ...home, loanValue: 320000 })).toBe(0)
  })

  it('ends when the balance amortizes to 78% of the price', () => {
    const months = pmiMonths(home) as number
    expect(months).toBeGreaterThan(0)
    expect(months).toBeLessThan(360)
    // 78% of 400k = 312k: the balance crosses it in that month, not before
    const balanceAt = (m: number) => loanBalanceAfter(380000, 6, 30, m) as number
    expect(balanceAt(months)).toBeLessThanOrEqual(312000)
    expect(balanceAt(months - 1)).toBeGreaterThan(312000)
  })

  it('only charges PMI for the months it applies over the term', () => {
    const monthly = monthlyOwnershipCost(home) as number
    const pmi = monthlyPmi(home) as number
    const months = pmiMonths(home) as number
    expect(costOfOwnership(home)).toBeCloseTo((monthly - pmi) * 360 + pmi * months, 6)
  })

  it('is null without a price or loan', () => {
    expect(monthlyPmi(deal({ loanValue: 380000 }))).toBeNull()
    expect(pmiMonths(deal({ propertyValue: 400000 }))).toBeNull()
  })
})

describe('itemized operating expenses', () => {
  const rental = deal({
    propertyValue: 200000,
    propertyTax: 1.2,
    rentValue: 2000,
    loanValue: 160000,
    loanRate: 6,
    loanTerm: 30,
    additionalMonthlyFees: 50,
    vacancyRate: 5,
    managementRate: 8,
    maintenanceRate: 10,
    insuranceAnnual: 1200,
  })
  // 23% of rent + insurance + tax on the sale price
  const opex = 2000 * 0.23 + 100 + (200000 * 0.012) / 12

  it('sums rent-based expenses, insurance, and property tax', () => {
    expect(monthlyOperatingExpenses(rental)).toBeCloseTo(opex, 6)
    expect(expenseRatio(rental)).toBeCloseTo((opex / 2000) * 100, 6)
  })

  it('computes itemized cash flow after mortgage and fees', () => {
    const payment = monthlyMortgagePayment(160000, 6, 30) as number
    expect(monthlyCashFlowItemized(rental)).toBeCloseTo(2000 - opex - payment - 50, 6)
  })

  it('stays off until an expense is entered', () => {
    const none = { ...rental, vacancyRate: null, managementRate: null, maintenanceRate: null, insuranceAnnual: null }
    expect(expenseBasis(none)).toBe('fiftyRule')
    expect(monthlyOperatingExpenses(none)).toBeNull()
    expect(monthlyCashFlowItemized(none)).toBeNull()
    expect(expenseBasis(rental)).toBe('itemized')
    // A single expense is enough to switch to the itemized basis
    expect(monthlyOperatingExpenses({ ...none, insuranceAnnual: 1200 })).toBeCloseTo(
      100 + (200000 * 0.012) / 12,
      6,
    )
  })
})

describe('BRRR: rehab and refinance', () => {
  const brrr = deal({
    propertyValue: 150000,
    propertyArvValue: 250000,
    rehabCost: 30000,
    closingCost: 5000,
    loanValue: 120000,
    loanRate: 10,
    loanTerm: 30,
    rentValue: 2200,
    refiLtv: 75,
    refiRate: 7,
    refiClosingCost: 4000,
  })

  it('applies the 70% rule to ARV minus rehab', () => {
    expect(allInCost(brrr)).toBe(185000)
    // 250k × 70% − 30k rehab = 145k, so paying 150k fails
    expect(maxOfferSeventyRule(brrr)).toBe(145000)
    expect(passesSeventyRule(brrr)).toBe(false)
    expect(passesSeventyRule({ ...brrr, propertyValue: 145000 })).toBe(true)
    expect(passesSeventyRule({ ...brrr, propertyArvValue: null })).toBeNull()
  })

  it('tracks cash in, cash out, and cash left after the refinance', () => {
    // in: 30k down + 5k closing + 30k rehab
    expect(cashInvested(brrr)).toBe(65000)
    expect(refinanceLoan(brrr)).toBe(187500)
    // 187.5k new loan − 120k payoff − 4k refi closing
    expect(cashOutAtRefinance(brrr)).toBe(63500)
    expect(cashLeftInDeal(brrr)).toBe(1500)
    expect(equityAfterRefinance(brrr)).toBe(62500)
  })

  it('uses the refinanced payment for cash flow and cash-on-cash return', () => {
    const payment = monthlyMortgagePayment(187500, 7, 30) as number
    expect(refinancePayment(brrr)).toBeCloseTo(payment, 6)
    const cashFlow = 2200 * 0.5 - payment
    expect(cashFlowAfterRefinance(brrr)).toBeCloseTo(cashFlow, 6)
    expect(cashOnCashAfterRefinance(brrr)).toBeCloseTo(((cashFlow * 12) / 1500) * 100, 6)
  })

  it('defaults the refinance term to 30 years', () => {
    expect(refinancePayment({ ...brrr, refiTerm: 15 })).toBeCloseTo(
      monthlyMortgagePayment(187500, 7, 15) as number,
      6,
    )
    expect(refinancePayment(brrr)).toBeCloseTo(monthlyMortgagePayment(187500, 7, 30) as number, 6)
  })

  it('has no cash-on-cash return once all cash is pulled out', () => {
    const allOut = { ...brrr, refiLtv: 80 }
    expect(cashLeftInDeal(allOut)).toBeLessThan(0)
    expect(cashOnCashAfterRefinance(allOut)).toBeNull()
  })

  it('switches to itemized cash flow after refi when expenses are entered', () => {
    const itemized = { ...brrr, vacancyRate: 5 }
    const payment = refinancePayment(itemized) as number
    const tax = (150000 * (DEFAULT_INPUTS.propertyTax as number)) / 100 / 12 // default rate, on the sale price
    expect(cashFlowAfterRefinance(itemized)).toBeCloseTo(2200 - 2200 * 0.05 - tax - payment, 6)
    expect(cashFlowAfterRefinance(itemized, 'fiftyRule')).toBeCloseTo(2200 * 0.5 - payment, 6)
  })

  it('counts rehab in the cash return on investment', () => {
    const before = cashFlowRateOfReturn({ ...brrr, rehabCost: null }) as number
    const after = cashFlowRateOfReturn(brrr) as number
    expect(after).toBeLessThan(before)
    expect(after).toBeCloseTo(((monthlyCashFlow(brrr) as number) * 12 / 65000) * 100, 6)
  })
})

