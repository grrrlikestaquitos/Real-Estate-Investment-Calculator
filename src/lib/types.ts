import { REGIONAL_MEDIAN_RATE_PERCENT } from './taxRates'

export type DealType = 'investment' | 'owner'

export interface DealInputs {
  propertyValue: number | null
  propertyArvValue: number | null
  propertyTax: number | null
  rentValue: number | null
  appreciationRate: number | null
  propertySize: number | null
  loanValue: number | null
  loanTerm: number | null
  loanRate: number | null
  loanPointRate: number | null
  pointsOffered: number | null
  closingCost: number | null
  additionalMonthlyFees: number | null
  rentYouPay: number | null
  householdIncome: number | null
  /** Rehab budget, paid in cash (investor). */
  rehabCost: number | null
  /** Insurance premium per year (both modes). */
  insuranceAnnual: number | null
  /** PMI as % of the loan per year; empty uses an estimate when under 20% down (homeowner). */
  pmiRate: number | null
  /** Operating expenses as % of gross rent (investor). */
  vacancyRate: number | null
  managementRate: number | null
  /** Repairs and capital expenditures. */
  maintenanceRate: number | null
  /** Refinance after rehab: loan as % of ARV, rate, term (empty = 30 yrs), closing costs (investor). */
  refiLtv: number | null
  refiRate: number | null
  refiTerm: number | null
  refiClosingCost: number | null
  /** Mortgage recast: when (years into the loan), the lump sum toward principal, and the lender's fee (both modes). */
  recastYears: number | null
  recastLumpSum: number | null
  recastFee: number | null
}

export type DealInputKey = keyof DealInputs

export interface Deal {
  id: string
  name: string
  type: DealType
  inputs: DealInputs
  createdAt: number
  updatedAt: number
}

export const DEFAULT_INPUTS: DealInputs = {
  propertyValue: null,
  propertyArvValue: null,
  // Typical greater Seattle rate; one click in the rate reference applies a specific city's.
  propertyTax: REGIONAL_MEDIAN_RATE_PERCENT,
  rentValue: null,
  appreciationRate: null,
  propertySize: null,
  loanValue: null,
  loanTerm: 30,
  loanRate: null,
  loanPointRate: null,
  pointsOffered: null,
  closingCost: null,
  additionalMonthlyFees: null,
  rentYouPay: null,
  householdIncome: null,
  rehabCost: null,
  insuranceAnnual: null,
  pmiRate: null,
  vacancyRate: null,
  managementRate: null,
  maintenanceRate: null,
  refiLtv: null,
  refiRate: null,
  refiTerm: null,
  refiClosingCost: null,
  recastYears: null,
  recastLumpSum: null,
  recastFee: null,
}

export const DEFAULT_DEAL_TYPE: DealType = 'investment'

export const ANALYSIS_HORIZONS: readonly number[] = [1, 5, 10, 15, 20, 30]
