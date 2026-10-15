export type TaxRateCounty = 'King' | 'Snohomish'

export interface TaxRateEntry {
  city: string
  county: TaxRateCounty
  /** Lowest total levy rate per $1,000 assessed value; null when the city has a single rate. */
  rateMinPer1000: number | null
  /** Highest total levy rate per $1,000 assessed value (single rate when min is null). */
  rateMaxPer1000: number
  /** Rate per $1,000 that the "Use" button applies to the deal's property tax input. */
  useRatePer1000: number
  /** Tax year the rates were published for. */
  year: number
}

const king = (city: string, rateMinPer1000: number | null, rateMaxPer1000: number): TaxRateEntry => ({
  city,
  county: 'King',
  rateMinPer1000,
  rateMaxPer1000,
  useRatePer1000: rateMaxPer1000,
  year: 2026,
})

const snohomish = (city: string, ratePer1000: number): TaxRateEntry => ({
  city,
  county: 'Snohomish',
  rateMinPer1000: null,
  rateMaxPer1000: ratePer1000,
  useRatePer1000: ratePer1000,
  year: 2026,
})

/**
 * Total property tax rates (all levies) for greater Seattle area cities,
 * expressed per $1,000 of assessed value.
 *
 * King County: lowest–highest rate across parcels within each city
 * (parcels in the same city can fall under different fire/school districts).
 * Snohomish County: the "predominant" rate for each city (rates vary within
 * most cities).
 */
export const TAX_RATE_ENTRIES: readonly TaxRateEntry[] = [
  // King County — 2026 Property Tax Levy Rate Distribution
  king('Algona', 9.25642, 11.29314),
  king('Auburn', 9.83067, 12.60954),
  king('Beaux Arts', null, 7.12326),
  king('Bellevue', 7.42658, 9.68982),
  king('Black Diamond', 8.34909, 10.75558),
  king('Bothell', 9.30116, 9.7413),
  king('Burien', 10.24439, 11.44862),
  king('Carnation', null, 8.59133),
  king('Clyde Hill', 6.76157, 7.25796),
  king('Covington', 8.8537, 9.94701),
  king('Des Moines', 9.81451, 11.28005),
  king('Duvall', null, 8.80155),
  king('Enumclaw', null, 9.58164),
  king('Federal Way', null, 9.29817),
  king('Hunts Point', null, 6.37729),
  king('Issaquah', 8.14116, 8.33391),
  king('Kenmore', 9.21638, 9.65652),
  king('Kent', 9.45289, 10.91843),
  king('Kirkland', 7.82628, 8.89773),
  king('Lake Forest Park', 9.06083, 9.60696),
  king('Maple Valley', 10.50357, 11.59688),
  king('Medina', null, 7.05309),
  king('Mercer Island', null, 6.51089),
  king('Milton', 10.32173, 10.68828),
  king('Newcastle', 8.23854, 9.75963),
  king('Normandy Park', null, 12.48973),
  king('North Bend', 9.03085, 9.09196),
  king('Pacific', 9.56503, 11.31883),
  king('Redmond', 7.27092, 8.39862),
  king('Renton', 9.31646, 10.57834),
  king('Sammamish', 8.43681, 9.09694),
  king('SeaTac', 10.11979, 11.93793),
  king('Seattle', 9.90845, 12.22112),
  king('Shoreline', null, 9.95297),
  king('Skykomish', null, 7.45423),
  king('Snoqualmie', 9.29531, 9.87994),
  king('Tukwila', 9.74869, 12.80351),
  king('Woodinville', 8.58826, 9.0284),
  king('Yarrow Point', 6.51377, 7.01016),
  // Snohomish County — 2026 Property Tax Information (predominant rates)
  snohomish('Arlington', 8.7152),
  snohomish('Bothell', 8.0664),
  snohomish('Brier', 7.6939),
  snohomish('Darrington', 7.1201),
  snohomish('Edmonds', 7.8348),
  snohomish('Everett', 8.5886),
  snohomish('Gold Bar', 8.3991),
  snohomish('Granite Falls', 7.1447),
  snohomish('Index', 5.8416),
  snohomish('Lake Stevens', 8.8673),
  snohomish('Lynnwood', 7.9139),
  snohomish('Marysville', 7.486),
  snohomish('Mill Creek', 8.7345),
  snohomish('Monroe', 7.8242),
  snohomish('Mountlake Terrace', 7.9075),
  snohomish('Mukilteo', 7.4912),
  snohomish('Snohomish', 9.7771),
  snohomish('Stanwood', 8.5128),
  snohomish('Sultan', 8.7709),
  snohomish('Woodway', 7.2566),
]

/** Converts a rate per $1,000 of assessed value to a percentage, rounded to 2 decimals. */
export function perThousandToPercent(ratePer1000: number): number {
  return Math.round((ratePer1000 / 10) * 100) / 100
}

/** Human-readable rate for an entry, e.g. "0.99% – 1.22%" or "0.86%". */
export function formatRateDisplay(entry: TaxRateEntry): string {
  const max = perThousandToPercent(entry.rateMaxPer1000).toFixed(2)
  if (entry.rateMinPer1000 == null || entry.rateMinPer1000 === entry.rateMaxPer1000) {
    return `${max}%`
  }
  const min = perThousandToPercent(entry.rateMinPer1000).toFixed(2)
  return `${min}% – ${max}%`
}

export const TAX_RATE_SOURCES = {
  king: {
    label: 'King County Assessor — 2026 Property Tax Levy Rate Distribution',
    url: 'https://cdn.kingcounty.gov/-/media/king-county/depts/assessor/buildings-property/reports/annual-reports/2026/26levydistricts.ashx',
  },
  snohomish: {
    label: 'Snohomish County Assessor — 2026 Property Tax Information (Jan 30, 2026)',
    url: 'https://www.snohomishcountywa.gov/DocumentCenter/View/141983/Press-Release-Jan-30-2026',
  },
} as const

export const TAX_RATE_DISCLAIMER =
  'Approximate total property tax rates (all levies) for the 2026 tax year, from official county ' +
  'assessor publications. King County shows the lowest–highest rate across parcels in each city; ' +
  'Snohomish County shows the predominant rate. The actual rate for a specific parcel can differ — ' +
  'verify with the county assessor before relying on a number.'

export const TAX_RATE_COVERAGE_NOTE =
  'Bothell appears twice because the city spans King and Snohomish counties. Tacoma, Puyallup, ' +
  'Lakewood and other Pierce County cities are not listed — the Pierce County assessor site was ' +
  'unavailable when this list was compiled; check piercecounty.gov for those rates.'
