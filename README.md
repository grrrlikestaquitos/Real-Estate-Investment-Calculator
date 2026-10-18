# Real Estate Investment Calculator (BRRR)

A single-page web app for evaluating real estate opportunities in two modes:

- **Investor (rental)** — screen BRRR investments: the 2% and 70% rules, rehab
  and refinance (cash out, cash left in, return after refi), cash flow from rules
  of thumb or itemized expenses, ROI, appreciation, and mortgage/points analysis.
- **Homeowner** — evaluate a home you'd actually live in: equity over time,
  total cost of ownership (including insurance and PMI), rent-vs-buy, and
  affordability (front ratio).

Each saved deal has its own mode, so investment screens and home searches can
coexist and be compared side by side.

Built with React + TypeScript, bundled with Vite, and tested with Vitest +
Testing Library.

## Features

- **Live results** — every metric recomputes as you type; unavailable values show `—`
  instead of `NaN`.
- **Fast input** — dollar amounts get thousands separators as you type (`320,000`),
  the form is a compact two-column grid, and **down payment quick picks** (3.5%–25%)
  fill in the loan amount from the sale price. Mortgage points are tucked into an
  optional, collapsible group.
- **Streamlined layout** — on wide screens the inputs sit in a sticky, scrollable left
  column while results fill the right; verdict cards show the actual numbers behind
  each rule, a **key numbers** strip surfaces the metrics that matter most, and
  secondary analysis (points, tenant screening, multi-year projections) is tucked
  behind a collapsed **Advanced Analysis** disclosure.
- **Two modes per deal** — Investor (rental/BRRR) and Homeowner (own it and live
  in it), toggleable on any deal.
- **Deal health at a glance** — investor: 2% rule, 70% rule (max offer), monthly
  cash flow, 50%-rule cash flow; homeowner: affordability (28% front ratio) and
  rent-vs-own savings.
- **Rehab & refinance** — enter a rehab budget and (optionally) refinance terms to
  see all-in cost, the 70% rule max offer, cash invested, cash out at refinance,
  cash left in the deal, and cash flow / cash-on-cash return after the refinance.
- **Itemized expenses** — optionally enter vacancy, management, repairs & CapEx
  (as % of rent) and insurance; an itemized cash flow then appears next to the
  50%/25% rule estimates and becomes the headline cash-flow figure.
- **Multiple deals** — deals live in a tab bar; click the name to rename it inline,
  **Duplicate** a deal to try a different scenario, and **Delete** or **Clear all**
  with a one-click **Undo**. Everything is auto-saved to `localStorage` (the header
  shows the save status), so a refresh keeps your work.
- **Backups** — **Export** downloads all deals as a JSON file; **Import** restores
  or merges one (deals with the same id are replaced, new ones are added).
- **Comparison view** — with two or more deals, **Compare** opens a side-by-side
  table grouped into purchase, financing, rental returns, and living-there metrics.
  Check or uncheck deals to choose which ones are compared (remembered between
  visits). The best value in each row is highlighted, 2% and 28% rules show
  Pass/Fail badges, and rows that don't apply to any compared deal are hidden.
- **Charts over time** — homeowner deals chart home value and equity, investor
  deals chart cumulative cash flow (rent held flat vs. growing with appreciation),
  year by year over 30 years. Hover (or focus the chart and use the arrow keys) to
  read any year; each chart has a **View as table** fallback.
- **Phone summary bar** — on phones and tablets, where results sit below the form,
  a bar pinned to the bottom of the screen shows the payment, cash flow (or monthly
  cost), and pass/fail checks for the key rules while you type. It stays above the
  on-screen keyboard, hides once the results scroll into view, and tapping it
  jumps to the full results.
- **Light & dark themes** — follows the OS setting until you pick one with the
  sun/moon button in the header; the choice is remembered.
- **Shareable links** — "Copy Link" encodes the deal into the URL hash; opening the
  link anywhere (even in a different browser) recreates the deal with its inputs.
- **Property tax rate reference** — a collapsible table of 2026 total property tax
  rates for 59 greater Seattle area cities (King + Snohomish counties, official
  county assessor publications); one click fills the Property Tax Rate input.
- **Find listings (NWMLS data)** — screens the NWMLS CSV exports in `Data/`
  and ranks them with a **0–100 score from one of two perspectives**, switched
  at the top of the page (each keeps its own assumptions and sort):
  - **Investor (Rental)** — estimated rent, cash flow and cap rate under your
    rental assumptions (down payment, rate, rent per sqft, vacancy, repairs,
    management, insurance, closing costs). Scores value, cap rate, seller
    motivation (price cuts, days on market) and upside (ADU, in-law, fixer or
    investor mentions, large house lots).
  - **Homeowner** — the monthly cost a lender counts (mortgage, tax,
    insurance, PMI under 20% down, HOA), its share of your household income,
    and cash to close. Scores value, affordability, condition (new, recently
    built or updated; fixers get nothing), livability (yard, 2-car garage,
    notable view, waterfront) and negotiation room.

  Both penalize HOA dues and restrictions, and every card lists the reasons
  behind its score. **$/sqft is compared with similar homes**: the same
  property type in the same city within ±25% of the size. **Rent is scaled
  by ZIP** using Census median rents, and the details show each ZIP's
  median rent and household income. NWMLS often lists one home twice (as
  residential and as a condo); those are **folded into one card** marked
  "Also listed as Condo". Filter by price, size, beds, HOA, cities
  (checklist), property type, price-reduced and value-add; **★ shortlist**
  the ones worth a visit. **Details** shows the full numbers, public remarks
  and Zillow/Redfin/map links, and **New deal** opens an investor or
  homeowner deal (matching the perspective) with the numbers filled in.
  Overlapping exports are merged by listing number and can be toggled;
  **Import CSV…** adds another export in the browser.

