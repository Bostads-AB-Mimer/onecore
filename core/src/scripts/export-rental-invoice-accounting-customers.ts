import { logger } from '@onecore/utilities'
import { getInvoiceRecipientsMissingAsCustomers } from '../adapters/economy-adapter'
import {
  syncInvoiceRecipientToEconomy,
  tenantAwareContactLookup,
} from '../processes/contacts'
import type { ContactLookup } from '../processes/contacts/sync-invoice-recipient'
import { runWithConcurrency } from '../utils/concurrency'

export type CustomerCreationReport = {
  created: string[]
  updated: string[]
  failed: {
    contactCode: string
    reason: 'contact-not-found' | 'sync-failed'
  }[]
  lookupFailure?: string
}

type CreateInvoiceRecipientsDeps = {
  contacts: ContactLookup
  concurrency?: number
}

const DEFAULT_CONCURRENCY = 5

export const createInvoiceRecipients = async (
  codes: string[],
  deps: CreateInvoiceRecipientsDeps = { contacts: tenantAwareContactLookup }
): Promise<CustomerCreationReport> => {
  const report: CustomerCreationReport = {
    created: [],
    updated: [],
    failed: [],
  }

  const results = await runWithConcurrency(
    codes,
    (contactCode) =>
      syncInvoiceRecipientToEconomy(deps.contacts, contactCode).catch(
        (err: unknown) => {
          logger.error(
            { contactCode, error: err instanceof Error ? err.message : err },
            'createInvoiceRecipients.syncThrew'
          )
          return { ok: false as const, err: 'sync-failed' as const }
        }
      ),
    deps.concurrency ?? DEFAULT_CONCURRENCY
  )

  results.forEach((result, index) => {
    const contactCode = codes[index]
    if (!result.ok) {
      report.failed.push({ contactCode, reason: result.err })
    } else if (result.data?.undo === null) {
      report.created.push(contactCode)
    } else {
      report.updated.push(contactCode)
    }
  })

  return report
}

export const createMissingInvoiceRecipients = async (
  companyId: string,
  deps?: CreateInvoiceRecipientsDeps
): Promise<CustomerCreationReport & { attempted: string[] }> => {
  const missing = await getInvoiceRecipientsMissingAsCustomers(companyId)
  if (!missing.ok) {
    return {
      created: [],
      updated: [],
      failed: [],
      attempted: [],
      lookupFailure: missing.detail
        ? `${missing.err}: ${missing.detail}`
        : missing.err,
    }
  }

  const attempted = missing.data.missingCustomerCodes
  const report = await createInvoiceRecipients(attempted, deps)
  return { ...report, attempted }
}

export const mergeCustomerReports = (
  a: CustomerCreationReport,
  b: CustomerCreationReport
): CustomerCreationReport => {
  const lookupFailure = [a.lookupFailure, b.lookupFailure]
    .filter((failure): failure is string => failure !== undefined)
    .join('; ')
  return {
    created: [...a.created, ...b.created],
    updated: [...a.updated, ...b.updated],
    failed: [...a.failed, ...b.failed],
    ...(lookupFailure && { lookupFailure }),
  }
}
