import KoaRouter from '@koa/router'
import { enrichInvoiceRows } from './adapters/xpand-db-adapter'
import {
  saveInvoiceRows,
  saveContacts,
} from './adapters/invoice-data-db-adapter'
import { InvoiceDataRow } from './types'
import { Contact } from 'onecore-types'

/**
 * Parses excel file and enriches each row with accounting data from Xpand. Saves each
 * enriched row to invoice_data in economy db.
 *
 * @param invoiceDataRows Array of invoice rows from Xpand
 * @returns Array of contact codes referred to in uploaded invoice data
 */
const processInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[]
): Promise<string[]> => {
  const addedContactCodes: Record<string, boolean> = {}

  const enrichedInvoiceRows = await enrichInvoiceRows(invoiceDataRows)

  invoiceDataRows.forEach((row) => {
    addedContactCodes[row.contactCode] = true
  })

  await saveInvoiceRows(enrichedInvoiceRows)

  return Object.keys(addedContactCodes)
}

export const routes = (router: KoaRouter) => {
  router.post('(.*)/invoice-data/enrich-invoice-data-rows', async (ctx) => {
    console.log('process-excel')
    const contactCodes: string[] = []

    try {
      const invoiceDataRows = ctx.request.body['invoiceDataRows']

      contactCodes.push(...(await processInvoiceRows(invoiceDataRows)))

      ctx.status = 200
      ctx.body = contactCodes
    } catch (error: any) {
      console.error('Error', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/update-contacts', async (ctx) => {
    console.log('process-excel')

    try {
      const contacts = ctx.request.body['contacts']

      await saveContacts(contacts)

      ctx.status = 200
      ctx.body = { result: true }
    } catch (error: any) {
      console.error('Error', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
