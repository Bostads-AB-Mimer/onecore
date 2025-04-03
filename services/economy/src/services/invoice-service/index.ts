import KoaRouter from '@koa/router'
import { getInvoicesByContactCode } from './adapters/xledger-adapter'
import {
  saveContacts,
  createBatch,
  getContacts,
} from './adapters/invoice-data-db-adapter'
import { syncContact, transformContact } from './adapters/xledger-adapter'
import { generateRouteMetadata, logger } from 'onecore-utilities'
import {
  createAggregateRows,
  createLedgerRows,
  processInvoiceRows,
} from './service'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/invoices/bycontactcode/:contactCode', async (ctx) => {
    const contactCode = ctx.params.contactCode
    try {
      const result = await getInvoicesByContactCode(contactCode)
      ctx.status = 200
      ctx.body = result
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/enrich-invoice-data-rows', async (ctx) => {
    console.log('enrich-invoice-data-rows')

    try {
      const invoiceDataRows = ctx.request.body['invoiceDataRows']
      const batchId = ctx.request.body['batchId']
      const invoiceDate = ctx.request.body['invoiceDate']
      const invoiceDueDate = ctx.request.body['invoiceDueDate']

      const contactCodes = await processInvoiceRows(
        invoiceDataRows,
        batchId,
        invoiceDate,
        invoiceDueDate
      )

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

  router.post('(.*)/invoice-data/batches', async (ctx) => {
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
    const metadata = generateRouteMetadata(ctx)

    try {
      const contacts = ctx.request.body['contacts']
      const batchId = ctx.request.body['batchId']

      const result = await saveContacts(contacts, batchId)

      ctx.status = 200
      ctx.body = { content: result.ok ? result.data : {}, ...metadata }
    } catch (error: any) {
      logger.error(error, 'Error saving contacts to invoice data database')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/update-contacts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    console.log('update-contacts')

    try {
      const batchId = ctx.request.body['batchId']

      const contacts = await getContacts(batchId)

      const errors: string[] = []
      let successfulContacts = 0
      let failedContacts = 0

      for (const contact of contacts) {
        const result = await syncContact(contact)
        if (!result.ok) {
          errors.push('Error syncing contact: ' + result.err)
          failedContacts++
        } else {
          successfulContacts++
        }
        await sleep(200)
      }

      ctx.status = 200
      ctx.body = {
        content: { successfulContacts, failedContacts, errors },
        ...metadata,
      }
    } catch (error: any) {
      logger.error(error, 'Error updating contacts')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.get('(.*)/invoice-data/batches/:batchId/contacts', async (ctx) => {
    console.log('get contacts', ctx.params.batchId)
    const metadata = generateRouteMetadata(ctx)

    const contacts = await getContacts(ctx.params.batchId)
    const xledgerContacts = contacts.map(transformContact)

    ctx.status = 200
    ctx.body = {
      content: xledgerContacts,
      metadata,
    }
  })

  router.get(
    '(.*)/invoice-data/batches/:batchId/aggregated-rows',
    async (ctx) => {
      ctx.request.socket.setTimeout(0)
      const metadata = generateRouteMetadata(ctx)

      console.log('get-aggregated-rows')

      try {
        const batchId = ctx.params.batchId
        const transactionRows = await createAggregateRows(batchId)

        ctx.status = 200
        ctx.body = {
          content: transactionRows,
          ...metadata,
        }
      } catch (error: any) {
        logger.error(error, 'Error getting invoice transaction rows')
        ctx.status = 500
        ctx.body = {
          message: error.message,
        }
      }
    }
  )

  router.get('(.*)/invoice-data/batches/:batchId/ledger-rows', async (ctx) => {
    ctx.request.socket.setTimeout(0)
    const metadata = generateRouteMetadata(ctx)

    console.log('get-ledger-rows')

    try {
      const batchId = ctx.params.batchId
      const transactionRows = await createLedgerRows(batchId)

      ctx.status = 200
      ctx.body = {
        content: transactionRows,
        ...metadata,
      }
    } catch (error: any) {
      logger.error(error, 'Error getting invoice transaction rows')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
