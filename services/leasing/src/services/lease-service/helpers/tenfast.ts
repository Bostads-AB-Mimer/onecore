import { Lease, LeaseStatus, LeaseRentRow, RentalObject } from '@onecore/types'

import {
  TenfastLease,
  TenfastInvoiceRow,
  TenfastRentalObject,
} from '../adapters/tenfast/schemas'
import {
  isPreliminaryTerminated,
  isPendingSignature,
} from '../adapters/tenfast/filters'

const calculateLeaseStatus = (lease: TenfastLease): LeaseStatus => {
  const today = new Date()
  const { startDate, endDate, stage } = lease

  // Check pending signature first (unsigned leases)
  if (isPendingSignature(lease)) return LeaseStatus.PendingSignature

  // Check preliminary termination
  if (isPreliminaryTerminated(lease)) return LeaseStatus.PreliminaryTerminated

  // Check ended leases (must be cancelled/archived with past end date)
  if (
    (stage === 'cancelled' || stage === 'archived') &&
    endDate &&
    endDate < today
  ) {
    return LeaseStatus.Ended
  }

  // Check about to end (cancelled with future end date)
  if (stage === 'cancelled' && endDate && endDate >= today) {
    return LeaseStatus.AboutToEnd
  }

  // Check upcoming (signed with future start date)
  if (startDate >= today && stage === 'signed') {
    return LeaseStatus.Upcoming
  }

  // Current lease (signed, started, not ending)
  if (
    stage === 'signed' &&
    startDate < today &&
    (!endDate || endDate > today)
  ) {
    return LeaseStatus.Current
  }

  // Default fallback
  return LeaseStatus.Current
}

function mapToOnecoreRentalObject(
  rentalObject: TenfastRentalObject
): RentalObject | undefined {
  // Only map if we have populated fields (not just a reference)
  if (!rentalObject.postadress) {
    return undefined
  }

  return {
    rentalObjectCode: rentalObject.externalId,
    address: rentalObject.postadress,
    rent: {
      rentalObjectCode: rentalObject.externalId,
      amount: rentalObject.hyraExcludingVat,
      vat: rentalObject.hyraVat,
      rows: rentalObject.hyror.map((row) => ({
        code: row.article ?? '',
        description: row.label ?? '',
        amount: row.amount,
        vatPercentage: row.vat,
        fromDate: row.from ? new Date(row.from) : undefined,
        toDate: row.to ? new Date(row.to) : undefined,
      })),
    },
    residentialAreaCaption: rentalObject.stadsdel ?? '',
    residentialAreaCode: rentalObject.stadsdel ?? '',
    objectTypeCaption: rentalObject.subType ?? rentalObject.typ ?? '',
    objectTypeCode: rentalObject.typ ?? '',
    boaArea: rentalObject.kvm ?? undefined,
    braArea: rentalObject.kvm ?? undefined,
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
    leaseId: lease.externalId,
    leaseNumber: lease.externalId.split('/')[1],
    leaseStartDate: lease.startDate,
    leaseEndDate: lease.endDate ?? undefined,
    status: calculateLeaseStatus(lease),
    noticeGivenBy: lease.cancellation.cancelledByType ?? undefined,
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
    rentalObject: lease.hyresobjekt[0]
      ? mapToOnecoreRentalObject(lease.hyresobjekt[0])
      : undefined,
    type: lease.hyresobjekt[0]?.typ ?? 'missing', // TODO: Typ av kontrakt, bostadskontrakt, parkeringsplatskontrakt.
    rentRows: lease.hyror.map(mapToOnecoreRentRow),
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
