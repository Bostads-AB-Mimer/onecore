/**
 * The columns of the Länsförsäkringar home insurance file, shared by the
 * daily file (convertHomeInsuranceToXlsx) and the staff Excel export, so the
 * two always have the same columns in the same order.
 */
export type HomeInsuranceLfColumnValues = {
  leaseId: string
  nationalIdNumber: string | null
  fullName: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  numberOfRooms: number | null
  squareMeters: number | null
  // Days as yyyy-mm-dd.
  leaseFromDate: string | null
  leaseToDate: string | null
  phoneNumber: string | null
  email: string | null
  rowFromDate: string | null
  rowToDate: string | null
  monthlyAmount: number | null
  rentalObjectCode: string | null
  // G in force, K on a lease to come, * the row has an end date.
  leaseStatus: string
  articleText: string | null
}

export type HomeInsuranceLfColumn = {
  header: string
  key: keyof HomeInsuranceLfColumnValues
}

export const HOME_INSURANCE_LF_COLUMNS: readonly HomeInsuranceLfColumn[] = [
  { header: 'Kontraktsnummer', key: 'leaseId' },
  { header: 'Personnummer', key: 'nationalIdNumber' },
  { header: 'Namn', key: 'fullName' },
  { header: 'Adress', key: 'address' },
  { header: 'Postnr', key: 'postalCode' },
  { header: 'Ort', key: 'city' },
  { header: 'Antal Rum', key: 'numberOfRooms' },
  { header: 'Kvadratmeter', key: 'squareMeters' },
  { header: 'Kontrakt Fr.o.m', key: 'leaseFromDate' },
  { header: 'Kontrakt T.o.m', key: 'leaseToDate' },
  { header: 'Telefon', key: 'phoneNumber' },
  { header: 'E-post', key: 'email' },
  { header: 'Hyresrad Fr.o.m', key: 'rowFromDate' },
  { header: 'Hyresrad T.o.m', key: 'rowToDate' },
  // The monthly amount. Länsförsäkringar's file has always called the
  // column Årshyra, so the header stays.
  { header: 'Årshyra', key: 'monthlyAmount' },
  { header: 'Hyresobjekt, hyresid', key: 'rentalObjectCode' },
  { header: 'Status', key: 'leaseStatus' },
  { header: 'Avitext', key: 'articleText' },
]

/** The row's values in column order. */
export const toHomeInsuranceLfCells = (
  values: HomeInsuranceLfColumnValues
): (string | number | null)[] =>
  HOME_INSURANCE_LF_COLUMNS.map((column) => values[column.key])
