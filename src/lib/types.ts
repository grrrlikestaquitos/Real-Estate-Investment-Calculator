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
  propertyTax: 2.57,
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
}

export const DEFAULT_DEAL_TYPE: DealType = 'investment'

export const ANALYSIS_HORIZONS: readonly number[] = [1, 5, 10, 15, 20, 30]
