import type { Contact } from '@onecore/contacts/domain'
import { economy, LeaseStatus } from '@onecore/types'

import * as economyAdapter from '../../adapters/economy-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import {
  ContactLookupDeps,
  lookUpContactsFailClosed,
} from '../../utils/contact-lookup'
import type {
  OpenInvoiceReportErrorCode,
  OpenInvoiceReportRow,
} from '../../services/reports-service/schemas'
import {
  BosocialaRow,
  REPORT_LEASE_STATUS_LABELS,
} from './converters/excelConverter'

export type OpenInvoiceReportDeps = {
  getOpenInvoices: typeof economyAdapter.getOpenInvoices
  getLeaseStatuses: typeof leasingAdapter.getLeaseStatuses
  contacts?: ContactLookupDeps['contacts']
  // Today as yyyy-mm-dd.
  today: () => string
}

// sv-SE formats a date as yyyy-mm-dd.
const swedishDayFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
})

// Called through the modules, so a test can replace an adapter function.
const defaultDeps: OpenInvoiceReportDeps = {
  getOpenInvoices: () => economyAdapter.getOpenInvoices(),
  getLeaseStatuses: (leaseIds) => leasingAdapter.getLeaseStatuses(leaseIds),
  today: () => swedishDayFormat.format(new Date()),
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days from one yyyy-mm-dd to another, negative when to is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

// Lease IDs from Tenfast and leasing may differ in case and padding.
const leaseKey = (leaseId: string): string => leaseId.trim().toUpperCase()

const contactAddress = (contact: Contact | undefined): string | null =>
  contact?.addresses.find((address) => address.street)?.street ?? null

const contactName = (contact: Contact | undefined): string | null => {
  if (!contact) return null
  return contact.type === 'organisation'
    ? contact.organisation.name
    : contact.personal.fullName
}

/**
 * Orders the list by due date, the oldest first and invoices without a due
 * date last, then by invoice number.
 */
const byDueDate = (a: economy.OpenInvoice, b: economy.OpenInvoice): number => {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  }
  return a.invoiceNumber.localeCompare(b.invoiceNumber, 'sv')
}

/**
 * Every open invoice, with the lease status from leasing and the tenant's
 * name and address from the contacts service.
 *
 * Economy and leasing failing fails the list: without them it would look
 * complete but miss rows or statuses. Leasing fails the whole lookup when it
 * cannot read a lease, so an empty status always means leasing has no such
 * lease, never that it could not be read. The contacts service failing does
 * not fail the list: the names and addresses are then left blank, as they
 * are for a protected identity.
 */
export const getOpenInvoiceReport = async (
  deps: OpenInvoiceReportDeps = defaultDeps
): Promise<
  | { ok: true; data: OpenInvoiceReportRow[] }
  | { ok: false; err: OpenInvoiceReportErrorCode }
> => {
  const invoicesResult = await deps.getOpenInvoices()
  if (!invoicesResult.ok) return { ok: false, err: invoicesResult.err }
  const invoices = [...invoicesResult.data].sort(byDueDate)

  const leaseIds = [
    ...new Set(
      invoices.flatMap((invoice) =>
        invoice.leaseId ? [invoice.leaseId.trim()] : []
      )
    ),
  ]

  const [leaseStatuses, contactFor] = await Promise.all([
    leaseIds.length === 0
      ? Promise.resolve({
          ok: true as const,
          data: { statuses: [], notFoundLeaseIds: [] },
        })
      : deps.getLeaseStatuses(leaseIds),
    lookUpContactsFailClosed(
      invoices.map((invoice) => invoice.contactCode),
      { includeAddress: true },
      'getOpenInvoiceReport',
      deps.contacts && { contacts: deps.contacts }
    ),
  ])
  // The adapter has logged the failure.
  if (!leaseStatuses.ok) {
    return {
      ok: false,
      err:
        leaseStatuses.err === 'cache-warming'
          ? 'cache-warming'
          : 'upstream-failed',
    }
  }

  const statusByKey = new Map<string, LeaseStatus>(
    leaseStatuses.data.statuses.map(({ leaseId, status }) => [
      leaseKey(leaseId),
      status,
    ])
  )

  const today = deps.today()

  return {
    ok: true,
    data: invoices.map((invoice) => {
      const contact = contactFor(invoice.contactCode)
      const leaseStatus = invoice.leaseId
        ? statusByKey.get(leaseKey(invoice.leaseId))
        : undefined
      return {
        ...invoice,
        leaseStatus: leaseStatus ?? null,
        fullName: contactName(contact),
        address: contactAddress(contact),
        daysPastDue: invoice.dueDate
          ? daysBetween(invoice.dueDate, today)
          : null,
      }
    }),
  }
}

// yyyy-mm-dd as midnight UTC, which Excel shows as that day.
const toExcelDate = (day: string | null): Date | undefined =>
  day ? new Date(`${day}T00:00:00Z`) : undefined

/** A row of the list in the columns of the unpaid invoice report. */
export const toOpenInvoiceExcelRow = (
  row: OpenInvoiceReportRow
): BosocialaRow => ({
  invoiceId: row.invoiceNumber,
  invoiceDate: toExcelDate(row.invoiceDate),
  expirationDate: toExcelDate(row.dueDate),
  invoiceAmount: row.amount,
  remainingAmount: row.remainingAmount,
  daysSinceExpirationDate: row.daysPastDue ?? undefined,
  rentalPropertyId: row.rentalObjectCode ?? '',
  tenantName: row.fullName ?? '',
  tenantContactCode: row.contactCode ?? '',
  address: row.address ?? '',
  leaseStatus:
    row.leaseStatus === null ? '' : REPORT_LEASE_STATUS_LABELS[row.leaseStatus],
  costCentre: row.costCentre ?? undefined,
})