## What it calculates

| Metric | Mode | Formula / convention |
| --- | --- | --- |
| Rent / ARV ratio | Investor | `rent / ARV × 100`; passes the **2% rule** at ≥ 2% |
| ARV difference | Investor | `ARV − sale price`, in dollars and percent |
| Price per sq ft | Both | sale price (and ARV) divided by square footage |
| Annual property tax | Both | `value × tax rate%` |
| Optimal rent range | Investor | 1%–2% of ARV (the 1%–2% rule) |
| Tenant income range | Investor | annual gross rent ÷ 25% and ÷ 30% (rent-to-income screening) |
| Down payment | Both | `sale price − loan amount`, and as a percent of the sale price |
| Cash to close | Both | down payment + closing costs |
| All-in cost | Investor | sale price + rehab + closing costs |
| 70% rule | Investor | max offer = `ARV × 70% − rehab`; passes when the sale price is at or below it |
| Cash invested | Investor | down payment + closing costs + rehab |
| Refinance | Investor | new loan = `ARV × LTV%`; cash out = new loan − purchase loan payoff − refi closing costs; cash left in = cash invested − cash out; payment uses the refi rate and term (30 yrs if empty) |
| Itemized operating expenses | Investor | `rent × (vacancy + management + repairs & CapEx)%` + insurance/12 + property tax (on the sale price) |
| Expense ratio | Investor | operating expenses ÷ rent (compare with the 50% rule) |
| Monthly mortgage payment | Both | standard fixed-rate amortization; a 0% rate uses `principal / months` |
| Total over term | Both | monthly payment × total months (principal & interest only) |
| Total interest | Both | total over term − loan amount |
| Closing costs | Both | your actual cost as % of the loan, plus a 2%–5% estimate range |
| Points break-even | Both | `points cost ÷ monthly savings` with the lower (pointed) rate |
| Monthly cash flow | Investor | `rent × k − mortgage − fees`, where `k = 1` (no overhead), `0.5` (50% rule), or `0.75` (25% rule). The rule is applied to **gross rent**; the 50%/25% figures represent assumed operating expenses. Itemized: `rent − operating expenses − mortgage − fees`. |
| Yearly ROI | Investor | yearly cash flow ÷ cash invested (`down payment + closing costs + rehab`) |
| Cash flow after refi | Investor | same formulas with the refinanced payment; itemized when expenses are entered, otherwise the 50% rule. Cash-on-cash = yearly cash flow ÷ cash left in (unlimited when no cash is left in) |
| Home value over time | Investor | `ARV × (1 + appreciation%)^years`, at 1/5/10/15/20/30-year horizons |
| Cash flow over time | Investor | cumulative monthly cash flow; the "with appreciation" variant re-prices rent at the appreciation rate starting in year 2, while the mortgage payment stays fixed |
| Home value over time | Homeowner | same compounding, but from the **purchase price** (ARV is hidden in this mode); charted yearly with equity |
| Equity over time | Homeowner | projected value − remaining loan balance at each horizon (balance from standard amortization; a cash purchase shows full value) |
| PMI | Homeowner | while the loan is over 80% of the price: `loan × PMI rate / 12` (0.5%/yr estimate when empty; 0 disables), ending when the balance amortizes to 78% of the price |
| Monthly ownership cost | Homeowner | mortgage + property tax + insurance + PMI + fees + **1% of the price per year** as a maintenance reserve |
| Total cost of ownership | Homeowner | monthly ownership cost × 12 × loan term, counting PMI only for the months it applies |
| Rent vs buy | Homeowner | `rent you'd otherwise pay − monthly ownership cost`, monthly and cumulative (rent held flat) |
| Front ratio | Homeowner | housing cost (payment + tax + insurance + PMI + fees) ÷ monthly household income; passes at ≤ **28%** |

## Getting started

```bash
yarn install
yarn dev        # start the dev server (http://localhost:5173)
```

## Scripts

| Command | Description |
| --- | --- |
| `yarn dev` | Start the dev server with hot reload |
| `yarn build` | Type-check and build the production bundle to `dist/` |
| `yarn preview` | Serve the production build locally |
| `yarn test` | Run the test suite once |
| `yarn test:watch` | Run tests in watch mode |
| `yarn lint` | Lint with oxlint |

