import { getContacts as getInvoiceContacts } from './adapters/invoice-data-db-adapter'
import {
  getAllInvoicePaymentEvents,
  getInvoiceByInvoiceNumber,
  getInvoicesByContactCode as getXledgerInvoicesByContactCode,
  transformContact,
  updateInvoiceDeferralDate,
  uploadFile as uploadFileToXledger,
} from '../common/adapters/xledger-adapter'
import { economy, Invoice, InvoiceRow, PaymentStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'
import {
  getInvoiceRows,
  getPropertyCodeAndCostCentreForLease,
} from '../common/adapters/xpand-db-adapter'
import {
  extractLeaseIdsFromInvoiceRows,
  getRentalIdFromLeaseId,
} from '../common/helpers'
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
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { postChannelLookup } from './adapters/stralfors/stralfors-adapter'

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

export const getInvoicesByContactCode = async (
  contactCode: string,
  filters?: { from?: Date }
) => {
  const xledgerInvoices =
    (await getXledgerInvoicesByContactCode(contactCode, {
      from: filters?.from,
    })) ?? []
  const tenfastInvoices = await getTenfastInvoicesByContactCode(contactCode, {
    from: filters?.from,
  })

  const xledgerInvoiceIds = xledgerInvoices.map(
    (parsed) => parsed.invoice.invoiceId
  )

  const regularInvoices: typeof xledgerInvoices = []
  const losses: typeof xledgerInvoices = []

  xledgerInvoices.forEach((parsed) => {
    // A loss is recorded as a transaction on account 1529
    if (parsed.invoice.accountCode === '1529') {
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

  // If invoice exists in tenfast, use period (fromDate, toDate) from tenfast invoice
  // Otherwise use period from xledger invoice
  return regularInvoices
    .map((parsed) => {
      const tenfastInvoice = tenfastInvoices.find(
        (invoice) => invoice.invoice.invoiceId === parsed.invoice.invoiceId
      )

      const invoice = {
        ...parsed.invoice,
        ...(tenfastInvoice?.invoice.fromDate &&
          tenfastInvoice.invoice.toDate && {
            fromDate: tenfastInvoice.invoice.fromDate,
            toDate: tenfastInvoice.invoice.toDate,
          }),
        ...(tenfastInvoice && {
          invoiceRows: tenfastInvoice.invoice.invoiceRows,
        }),
      }

      return withInvoiceDeferral(invoice, {
        defermentEndDate: parsed.defermentEndDate,
        tenfastDeferral: tenfastInvoice?.tenfastDeferral,
      })
    })
    .concat(
      tenfastInvoices
        .filter(
          (parsed) => !xledgerInvoiceIds.includes(parsed.invoice.invoiceId)
        )
        .map((parsed) =>
          withInvoiceDeferral(parsed.invoice, {
            tenfastDeferral: parsed.tenfastDeferral,
          })
        )
    )
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
