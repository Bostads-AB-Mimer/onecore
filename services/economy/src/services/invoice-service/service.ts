import {
  getContacts as getInvoiceContacts,
  getCounterPartCustomers,
  findCounterPartCustomer,
} from './adapters/invoice-data-db-adapter'
import {
  getRoundOffInformation,
  RoundOffInformationNotFoundError,
  enrichInvoiceWithAccounting,
  getActiveRentalBlocksWithAccounting,
  getRentalSpecificRules,
  getInvoicesByContactCode as getXpandInvoicesByContactCode,
  getInvoiceRows as getXpandInvoiceListRows,
} from './adapters/xpand-db-adapter'
import {
  getAllInvoicePaymentEvents,
  getInvoiceByInvoiceNumber,
  getInvoicesByContactCode as getXledgerInvoicesByContactCode,
  getInvoicesByInvoiceNumbers as getXledgerInvoicesByInvoiceNumbers,
  ParsedXledgerInvoice,
  getPeriodInformationFromDateStrings,
  setInvoiceRowsTaxRule,
  transformContact,
  updateInvoiceDeferralDate,
  uploadFile as uploadFileToXledger,
} from '../common/adapters/xledger-adapter'
import { economy, Invoice, InvoiceRow, PaymentStatus } from '@onecore/types'
import { errorMessage, logger } from '@onecore/utilities'
import {
  getInvoiceRows,
  getPropertyCodeAndCostCentreForLease,
} from '../common/adapters/xpand-db-adapter'
import {
  extractLeaseIdsFromInvoiceRows,
  getRentalIdFromLeaseId,
} from '../common/helpers'
import {
  InvoiceWithAccounting,
  ExportedInvoiceRow,
  TOTAL_ACCOUNT,
  CUSTOMER_LEDGER_ACCOUNT,
  AggregatedRow,
  LedgerRow,
  xledgerDateString,
  RentalLoss,
  RentalLossChecksumMismatch,
  RentalLossError,
  RentalLossRow,
  RentalBlockWithAccounting,
  MimerCompany,
} from '../../common/types/typesv2'
import { TenfastRentArticle } from '@src/common/adapters/tenfast/schemas'
import { AdapterResult } from '@src/common/types'
import { withInvoiceDeferral } from '@src/common/invoice-deferral'
import {
  getInvoiceArticle,
  getInvoiceByOcr,
  setGracePeriod,
  getInvoicesByContactCode as getTenfastInvoicesByContactCode,
  getInvoicesForTenant,
  getTenantByContactCode,
  getAutogiroConsentByNationalRegistrationNumber,
  getInvoicesNotExported,
  getInvoicesByOcr,
  getRentalLosses,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import config, { isRentalLossExcludedAccount } from '@src/common/config'
import { postChannelLookup } from './adapters/stralfors/stralfors-adapter'

export { markInvoicesAsExported } from '@src/common/adapters/tenfast/tenfast-adapter'

export const getBatchContactsCsv = async (batchId: string) => {
  const invoiceContacts = await getInvoiceContacts(batchId)
  const contacts = invoiceContacts.map(transformContact)

  if (contacts.length === 0) {
    return null
  }

  const csvContent: string[] = []

  csvContent.push(
    'Code;Description;Company No;Email;Street Address;Zip Code;City;Invoice Delivery Method;GL Object Value 5;Group;Collection Code'
  )

  contacts.forEach((contact) => {
    csvContent.push(
      `${contact.code};${contact.description};${contact.companyNo};${contact.email};${contact.streetAddress};${contact.zipCode};${contact.city};${contact.invoiceDeliveryMethod};${contact.counterPart};${contact.group};${contact.counterPart ? contact.group : ''}`
    )
  })

  return csvContent.join('\n')
}

export const uploadInvoiceFile = async (
  filename: string,
  csvContent: string
) => {
  await uploadFileToXledger(filename, csvContent)
}

export const fetchInvoiceRows = async (invoiceIds: string[]) => {
  return getInvoiceRows(invoiceIds)
}

export const fetchPaymentEvents = async (matchIds: number[]) => {
  return getAllInvoicePaymentEvents(matchIds)
}

export const getLeaseDetails = async (invoiceIds: string[]) => {
  const invoiceRows = await getInvoiceRows(invoiceIds)

  return Promise.all(
    invoiceIds.map(async (id) => {
      const invoiceRowsForInvoice = invoiceRows.filter(
        (r) => r.invoiceNumber === id
      )
      const year = invoiceRowsForInvoice[0]?.fromDate.getFullYear()
      const leaseIds = extractLeaseIdsFromInvoiceRows(invoiceRowsForInvoice)
      const details = await Promise.all(
        leaseIds.map(async (leaseId) => {
          const rentalId = getRentalIdFromLeaseId(leaseId)
          const details = await getPropertyCodeAndCostCentreForLease(
            rentalId,
            year
          )

          return {
            leaseId,
            costCentre: details?.costCentre ?? null,
          }
        })
      )

      return {
        invoiceId: id,
        details,
      }
    })
  )
}

// A loss is recorded in Xledger as a transaction on this account.
const LOSS_ACCOUNT_CODE = '1529'

// Mimer's company code in Xpand.
const XPAND_MIMER_COMPANY_ID = '001'

const normalizeContactCode = (contactCode: string) =>
  contactCode.trim().toUpperCase()

// Keeps the first entry per invoice id, like Array.find would.
const firstByInvoiceId = <T>(items: T[], getInvoiceId: (item: T) => string) => {
  const byId = new Map<string, T>()
  for (const item of items) {
    const invoiceId = getInvoiceId(item)
    if (!byId.has(invoiceId)) {
      byId.set(invoiceId, item)
    }
  }
  return byId
}

/*
 * Replaces Xpand invoices with their Xledger counterpart, looked up by invoice
 * number. Xledger owns payment status, debt collection, remaining amount and
 * the invoice PDF, but its transform carries no lease context — leaseIds is
 * empty and transactionTypeName generated — so those values are kept from the
 * Xpand invoice.
 *
 * Mirrors the contact-scoped merge: one Xledger invoice yields exactly one
 * result, even if several Xpand rows share its invoice number.
 */
const enrichFromXledgerByNumber = (
  xpandInvoices: Invoice[],
  xledgerInvoices: ParsedXledgerInvoice[]
): Invoice[] => {
  const lossInvoiceIds = new Set<string>()
  const regularById = new Map<string, ParsedXledgerInvoice>()
  for (const parsed of xledgerInvoices) {
    if (parsed.invoice.accountCode === LOSS_ACCOUNT_CODE) {
      lossInvoiceIds.add(parsed.invoice.invoiceId)
    } else if (!regularById.has(parsed.invoice.invoiceId)) {
      regularById.set(parsed.invoice.invoiceId, parsed)
    }
  }

  const enrichedInvoiceIds = new Set<string>()
  const result: Invoice[] = []
  for (const xpandInvoice of xpandInvoices) {
    const xledgerInvoice = regularById.get(xpandInvoice.invoiceId)
    const isExpectedLoss = lossInvoiceIds.has(xpandInvoice.invoiceId)

    if (!xledgerInvoice) {
      // An invoice can be recorded in Xledger as a loss only, with no
      // regular transaction row to enrich from.
      result.push(
        isExpectedLoss ? { ...xpandInvoice, expectedLoss: true } : xpandInvoice
      )
      continue
    }

    if (enrichedInvoiceIds.has(xpandInvoice.invoiceId)) {
      continue
    }
    enrichedInvoiceIds.add(xpandInvoice.invoiceId)

    result.push(
      withInvoiceDeferral(
        {
          ...xledgerInvoice.invoice,
          leaseIds: xpandInvoice.leaseIds,
          transactionType: xpandInvoice.transactionType,
          transactionTypeName: xpandInvoice.transactionTypeName,
          fromDate: xpandInvoice.fromDate ?? xledgerInvoice.invoice.fromDate,
          toDate: xpandInvoice.toDate ?? xledgerInvoice.invoice.toDate,
          ...(isExpectedLoss ? { expectedLoss: true } : {}),
        },
        { defermentEndDate: xledgerInvoice.defermentEndDate }
      )
    )
  }

  return result
}

// Upper bound on how long the invoice list waits for each Xpand call (customer
// card, Mina sidor, credit check). The invoice-list DB client already cancels
// a single query after 10 s; a call can run a few queries, so this caps the
// whole call and also covers waiting for a connection.
const XPAND_TIMEOUT_MS = 15_000

class XpandTimeoutError extends Error {}

const withXpandTimeout = <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new XpandTimeoutError('Xpand did not answer in time')),
      XPAND_TIMEOUT_MS
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// The adapter logs its own failures, including the DB client's own request
// timeout. Only this outer timeout is logged here.
const logXpandFailure = (err: unknown, contactCode: string, what: string) => {
  if (err instanceof XpandTimeoutError) {
    logger.error(
      { contactCode, timeoutMs: XPAND_TIMEOUT_MS },
      `getInvoicesByContactCode: ${what} timed out`
    )
  } else {
    logger.warn(
      { contactCode },
      `getInvoicesByContactCode: ${what} unavailable`
    )
  }
}

