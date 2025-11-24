import { Lease, LeaseStatus } from '@onecore/types'
import { TenfastLease } from '../../../common/adapters/tenfast/schemas'

const calculateLeaseStatus = (
  startDate: Date,
  endDate: Date | null
): LeaseStatus => {
  // TODO: Verify this logic
  const today = new Date()
  if (endDate && endDate >= today) return LeaseStatus.AboutToEnd
  if (endDate && endDate < today) return LeaseStatus.Ended
  if (startDate >= today) return LeaseStatus.Upcoming

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
    leaseId: 'missing',
    leaseNumber: 'missing',
    leaseStartDate: lease.startDate,
    leaseEndDate: lease.endDate ?? undefined,
    status: calculateLeaseStatus(lease.startDate, lease.endDate),
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: undefined,
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: undefined,
    lastDebitDate: undefined,
    approvalDate: undefined,
    residentialArea: undefined,
    tenantContactIds: lease.hyresgaster.map((tenant) => tenant.externalId),
    tenants: undefined,
    rentalPropertyId: lease.hyresobjekt[0]?.externalId ?? 'missing',
    type: 'missing',
  }
}
