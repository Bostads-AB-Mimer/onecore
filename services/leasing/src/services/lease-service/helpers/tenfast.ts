import { Lease, LeaseStatus } from '@onecore/types'
import { TenfastLease } from '../../../common/adapters/tenfast/schemas'

const calculateLeaseStatus = (
  lastDebitDateString: string,
  startDateString: string
): LeaseStatus => {
  const leaseStartDate = new Date(startDateString)
  const leaseLastDebitDate = new Date(lastDebitDateString)
  const today = new Date()

  leaseStartDate.setHours(0, 0, 0, 0)
  leaseLastDebitDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  if (lastDebitDateString && leaseLastDebitDate >= today)
    return LeaseStatus.AboutToEnd
  else if (lastDebitDateString && leaseLastDebitDate < today)
    return LeaseStatus.Ended
  else if (leaseStartDate >= today) return LeaseStatus.Upcoming
  else {
    return LeaseStatus.Current
  }
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
    // calculateLeaseStatus will break because it needs properties tenfast doesnt have right now
    status: calculateLeaseStatus(
      lease.endDate?.toISOString() ?? '', // TODO: dunno if endDate is good here
      lease.startDate.toISOString()
    ),
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
    rentalPropertyId: 'missing',
    type: 'missing',
  }
}