// Xpand is best-effort: when it is unavailable the list is still returned from
// Xledger and Tenfast. Returns undefined in that case, so the caller can skip
// the other Xpand queries.
const getXpandInvoicesIfAvailable = async (
  contactCode: string,
  from?: Date
): Promise<Invoice[] | undefined> => {
  try {
    return (
      (await withXpandTimeout(
        getXpandInvoicesByContactCode(contactCode, { from })
      )) ?? []
    )
  } catch (err: unknown) {
    logXpandFailure(err, contactCode, 'Xpand invoices')
    return undefined
  }
}

/*
 * Invoices for a shared lease billed to the other lease holder (MIM-1160) are
 * missed by the contact-scoped Xledger lookup, so their Xledger data is
 * fetched by invoice number instead. Best-effort: falls back to the plain
 * Xpand invoices.
 */
const enrichHouseholdInvoices = async (
  householdInvoices: Invoice[],
  contactCode: string
): Promise<Invoice[]> => {
  if (householdInvoices.length === 0) {
    return householdInvoices
  }

  try {
    const xledgerByNumber = await getXledgerInvoicesByInvoiceNumbers(
      householdInvoices.map((invoice) => invoice.invoiceId)
    )
    return enrichFromXledgerByNumber(householdInvoices, xledgerByNumber)
  } catch {
    logger.warn(
      { contactCode },
      'getInvoicesByContactCode: could not enrich household invoices from Xledger, returning them from Xpand'
    )
    return householdInvoices
  }
}

// Returns undefined when Xpand is unavailable, so the caller keeps the rows
// the invoices already have. The adapter logs the failure itself.
const getXpandInvoiceRowsByInvoiceId = async (
  invoiceIds: string[],
  contactCode: string
): Promise<Map<string, InvoiceRow[]> | undefined> => {
  try {
    const rows = await withXpandTimeout(
      getXpandInvoiceListRows(XPAND_MIMER_COMPANY_ID, invoiceIds)
    )
    const rowsByInvoiceId = new Map<string, InvoiceRow[]>()
    for (const row of rows) {
      const invoiceRows = rowsByInvoiceId.get(row.invoiceNumber) ?? []
      invoiceRows.push(row)
      rowsByInvoiceId.set(row.invoiceNumber, invoiceRows)
    }
    return rowsByInvoiceId
  } catch (err: unknown) {
    logXpandFailure(err, contactCode, 'Xpand invoice rows')
    return undefined
  }
}

/*
 * A contact's invoices from Xledger, Tenfast and Xpand.
 *
 * Xledger is the base list. Tenfast adds invoices not yet in Xledger, Xpand
 * adds invoices that predate Xledger (the contact's own, and those billed to
 * a co-holder on a shared lease). For the period and the invoice rows,
 * Tenfast takes precedence over Xpand, and Xpand over Xledger.
 */
export const getInvoicesByContactCode = async (
  contactCode: string,
  filters?: { from?: Date }
): Promise<Invoice[]> => {
  const from = filters?.from
  const [xledgerResult, tenfastInvoices, xpandResult] = await Promise.all([
    getXledgerInvoicesByContactCode(contactCode, { from }),
    getTenfastInvoicesByContactCode(contactCode, { from }),
    getXpandInvoicesIfAvailable(contactCode, from),
  ])
  const xledgerInvoices = xledgerResult ?? []
  const isXpandAvailable = xpandResult !== undefined
  const xpandInvoices = xpandResult ?? []

  const regularInvoices: typeof xledgerInvoices = []
  const losses: typeof xledgerInvoices = []

  xledgerInvoices.forEach((parsed) => {
    if (parsed.invoice.accountCode === LOSS_ACCOUNT_CODE) {
      losses.push(parsed)
    } else {
      regularInvoices.push(parsed)
    }
  })

  // An invoice is marked as an expected loss if there is a recorded loss with the same invoice number
  regularInvoices.forEach((parsed) => {
    const lossForInvoice = losses.find(
      (loss) => loss.invoice.invoiceId === parsed.invoice.invoiceId
    )
    if (lossForInvoice) {
      parsed.invoice.expectedLoss = true
    }
  })

  const xledgerInvoiceIds = new Set(
    xledgerInvoices.map((parsed) => parsed.invoice.invoiceId)
  )
  const tenfastById = firstByInvoiceId(
    tenfastInvoices,
    (parsed) => parsed.invoice.invoiceId
  )
  const xpandById = firstByInvoiceId(
    xpandInvoices,
    (invoice) => invoice.invoiceId
  )

  const xledgerBasedInvoices = regularInvoices.map((parsed) => {
    const tenfastParsed = tenfastById.get(parsed.invoice.invoiceId)
    const tenfastInvoice = tenfastParsed?.invoice
    const xpandInvoice = xpandById.get(parsed.invoice.invoiceId)
    const periodSource = [tenfastInvoice, xpandInvoice].find(
      (source) => source?.fromDate && source.toDate
    )

    const invoice = {
      ...parsed.invoice,
      ...(periodSource && {
        fromDate: periodSource.fromDate,
        toDate: periodSource.toDate,
      }),
      ...(tenfastInvoice && { invoiceRows: tenfastInvoice.invoiceRows }),
    }

    return withInvoiceDeferral(invoice, {
      defermentEndDate: parsed.defermentEndDate,
      tenfastDeferral: tenfastParsed?.tenfastDeferral,
    })
  })

  const tenfastOnlyInvoices = tenfastInvoices
    .filter((parsed) => !xledgerInvoiceIds.has(parsed.invoice.invoiceId))
    .map((parsed) =>
      withInvoiceDeferral(parsed.invoice, {
        tenfastDeferral: parsed.tenfastDeferral,
      })
    )

  const xpandOnlyInvoices = xpandInvoices.filter(
    (invoice) =>
      !xledgerInvoiceIds.has(invoice.invoiceId) &&
      !tenfastById.has(invoice.invoiceId)
  )
  // The contact's own Xpand-only invoices predate Xledger, so looking them up
  // there would only add round trips that return nothing.
  const isBilledToOtherContact = (invoice: Invoice) =>
    normalizeContactCode(invoice.reference) !==
    normalizeContactCode(contactCode)
  const ownXpandOnlyInvoices = xpandOnlyInvoices.filter(
    (invoice) => !isBilledToOtherContact(invoice)
  )

  // Invoices in Tenfast keep Tenfast's rows; all others get Xpand's rows.
  const invoiceIdsNeedingXpandRows = [
    ...new Set(
      regularInvoices
        .map((parsed) => parsed.invoice.invoiceId)
        .filter((invoiceId) => !tenfastById.has(invoiceId))
        .concat(xpandOnlyInvoices.map((invoice) => invoice.invoiceId))
    ),
  ]

  const [householdInvoices, xpandRowsByInvoiceId] = await Promise.all([
    enrichHouseholdInvoices(
      xpandOnlyInvoices.filter(isBilledToOtherContact),
      contactCode
    ),
    // Xpand didn't answer the invoice lookup: don't wait for it a second time.
    isXpandAvailable
      ? getXpandInvoiceRowsByInvoiceId(invoiceIdsNeedingXpandRows, contactCode)
      : undefined,
  ])

  const withXpandRows = (invoice: Invoice): Invoice =>
    xpandRowsByInvoiceId && !tenfastById.has(invoice.invoiceId)
      ? {
          ...invoice,
          invoiceRows: xpandRowsByInvoiceId.get(invoice.invoiceId) ?? [],
        }
      : invoice

  return [
    ...xledgerBasedInvoices,
    ...tenfastOnlyInvoices,
    ...ownXpandOnlyInvoices,
    ...householdInvoices,
  ].map(withXpandRows)
}

type DeferInvoiceError = economy.DeferralErrorCode | 'unknown'

const isInvoiceEligibleForDeferral = (invoice: Invoice): boolean =>
  invoice.source === 'next' &&
  invoice.paymentStatus !== PaymentStatus.Paid &&
  invoice.credit === null

const checkInvoiceDeferralEligibility = async (
  invoiceOcr: string
): Promise<
  | { ok: true }
  | { ok: false; err: 'invoice-not-found' | 'invoice-not-eligible' | 'unknown' }
