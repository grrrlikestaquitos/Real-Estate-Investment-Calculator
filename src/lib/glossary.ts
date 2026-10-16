import { DEFAULT_PMI_RATE_PERCENT, FRONT_RATIO_PASS_PERCENT, SEVENTY_RULE_PERCENT } from './calculations'

export interface GlossaryEntry {
  /** The term as a reader would say it ("ARV", "the 2% rule"). */
  term: string
  text: string
}

/** Plain-language explanations behind the "?" tips. */
export const GLOSSARY = {
  arv: {
    term: 'ARV',
    text: 'After-repair value: what the property should be worth once the rehab is done. A refinance is based on it.',
  },
  closingCosts: {
    term: 'closing costs',
    text: 'Lender, title, escrow, and recording fees paid when you buy, typically 2–5% of the loan.',
  },
  otherFees: {
    term: 'other monthly fees',
    text: 'Fixed monthly costs not counted elsewhere, like HOA dues or utilities you pay as the owner.',
  },
  pmi: {
    term: 'PMI',
    text: `Private mortgage insurance. Conventional lenders require it with less than 20% down; it ends once the balance falls to 78% of the price. Left empty, ${DEFAULT_PMI_RATE_PERCENT}% of the loan a year is assumed.`,
  },
  vacancy: {
    term: 'vacancy',
    text: 'Rent lost while the unit sits empty between tenants. 5% is about 18 days a year.',
  },
  management: {
    term: 'management',
    text: "A property manager's fee, usually 8–10% of the rent collected. Use 0 if you manage it yourself.",
  },
  capex: {
    term: 'CapEx',
    text: 'Capital expenditures: money set aside for big replacements like the roof, HVAC, and water heater, on top of everyday repairs.',
  },
  ltv: {
    term: 'loan-to-value',
    text: 'The new loan as a share of the appraised value (ARV). Cash-out refinances on rentals usually allow 70–75%.',
  },
  points: {
    term: 'mortgage points',
    text: 'Upfront fees paid to the lender for a lower rate. Each point costs 1% of the loan, so it pays off only if you keep the loan past the break-even.',
  },
  twoPercentRule: {
    term: 'the 2% rule',
    text: "A quick cash-flow screen: monthly rent should be at least 2% of the property's value. Few markets meet it today; 1% is a common fallback.",
  },
  seventyRule: {
    term: `the ${SEVENTY_RULE_PERCENT}% rule`,
    text: `Pay no more than ${SEVENTY_RULE_PERCENT}% of ARV minus the rehab. The rest covers holding costs, closing, and your margin.`,
  },
  fiftyRule: {
    term: 'the 50% rule',
    text: 'Assume half the rent goes to operating expenses (taxes, insurance, repairs, vacancy, management). The mortgage comes out of the other half.',
  },
  twentyFiveRule: {
    term: 'the 25% rule',
    text: 'A lighter estimate that sets aside a quarter of the rent for operating expenses. Itemize expenses to use your own numbers instead.',
  },
  frontRatio: {
    term: `the ${FRONT_RATIO_PASS_PERCENT}% rule`,
    text: `Lenders like the housing payment (mortgage, property tax, insurance, PMI, HOA) to stay under ${FRONT_RATIO_PASS_PERCENT}% of gross monthly income.`,
  },
  cashNeeded: {
    term: 'cash needed',
    text: 'Everything you pay out of pocket to buy and fix it up: down payment, closing costs, and the rehab budget.',
  },
  cashOnCash: {
    term: 'cash-on-cash return',
    text: 'A year of cash flow divided by the cash you put in. It shows what your money earns, not counting appreciation or loan paydown.',
  },
  equityAtPurchase: {
    term: 'equity at purchase',
    text: 'ARV minus everything you paid to get there (price, rehab, closing): the value the deal and the rehab create.',
  },
  cashLeftInDeal: {
    term: 'cash left in the deal',
    text: "Cash you put in that the refinance doesn't give back. BRRR aims to get this near zero so the money can fund the next deal.",
  },
  cashToClose: {
    term: 'cash to close',
    text: 'Down payment plus closing costs: what you bring on closing day.',
  },
  ownershipCost: {
    term: 'monthly ownership cost',
    text: 'Mortgage, property tax, insurance, PMI, fees, and about 1% of the price a year set aside for maintenance.',
  },
  recast: {
    term: 'a recast',
    text: "Pay a lump sum toward principal and the lender re-spreads what's left over the remaining term at the same rate, so the payment drops. It's usually a $150–$500 fee, with no new loan or credit check.",
  },
  breakEven: {
    term: 'break-even',
    text: 'The point where rent just covers the mortgage, fees, and operating expenses, so monthly cash flow is $0. Each figure changes one input and holds the rest as entered.',
  },
  equity: {
    term: 'equity',
    text: 'Home value minus what you still owe. It grows as you pay down the loan and as the home appreciates (enter an appreciation rate to project it).',
  },
  priceBuffer: {
    term: 'price buffer',
    text: 'Headroom above your max price, as a percent of it. Listings priced above the max but within the buffer appear in a second group, so a slightly-over-asking property still makes the screen.',
  },
} satisfies Record<string, GlossaryEntry>
