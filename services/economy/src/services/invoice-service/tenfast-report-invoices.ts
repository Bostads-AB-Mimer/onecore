import { RentInvoiceRow } from '@onecore/types'
import { logger, runWithConcurrency } from '@onecore/utilities'
import {
  fetchTenfastInvoiceByOcr,
  getArticleCodesById,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { TenfastInvoice } from '@src/common/adapters/tenfast/schemas'
import {
  getLatestCostCentreYear,
  getPropertyCodeAndCostCentreForLease,
} from '../common/adapters/xpand-db-adapter'

// The reports send up to 500 invoices per request; this keeps the load on
// Tenfast and Xpand down.
const CONCURRENCY = 10

/** A Tenfast invoice with the OCR number it was looked up by (its invoice number in Xledger). */
export type TenfastReportInvoice = { ocr: string; invoice: TenfastInvoice }

/**
 * Invoices made by Tenfast are not in Xpand. The unpaid-invoice and Bosociala
 * reports look those up here instead, by OCR number, which is the invoice
 * number in Xledger.
 *
 * An invoice that isn't in Tenfast either is left out, the same way an invoice
 * without rows in Xpand is. One that fails the schema is logged and left out,
 * so it doesn't stop the whole report. Any other error is thrown.
 */
export const getTenfastInvoicesByOcr = async (
  ocrNumbers: string[]
): Promise<TenfastReportInvoice[]> => {
  const results = await runWithConcurrency(
    ocrNumbers,
    async (ocr) => ({ ocr, result: await fetchTenfastInvoiceByOcr(ocr) }),
    CONCURRENCY
  )

  return results.flatMap(({ ocr, result }) => {
    if (result.ok) return [{ ocr, invoice: result.data }]
    if (result.err === 'not-found') {
      logger.warn(
        { ocr },
        'Invoice for report found in neither Xpand nor Tenfast'
      )
      return []
    }
    if (result.err === 'schema-error') {
      logger.error({ ocr }, 'Tenfast invoice for report failed the schema')
      return []
    }
    throw new Error(`Could not fetch Tenfast invoice ${ocr} for report`)
  })
}

const roundToOre = (amount: number) => Math.round(amount * 100) / 100

/**
 * Tenfast rows in the same shape as Xpand's. Tenfast's amount excludes VAT and
 * its vat is the rate (0.25), while Xpand's vat is an amount, so the VAT is
 * worked out here. Tenfast has no reduction on a row.
 *
 * Throws if an article's code can't be looked up: the unpaid-invoice report
 * picks rows by code, so a row without one would quietly drop the invoice.
 */
export const toRentInvoiceRows = async (
  invoices: TenfastReportInvoice[]
): Promise<RentInvoiceRow[]> => {
  const codeById = await getArticleCodesById(
    invoices.flatMap(({ invoice }) =>
      invoice.hyror.flatMap((row) => (row.article ? [row.article] : []))
    )
  )

  return invoices.flatMap(({ ocr, invoice }) =>
    invoice.hyror.map((row): RentInvoiceRow => {
      const code = row.article ? codeById.get(row.article) : null
      if (code === undefined) {
        throw new Error(
          `Could not look up article ${row.article} on Tenfast invoice ${ocr} for report`
        )
      }
      return {
        invoiceNumber: ocr,
        text: row.label ?? '',
        amount: row.amount,
        reduction: 0,
        vat: roundToOre(row.amount * row.vat),
        type: 'Rent',
        // Xpand names the home insurance row this way; keep the reports alike
        rentType: code === 'HEMFÖR' ? 'Hemförsäkring' : null,
        code,
        rowType: 0,
        printGroup: row.consolidationLabel ?? null,
        // Some rows, e.g. the invoice fee, have no period of their own
        fromDate: new Date(row.from ?? invoice.interval.from),
        toDate: new Date(row.to ?? invoice.interval.to),
      }
    })
  )
}

/**
 * Leases and cost centres for Bosociala. The housing lease comes first, since
 * the report shows the first one: a rental object with a skvNummer
 * (Skatteverket's apartment number) is housing. Otherwise Tenfast's order is
 * kept, and Tenfast already puts the main lease first.
 * The cost centre is the one for the latest year Xpand has: buildings rarely
 * change cost centre, and Xpand may get no rows for the years after the move
 * to Tenfast. The year is looked up once, since a lookup without a year is
 * too slow.
 */
export const toLeaseDetails = async (invoices: TenfastReportInvoice[]) => {
  const rentalIds = [
    ...new Set(
      invoices.flatMap(({ invoice }) =>
        invoice.avtal.map((lease) => lease.hyresobjekt[0].externalId)
      )
    ),
  ]
  const year = rentalIds.length > 0 ? await getLatestCostCentreYear() : null
  const costCentres = await runWithConcurrency(
    rentalIds,
    async (rentalId) =>
      (await getPropertyCodeAndCostCentreForLease(rentalId, year ?? undefined))
        ?.costCentre ?? null,
    CONCURRENCY
  )
  const costCentreByRentalId = new Map(
    rentalIds.map((rentalId, i) => [rentalId, costCentres[i]])
  )

  return invoices.map(({ ocr, invoice }) => ({
    invoiceId: ocr,
    details: [...invoice.avtal]
      .sort((a, b) => Number(!hasSkvNummer(a)) - Number(!hasSkvNummer(b)))
      .map((lease) => ({
        leaseId: lease.externalId,
        costCentre:
          costCentreByRentalId.get(lease.hyresobjekt[0].externalId) ?? null,
      })),
  }))
}

const hasSkvNummer = (lease: TenfastInvoice['avtal'][number]) =>
  lease.hyresobjekt.some((rentalObject) => rentalObject.skvNummer != null)