> => {
  const xledgerInvoice = await getInvoiceByInvoiceNumber(invoiceOcr)
  if (!xledgerInvoice) {
    logger.warn(
      { invoiceOcr },
      'deferral: eligibility failed — invoice not found in Xledger'
    )
    return { ok: false, err: 'invoice-not-found' }
  }

  if (!isInvoiceEligibleForDeferral(xledgerInvoice.invoice)) {
    logger.warn(
      {
        invoiceOcr,
        source: xledgerInvoice.invoice.source,
        paymentStatus: xledgerInvoice.invoice.paymentStatus,
        credit: xledgerInvoice.invoice.credit,
      },
      'deferral: eligibility failed — invoice not eligible'
    )
    return { ok: false, err: 'invoice-not-eligible' }
  }

  return { ok: true }
}

export const deferInvoice = async (params: {
  invoiceOcr: string
  endDate: string
  madeByEmail: string
  reason: string
}): Promise<{ ok: true } | { ok: false; err: DeferInvoiceError }> => {
  const eligibility = await checkInvoiceDeferralEligibility(params.invoiceOcr)
  if (!eligibility.ok) {
    return eligibility
  }

  const tenfastResult = await setGracePeriod({
    invoiceOcr: params.invoiceOcr,
    endDate: params.endDate,
    madeByEmail: params.madeByEmail,
    reason: params.reason,
  })

  if (!tenfastResult.ok) {
    logger.error(
      { invoiceOcr: params.invoiceOcr, err: tenfastResult.err },
      'deferral: Tenfast grace period failed — skipping Xledger update'
    )
    if (tenfastResult.err === 'not-found') {
      return { ok: false, err: 'invoice-not-found' }
    }
    return { ok: false, err: 'tenfast-failed' }
  }

  try {
    await updateInvoiceDeferralDate(params.invoiceOcr, new Date(params.endDate))
  } catch (error) {
    logger.error(
      { error, invoiceOcr: params.invoiceOcr },
      'deferral: Xledger update failed after Tenfast grace period was set'
    )
    return { ok: false, err: 'xledger-failed' }
  }

  return { ok: true }
}

export const getPublicInvoiceByOcr = async (
  ocr: string
): Promise<AdapterResult<Invoice | null, string>> => {
  const tenfastResult = await getInvoiceByOcr(ocr)
  if (!tenfastResult.ok) {
    return tenfastResult
  }

  if (tenfastResult.data === null) {
    return { ok: true, data: null }
  }

  const xledgerResult = await getInvoiceByInvoiceNumber(
    tenfastResult.data.invoice.invoiceId
  )

  return {
    ok: true,
    data: withInvoiceDeferral(tenfastResult.data.invoice, {
      defermentEndDate: xledgerResult?.defermentEndDate,
      tenfastDeferral: tenfastResult.data.tenfastDeferral,
    }),
  }
}

export const getInvoiceDetails = async (
  invoiceNumber: string
): Promise<Invoice | null> => {
  const parsed = await getInvoiceByInvoiceNumber(invoiceNumber)
  if (!parsed) {
    logger.warn(
      { invoiceNumber },
      'deferral: getInvoiceDetails — invoice not found in Xledger'
    )

    return null
  }

  let invoice = parsed.invoice
  const tenfastInvoiceResult = await getInvoiceByOcr(invoice.invoiceId)

  if (!tenfastInvoiceResult.ok) {
    throw new Error(tenfastInvoiceResult.err)
  }

  if (tenfastInvoiceResult.data) {
    invoice = {
      ...invoice,
      invoiceRows: await enrichInvoiceRowsWithText(
        tenfastInvoiceResult.data.invoice.invoiceRows
      ),
    }
  }

  return withInvoiceDeferral(invoice, {
    defermentEndDate: parsed.defermentEndDate,
    tenfastDeferral: tenfastInvoiceResult.data?.tenfastDeferral,
  })
}

export const getInvoiceDetailsForContactCode = async (
  contactCode: string,
  from?: Date
): Promise<Invoice[]> => {
  const tenfastTenantResult = await getTenantByContactCode(contactCode)
  if (!tenfastTenantResult.ok || tenfastTenantResult.data === null) {
    return []
  }

  const tenfastInvoicesResult = await getInvoicesForTenant(
    tenfastTenantResult.data._id,
    from
  )
  if (!tenfastInvoicesResult.ok) {
    return []
  }

  return enrichInvoices(
    tenfastInvoicesResult.data.map((parsed) =>
      withInvoiceDeferral(parsed.invoice, {
        tenfastDeferral: parsed.tenfastDeferral,
      })
    )
  )
}

const enrichInvoices = async (invoices: Invoice[]): Promise<Invoice[]> => {
  const allInvoiceRows = invoices.flatMap((i) => i.invoiceRows)
  const articleIds = allInvoiceRows.reduce<string[]>((acc, ir) => {
    if (ir.rentArticle) {
      acc.push(ir.rentArticle)
    }
    return acc
  }, [])

  const articleResults = await Promise.all(
    articleIds.map((id) => getInvoiceArticle(id))
  )
  const articles = articleResults.reduce<TenfastRentArticle[]>((acc, ar) => {
    if (ar.ok) {
      acc.push(ar.data)
    }
    return acc
  }, [])

  return invoices.map((i): Invoice => {
    return {
      ...i,
      invoiceRows: i.invoiceRows.map((ir) => {
        const article = articles.find((a) => {
          return a._id === ir.rentArticle
        })

        return {
          ...ir,
          invoiceRowText: article?.title ?? null,
        }
      }),
    }
  })
}

const enrichInvoiceRowsWithText = async (
  invoiceRows: InvoiceRow[]
): Promise<InvoiceRow[]> => {
  const articleIds = invoiceRows.reduce<string[]>((acc, ir) => {
    if (ir.rentArticle) {
      acc.push(ir.rentArticle)
    }
    return acc
  }, [])

  const articleResults = await Promise.all(
    articleIds.map((id) => getInvoiceArticle(id))
  )
  const articles = articleResults.reduce<TenfastRentArticle[]>((acc, ar) => {
    if (ar.ok) {
      acc.push(ar.data)
    }
    return acc
  }, [])

  return invoiceRows.map((ir): InvoiceRow => {
    const article = articles.find((a) => {
      return a._id === ir.rentArticle
    })

    return {
      ...ir,
      invoiceRowText: article?.title ?? null,
    }
  })
}

export const stralforsPostChannelLookup = async (
  recipients: economy.LookupRecipient[]
) => {
  return await postChannelLookup(recipients)
}

export const getAutogiroConsent = async (
  nationalRegistrationNumber: string
) => {
  const autogiroConsentResult =
    await getAutogiroConsentByNationalRegistrationNumber(
      nationalRegistrationNumber
    )

  if (!autogiroConsentResult.ok) {
    throw new Error(autogiroConsentResult.err)
  }

  return autogiroConsentResult.data
}

//#region Rental Invoice Accounting
/*
 *
 */
/**
 * Shared enrichment for invoices that are about to be exported as accounting:
 * sets the company round-off cost code, enriches each invoice with accounting
 * and tax rules, and resolves counter part customers. Returns only the
 * invoices that were prepared successfully; failures are reported as errors.
 */
const prepareInvoicesForAccounting = async (
  company: MimerCompany,
  invoices: InvoiceWithAccounting[]
): Promise<{
  invoices: InvoiceWithAccounting[]
  errors: economy.RentalInvoiceExportError[]
}> => {
  const errors: economy.RentalInvoiceExportError[] = []
  const prepared: InvoiceWithAccounting[] = []

  const counterPartCustomers = await getCounterPartCustomers()

  for (const invoice of invoices) {
    if (company.roundOffCostCode) {
      invoice.roundOffCostCode = company.roundOffCostCode
    }

    try {
      await enrichInvoiceWithAccounting(invoice)
      await setInvoiceRowsTaxRule(invoice)
      // Resolved here rather than when the rows are built, so a year without
      // an ORESUTJ account only leaves out the invoices that need one.
      if (invoice.roundoff) {
        const roundOffInformation = await getRoundOffInformation(
          invoice.fromDate.getFullYear().toString()
        )
        invoice.roundOffAccount = roundOffInformation.account
        invoice.roundOffCostCode ??= roundOffInformation.costCode
      }
    } catch (err: unknown) {
      if (err instanceof RoundOffInformationNotFoundError) {
        logger.error(
          { invoiceNumber: invoice.invoiceId, year: err.year },
          'Round-off account missing for invoice'
        )
        errors.push({
          invoiceNumber: invoice.invoiceId,
          code: 'missing-round-off-account',
          error: err.message,
        })
      } else {
        const message = errorMessage(err)
        logger.error(
          { invoiceNumber: invoice.invoiceId, error: message },
          'Could not add accounting to invoice'
        )
        errors.push({
          invoiceNumber: invoice.invoiceId,
          code: 'accounting-failed',
          error: message,
        })
      }
      continue
    }

    const counterPartCustomer = findCounterPartCustomer(
      counterPartCustomers,
      invoice.recipientName
    )

    if (counterPartCustomer) {
      invoice.totalAccount = counterPartCustomer.totalAccount
      invoice.ledgerAccount = counterPartCustomer.ledgerAccount
      invoice.counterPartCode = counterPartCustomer.counterPartCode
    } else {
      invoice.totalAccount = TOTAL_ACCOUNT
      invoice.ledgerAccount = CUSTOMER_LEDGER_ACCOUNT
    }

    prepared.push(invoice)
  }

  return { invoices: prepared, errors }
}

