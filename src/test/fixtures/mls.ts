/** A tiny NWMLS-style CSV export: the columns the parser reads, in the export's own order. */
const HEADER = [
  'AgentOnlyComments', 'Area', 'AssociationDues', 'AssociationFeeFrequency', 'Auction',
  'BankOrRealEstateOwned', 'Basement', 'BathsFullTotal', 'BathsHalfTotal', 'BathsThreeQuarterTotal',
  'BedroomsLower', 'BedroomsMain', 'BedroomsUpper', 'BuildingComplexOrProjectName', 'CDOM', 'City',
  'CurrentPrice', 'DOM', 'ListingDate', 'ListingNumber', 'ListingPrice', 'LotSquareFootage',
  'MarketingComments', 'OriginalPrice', 'ParkingCoveredTotal', 'SquareFootage', 'SquareFootageFinished',
  'Status', 'StreetDirection', 'StreetName', 'StreetNumber', 'StreetNumberModifier',
  'StreetPostDirection', 'StreetSuffix', 'StyleCode', 'Unit', 'View', 'Waterfront', 'YearBuilt', 'ZipCode ',
]

export interface Row {
  id: string
  price: number
  original?: number
  sqft: number
  city?: string
  style?: string
  remarks?: string
  hoa?: [number, string]
  lot?: number
  cdom?: number
  beds?: [number, number]
  unit?: string
  agentOnly?: string
  year?: number
  bankOwned?: boolean
  zip?: string
  view?: string
  garage?: number
  /** Street number (defaults to the id's last 4 digits, so addresses are unique). */
  streetNumber?: string
}

function quote(cell: string | number): string {
  const text = String(cell)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function mlsCsv(rows: Row[]): string {
  const lines = rows.map((r) => {
    const values: Record<string, string | number> = {
      AgentOnlyComments: r.agentOnly ?? 'Lockbox code 1234, call 555-0100',
      Area: '740 - Everett/Mukilteo​',
      AssociationDues: r.hoa?.[0] ?? 0,
      AssociationFeeFrequency: r.hoa?.[1] ?? '',
      Auction: 'False',
      BankOrRealEstateOwned: r.bankOwned ? 'True' : 'False',
      Basement: 'None',
      BathsFullTotal: 2,
      BathsHalfTotal: 1,
      BathsThreeQuarterTotal: 0,
      BedroomsLower: r.beds?.[1] ?? 0,
      BedroomsMain: r.beds?.[0] ?? 0,
      BedroomsUpper: 0,
      BuildingComplexOrProjectName: '',
      CDOM: r.cdom ?? 10,
      City: r.city ?? 'Everett',
      CurrentPrice: r.price,
      DOM: r.cdom ?? 10,
      ListingDate: '9/1/2026 12:00:00 AM',
      ListingNumber: r.id,
      ListingPrice: r.price,
      LotSquareFootage: r.lot ?? 5000,
      MarketingComments: r.remarks ?? 'Lovely home.',
      OriginalPrice: r.original ?? r.price,
      ParkingCoveredTotal: r.garage ?? 2,
      SquareFootage: r.sqft,
      SquareFootageFinished: r.sqft,
      Status: 'Active',
      StreetDirection: '',
      StreetName: '12th',
      StreetNumber: r.streetNumber ?? r.id.slice(-4),
      StreetNumberModifier: '',
      StreetPostDirection: 'SE',
      StreetSuffix: 'Ave',
      StyleCode: r.style ?? '12 - 2 Story',
      Unit: r.unit ?? '',
      View: r.view ?? '',
      Waterfront: '',
      YearBuilt: r.year ?? 1995,
      'ZipCode ': r.zip ?? '98208',
    }
    return HEADER.map((h) => quote(values[h])).join(',')
  })
  return [HEADER.join(','), ...lines].join('\r\n') + '\r\n'
}
