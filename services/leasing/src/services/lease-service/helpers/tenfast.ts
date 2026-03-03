import { Lease, LeaseStatus, LeaseRentRow } from '@onecore/types'

import { TenfastLease, TenfastInvoiceRow } from '../adapters/tenfast/schemas'

export const calculateLeaseStatus = (lease: TenfastLease): LeaseStatus => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const startDate = new Date(lease.startDate)
  startDate.setHours(0, 0, 0, 0)

  const endDate = lease.endDate ? new Date(lease.endDate) : null
  if (endDate) endDate.setHours(0, 0, 0, 0)

  if (endDate && endDate >= now && lease.cancellation.cancelled) {
    return LeaseStatus.AboutToEnd
  }
  if (endDate && endDate < now) {
    return LeaseStatus.Ended
  }
  if (startDate >= now) {
    return LeaseStatus.Upcoming
  }
  return LeaseStatus.Current
}

// tenantContactIds: string[] | undefined // Kanske vi vill ha external id
// tenants: Contact[] | undefined
// // sublet: Information om andrahandsuthyrning
// // hyresrader vill vi ha också
// rentalPropertyId: string
// type: string // Typ av kontrakt, bostadskontrakt, parkeringsplatskontrakt.
// noticeGivenBy: string | undefined // Vem har gjort uppsägningen?
// noticeDate: Date | undefined // När gjordes uppsägningen?
// noticeTimeTenant: string | undefined // Uppsägningstid i antal månader
// preferredMoveOutDate: Date | undefined // När vill den här hyresgästen flytta ut?
// terminationDate: Date | undefined // När bekräftades uppsägningen av mimer?
// contractDate: Date | undefined // När skapades kontraktet?
// lastDebitDate: Date | undefined // Sista betaldatum
// approvalDate: Date | undefined // När godkände mimer kontraktet?

export function mapToOnecoreLease(lease: TenfastLease): Lease {
  return {
    leaseId: lease.externalId,
    leaseNumber: lease.externalId.split('/')[1],
    leaseStartDate: lease.startDate,
    leaseEndDate: lease.endDate ?? undefined,
    status: calculateLeaseStatus(lease),
    noticeGivenBy: lease.cancellation.handledBy ?? undefined,
    noticeDate: lease.cancellation.handledAt ?? undefined,
    noticeTimeTenant: lease.uppsagningstid,
    preferredMoveOutDate: lease.cancellation.preferredMoveOutDate ?? undefined,
    terminationDate: lease.cancellation.handledAt ?? undefined,
    contractDate: lease.signedAt ?? undefined,
    lastDebitDate: lease.endDate ?? undefined,
    approvalDate: lease.signedAt ?? undefined,
    residentialArea: undefined,
    tenantContactIds: lease.hyresgaster.map((tenant) => tenant.externalId),
    tenants: undefined,
    rentalPropertyId: lease.hyresobjekt[0]?.externalId ?? 'missing',
    type: 'missing',
  }
}

export function mapToOnecoreRentRow(row: TenfastInvoiceRow): LeaseRentRow {
  return {
    id: row._id,
    amount: row.amount,
    articleId: row.article ?? '',
    label: row.label ?? '',
    vat: row.vat,
    from: row.from ?? undefined,
    to: row.to ?? undefined,
  }
}