export const exportRentalInvoicesAccounting = async (
  companyId: string,
  numberOfChunks: number = 1
): Promise<{
  exportedInvoices: InvoiceWithAccounting[]
  skippedInvoices: InvoiceWithAccounting[]
  errors: economy.RentalInvoiceExportError[]
}> => {
  try {
    const errors: economy.RentalInvoiceExportError[] = []
    const CHUNK_SIZE = 1000 // 100
    const invoices: InvoiceWithAccounting[] = []
    const skippedInvoices: InvoiceWithAccounting[] = []

    const company = config.companies.find(
      (company) => company.xpandId.localeCompare(companyId) === 0
    )

    if (!company) {
      throw new Error('Could not find company ' + companyId)
    }

    for (let i = 0; i < numberOfChunks; i++) {
      const invoicesResult = await getInvoicesNotExported(CHUNK_SIZE, company)
      if (!invoicesResult.ok) {
        logger.error(
          { error: invoicesResult.err },
          'Could not get rental invoices for export'
        )
        throw new Error(invoicesResult.err)
      } else {
        logger.info(
          { invoicesToImport: invoicesResult.data.invoices.length },
          'Importing invoices'
        )
      }

      // TODO: add logic for internal customers instead of filtering them out.
      let chunkInvoices = invoicesResult.data.invoices.filter((invoice) => {
        return !invoice.recipientContactCode?.startsWith('I')
      })

      let skipped = invoicesResult.data.invoices.filter((invoice) => {
        return invoice.recipientContactCode?.startsWith('I')
      })

      skippedInvoices.push(...skipped)

      if (invoicesResult.data.errors) {
        errors.push(...invoicesResult.data.errors)
      }

      if (
        !invoicesResult.data.invoices ||
        invoicesResult.data.invoices.length === 0
      ) {
        return {
          exportedInvoices: [],
          skippedInvoices,
          errors,
        }
      }

      const prepared = await prepareInvoicesForAccounting(
        company,
        chunkInvoices
      )
      errors.push(...prepared.errors)

      // Remove invoices with errors
      if (errors && errors.length) {
        const errorInvoiceNumbers = new Set(errors.map((e) => e.invoiceNumber))
        chunkInvoices = chunkInvoices.filter(
          (invoice) => !errorInvoiceNumbers.has(invoice.invoiceId)
        )
      }

      chunkInvoices.sort(
        (a: InvoiceWithAccounting, b: InvoiceWithAccounting) => {
          return (
            a.ledgerAccount?.localeCompare(b.ledgerAccount ?? '') ||
            a.totalAccount?.localeCompare(b.totalAccount ?? '') ||
            dateString(a.fromDate)?.localeCompare(
              dateString(b.fromDate) ?? ''
            ) ||
            dateString(a.toDate)?.localeCompare(dateString(b.toDate) ?? '') ||
            0
          )
        }
      )

      invoices.push(...chunkInvoices)
    }

    return {
      exportedInvoices: invoices,
      skippedInvoices,
      errors,
    }
  } catch (error: any) {
    logger.error(error, 'Error importing invoices')

    throw error
  }
}

/**
 * Debug variant of exportRentalInvoicesAccounting: prepares accounting for the
 * invoices with the given OCR numbers (regardless of export status) without
 * pulling anything from the normal "not exported" queue. Intended for the
 * debug import-invoices endpoint, which regenerates the accounting files
 * without marking the invoices as exported.
 */
export const exportRentalInvoicesAccountingByOcr = async (
  companyId: string,
  ocrNumbers: string[]
): Promise<{
  exportedInvoices: InvoiceWithAccounting[]
  skippedInvoices: InvoiceWithAccounting[]
  errors: economy.RentalInvoiceExportError[]
}> => {
  const company = config.companies.find(
    (company) => company.xpandId.localeCompare(companyId) === 0
  )

  if (!company) {
    throw new Error('Could not find company ' + companyId)
  }

  const invoicesResult = await getInvoicesByOcr(ocrNumbers, company)
  if (!invoicesResult.ok) {
    logger.error(
      { error: invoicesResult.err },
      'Could not get invoices by OCR for export'
    )
    throw new Error(invoicesResult.err)
  }

  const errors = [...(invoicesResult.data.errors ?? [])]

  // TODO: add logic for internal customers instead of filtering them out.
  const skippedInvoices = invoicesResult.data.invoices.filter((invoice) => {
    return invoice.recipientContactCode?.startsWith('I')
  })

  const relevantInvoices = invoicesResult.data.invoices.filter((invoice) => {
    return !invoice.recipientContactCode?.startsWith('I')
  })

  const prepared = await prepareInvoicesForAccounting(company, relevantInvoices)
  errors.push(...prepared.errors)

  prepared.invoices.sort(
    (a: InvoiceWithAccounting, b: InvoiceWithAccounting) => {
      return (
        a.ledgerAccount?.localeCompare(b.ledgerAccount ?? '') ||
        a.totalAccount?.localeCompare(b.totalAccount ?? '') ||
        dateString(a.fromDate)?.localeCompare(dateString(b.fromDate) ?? '') ||
        dateString(a.toDate)?.localeCompare(dateString(b.toDate) ?? '') ||
        0
      )
    }
  )

  return {
    exportedInvoices: prepared.invoices,
    skippedInvoices,
    errors,
  }
}

/**
 * Default allowance for the difference between the ledger sum and the
 * aggregate sum. The two sums are computed independently and the aggregate
 * side rounds each grouped row separately, so small deviations are expected.
 */
export const DEFAULT_ACCEPTED_SUM_DIFFERENCE = 1

/**
 * Verifies that the ledger sum equals the aggregate sum. The ledger sum is
 * the total of the invoice amounts (what ends up in the ledger CSV) and the
 * aggregate sum is the total of the exported invoice row amounts, including
 * round-off rows (what ends up in the aggregate CSV). A difference above
 * acceptedDifference (allowed for rounding errors) throws, aborting the
 * export before anything is uploaded.
 */
export const verifyLedgerAndAggregateSums = (
  invoices: InvoiceWithAccounting[],
  invoiceRows: ExportedInvoiceRow[],
  acceptedDifference: number
): void => {
  const ledgerSum = roundCurrency(
    invoices.reduce((sum, invoice) => sum + (invoice.amount ?? 0), 0)
  )
  const aggregateSum = roundCurrency(
    invoiceRows.reduce((sum, row) => sum + (row.totalAmount ?? 0), 0)
  )
  const difference = roundCurrency(Math.abs(ledgerSum - aggregateSum))

  logger.info(
    { ledgerSum, aggregateSum, difference, acceptedDifference },
    'Verifying ledger sum against aggregate sum'
  )

  if (difference > acceptedDifference) {
    throw new Error(
      `Ledger sum (${ledgerSum}) and aggregate sum (${aggregateSum}) differ by ${difference}, which exceeds the accepted difference of ${acceptedDifference}`
    )
  }
}