## Project structure

```
Data/                 NWMLS CSV exports, bundled at build time (vite.config.ts)
scripts/
  zip-stats.mjs       Regenerates src/lib/zipStats.json from Census ACS files
src/
  lib/
    types.ts          Deal model + default inputs
    calculations.ts   Pure metric functions (no React, fully unit-tested)
    mls.ts            NWMLS CSV parsing → listings (also used by vite.config.ts)
    screening.ts      Comps, rent and cost estimates, investor/homeowner scores, filters, sorting
    zipStats.json     Median rent and household income by Washington ZIP (Census ACS)
    storage.ts        localStorage persistence, shareable-link codec, JSON backups
    clipboard.ts      Clipboard helper
    format.ts         Currency/percent formatting + live digit grouping for inputs
    chart.ts          Axis tick helper for the SVG charts
    taxRates.ts       Greater Seattle 2026 property tax rates (reference data)
  hooks/
    useDeals.ts       Deal state: create/duplicate/rename/delete/restore/import + persistence
    useListings.ts    Find-listings state: datasets, perspective, filters, assumptions, sort, shortlist
    useToast.ts       Transient messages with an optional Undo action
    useTheme.ts       Light/dark theme (OS default, saved override)
    useCompareSelection.ts  Which deals the comparison includes
    useViewport.ts    Media queries, on-screen keyboard inset, in-view tracking
  components/         UI building blocks (fields, cards, tables, indicators),
                      incl. ListingsView/ListingCard for the Find-listings tool
  App.tsx             Page layout
```

## Conventions & assumptions

- Inputs are optional. Any missing input simply leaves the dependent results as `—`.
- The property tax rate defaults to the **median greater Seattle rate** in the
  reference list (0.89% for 2026, computed from the data) and the loan term to 30
  years; both can be changed. Under the Property Tax Rate field there is a **greater Seattle rate
  reference** (2026 tax year): King County cities show the lowest–highest rate
  across parcels (the "Use" button applies the highest, conservatively) and
  Snohomish County cities show the assessor's "predominant" rate. Sources:
  [King County Assessor — 2026 Property Tax Levy Rate
  Distribution](https://cdn.kingcounty.gov/-/media/king-county/depts/assessor/buildings-property/reports/annual-reports/2026/26levydistricts.ashx)
  and [Snohomish County Assessor — 2026 Property Tax
  Information](https://www.snohomishcountywa.gov/DocumentCenter/View/141983/Press-Release-Jan-30-2026).
  Rates are approximations for budgeting; a specific parcel's rate can differ
  (fire/school district boundaries), so verify with the county assessor. Pierce
  County cities (Tacoma, Puyallup, …) are not listed.
- The down payment percentage is relative to the **sale price**; closing cost
  percentages are relative to the **loan** amount.
- Cash flow figures are after the mortgage payment and other monthly fees. The
  50%/25% rules stand in for operating expenses; enter itemized expenses for your
  own numbers. Percent-of-rent expenses apply to gross rent.
- The refinance assumes the purchase loan is paid off near its original balance
  (a short rehab) and that rehab is paid in cash. PMI is modeled for homeowner
  deals only; investment loans usually need 15%+ down, so investor deals offer
  15/20/25% down picks.
- **Investor mode** projections start from ARV; **homeowner mode** projections start
  from the purchase price.
- Ownership costs include a flat **1% of the price per year** as a maintenance
  reserve; property tax is computed from the sale price (no re-assessment modeled).
- Rent vs buy assumes the rent you'd otherwise pay **stays flat**; appreciation and
  equity growth are upside not included in the rent column. PMI drops out of the
  cumulative comparison once it ends.
- The affordability check uses the **28% front ratio** (housing cost vs gross
  income); it does not model back ratio (DTI) or down-payment sources.
- Find listings works on the **snapshot** in the CSV exports; re-export from
  NWMLS and rebuild (or import the new CSV) to refresh. The exports are parsed
  at build time and only public fields reach the page: **agent-only remarks are
  never bundled**. The export leaves out upper-floor bedrooms, so bedrooms come
  from the remarks ("3-bedroom") when they say, and otherwise show as a floor
  ("2+ bd") that the Min beds filter doesn't rule out. Rent is an estimate:
  rent per sqft up to 1,500 sqft and half that beyond (big homes rent for less
  per foot), times the listing's ZIP median rent over the typical ZIP's in the
  data (kept within ×0.75–×1.35); check real rent comps before offering. ZIP
  figures are the Census Bureau's ACS 2020–2024 5-year estimates (median gross
  rent B25064, median household income B19013); `node scripts/zip-stats.mjs`
  refreshes them. ZIP rent only feeds the rent estimate; ZIP income is shown
  for context and never scored. Both lag today's market. Comps need at least 5 other listings: similar-size homes of
  the same type in the city, then that type in the city at any size, then
  similar-size homes of that type in every city, then that type, then
  everything. The score ranks listings against each other; it is
  not an absolute verdict.

Developed & maintained by Andrei Villasana.
