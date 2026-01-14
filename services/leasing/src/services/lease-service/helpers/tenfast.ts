import { Lease, LeaseStatus, RentArticle, RentRow } from '@onecore/types'
import {
  TenfastLease,
  TenfastArticle,
  TenfastInvoiceRow,
} from '../adapters/tenfast/schemas'

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
    leaseId: lease.externalId,
    leaseNumber: lease.externalId.split('/')[1],
    leaseStartDate: lease.startDate,
    leaseEndDate: lease.endDate ?? undefined,
    status: calculateLeaseStatus(lease.startDate, lease.endDate),
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

export function mapToOnecoreRentArticle(article: TenfastArticle): RentArticle {
  return {
    id: article._id,
    hyresvard: article.hyresvard,
    title: article.title,
    defaultLabel: article.defaultLabel,
    code: article.code,
    accountNr: article.accountNr,
    vat: article.vat,
    description: article.description,
    category: article.category,
    includeInContract: article.includeInContract,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  }
}

export function mapToOnecoreRentRow(row: TenfastInvoiceRow): RentRow {
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