export const createAccounting = async (
  invoices: InvoiceWithAccounting[],
  acceptedDifference: number = DEFAULT_ACCEPTED_SUM_DIFFERENCE
): Promise<{
  aggregateAccountingCsv: string[]
  ledgerAccountingCsv: string[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  const invoiceRowsForExport = await getExportInvoiceRows(invoices)
  verifyLedgerAndAggregateSums(
    invoices,
    invoiceRowsForExport,
    acceptedDifference
  )
  const aggregateAccountingCsv = await createAggregateCsv(invoiceRowsForExport)
  const ledgerAccountingCsv = await createLedgerCsv(invoices)
  //c§onst contactsCsv = await getContacts(invoices)

  /*console.log('\n--- CONTACT CSV ---')
  console.log(contactsCsv.join('\n'))
  console.log('---------')*/

  return {
    aggregateAccountingCsv,
    ledgerAccountingCsv,
    errors: [],
  }
}

const getExportInvoiceRows = async (invoices: InvoiceWithAccounting[]) => {
  const exportInvoiceRows: ExportedInvoiceRow[] = []

  for (const invoice of invoices) {
    if (invoice.roundoff && invoice.roundoff !== 0) {
      exportInvoiceRows.push(
        createRoundOffRow(
          invoice,
          invoice.totalAccount!!,
          invoice.ledgerAccount!!
        )
      )
    }

    for (const invoiceRow of invoice.invoiceRows) {
      exportInvoiceRows.push({
        amount: invoiceRow.amount,
        totalAmount: invoiceRow.totalAmount,
        deduction: invoiceRow.deduction,
        vat: invoiceRow.vat,
        invoiceDate: invoice.invoiceDate,
        invoiceDueDate: invoice.expirationDate,
        invoiceNumber: invoice.invoiceId,
        invoiceRowText: invoiceRow.invoiceRowText,
        fromDate: clampToCurrentMonth(invoice.fromDate, 'start'),
        toDate: clampToCurrentMonth(invoice.toDate, 'end'),
        contractCode: invoice.leaseIds[0],
        rentArticleName: invoiceRow.rentArticleName,
        account: invoiceRow.account,
        costCode: invoiceRow.costCode,
        property: invoiceRow.property,
        freeCode: invoiceRow.freeCode,
        projectCode: invoiceRow.projectCode,
        totalAccount: invoice.totalAccount,
        ledgerAccount: invoice.ledgerAccount,
        counterPartCode: invoice.counterPartCode,
        contactCode: invoice.recipientContactCode,
        tenantName: invoice.recipientName,
        taxRule: invoiceRow.taxRule,
      })
    }
  }

  return exportInvoiceRows
}

const createRoundOffRow = (
  invoice: InvoiceWithAccounting,
  totalAccount: string,
  ledgerAccount: string
): ExportedInvoiceRow => {
  if (!invoice.roundOffAccount) {
    // prepareInvoicesForAccounting sets it for every invoice with a round-off
    // amount, so this only happens if that step was skipped.
    throw new Error(
      `Round-off account not resolved for invoice ${invoice.invoiceId}`
    )
  }

  return {
    account: invoice.roundOffAccount,
    costCode: invoice.roundOffCostCode,
    amount: invoice.roundoff as number,
    totalAmount: invoice.roundoff as number,
    rowTotalAmount: invoice.roundoff as number,
    invoiceDate: invoice.invoiceDate,
    invoiceNumber: invoice.invoiceId,
    invoiceRowText: 'Öresutjämning',
    fromDate: clampToCurrentMonth(invoice.fromDate, 'start'),
    toDate: clampToCurrentMonth(invoice.toDate, 'end'),
    contractCode: invoice.leaseIds[0],
    totalAccount,
    ledgerAccount,
    counterPartCode: invoice.counterPartCode,
    contactCode: invoice.recipientContactCode,
    tenantName: invoice.recipientName,
  }
}

//#region Rental Aggregate Accounting
const createAggregateCsv = async (invoiceRows: ExportedInvoiceRow[]) => {
  const aggregateRows = await createAggregateRows(invoiceRows)
  const aggregateRowsCsv = convertToAggregateCsvRows(aggregateRows)

  return aggregateRowsCsv
}

const createAggregateRows = async (invoiceRows: ExportedInvoiceRow[]) => {
  const rowChunks: Record<string, ExportedInvoiceRow[]> = {}

  invoiceRows.forEach((invoiceRow) => {
    // Counterpart customers (intercompany) must not share a voucher with
    // other customers, so the counterpart code is part of the voucher key.
    const key =
      invoiceRow.totalAccount +
      ':' +
      invoiceRow.counterPartCode +
      ':' +
      invoiceRow.taxRule +
      ':' +
      dateString(invoiceRow.fromDate) +
      ':' +
      dateString(invoiceRow.toDate)

    if (!rowChunks[key]) {
      rowChunks[key] = []
    }

    rowChunks[key].push(invoiceRow)
  })

  let aggregatedRows: AggregatedRow[] = []
  let voucherIndex = 0

  Object.values(rowChunks).forEach((chunkInvoiceRows) => {
    const voucherNumber =
      Date.now().toString().substring(6, 12) +
      voucherIndex.toString().padStart(3, '0')
    voucherIndex++

    const chunkAggregatedRows = groupAggregateRows(
      chunkInvoiceRows,
      voucherNumber
    )
    aggregatedRows.push(...chunkAggregatedRows)
    const chunkTotalRow = createAggregatedTotalRow(
      chunkAggregatedRows,
      voucherNumber
    )
    aggregatedRows.push(chunkTotalRow)
  })

  return aggregatedRows
}

const dateString = (date: Date | undefined) => {
  return date ? date.toISOString().split('T')[0] : undefined
}

// Uses UTC throughout to stay consistent with dateString() which calls toISOString().
// Replacement dates are built with Date.UTC so toISOString() always returns the
// intended calendar date regardless of the server's local timezone offset.
const clampToCurrentMonth = (
  date: Date | undefined,
  position: 'start' | 'end'
): Date | undefined => {
  if (!date) return undefined

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth()

  if (
    date.getUTCFullYear() < currentYear ||
    (date.getUTCFullYear() === currentYear && date.getUTCMonth() < currentMonth)
  ) {
    return position === 'start'
      ? new Date(Date.UTC(currentYear, currentMonth, 1))
      : new Date(Date.UTC(currentYear, currentMonth + 1, 0))
  }

  return date
}

const safeAdd = (
  term1: number | undefined,
  term2: number | undefined
): number => {
  return Math.round(((term1 ?? 0) + (term2 ?? 0) + Number.EPSILON) * 100) / 100
}

/**
 * Aggregates invoice rows into groups based on the following fields (i.e. into
 * rows that can exist in the same voucher):
 *
 * 'Account', 'CostCode', 'Property', 'ProjectCode', 'FreeCode', 'InvoiceDate', 'InvoiceFromDate',
 * 'InvoiceToDate', 'TotalAccount', 'CounterPartCode'
 *
 * @param invoiceRows
 */
const groupAggregateRows = (
  invoiceRows: ExportedInvoiceRow[],
  voucherNumber: string
): AggregatedRow[] => {
  const groupedRows = [
    ...invoiceRows
      .reduce((r, o) => {
        const key =
          o.account +
          '||' +
          o.taxRule +
          '||' +
          o.costCode +
          '||' +
          o.property +
          '||' +
          o.projectCode +
          '||' +
          o.freeCode +
          '||' +
          dateString(o.invoiceDate) +
          '||' +
          dateString(o.fromDate) +
          '||' +
          dateString(o.toDate) +
          '||' +
          o.totalAccount +
          '||' +
          o.counterPartCode

        const aggregatedRow = r.get(key) || {
          account: o.account,
          costCode: o.costCode,
          projectCode: o.projectCode,
          freeCode: o.freeCode,
          property: o.property,
          voucherDate: dateString(o.fromDate) ?? '',
          fromDate: dateString(o.fromDate) ?? '',
          toDate: dateString(o.toDate) ?? '',
          totalAccount: o.totalAccount,
          counterPartCode: o.counterPartCode,
          voucherNumber,
          amount: 0,
          totalAmount: 0,
          vat: 0,
          taxRule: o.taxRule,
        }

        aggregatedRow.amount = safeAdd(
          aggregatedRow.amount,
          o.amount ? -1 * o.amount : 0
        )
        aggregatedRow.totalAmount = safeAdd(
          aggregatedRow.totalAmount,
          o.totalAmount ? -1 * o.totalAmount : 0
        )

        return r.set(key, aggregatedRow)
      }, new Map())
      .values(),
  ]

  return groupedRows
}

export const createAggregatedTotalRow = (
  aggregatedRows: AggregatedRow[],
  voucherNumber: string
): AggregatedRow => {
  const accumulator: AggregatedRow = {
    voucherDate: aggregatedRows[0].fromDate,
    account: aggregatedRows[0].totalAccount,
    fromDate: aggregatedRows[0].fromDate,
    toDate: aggregatedRows[0].toDate,
    totalAccount: aggregatedRows[0].totalAccount,
    counterPartCode: aggregatedRows[0].counterPartCode,
    voucherNumber,
    amount: 0,
    totalAmount: 0,
    vat: 0,
  }

  const totalRow = aggregatedRows.reduce((acc: AggregatedRow, row) => {
    acc.amount = (acc.amount as number) - (row.totalAmount as number)
    return acc
  }, accumulator)

  totalRow.amount =
    Math.round(((totalRow.amount as number) + Number.EPSILON) * 100) / 100

  return totalRow
}

const convertToAggregateCsvRows = (
  aggregateRows: AggregatedRow[],
  voucherType: 'AR' | 'GL' = 'AR'
) => {
  const csvRows: string[] = []

  csvRows.push(
    'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
  )

  aggregateRows.forEach((row) => {
    const periodInfo = getPeriodInformationFromDateStrings(
      row.voucherDate,
      row.fromDate,
      row.toDate
    )
    csvRows.push(
      `${voucherType};${row.voucherNumber};${xledgerDateString(row.voucherDate)};${row.account};${row.costCode || ''};${row.projectCode || ''};${row.property || ''};${row.freeCode || ''};${row.counterPartCode || ''};${periodInfo.periodStart};${periodInfo.periods};${''};${''};${''};${''};${''};${''};${row.taxRule ?? ''};${row.amount}`
    )
  })

  return csvRows
}
//#endregion

//#region Rental Ledger Accounting
const createLedgerCsv = async (invoices: InvoiceWithAccounting[]) => {
  const ledgerRows = await createLedgerRows(invoices)
  const ledgerCsvRows = convertToLedgerCsvRows(ledgerRows)

  return ledgerCsvRows
}

export const createLedgerRows = async (
  invoices: InvoiceWithAccounting[]
): Promise<LedgerRow[]> => {
  const invoiceChunks: Record<string, InvoiceWithAccounting[]> = {}

  invoices.forEach((invoice) => {
    // The total row of a voucher is posted to the first invoice's total
    // account and counterpart, so every invoice in a voucher must share them.
    const key =
      invoice.ledgerAccount +
      ':' +
      invoice.totalAccount +
      ':' +
      invoice.counterPartCode +
      ':' +
      dateString(invoice.invoiceDate)
    if (!invoiceChunks[key]) {
      invoiceChunks[key] = []
    }

    invoiceChunks[key].push(invoice)
  })

  let voucherIndex = 0
  let ledgerRows: LedgerRow[] = []
  Object.values(invoiceChunks).forEach((chunkInvoices) => {
    const voucherNumber =
      Date.now().toString().substring(6, 12) +
      voucherIndex.toString().padStart(3, '0')
    voucherIndex++

    const chunkRows = convertToLedgerRows(chunkInvoices, voucherNumber)
    ledgerRows.push(...chunkRows)
    const chunkTotalRow = createLedgerTotalRow(chunkInvoices, voucherNumber)
    ledgerRows.push(chunkTotalRow)
  })

  return ledgerRows
}

const convertToLedgerRows = (
  invoices: InvoiceWithAccounting[],
  voucherNumber: string
): LedgerRow[] => {
  return invoices.map((invoice) => {
    return {
      account: invoice.ledgerAccount,
      amount: invoice.amount,
      vat: invoice.totalVat ?? 0,
      voucherDate: dateString(invoice.invoiceDate) ?? '',
      voucherNumber,
      invoiceDate: dateString(invoice.invoiceDate),
      invoiceDueDate: dateString(invoice.expirationDate),
      invoiceNumber: invoice.invoiceId,
      recipientContactCode: invoice.recipientContactCode,
      counterPartCode: invoice.counterPartCode,
    }
  })
}

const createLedgerTotalRow = (
  invoices: InvoiceWithAccounting[],
  voucherNumber: string
): LedgerRow => {
  const totalAmount = invoices
    .map((invoice) => invoice.amount)
    .reduce((accumulator: number, amount: number) => {
      accumulator += amount

      return accumulator
    }, 0)

  const totalVat = invoices
    .map((invoice) => invoice.totalVat)
    .reduce(
      (accumulator: number, amount: number | undefined) =>
        accumulator + (amount ?? 0),
      0
    )

  return {
    account: invoices[0].totalAccount,
    voucherDate: dateString(invoices[0].invoiceDate) ?? '',
    voucherNumber,
    counterPartCode: invoices[0].counterPartCode,
    vat: totalVat ?? 0,
    amount: -Math.round(((totalAmount as number) + Number.EPSILON) * 100) / 100,
  }
}

const convertToLedgerCsvRows = (ledgerRows: LedgerRow[]) => {
  const csvRows: string[] = []

  csvRows.push(
    'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
  )

  ledgerRows.forEach((row) => {
    csvRows.push(
      `AR;${row.voucherNumber};${xledgerDateString(row.voucherDate)};${row.account};${''};${''};${''};${''};${row.counterPartCode ?? ''};${''};${''};${row.recipientContactCode ?? ''};${xledgerDateString(row.invoiceDate)};${row.invoiceNumber ?? ''};${row.invoiceNumber ?? ''};${xledgerDateString(row.invoiceDueDate)};${''};${''};${row.amount}`
    )
  })

  return csvRows
}
//#endregion

//#endregion

//#region Rental Loss Accounting
export const exportRentalLosses = async (
  companyId: string,
  reportId: string
): Promise<{
  rentalLosses: RentalLoss[]
  errors: RentalLossError[]
  rentalObjectsWithoutRentRows: string[]
  checksumMismatches: RentalLossChecksumMismatch[]
}> => {
  const company = config.companies.find(
    (company) => company.xpandId.localeCompare(companyId) === 0
  )

  if (!company) {
    throw new Error('Could not find company ' + companyId)
  }

  const rentalLossResults = await getRentalLosses(company, reportId)
  if (rentalLossResults.ok !== true) {
    logger.error(
      { error: rentalLossResults.err },
      'Could not retrieve rental loss information'
    )
    throw new Error(
      'Could not retrieve rental loss information: ' + rentalLossResults.err
    )
  }

  const {
    rentalLosses,
    errors,
    rentalObjectsWithoutRentRows,
    checksumMismatches,
  } = rentalLossResults.data

  if (errors.length > 0) {
    logger.warn(
      { companyId, errorCount: errors.length },
      'Some rental losses could not be mapped and are left out of the export'
    )
  }

  return {
    rentalLosses,
    errors,
    rentalObjectsWithoutRentRows,
    checksumMismatches,
  }
}

export const createRentalLossAccounting = async (
  rentalLosses: RentalLoss[]
): Promise<{
  aggregateRentalLossAccountingCsv: string[]
  errors: RentalLossError[]
}> => {
  const { aggregateRows, errors } = createRentalLossAggregateRows(rentalLosses)

  const rowChunks: Record<string, AggregatedRow[]> = {}

  aggregateRows.forEach((aggregatedRow) => {
    const key = aggregatedRow.fromDate + ':' + aggregatedRow.toDate

    if (!rowChunks[key]) {
      rowChunks[key] = []
    }

    rowChunks[key].push(aggregatedRow)
  })

  let voucherIndex = 0
  let voucherRowCount = 0
  let MAX_VOUCHER_ROWS = 500

  Object.values(rowChunks).forEach((chunkAggregatedRows) => {
    let voucherNumber =
      Date.now().toString().substring(6, 12) +
      voucherIndex.toString().padStart(3, '0')
    voucherIndex++
    voucherRowCount = 0

    // Rows come in balanced income/cost pairs (see
    // createRentalLossAggregateRows). Only start a new voucher between two
    // pairs, so every voucher balances.
    chunkAggregatedRows.forEach((aggregatedRow) => {
      if (voucherRowCount >= MAX_VOUCHER_ROWS && voucherRowCount % 2 === 0) {
        voucherNumber =
          Date.now().toString().substring(6, 12) +
          voucherIndex.toString().padStart(3, '0')
        voucherIndex++
        voucherRowCount = 0
      }
      aggregatedRow.voucherNumber = voucherNumber
      voucherRowCount++
    })
  })

  const aggregateRowsCsv = convertToAggregateCsvRows(aggregateRows, 'GL')

  return {
    aggregateRentalLossAccountingCsv: aggregateRowsCsv,
    errors,
  }
}

// Returns why a rental loss row cannot be accounted, or undefined if it can.
const validateRentalLossRow = (
  rentalLossRow: RentalLossRow
): string | undefined => {
  if (!Number.isFinite(rentalLossRow.amount)) {
    return `Raden för ${rentalLossRow.rentArticleName ?? 'okänd artikel'} har ogiltigt belopp`
  }
  if (
    !rentalLossRow.incomeAccount ||
    !Number.isFinite(rentalLossRow.incomeAccount)
  ) {
    return `Raden för ${rentalLossRow.rentArticleName ?? 'okänd artikel'} saknar intäktskonto`
  }
  if (
    !rentalLossRow.costAccount ||
    !Number.isFinite(rentalLossRow.costAccount)
  ) {
    return `Raden för ${rentalLossRow.rentArticleName ?? 'okänd artikel'} saknar kostnadskonto${rentalLossRow.isBlock ? ' (spärr)' : ''}`
  }
  return undefined
}

const createRentalLossAggregateRows = (rentalLosses: RentalLoss[]) => {
  const exportedRows: AggregatedRow[] = []
  const errors: RentalLossError[] = []

  rentalLosses.forEach((rentalLoss) => {
    rentalLoss.rentalLossRows.forEach((rentalLossRow) => {
      if (
        isRentalLossExcludedAccount(rentalLossRow.incomeAccount) ||
        isRentalLossExcludedAccount(rentalLossRow.costAccount)
      ) {
        return
      }

      const validationError = validateRentalLossRow(rentalLossRow)
      if (validationError) {
        errors.push({
          rentalObject: rentalLoss.rentalObject,
          error: validationError,
        })
        return
      }

      const rowFrom =
        rentalLossRow.fromDate ?? rentalLoss.uncontractedInterval.from
      const rowTo = rentalLossRow.toDate ?? rentalLoss.uncontractedInterval.to

      // Rental loss reverses the income: debit income, credit cost.
      const exportedRentalLossIncomeRow = {
        amount: -rentalLossRow.amount,
        vat: rentalLossRow.vat,
        totalAmount: -rentalLossRow.totalAmount,
        taxRule: rentalLossRow.taxRule,
        account: rentalLossRow.incomeAccount.toString(),
        projectCode: rentalLossRow.incomeProjectCode,
        freeCode: rentalLossRow.incomeFreeCode,
        costCode: rentalLossRow.incomeCostCode,
        property: rentalLossRow.incomeProperty,
        fromDate: dateString(rowFrom) ?? '',
        toDate: dateString(rowTo) ?? '',
        voucherDate: dateString(rowFrom) ?? '',
        totalAccount: '',
      }

      exportedRows.push(exportedRentalLossIncomeRow)

      const exportedRentalLossCostRow = {
        amount: rentalLossRow.amount,
        vat: rentalLossRow.vat,
        totalAmount: rentalLossRow.totalAmount,
        taxRule: rentalLossRow.taxRule,
        account: rentalLossRow.costAccount.toString(),
        projectCode: rentalLossRow.costProjectCode,
        freeCode: rentalLossRow.costFreeCode,
        costCode: rentalLossRow.costCostCode,
        property: rentalLossRow.costProperty,
        fromDate: dateString(rowFrom) ?? '',
        toDate: dateString(rowTo) ?? '',
        voucherDate: dateString(rowFrom) ?? '',
        totalAccount: '',
      }

      exportedRows.push(exportedRentalLossCostRow)
    })
  })

  return { aggregateRows: exportedRows, errors }
}

/**
 * Fills in cost center (GL object 1) and property (GL object 3), plus project
 * and free code, from Xpand's rental specific accounting rules for every
 * rental loss row where the article (or rental block) did not provide them.
 * This mirrors enrichInvoiceWithAccounting for invoices. Rental losses whose
 * rental object has no rules for the year are kept as they are and reported as
 * errors.
 */
export const enrichRentalLossesWithAccounting = async (
  rentalLosses: RentalLoss[]
): Promise<{ rentalLosses: RentalLoss[]; errors: RentalLossError[] }> => {
  const errors: RentalLossError[] = []
  const enrichedRentalLosses: RentalLoss[] = []

  const rentalObjectsByYear: Record<string, Set<string>> = {}
  for (const rentalLoss of rentalLosses) {
    const year = rentalLossYear(rentalLoss)
    rentalObjectsByYear[year] ??= new Set()
    rentalObjectsByYear[year].add(rentalLoss.rentalObject)
  }

  const rulesByYear: Record<
    string,
    Awaited<ReturnType<typeof getRentalSpecificRules>>
  > = {}
  for (const [year, rentalObjects] of Object.entries(rentalObjectsByYear)) {
    rulesByYear[year] = await getRentalSpecificRules(
      Array.from(rentalObjects),
      year
    )
  }

  for (const rentalLoss of rentalLosses) {
    const year = rentalLossYear(rentalLoss)
    const rule = rulesByYear[year]?.[rentalLoss.rentalObject]

    if (!rule || Object.keys(rule).length === 0) {
      logger.error(
        { rentalObject: rentalLoss.rentalObject, year },
        'Could not get accounting rules for rental loss from Xpand'
      )
      errors.push({
        rentalObject: rentalLoss.rentalObject,
        error: `Kunde inte hitta konteringsregler för hyresobjektet ${rentalLoss.rentalObject} (${year}), hyresbortfallet konteras utan kostnadsställe och fastighet från Xpand`,
      })
      // Keep the rental loss so it is still accounted, with only the
      // accounting from the article (or rental block).
      enrichedRentalLosses.push(rentalLoss)
      continue
    }

    enrichedRentalLosses.push({
      ...rentalLoss,
      rentalLossRows: rentalLoss.rentalLossRows.map((row) => ({
        ...row,
        incomeCostCode: row.incomeCostCode ?? rule.costCode,
        incomeProperty: row.incomeProperty ?? rule.property,
        incomeProjectCode: row.incomeProjectCode ?? rule.projectCode,
        incomeFreeCode: row.incomeFreeCode ?? rule.freeCode,
        costCostCode: row.costCostCode ?? rule.costCode,
        costProperty: row.costProperty ?? rule.property,
        costProjectCode: row.costProjectCode ?? rule.projectCode,
        costFreeCode: row.costFreeCode ?? rule.freeCode,
      })),
    })
  }

  return { rentalLosses: enrichedRentalLosses, errors }
}

// RentalLoss.month is "YYYY-MM"
const rentalLossYear = (rentalLoss: RentalLoss): string =>
  rentalLoss.month.substring(0, 4)

// Rental loss block accounts (308x) and the income accounts they apply to:
// 3081, 3086 and 3089 for housing rent, 3087 for parking.
const RENTAL_LOSS_BLOCK_ACCOUNTS: Record<string, number[]> = {
  '3081': [3011],
  '3086': [3011],
  '3087': [3015],
  '3089': [3011],
}

// Whether a rental block replaces the cost side of a rental loss row. This
// follows the rental loss accounting of the old system (Xpand):
// - Rows booked on the same account on both sides (e.g. 2420, 2883) keep it.
// - A rental loss block account (308x) applies only to the rent it is meant
//   for (RENTAL_LOSS_BLOCK_ACCOUNTS). Other rent keeps the article's account.
// - Other block accounts, e.g. 1182 for projects, apply to all rent.
const blockAccountApplies = (
  row: RentalLossRow,
  block: RentalBlockWithAccounting
): boolean => {
  if (row.incomeAccount === row.costAccount) return false

  const incomeAccounts = RENTAL_LOSS_BLOCK_ACCOUNTS[block.account]
  if (incomeAccounts) return incomeAccounts.includes(row.incomeAccount)

  return !block.account.startsWith('308')
}

export const handleRentalBlocks = async (rentalLosses: RentalLoss[]) => {
  const rentalLossesWithBlocks: RentalLoss[] = []

  for (const rentalLoss of rentalLosses) {
    // 1. check for active block
    // 2. get accounting for active block - if exists, replace rental loss row (fully or partially based on date ranges) with block accounting
    const rentalBlocks = await getActiveRentalBlocksWithAccounting(
      rentalLoss.rentalObject,
      rentalLoss.uncontractedInterval.from,
      rentalLoss.uncontractedInterval.to
    )

    if (!rentalBlocks || rentalBlocks.length === 0) {
      rentalLossesWithBlocks.push(rentalLoss)
      continue
    }

    // Earliest block wins on overlaps. Stable by fromDate, then description.
    const orderedBlocks = [...rentalBlocks].sort((a, b) => {
      const fromDelta = a.fromDate.getTime() - b.fromDate.getTime()
      return fromDelta !== 0
        ? fromDelta
        : a.description.localeCompare(b.description)
    })

    const lossInterval = rentalLoss.uncontractedInterval
    const lossTotalDays = daysInclusive(lossInterval.from, lossInterval.to)
    if (lossTotalDays <= 0) {
      rentalLossesWithBlocks.push(rentalLoss)
      continue
    }

    // Build the distinct sub-intervals. Iterate blocks in priority order; for each
    // as-yet-uncovered portion of [lossFrom, lossTo] that a block intersects,
    // emit a block-covered interval. Gaps between blocks remain as plain loss.
    //
    // All interval math is performed on start-of-day UTC timestamps so splits
    // land on midnight boundaries regardless of any time component on the
    // source dates.
    const startOfDay = (d: Date) => {
      const u = new Date(d.getTime())
      u.setUTCHours(0, 0, 0, 0)
      return u
    }
    const DAY_MS = 24 * 60 * 60 * 1000
    const lossStart = startOfDay(lossInterval.from).getTime()
    const lossEnd = startOfDay(lossInterval.to).getTime()

    const blockIntervals: {
      from: Date
      to: Date
      block: RentalBlockWithAccounting
    }[] = []
    const uncovered: { from: Date; to: Date }[] = [
      { from: new Date(lossStart), to: new Date(lossEnd) },
    ]

    for (const block of orderedBlocks) {
      if (uncovered.length === 0) break
      const blockFrom = startOfDay(block.fromDate).getTime()
      // Open-ended blocks (null toDate) extend to the end of the loss interval.
      const blockTo = startOfDay(block.toDate ?? lossInterval.to).getTime()
      if (blockTo < lossStart || blockFrom > lossEnd) continue

      const stillUncovered: { from: Date; to: Date }[] = []
      for (const piece of uncovered) {
        const pieceFrom = piece.from.getTime()
        const pieceTo = piece.to.getTime()
        if (blockTo < pieceFrom || blockFrom > pieceTo) {
          stillUncovered.push(piece)
          continue
        }
        const overlapFrom = Math.max(pieceFrom, blockFrom)
        const overlapTo = Math.min(pieceTo, blockTo)
        blockIntervals.push({
          from: new Date(overlapFrom),
          to: new Date(overlapTo),
          block,
        })
        if (pieceFrom < overlapFrom) {
          stillUncovered.push({
            from: piece.from,
            to: new Date(overlapFrom - DAY_MS),
          })
        }
        if (pieceTo > overlapTo) {
          stillUncovered.push({
            from: new Date(overlapTo + DAY_MS),
            to: piece.to,
          })
        }
      }
      uncovered.length = 0
      uncovered.push(...stillUncovered)
    }

    // Merge contiguous block intervals that share the same block, so we don't
    // produce redundant rows when one block covers a fragmented range.
    const mergedBlockIntervals = mergeContiguousBlockIntervals(blockIntervals)

    // The chronological segments the original rows are split across: block
    // intervals carry the block's cost-side accounting, gaps keep the original.
    const segments: {
      from: Date
      to: Date
      block?: RentalBlockWithAccounting
    }[] = [...mergedBlockIntervals, ...uncovered].sort(
      (a, b) => a.from.getTime() - b.from.getTime()
    )

    // Build the new set of rental loss rows, one per original row and segment.
    const newRows: RentalLossRow[] = []
    for (const row of rentalLoss.rentalLossRows) {
      // A single whole-period gap with no blocks just clones the original row
      // (no proration) so the no-op case is byte-identical to the input.
      if (mergedBlockIntervals.length === 0) {
        newRows.push({ ...row })
        continue
      }

      // A rent row valid during only part of the loss interval carries its
      // own dates. Split it within those dates, and prorate by its own days.
      const rowFrom = Math.max(
        startOfDay(row.fromDate ?? lossInterval.from).getTime(),
        lossStart
      )
      const rowTo = Math.min(
        startOfDay(row.toDate ?? lossInterval.to).getTime(),
        lossEnd
      )
      const rowTotalDays = daysInclusive(new Date(rowFrom), new Date(rowTo))
      if (rowTotalDays <= 0) {
        newRows.push({ ...row })
        continue
      }

      const rowSegments = segments
        .map((segment) => ({
          ...segment,
          from: new Date(Math.max(segment.from.getTime(), rowFrom)),
          to: new Date(Math.min(segment.to.getTime(), rowTo)),
        }))
        .filter((segment) => segment.from.getTime() <= segment.to.getTime())

      const splitRows = rowSegments.map((segment): RentalLossRow => {
        const factor = daysInclusive(segment.from, segment.to) / rowTotalDays
        const splitRow: RentalLossRow = {
          ...row,
          amount: roundCurrency(row.amount * factor),
          totalAmount: roundCurrency(row.totalAmount * factor),
          fromDate: segment.from,
          toDate: segment.to,
        }

        if (!segment.block) return splitRow

        const block = segment.block

        // A row keeping its own account only gets the block's free code,
        // and only if it has none of its own.
        if (!blockAccountApplies(row, block)) {
          return {
            ...splitRow,
            costFreeCode: row.costFreeCode || block.freeCode,
            isBlock: true,
          }
        }

        return {
          ...splitRow,
          costAccount: Number(block.account),
          costProjectCode: block.projectCode || row.costProjectCode,
          costProperty: block.property || row.costProperty,
          costFreeCode: block.freeCode || row.costFreeCode,
          costCostCode: block.costCode || row.costCostCode,
          isBlock: true,
        }
      })

      // Each segment is prorated and rounded independently, so the parts can
      // miss the original row by a few öre. The chronologically last segment
      // absorbs the residual, making the splits sum back to the original.
      const lastRow = splitRows[splitRows.length - 1]
      if (lastRow) {
        const amountSum = splitRows.reduce((sum, r) => sum + r.amount, 0)
        const totalAmountSum = splitRows.reduce(
          (sum, r) => sum + r.totalAmount,
          0
        )
        lastRow.amount = roundCurrency(
          lastRow.amount + (row.amount - amountSum)
        )
        lastRow.totalAmount = roundCurrency(
          lastRow.totalAmount + (row.totalAmount - totalAmountSum)
        )
      }

      newRows.push(...splitRows)
    }

    rentalLossesWithBlocks.push({
      ...rentalLoss,
      rentalLossRows: newRows,
    })
  }

  return rentalLossesWithBlocks
}

// Number of days in a closed date interval [from, to] (inclusive on both ends).
// Days are counted at the millisecond boundary, so [2026-07-01, 2026-07-31] = 31.
const daysInclusive = (from: Date, to: Date): number => {
  const ms = to.getTime() - from.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

const datesAreContiguous = (a: Date, b: Date): boolean => {
  // a ends the day before b starts: a.to = 2026-07-10 -> b.from = 2026-07-11
  return a.getTime() + 24 * 60 * 60 * 1000 === b.getTime()
}

const mergeContiguousBlockIntervals = (
  intervals: { from: Date; to: Date; block: RentalBlockWithAccounting }[]
): { from: Date; to: Date; block: RentalBlockWithAccounting }[] => {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort(
    (a, b) => a.from.getTime() - b.from.getTime()
  )
  const merged: { from: Date; to: Date; block: RentalBlockWithAccounting }[] = [
    sorted[0],
  ]
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = sorted[i]
    if (
      curr.block === prev.block &&
      (datesAreContiguous(prev.to, curr.from) ||
        prev.to.getTime() === curr.from.getTime())
    ) {
      prev.to = new Date(Math.max(prev.to.getTime(), curr.to.getTime()))
    } else {
      merged.push(curr)
    }
  }
  return merged
}
//#endregion

export const uploadCsvFiles = async (
  companyId: string,
  aggregateAccountingCsv: string[],
  ledgerAccountingCsv: string[]
) => {
  const company = config.companies.find(
    (company) => company.xpandId.localeCompare(companyId) === 0
  )

  if (!company) {
    logger.error({ companyId }, 'Could not find company')
    throw new Error('Could not find company ' + companyId)
  }

  const aggregateFilename = `${company.xpandId}/GL-HYRESAVISERING_-${Date.now()}-${company.xpandId}-aggregated.gl.csv`
  await uploadFileToXledger(
    aggregateFilename,
    aggregateAccountingCsv.join('\n')
  )

  const ledgerFilename = `${company.xpandId}/GL-HYRESAVISERING_${Date.now()}-${company.xpandId}-ledger.gl.csv`
  try {
    await uploadFileToXledger(ledgerFilename, ledgerAccountingCsv.join('\n'))
  } catch (err: unknown) {
    // The aggregate file is already in Xledger, so a retry would post it
    // twice. Report which file got through so it can be handled manually.
    throw new PartialCsvUploadError([aggregateFilename], err)
  }
}

export class PartialCsvUploadError extends Error {
  readonly code = 'partial-upload'

  constructor(
    readonly uploadedFiles: string[],
    cause: unknown
  ) {
    super('Only some accounting files were uploaded to Xledger', { cause })
    this.name = 'PartialCsvUploadError'
  }
}

export const uploadRentalLossCsvFile = async (
  companyId: string,
  rentalLossAccountingCsv: string[]
) => {
  const company = config.companies.find(
    (company) => company.xpandId.localeCompare(companyId) === 0
  )

  if (!company) {
    logger.error({ companyId }, 'Could not find company')
    throw new Error('Could not find company ' + companyId)
  }

  const aggregateFilename = `${company.xpandId}/GL-HYRESAVISERING_${Date.now()}-${company.xpandId}-rental-loss.gl.csv`
  await uploadFileToXledger(
    aggregateFilename,
    rentalLossAccountingCsv.join('\n')
  )
}
