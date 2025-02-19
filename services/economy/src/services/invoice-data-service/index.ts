import KoaRouter from '@koa/router'
import { enrichInvoiceRows } from './adapters/xpand-db-adapter'
import {
  getInvoiceRows,
  saveInvoiceRows,
  markInvoiceRowsAsImported,
  saveContacts,
  createBatch,
  getContacts,
  getContracts,
} from './adapters/invoice-data-db-adapter'
import { InvoiceDataRow } from './types'
import {
  syncContact,
  updateCustomerInvoiceData,
} from './adapters/xledger-adapter'
import { logger } from 'onecore-utilities'

/**
 * Parses excel file and enriches each row with accounting data from Xpand. Saves each
 * enriched row to invoice_data in economy db.
 *
 * @param invoiceDataRows Array of invoice rows from Xpand
 * @returns Array of contact codes referred to in uploaded invoice data
 */
const processInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string
): Promise<string[]> => {
  const addedContactCodes: Record<string, boolean> = {}

  const enrichedInvoiceRows = await enrichInvoiceRows(invoiceDataRows)

  invoiceDataRows.forEach((row) => {
    addedContactCodes[row.contactCode] = true
  })

  await saveInvoiceRows(enrichedInvoiceRows, batchId)

  return Object.keys(addedContactCodes)
}

export const routes = (router: KoaRouter) => {
  router.post('(.*)/invoice-data/enrich-invoice-data-rows', async (ctx) => {
    console.log('process-excel')
    const contactCodes: string[] = []

    try {
      const invoiceDataRows = ctx.request.body['invoiceDataRows']
      const batchId = ctx.request.body['batchId']

      contactCodes.push(...(await processInvoiceRows(invoiceDataRows, batchId)))

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

  router.post('(.*)/invoice-data/create-batch', async (ctx) => {
    try {
      const batchId = await createBatch()

      ctx.status = 200
      ctx.body = batchId
    } catch (error: any) {
      console.error('Error', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/save-contacts', async (ctx) => {
    console.log('save-contacts')

    try {
      const contacts = ctx.request.body['contacts']
      const batchId = ctx.request.body['batchId']

      await saveContacts(contacts, batchId)

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

  router.post('(.*)/invoice-data/update-contacts', async (ctx) => {
    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    console.log('save-contacts')

    try {
      const batchId = ctx.request.body['batchId']

      const contacts = await getContacts(batchId)

      for (const contact of contacts) {
        await syncContact(contact)
        await sleep(200)
      }

      ctx.status = 200
      ctx.body = { result: true }
    } catch (error: any) {
      logger.error(error, 'Error updating contacts')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/update-invoices', async (ctx) => {
    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    console.log('update-invoices')

    try {
      const batchId = ctx.request.body['batchId']

      // Get aggregated rows for account/projectCode/costCode combos

      // Get rows for a specific contract
      const contractCodes = await getContracts(batchId)

      for (const contractCode of contractCodes) {
        const contractInvoiceRows = await getInvoiceRows(
          contractCode as string,
          batchId
        )
        await updateCustomerInvoiceData(contractInvoiceRows, batchId)
        await markInvoiceRowsAsImported(contractInvoiceRows, batchId)
        await sleep(100)
      }

      ctx.status = 200
      ctx.body = { result: true }
    } catch (error: any) {
      logger.error(error, 'Error updating invoices')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
