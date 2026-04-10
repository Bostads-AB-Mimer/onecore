import { RentInvoiceRow } from '@onecore/types'

export const getRentalIdFromLeaseId = (leaseId: string) => {
  return leaseId.split('/')[0]
}

export const extractLeaseIdsFromInvoiceRows = (rows: RentInvoiceRow[]) => {
  const leaseIdRegex = /^[A-Z\d]{3}-[A-Z\d]{3}-[A-Z\d]{2}-[A-Z\d]{4}\/\d{2}/i

  return rows.reduce<string[]>((leaseIds, row) => {
    if (row.rowType === 3) {
      const match = row.text.match(leaseIdRegex)

      if (match) {
        leaseIds.push(match[0])
      }
    }

    return leaseIds
  }, [])
}
