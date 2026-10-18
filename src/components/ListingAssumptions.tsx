import { formatNumber } from '../lib/format'
import { RENT_TAPER_SQFT } from '../lib/screening'
import type { ListingsApi } from '../hooks/useListings'
import { Field } from './Field'
import { Section } from './Section'

/** The assumptions behind every listing's numbers, for the current perspective. */
export function ListingAssumptions({ api }: { api: ListingsApi }) {
  const isOwner = api.perspective === 'owner'
  const tax = (
    <p className="note">
      Property tax uses each city's 2026 rate (the regional median where the city isn't in the
      table); HOA dues come from the listing.
      {isOwner ? ' PMI is estimated under 20% down.' : ''}
    </p>
  )
  const reset = (
    <button type="button" className="btn btn-small btn-ghost" onClick={api.resetAssumptions}>
      Reset assumptions
    </button>
  )

  if (isOwner) {
    const o = api.owner
    return (
      <Section title="Buying assumptions" subtitle="Used for every listing's monthly cost">
        <div className="field-grid">
          <Field
            id="owner-income"
            label="Household income"
            prefix="$"
            suffix="/yr"
            grouped
            wide
            value={o.householdIncome}
            onChange={(v) => api.updateOwner({ householdIncome: v })}
            placeholder="150,000"
            hint="Gross, before tax. Scores affordability: the payment as a share of income"
          />
          <Field
            id="owner-down"
            label="Down payment"
            suffix="%"
            value={o.downPct}
            onChange={(v) => api.updateOwner({ downPct: v })}
          />
          <Field
            id="owner-rate"
            label="Interest rate"
            suffix="%"
            value={o.rate}
            onChange={(v) => api.updateOwner({ rate: v })}
          />
          <Field
            id="owner-insurance"
            label="Insurance"
            suffix="% / yr"
            value={o.insurancePct}
            onChange={(v) => api.updateOwner({ insurancePct: v })}
          />
          <Field
            id="owner-closing"
            label="Closing costs"
            suffix="%"
            value={o.closingPct}
            onChange={(v) => api.updateOwner({ closingPct: v })}
          />
        </div>
        {tax}
        {reset}
      </Section>
    )
  }

  const a = api.investor
  return (
    <Section title="Rental assumptions" subtitle="Used for every listing's rent, cash flow and cap rate">
      <div className="field-grid">
        <Field
          id="assume-down"
          label="Down payment"
          suffix="%"
          value={a.downPct}
          onChange={(v) => api.updateInvestor({ downPct: v })}
        />
        <Field
          id="assume-rate"
          label="Interest rate"
          suffix="%"
          value={a.rate}
          onChange={(v) => api.updateInvestor({ rate: v })}
        />
        <Field
          id="assume-rent"
          label="Rent per sqft"
          prefix="$"
          suffix="/mo"
          value={a.rentPerSqft}
          onChange={(v) => api.updateInvestor({ rentPerSqft: v })}
          hint={`For a typical ZIP in the data, scaled by each ZIP's median rent; half rate past ${formatNumber(RENT_TAPER_SQFT)} sqft`}
          wide
        />
        <Field
          id="assume-vacancy"
          label="Vacancy"
          suffix="% rent"
          value={a.vacancyPct}
          onChange={(v) => api.updateInvestor({ vacancyPct: v })}
        />
        <Field
          id="assume-repairs"
          label="Repairs & CapEx"
          suffix="% rent"
          value={a.repairsPct}
          onChange={(v) => api.updateInvestor({ repairsPct: v })}
        />
        <Field
          id="assume-management"
          label="Management"
          suffix="% rent"
          value={a.managementPct}
          onChange={(v) => api.updateInvestor({ managementPct: v })}
        />
        <Field
          id="assume-insurance"
          label="Insurance"
          suffix="% / yr"
          value={a.insurancePct}
          onChange={(v) => api.updateInvestor({ insurancePct: v })}
        />
        <Field
          id="assume-closing"
          label="Closing costs"
          suffix="%"
          value={a.closingPct}
          onChange={(v) => api.updateInvestor({ closingPct: v })}
        />
      </div>
      {tax}
      {reset}
    </Section>
  )
}
