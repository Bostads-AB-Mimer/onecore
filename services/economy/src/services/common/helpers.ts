import { RentInvoiceRow } from '@onecore/types'

export const getRentalIdFromLeaseId = (leaseId: string) => {
  return leaseId.split('/')[0]
}

// Matches a lease id at the start of an Xpand header row, e.g. "306-001-01-0101/01"
export const XPAND_LEASE_ID_REGEX =
  /^[A-Z\d]{3}-[A-Z\d]{3}-[A-Z\d]{2}-[A-Z\d]{4}\/\d{2}/i
// Xpand row type for a header row that starts a print group
export const XPAND_HEADER_ROW_TYPE = 3

export const extractLeaseIdsFromInvoiceRows = (rows: RentInvoiceRow[]) => {
  return rows.reduce<string[]>((leaseIds, row) => {
    if (row.rowType === XPAND_HEADER_ROW_TYPE) {
      const match = row.text.match(XPAND_LEASE_ID_REGEX)

      if (match) {
        leaseIds.push(match[0])
      }
    }

    return leaseIds
  }, [])
}
